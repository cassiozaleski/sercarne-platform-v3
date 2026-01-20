import { google } from 'googleapis';

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return (v === undefined || v === null || v === '') ? fallback : v;
}

export function getSheetConfig() {
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  let clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  let privateKeyRaw = getEnv('GOOGLE_PRIVATE_KEY');

  // 🔒 Robustez: alguns setups colam o JSON inteiro do service account ou deixam aspas extras.
  // Aceita:
  // 1) GOOGLE_PRIVATE_KEY contendo somente a PEM
  // 2) GOOGLE_PRIVATE_KEY contendo o JSON completo (com campo private_key)
  // 3) PEM com \n literais OU com quebras de linha reais
  // 4) PEM envolta por aspas simples/duplas
  const trimmed = (privateKeyRaw || '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.private_key) privateKeyRaw = String(parsed.private_key);
      if (parsed?.client_email && !clientEmail) clientEmail = String(parsed.client_email);
    } catch {
      // se não for JSON válido, seguimos com o valor bruto
    }
  }

  let pk = (privateKeyRaw || '').trim();
  if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'"))) {
    pk = pk.slice(1, -1);
  }
  // Se veio com \n literais, converte para newlines reais
  pk = pk.replace(/\\n/g, '\n');
  const privateKey = pk;

  const pedidosSheet = getEnv('SHEET_PEDIDOS', 'PEDIDOS');
  const reservaSheet = getEnv('SHEET_RESERVAS', getEnv('SHEET_RESERVA', 'RESERVAS'));
  const usuariosSheet = getEnv('SHEET_USUARIOS', 'USUARIOS');

  if (!spreadsheetId || !clientEmail || !privateKeyRaw) {
    const missing = [
      !spreadsheetId ? 'GOOGLE_SHEET_ID' : null,
      !clientEmail ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL' : null,
      !privateKeyRaw ? 'GOOGLE_PRIVATE_KEY' : null
    ].filter(Boolean);
    throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }

  return { spreadsheetId, clientEmail, privateKey, pedidosSheet, reservaSheet, usuariosSheet };
}

export async function getSheetsClient() {
  const { clientEmail, privateKey } = getSheetConfig();

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

export async function appendRow(sheets, spreadsheetId, sheetName, values) {
  const range = `${sheetName}!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
  return res.data;
}

export async function getAllRows(sheets, spreadsheetId, sheetName) {
  const range = `${sheetName}!A:Z`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

export async function batchUpdateValues(sheets, spreadsheetId, data) {
  // data: [{ range, values }]
  const res = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
  return res.data;
}

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
