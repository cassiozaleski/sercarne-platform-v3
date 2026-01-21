import crypto from "crypto";
import { getSheetsClient, getSheetConfig, getAllRows, json } from "./_sheets.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function norm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function digitsOnly(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function isTrue(v) {
  const s = norm(v);
  return s === "true" || s === "verdadeiro" || s === "1" || s === "sim" || s === "s";
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
}

function normalizeRole(tipoRaw) {
  const t = norm(tipoRaw);

  if (t === "admin") return "admin";
  if (t.includes("gestor")) return "gestorcomercial";
  if (t.includes("representante")) return "representantepj";
  if (t.includes("vendedor")) return "vendedor";

  if (t.includes("cliente") && t.includes("b2b")) return "cliente_b2b";
  if (t.includes("cliente") && t.includes("b2c")) return "cliente_b2c";
  if (t.includes("cliente")) return "cliente";

  // fallback
  return t || "public";
}

function normalizeHomePath(role, homeFromSheet) {
  const h = String(homeFromSheet ?? "").trim();
  if (h && h.startsWith("/")) return h;

  // defaults seguros por role
  if (role === "admin") return "/admin";
  if (role === "gestorcomercial") return "/gestorcomercial";
  if (role === "vendedor" || role === "representantepj") return "/vendedor";
  if (role === "cliente_b2b") return "/cliente_b2b";
  if (role === "cliente_b2c") return "/cliente_b2c";
  if (role === "cliente") return "/cliente";

  return "/login";
}

function findHeaderIndexes(headerRow) {
  const header = (headerRow || []).map((h) => norm(h));

  // tenta achar por nome; se não achar, cai no padrão A-F
  const idx = {
    nome: header.findIndex((h) => h === "usuario" || h === "nome" || h.includes("usuario")),
    login: header.findIndex((h) => h === "login"),
    senha: header.findIndex((h) => h.includes("senha")),
    tipo: header.findIndex((h) => h.includes("tipo")),
    ativo: header.findIndex((h) => h.includes("ativo")),
    home: header.findIndex((h) => (h.includes("app") && h.includes("login")) || h.includes("home")),
  };

  const fallback = { nome: 0, login: 1, senha: 2, tipo: 3, ativo: 4, home: 5 };

  // se falhar qualquer coluna crítica, usa fallback
  const critical = ["login", "senha", "tipo", "ativo"];
  for (const k of critical) {
    if (idx[k] < 0) return fallback;
  }

  // nome/home podem não existir, mas se existirem ok
  if (idx.nome < 0) idx.nome = fallback.nome;
  if (idx.home < 0) idx.home = fallback.home;

  return idx;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    // healthcheck /api/auth
    return json(res, 200, { ok: true, route: "/api/auth" });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Método não suportado" });
  }

  let body = req.body;
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (_) {
    // ignora, vamos tratar como vazio
  }

  const login = String(body?.login ?? "").trim();
  const password = String(body?.password ?? "").trim();

  if (!login || !password) {
    return json(res, 400, { ok: false, error: "Informe login e senha" });
  }

  const wanted = norm(login);
  const wantedDigits = digitsOnly(login);

  try {
    const cfg = getSheetConfig();
    const sheets = await getSheetsClient();

    const sheetName = cfg.SHEET_USUARIOS || "USUARIOS";
    const rows = await getAllRows(sheets, cfg.GOOGLE_SHEET_ID, sheetName);

    if (!rows || rows.length < 2) {
      return json(res, 500, { ok: false, error: "Aba USUARIOS vazia ou não encontrada" });
    }

    const idx = findHeaderIndexes(rows[0]);

    let found = null;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];

      const nome = row[idx.nome] ?? "";
      const loginB = row[idx.login] ?? "";

      const nomeNorm = norm(nome);
      const loginNorm = norm(loginB);

      const loginDigits = digitsOnly(loginB);

      const match =
        nomeNorm === wanted ||
        loginNorm === wanted ||
        (wantedDigits && loginDigits && loginDigits === wantedDigits);

      if (!match) continue;

      const ativo = row[idx.ativo] ?? "";
      if (!isTrue(ativo)) {
        return json(res, 401, { ok: false, error: "Usuário inativo" });
      }

      const senhaStored = String(row[idx.senha] ?? "").trim();
      const tipoRaw = row[idx.tipo] ?? "";
      const homeFromSheet = row[idx.home] ?? "";

      // ✅ senha pode ser texto (zaleski9) OU SHA-256 hex (64 chars)
      let passOk = false;
      if (/^[a-f0-9]{64}$/i.test(senhaStored)) {
        passOk = sha256Hex(password) === senhaStored.toLowerCase();
      } else {
        passOk = senhaStored === password;
      }

      if (!passOk) {
        return json(res, 401, { ok: false, error: "Senha inválida" });
      }

      const role = normalizeRole(tipoRaw);
      const homePath = normalizeHomePath(role, homeFromSheet);

      found = {
        name: String(nome ?? "").trim() || "Usuário",
        login: String(loginB ?? "").trim() || login,
        role,
        tipo: String(tipoRaw ?? "").trim(),
        homePath,
      };

      break;
    }

    if (!found) {
      return json(res, 401, { ok: false, error: "Credenciais inválidas" });
    }

    return json(res, 200, { ok: true, user: found });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: "Falha no servidor de autenticação",
      detail: String(err?.message || err),
    });
  }
}
