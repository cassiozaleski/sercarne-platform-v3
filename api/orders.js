import { getSheetsClient, getSheetConfig, appendRow, getAllRows, batchUpdateValues, json } from './_sheets.js';

function nowIso() {
  return new Date().toISOString();
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function safeJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

async function cleanupExpiredReservations(sheets, spreadsheetId, reservaSheet) {
  const rows = await getAllRows(sheets, spreadsheetId, reservaSheet);
  if (!rows.length) return { cleaned: 0 };

  // Expect header on row 1; data from row 2
  const header = rows[0] || [];
  const idx = {
    status: header.indexOf('status'),
    expiresAt: header.indexOf('expiresAt'),
  };

  // If sheet is empty/no header yet, do nothing
  if (idx.status === -1 || idx.expiresAt === -1) return { cleaned: 0 };

  const updates = [];
  let cleaned = 0;
  const now = new Date();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const status = String(row[idx.status] || '').toUpperCase();
    if (status !== 'RESERVADO') continue;

    const expiresAt = new Date(row[idx.expiresAt]);
    if (isNaN(expiresAt.getTime())) continue;

    if (expiresAt <= now) {
      cleaned++;
      // status column is (idx.status + 1) letter, row is (r+1)
      const col = idx.status + 1;
      updates.push({
        range: `${reservaSheet}!${colToA1(col)}${r + 1}`,
        values: [['CANCELADO']]
      });
    }
  }

  if (updates.length) await batchUpdateValues(sheets, spreadsheetId, updates);
  return { cleaned };
}

async function ensureHeaders(sheets, spreadsheetId, pedidosSheet, reservaSheet) {
  const pedidos = await getAllRows(sheets, spreadsheetId, pedidosSheet);
  const reserva = await getAllRows(sheets, spreadsheetId, reservaSheet);

  const pedidosHeader = pedidos[0] || [];
  const reservaHeader = reserva[0] || [];

  const expectedPedidos = ['orderId','createdAt','deliveryDate','status','origin','clientNome','clientCnpjCpf','clientTelefone','clientEmail','total'];
  const expectedReserva = ['orderId','createdAt','expiresAt','status','deliveryDate','sku','descricao','qty','unidade','clientNome'];

  const needsPedidos = pedidos.length === 0 || String(pedidosHeader[0] || '').toLowerCase() !== 'orderid';
  const needsReserva = reserva.length === 0 || String(reservaHeader[0] || '').toLowerCase() !== 'orderid';

  const updates = [];
  if (needsPedidos) {
    updates.push({ range: `${pedidosSheet}!A1:J1`, values: [expectedPedidos] });
  }
  if (needsReserva) {
    updates.push({ range: `${reservaSheet}!A1:J1`, values: [expectedReserva] });
  }

  if (updates.length) {
    await batchUpdateValues(sheets, spreadsheetId, updates);
  }
}

function colToA1(n) {
  // 1 -> A
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const payload = await safeJson(req);
    const action = (payload.action || 'reserve').toLowerCase();

    const { spreadsheetId, pedidosSheet, reservaSheet } = getSheetConfig();
    const sheets = await getSheetsClient();

    await ensureHeaders(sheets, spreadsheetId, pedidosSheet, reservaSheet);

    // always cleanup expired reservations opportunistically
    await cleanupExpiredReservations(sheets, spreadsheetId, reservaSheet);

    if (action === 'reserve') {
      const order = payload.order || payload;
      const items = order.items || [];
      const client = order.clientData || order.client || {};
      const deliveryDate = order.deliveryDate;

      if (!items.length || !deliveryDate) {
        return json(res, 400, { ok: false, error: 'Pedido inválido: itens e deliveryDate são obrigatórios.' });
      }

      const orderId = `SC-${Date.now()}`;
      const createdAt = nowIso();
      const expiresAt = addHours(new Date(), 2).toISOString();
      const total = order.total ?? null;

      // Write PEDIDOS (one row per order)
      // Columns (suggested header): orderId, createdAt, deliveryDate, status, origin, clientNome, clientCnpjCpf, clientTelefone, clientEmail, total
      await appendRow(sheets, spreadsheetId, pedidosSheet, [
        orderId,
        createdAt,
        deliveryDate,
        'RESERVADO',
        client.origin || order.origin || 'app',
        client.nome || client.name || '',
        client.cnpj || client.cpf || client.cnpjCpf || '',
        client.telefone || client.phone || '',
        client.email || '',
        total !== null ? total : ''
      ]);

      // Write RESERVA (one row per item)
      // Columns (suggested header): orderId, createdAt, expiresAt, status, deliveryDate, sku, descricao, qty, unidade, clientNome
      for (const it of items) {
        const product = it.product || it;
        const sku = String(product.sku || it.sku || '');
        const qty = Number(it.quantity || it.qty || 0);
        if (!sku || qty <= 0) continue;

        const unidade = Number(sku) >= 410000 ? 'CX' : 'UND';
        await appendRow(sheets, spreadsheetId, reservaSheet, [
          orderId,
          createdAt,
          expiresAt,
          'RESERVADO',
          deliveryDate,
          sku,
          product.descricaoPrincipal || product.descricao || product.nome || '',
          qty,
          unidade,
          client.nome || client.name || ''
        ]);
      }

      return json(res, 200, {
        ok: true,
        order: {
          id: orderId,
          createdAt,
          expiresAt,
          deliveryDate,
          status: 'RESERVADO'
        }
      });
    }

    if (action === 'confirm') {
      // Minimal confirm: update PEDIDOS status and RESERVA status by orderId
      const orderId = payload.orderId;
      if (!orderId) return json(res, 400, { ok: false, error: 'orderId é obrigatório' });

      const pedidos = await getAllRows(sheets, spreadsheetId, pedidosSheet);
      const reserva = await getAllRows(sheets, spreadsheetId, reservaSheet);

      const pedidosHeader = pedidos[0] || [];
      const reservaHeader = reserva[0] || [];
      const pedidosIdxId = pedidosHeader.indexOf('orderId');
      const pedidosIdxStatus = pedidosHeader.indexOf('status');
      const reservaIdxId = reservaHeader.indexOf('orderId');
      const reservaIdxStatus = reservaHeader.indexOf('status');

      if (pedidosIdxId === -1 || pedidosIdxStatus === -1 || reservaIdxId === -1 || reservaIdxStatus === -1) {
        return json(res, 400, { ok: false, error: 'Cabeçalho das abas PEDIDOS/RESERVA não está no formato esperado.' });
      }

      const updates = [];

      for (let r = 1; r < pedidos.length; r++) {
        if (String(pedidos[r][pedidosIdxId]) === String(orderId)) {
          updates.push({
            range: `${pedidosSheet}!${colToA1(pedidosIdxStatus + 1)}${r + 1}`,
            values: [['CONFIRMADO']]
          });
        }
      }

      for (let r = 1; r < reserva.length; r++) {
        if (String(reserva[r][reservaIdxId]) === String(orderId)) {
          updates.push({
            range: `${reservaSheet}!${colToA1(reservaIdxStatus + 1)}${r + 1}`,
            values: [['CONFIRMADO']]
          });
        }
      }

      if (updates.length) await batchUpdateValues(sheets, spreadsheetId, updates);
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { ok: false, error: 'Ação inválida. Use action=reserve|confirm' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: err.message || 'Erro interno' });
  }
}
