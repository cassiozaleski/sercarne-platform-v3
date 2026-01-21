import { google } from 'googleapis';

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}
function isTrue(v) {
  const t = norm(v);
  return t === 'true' || t === '1' || t === 'sim' || t === 'yes' || t === 'y' || t === 'ok';
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function safeJson(req) {
  // Vercel/Node serverless: precisamos ler o body manualmente
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getSheetValues({ spreadsheetId, sheetName }) {
  const clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  let privateKey = getEnv('GOOGLE_PRIVATE_KEY');

  // Vercel geralmente salva \n escapado
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${sheetName}!A:Z`;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  return resp?.data?.values || [];
}

export default async function handler(req, res) {
  try {
    // healthcheck
    if (req.method === 'GET') {
      return json(res, 200, { ok: true, route: '/api/auth' });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const payload = await safeJson(req);

    // ✅ CORREÇÃO: Aceita variações de nomes vindas do front
    // (algumas telas mandam "senha", outras "password"; e "login" ou "usuario")
    const login = payload.login ?? payload.usuario ?? payload.user ?? payload.phone ?? payload.telefone;
    const password = payload.password ?? payload.senha ?? payload.pass;

    if (!login || !password) {
      return json(res, 400, { ok: false, error: 'login e senha (password) são obrigatórios' });
    }

    const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
    const sheetName = getEnv('SHEET_USUARIOS');

    const rows = await getSheetValues({ spreadsheetId, sheetName });
    if (!rows || rows.length < 2) {
      return json(res, 500, { ok: false, error: 'Planilha USUARIOS vazia ou inválida' });
    }

    const header = rows[0] || [];
    const hasHeader = header.some((h) => norm(h).includes('usuario') || norm(h).includes('login'));

    const idx = hasHeader
      ? {
          nome: header.findIndex((h) => norm(h) === 'usuario' || norm(h) === 'nome' || norm(h).includes('usuario')),
          login: header.findIndex((h) => norm(h) === 'login'),
          senha: header.findIndex((h) => norm(h).includes('senha')),
          tipo: header.findIndex((h) => norm(h).includes('tipo')),
          ativo: header.findIndex((h) => norm(h).includes('ativo')),
          home: header.findIndex((h) => norm(h).includes('app') || norm(h).includes('login')),
        }
      : { nome: 0, login: 1, senha: 2, tipo: 3, ativo: 4, home: 5 };

    const wanted = norm(login);
    const wantedDigits = wanted.replace(/\D/g, ''); // só números

    let found = null;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nome = row[idx.nome] ?? '';
      const loginB = row[idx.login] ?? '';
      const senha = row[idx.senha] ?? '';
      const tipo = row[idx.tipo] ?? '';
      const ativo = row[idx.ativo] ?? '';
      const home = row[idx.home] ?? '';

      const nomeNorm = norm(nome);
      const loginNorm = norm(loginB);
      const loginDigits = loginNorm.replace(/\D/g, '');

      // ✅ aceita login por coluna A (nome) OU coluna B (login)
      // ✅ e aceita comparação por dígitos (se o front mandar sem máscara)
      const match =
        nomeNorm === wanted ||
        loginNorm === wanted ||
        (wantedDigits && loginDigits && loginDigits === wantedDigits);

      if (!match) continue;

      if (!isTrue(ativo)) {
        return json(res, 401, { ok: false, error: 'Usuário inativo' });
      }

      // ✅ trim pra evitar espaço invisível na planilha
      if (String(senha).trim() !== String(password).trim()) {
        return json(res, 401, { ok: false, error: 'Senha inválida' });
      }

      found = {
        name: String(nome || loginB || login).trim(),
        login: String(loginB || login).trim(),
        role: String(tipo || '').trim(),
        homePath: String(home || '').trim(),
      };
      break;
    }

    if (!found) {
      return json(res, 401, { ok: false, error: 'Usuário não encontrado' });
    }

    return json(res, 200, { ok: true, user: found });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'Erro interno em /api/auth',
      detail: String(err?.message || err),
    });
  }
}
