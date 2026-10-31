// ============================================================
// Fonction serveur : social-login — « Continuer avec Google » (31/10/2026)
// Sans clé secrète : Google renvoie ici (POST) un jeton signé (id_token) ;
// on vérifie sa signature avec les clés publiques de Google, l'application
// (aud = notre ID client), l'expiration et le code de la tentative (nonce).
// Le résultat est rangé sous ce code ; l'application (téléphone, site,
// Windows) vient le chercher (« poll »). Une seule fois, 10 minutes au plus.
//  - compte déjà relié (googleSub) ou même e-mail : connexion directe ;
//  - sinon : l'app affiche le formulaire court (numéro + mot de passe),
//    crée le compte normalement puis appelle « link ».
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const GOOGLE_CLIENT_ID = "779026073520-u3sc7onv671k4ruldqc6jruif2ou4k27.apps.googleusercontent.com";
const SITE = "https://sounsouni.pro";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const b64uDec = (s: string) => { const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); const t = atob(b); const o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; };
const b64uEnc = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const SESSION_MS = 30 * 24 * 3600 * 1000;
async function hmacKey() { return crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("SESSION_SECRET") || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function signSession(accountId: string) {
  const now = Date.now();
  const p = b64uEnc(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: now, expiresAt: now + SESSION_MS })));
  return p + "." + b64uEnc(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(p))));
}
async function sessionOf(req: Request) {
  const t = req.headers.get("X-Session-Token"); if (!t) return null;
  const parts = t.split("."); if (parts.length !== 2) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await hmacKey(), b64uDec(parts[1]), new TextEncoder().encode(parts[0])))) return null;
    const p = JSON.parse(new TextDecoder().decode(b64uDec(parts[0])));
    return p && p.purpose === "session" && p.accountId && Date.now() < p.expiresAt ? p : null;
  } catch { return null; }
}
// ---- Vérification du jeton Google ----
let jwksCache: { at: number; keys: any[] } | null = null;
async function googleKeys(force = false) {
  if (!force && jwksCache && Date.now() - jwksCache.at < 3600000) return jwksCache.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs"); const j = await r.json();
  jwksCache = { at: Date.now(), keys: j.keys || [] }; return jwksCache.keys;
}
export async function verifyGoogleIdToken(tok: string, nonce: string, clientId = GOOGLE_CLIENT_ID, keysFn = googleKeys) {
  const parts = String(tok || "").split("."); if (parts.length !== 3) return null;
  const head = JSON.parse(new TextDecoder().decode(b64uDec(parts[0])));
  const body = JSON.parse(new TextDecoder().decode(b64uDec(parts[1])));
  if (head.alg !== "RS256") return null;
  let jwk = (await keysFn()).find((k: any) => k.kid === head.kid);
  if (!jwk) jwk = (await keysFn(true)).find((k: any) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64uDec(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(body.iss)) return null;
  if (body.aud !== clientId || !(body.exp > now - 60) || body.nonce !== nonce || !body.sub) return null;
  return body;
}
const esc = (s: string) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
function page(ok: boolean, loginId: string, mode: string, msg: string) {
  const back = mode === "w" ? `location.replace(${JSON.stringify(SITE + "/?social=" + loginId)});` : "try{window.close()}catch(e){}";
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sounsouni</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f3f6f1;color:#1a1a2e;text-align:center}div{max-width:360px;padding:24px}b{font-size:46px;display:block;margin-bottom:8px}p{font-size:16px;line-height:1.5}</style></head>
<body><div><b>${ok ? "✅" : "❌"}</b><p>${esc(msg)}</p></div><script>setTimeout(function(){${back}},${ok ? 700 : 4000});</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
const norm = (s: unknown) => String(s || "").trim().toLowerCase();
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const getRow = async (id: string) => { const { data } = await db.from("app_data").select("data").eq("collection", "socialLogins").eq("id", id).maybeSingle(); return data ? (data as any).data : null; };
  const putRow = (id: string, d: any) => db.from("app_data").upsert({ collection: "socialLogins", id, data: { id, ...d }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
  try {
    const type = req.headers.get("content-type") || "";
    // ---- Retour de Google (formulaire POST) ----
    if (!type.includes("application/json")) {
      const form = await req.formData().catch(() => null);
      const state = String((form && form.get("state")) || "");
      const m = /^([A-Za-z0-9]{24,64})\.([wpa])$/.exec(state);
      if (!m) return page(false, "", "a", "Lien de connexion invalide. Retournez dans Sounsouni et réessayez.");
      const loginId = m[1], mode = m[2];
      if (form && form.get("error")) return page(false, loginId, mode, "Connexion annulée. Retournez dans Sounsouni.");
      const claims = await verifyGoogleIdToken(String(form && form.get("id_token") || ""), loginId);
      if (!claims) return page(false, loginId, mode, "Google n'a pas pu confirmer votre compte. Retournez dans Sounsouni et réessayez.");
      const prev = await getRow("g_" + loginId);
      if (prev) return page(true, loginId, mode, "Connexion réussie. Retournez dans Sounsouni.");
      const email = claims.email_verified ? norm(claims.email) : "";
      // Compte déjà relié à ce compte Google, sinon même e-mail (un seul compte, non banni).
      let acc: any = null;
      const { data: bySub } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>googleSub", String(claims.sub)).limit(2);
      if (bySub && bySub.length) acc = (bySub[0] as any).data;
      if (!acc && email) {
        const { data: byMail } = await db.from("app_data").select("data").eq("collection", "accounts").ilike("data->>email", email).limit(3);
        const list = (byMail || []).map((r: any) => r.data).filter((a: any) => a && norm(a.email) === email && !/^(admin_|national_admin_)/.test(String(a.id)));
        if (list.length === 1) acc = list[0];
      }
      const base = { at: Date.now(), sub: String(claims.sub), email, name: String(claims.name || "").slice(0, 80), picture: String(claims.picture || "").slice(0, 500) };
      if (acc && !acc.banned) {
        if (acc.googleSub !== String(claims.sub)) {
          await db.rpc("sns_doc_patch", { p_collection: "accounts", p_id: acc.id, p_patch: { googleSub: String(claims.sub), email: acc.email || email || null }, p_expect: null });
        }
        await putRow("g_" + loginId, { ...base, status: "login", accountId: acc.id });
      } else if (acc && acc.banned) {
        await putRow("g_" + loginId, { ...base, status: "banned" });
      } else {
        await putRow("g_" + loginId, { ...base, status: "new" });
      }
      return page(true, loginId, mode, "Connexion réussie. Retournez dans Sounsouni.");
    }
    // ---- Demandes de l'application ----
    const body = await req.json().catch(() => ({}));
    const op = String(body.operation || "");
    const loginId = String(body.loginId || "");
    if (!/^[A-Za-z0-9]{24,64}$/.test(loginId)) return json({ success: false, error: "bad_login_id" }, 400);
    const row = await getRow("g_" + loginId);
    if (op === "poll") {
      if (!row) return json({ success: true, status: "pending" });
      if (Date.now() - Number(row.at) > 10 * 60000) return json({ success: false, error: "expired" }, 410);
      if (row.status === "login") {
        if (row.used) return json({ success: false, error: "already_used" }, 409);
        await putRow("g_" + loginId, { ...row, used: Date.now() });
        const { data: a } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", row.accountId).maybeSingle();
        const account = a ? (a as any).data : null;
        if (!account || account.banned) return json({ success: false, error: "account_not_found" }, 404);
        return json({ success: true, status: "login", accountId: account.id, sessionToken: await signSession(account.id), account });
      }
      return json({ success: true, status: row.status, name: row.name, email: row.email, picture: row.picture });
    }
    if (op === "link") {
      // Après la création du compte (formulaire court) : on relie le compte Google.
      const s = await sessionOf(req);
      if (!s) return json({ success: false, error: "session_required" }, 401);
      if (!row || row.status !== "new" || Date.now() - Number(row.at) > 30 * 60000) return json({ success: false, error: "expired" }, 410);
      const { data: taken } = await db.from("app_data").select("id").eq("collection", "accounts").eq("data->>googleSub", row.sub).limit(1);
      if (taken && taken.length) return json({ success: false, error: "already_linked" }, 409);
      const { data: a } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", s.accountId).maybeSingle();
      const me = a ? (a as any).data : null;
      if (!me) return json({ success: false, error: "account_not_found" }, 404);
      const patch: any = { googleSub: row.sub };
      if (!me.email && row.email) patch.email = row.email;
      if (!me.avatarPhoto && row.picture) patch.avatarPhoto = row.picture;
      await db.rpc("sns_doc_patch", { p_collection: "accounts", p_id: me.id, p_patch: patch, p_expect: null });
      await putRow("g_" + loginId, { ...row, status: "linked", accountId: me.id });
      return json({ success: true, patch });
    }
    return json({ success: false, error: "unknown_operation" }, 400);
  } catch (e) {
    console.error("social-login", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
