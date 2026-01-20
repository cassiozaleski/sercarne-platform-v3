export default async function handler(req, res) {
  // ✅ libera preflight (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ✅ libera GET para teste / health-check
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, method: 'GET', route: '/api/auth' });
  }

  // 🔒 mantém POST como login
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // ... resto do seu código POST (login) aqui
}

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
  // remove acentos básicos e espaços
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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

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

    // Se houver cabeçalho, tenta localizar pelas colunas; senão assume layout fixo (A-F)
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
    let found = null;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nome = row[idx.nome] ?? '';
      const loginB = row[idx.login] ?? '';
      const senha = row[idx.senha] ?? '';
      const ativo = row[idx.ativo] ?? '';

      // aceita login por coluna A (nome) OU coluna B (login)
      const match = (norm(nome) === wanted) || (norm(loginB) === wanted);
      if (!match) continue;

      if (!isTrue(ativo)) {
        return json(res, 401, { ok: false, error: 'Usuário inativo' });
      }

      if (String(senha) !== String(password)) {
        return json(res, 401, { ok: false, error: 'Senha inválida' });
      }

      found = {
        nome: String(nome || loginB || '').trim(),
        login: String(loginB || nome || '').trim(),
        tipo: String(row[idx.tipo] || '').trim(),
        homePath: String(row[idx.home] || '').trim() || '/cliente',
      };
      break;
    }

    if (!found) return json(res, 401, { ok: false, error: 'Usuário não encontrado' });

    const role = slugRole(found.tipo);
    return json(res, 200, {
      ok: true,
      user: {
        name: found.nome,
        login: found.login,
        role,
        tipo: found.tipo,
        homePath: found.homePath,
      }
    });
  } catch (err) {
    console.error(err);
    return json(res, 500, { ok: false, error: err.message || 'Erro interno' });
  }
}
