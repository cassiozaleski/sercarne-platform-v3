import { getSheetsClient, getSheetConfig, getAllRows, batchUpdateValues, json } from './_sheets.js';

function colToA1(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function cleanupExpired(sheets, spreadsheetId, reservaSheet) {
  const rows = await getAllRows(sheets, spreadsheetId, reservaSheet);
  if (!rows.length) return 0;
  const header = rows[0] || [];
  const idxStatus = header.indexOf('status');
  const idxExpires = header.indexOf('expiresAt');
  if (idxStatus === -1 || idxExpires === -1) return 0;

  const now = new Date();
  const updates = [];
  let cleaned = 0;

  for (let r = 1; r < rows.length; r++) {
    const status = String(rows[r][idxStatus] || '').toUpperCase();
    if (status !== 'RESERVADO') continue;
    const expiresAt = new Date(rows[r][idxExpires]);
    if (isNaN(expiresAt.getTime())) continue;
    if (expiresAt <= now) {
      cleaned++;
      updates.push({
        range: `${reservaSheet}!${colToA1(idxStatus + 1)}${r + 1}`,
        values: [['CANCELADO']]
      });
    }
  }

  if (updates.length) await batchUpdateValues(sheets, spreadsheetId, updates);
  return cleaned;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const { spreadsheetId, reservaSheet } = getSheetConfig();
    const sheets = await getSheetsClient();

    await cleanupExpired(sheets, spreadsheetId, reservaSheet);

    const rows = await getAllRows(sheets, spreadsheetId, reservaSheet);
    if (!rows.length) return json(res, 200, { ok: true, reservations: [] });

    const header = rows[0] || [];
    const idx = {
      orderId: header.indexOf('orderId'),
      createdAt: header.indexOf('createdAt'),
      expiresAt: header.indexOf('expiresAt'),
      status: header.indexOf('status'),
      deliveryDate: header.indexOf('deliveryDate'),
      sku: header.indexOf('sku'),
      qty: header.indexOf('qty'),
    };

    const reservations = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const status = String(row[idx.status] || '').toUpperCase();
      if (status !== 'RESERVADO' && status !== 'CONFIRMADO') continue;
      const expiresAt = row[idx.expiresAt] ? new Date(row[idx.expiresAt]) : null;
      if (status === 'RESERVADO' && expiresAt && expiresAt <= new Date()) continue;

      reservations.push({
        orderId: row[idx.orderId],
        createdAt: row[idx.createdAt],
        expiresAt: row[idx.expiresAt],
        status,
        deliveryDate: row[idx.deliveryDate],
        sku: String(row[idx.sku] || ''),
        qty: Number(row[idx.qty] || 0)
      });
    }

    return json(res, 200, { ok: true, reservations });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: err.message || 'Erro interno' });
  }
}
