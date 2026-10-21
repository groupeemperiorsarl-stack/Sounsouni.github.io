// ============================================================
// Fonction serveur : create-account (version 2026-10-14, sécurité)
// - Vérifie l'unicité du numéro avec les VRAIES données (numéro nettoyé :
//   "+223 93 01..." et "+22393 01..." sont le même numéro).
// - Un 2e compte (vendeur) sur un numéro qui a déjà un compte n'est permis
//   QUE si la personne est connectée sur ce numéro (jeton de session) :
//   sinon, quelqu'un pourrait créer un compte sur le numéro d'un autre et
//   toucher à son portefeuille.
// - Les champs « sensibles » envoyés par le téléphone sont ignorés
//   (vérifié, banni, mot de passe, gains, rôles spéciaux...).
// Version 2026-10-21 (robots) :
// - Limite par adresse IP : 10 comptes par heure et 30 par jour au plus.
// - Champ piège (hp) rempli ou formulaire envoyé en moins de 1,5 s → refusé.
// - Les alertes robots du téléphone (botSignal) sont enregistrées ici,
//   dans securityAlerts (le téléphone n'a pas le droit d'y écrire).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const bad = (reason: string) => json({ success: false, error: reason }, 400);
function toBase64Url(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(s: string): Uint8Array { const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); const str = atob(b); const out = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i); return out; }
async function getKey(): Promise<CryptoKey> { const secret = Deno.env.get("SESSION_SECRET"); if (!secret) throw new Error("SESSION_SECRET manquant"); return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function issueSessionToken(accountId: string): Promise<string> {
  const now = Date.now();
  const p64 = toBase64Url(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000 })));
  const sig = await crypto.subtle.sign("HMAC", await getKey(), new TextEncoder().encode(p64));
  return p64 + "." + toBase64Url(new Uint8Array(sig));
}
async function sessionAccountId(req: Request): Promise<string | null> {
  const t = req.headers.get("X-Session-Token"); if (!t) return null;
  const parts = t.split("."); if (parts.length !== 2) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await getKey(), fromBase64Url(parts[1]), new TextEncoder().encode(parts[0])))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    if (!p.accountId || p.purpose !== "session" || typeof p.expiresAt !== "number" || Date.now() > p.expiresAt) return null;
    return String(p.accountId);
  } catch { return null; }
}
const clientIp = (req: Request) => (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "?").trim().slice(0, 64);
const maskIp = (ip: string) => ip.includes(".") ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip.split(":").slice(0, 3).join(":") + ":…";
async function sha(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
// Compteur par IP (collection loginHistory : lisible et modifiable par le serveur seulement).
async function ipHits(db: any, kind: string, ip: string, windowMs: number) {
  const id = kind + ":" + (await sha(ip));
  const { data: row } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", id).maybeSingle();
  const now = Date.now();
  const hits: number[] = (row && row.data && Array.isArray(row.data.hits) ? row.data.hits : []).filter((t: number) => now - t < windowMs);
  return { hits, add: () => db.from("app_data").upsert({ collection: "loginHistory", id, data: { id, kind, hits: [...hits, now].slice(-200) }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" }) };
}
async function alert(db: any, ip: string, detail: string, type = "formulaire") {
  const id = "alert-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await db.from("app_data").upsert({ collection: "securityAlerts", id, data: { id, at: Date.now(), type, detail: String(detail).slice(0, 200), ip: maskIp(ip) }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
}
const norm = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
// Champs que SEUL le serveur ou l'administration peut poser.
const FORBIDDEN = ["roles", "banned", "verified", "verificationStatus", "hasVerificationDocs", "livreurApplicationStatus", "isSourcingAgent", "isAdmin", "admin", "affiliateBalance", "affiliateEarnings", "affiliateReferrals", "verifiedSalesTotal", "verifiedSalesCount", "password", "hasPassword", "passwordHash", "recoveryCode", "hasRecoveryCode", "birthDate", "payoutOperator", "payoutNumber", "walletBalance", "balance"];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const ip = clientIp(req);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Alerte « robot » envoyée par le téléphone (piège du formulaire déclenché).
    if (body && body.botSignal) {
      const lim = await ipHits(db, "botsig", ip, 60 * 60 * 1000);
      if (lim.hits.length < 20) { await lim.add(); await alert(db, ip, String(body.botSignal.detail || "Formulaire")); }
      return json({ success: true });
    }
    const account = body && body.account;
    if (!account || typeof account !== "object" || !account.id || !account.phone || !account.role) return bad("invalid_account");
    if (typeof account.id !== "string" || !/^[A-Za-z0-9_\-]{6,64}$/.test(account.id)) return bad("invalid_account");
    if (account.id === "admin_owner" || account.id.startsWith("national_admin_")) return bad("invalid_account");
    if (account.role !== "acheteur" && account.role !== "vendeur") return bad("invalid_account");
    const phone = norm(account.phone);
    if (!/^\+\d{8,15}$/.test(phone)) return bad("invalid_phone");
    for (const k of FORBIDDEN) delete account[k];
    account.phone = phone;
    account.verified = false;
    account.password = null;
    account.recoveryCode = null;
    account.birthDate = null;
    if (account.relaisApplicationStatus !== "pending") account.relaisApplicationStatus = null;
    if (typeof account.name !== "string" || !account.name.trim()) return bad("invalid_account");
    account.name = account.name.trim().slice(0, 80);
    account.createdAt = Date.now();
    // Pièges : champ invisible rempli, ou formulaire rempli en moins de 1,5 s.
    if ((typeof body.hp === "string" && body.hp.trim()) || (typeof body.formMs === "number" && body.formMs >= 0 && body.formMs < 1500)) {
      await alert(db, ip, body.hp ? "Inscription : champ invisible rempli" : "Inscription en moins de 1,5 s");
      return json({ success: false, error: "server_error" }, 500);
    }
    // Limite par adresse IP (plusieurs personnes peuvent partager une IP chez
    // les opérateurs mobiles : limites larges, pensées contre les robots).
    const perHour = await ipHits(db, "ipcreate", ip, 60 * 60 * 1000);
    const perDay = perHour.hits.length >= 10 ? perHour : await ipHits(db, "ipcreate_day", ip, 24 * 60 * 60 * 1000);
    if (perHour.hits.length >= 10 || perDay.hits.length >= 30) {
      if (perHour.hits.length === 10 || perDay.hits.length === 30) await alert(db, ip, "Trop de comptes créés depuis la même adresse (" + (perHour.hits.length >= 10 ? "10 en 1 h" : "30 en 24 h") + ")", "limite");
      await (perHour.hits.length >= 10 ? perHour : perDay).add();
      return json({ success: false, error: "too_many_attempts" }, 429);
    }
    const { data: existing } = await db.from("app_data").select("id").eq("collection", "accounts").eq("id", account.id).maybeSingle();
    if (existing) return bad("id_already_exists");
    const { data: rows } = await db.from("app_data").select("data").eq("collection", "accounts").limit(20000);
    const same = (rows || []).map((r: any) => r.data).filter((a: any) => a && norm(a.phone) === phone);
    if (account.role === "acheteur" && same.length > 0) return bad("phone_already_used");
    if (account.role === "vendeur" && same.some((a: any) => a.role === "vendeur")) return bad("phone_already_seller");
    if (same.length > 0) {
      // Numéro déjà utilisé : il faut être connecté sur un compte de ce numéro.
      const me = await sessionAccountId(req);
      if (!me || !same.some((a: any) => a.id === me)) return bad("login_required_for_phone");
    }
    const { error } = await db.from("app_data").upsert({ collection: "accounts", id: account.id, data: account, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    if (error) { console.error("create-account", error); return json({ success: false, error: "server_error" }, 500); }
    await perHour.add(); if (perDay !== perHour) await perDay.add();
    return json({ success: true, sessionToken: await issueSessionToken(account.id) });
  } catch (e) {
    console.error("create-account", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
