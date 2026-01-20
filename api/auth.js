import { getSheetsClient, getSheetConfig, getAllRows, json } from './_sheets.js';

function safeJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function slugRole(tipo) {
  const s = norm(tipo);
  if (!s) return 'public';
  const noAccents = s
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c');
  return noAccents.replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
}

function isTrue(v) {
  const s = norm(v);
  return s === 'true' || s === '1' || s === 'sim' || s === 'yes' || s === 'ativo' || s === 'x' || s === '✅';
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);

  // ✅ Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ✅ Health-check
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, route: '/api/auth' });
  }

  // 🔒 Login somente via POST
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const payload = await safeJson(req);
    const login = payload.login;
    const password = payload.password;

    if (!login || !password) {
      return json(res, 400, { ok: false, error: 'login e password são obrigatórios' });
    }

    const { spreadsheetId, usuariosSheet } = getSheetConfig();
    const sheets = await getSheetsClient();
    const rows = await getAllRows(sheets, spreadsheetId, usuariosSheet);

    if (!rows.length) return json(res, 401, { ok: false, error: 'USUARIOS vazio' });

    const header = rows[0] || [];
    const hasHeader = header.some(h => norm(h).includes('usuario') || norm(h).includes('login'));

    const idx = hasHeader ? {
      nome: header.findIndex(h => norm(h) === 'usuario' || norm(h) === 'nome' || norm(h).includes('usuario')),
      login: header.findIndex(h => norm(h) === 'login'),
      senha: header.findIndex(h => norm(h).includes('senha')),
      tipo: header.findIndex(h => norm(h).includes('tipo')),
      ativo: header.findIndex(h => norm(h).includes('ativo')),
      home: header.findIndex(h => norm(h).includes('app') || norm(h).includes('login')),
    } : { nome: 0, login: 1, senha: 2, tipo: 3, ativo: 4, home: 5 };

    const wanted = norm(login);

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nome = row[idx.nome] ?? '';
      const loginB = row[idx.login] ?? '';
      const senha = row[idx.senha] ?? '';
      const ativo = row[idx.ativo] ?? '';

      const match = (norm(nome) === wanted) || (norm(loginB) === wanted);
      if (!match) continue;

      if (!isTrue(ativo)) return json(res, 401, { ok: false, error: 'Usuário inativo' });
      if (String(senha) !== String(password)) return json(res, 401, { ok: false, error: 'Senha inválida' });

      const tipo = String(row[idx.tipo] || '').trim();
      const homePath = (String(row[idx.home] || '').trim() || '/cliente');

      return json(res, 200, {
        ok: true,
        user: {
          name: String(nome || loginB || '').trim(),
          login: String(loginB || nome || '').trim(),
          role: slugRole(tipo),
          tipo,
          homePath,
        }
      });
    }

    return json(res, 401, { ok: false, error: 'Usuário não encontrado' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: err?.message || 'Erro interno' });
  }
}
