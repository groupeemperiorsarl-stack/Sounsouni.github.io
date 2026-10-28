// ============================================================
// Fonction serveur : verify-login (version 2026-10-28, sécurité)
// Reçoit { accountId, password } ou { accountId, recoveryCode }.
// - Après 8 essais ratés en 15 minutes sur un même compte, le compte est
//   bloqué 15 minutes (empêche de deviner le mot de passe).
// - Nouveau : après 40 essais ratés en 15 minutes depuis une même adresse
//   IP (tous comptes confondus), cette adresse est bloquée 15 minutes et
//   une alerte part dans « Pièges à robots » (robot qui essaie beaucoup de
//   comptes à la suite).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ITERATIONS = 100000;
const MAX_FAILS = 8;
const MAX_IP_FAILS = 40;
const WINDOW_MS = 15 * 60 * 1000;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function toBase64Url(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function getSessionKey(): Promise<CryptoKey> { const secret = Deno.env.get("SESSION_SECRET"); if (!secret) throw new Error("SESSION_SECRET manquant"); return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function issueToken(accountId: string, purpose: "session" | "password_reset", durationMs: number): Promise<string> {
  const now = Date.now();
  const p64 = toBase64Url(new TextEncoder().encode(JSON.stringify({ accountId, purpose, issuedAt: now, expiresAt: now + durationMs })));
  const sig = await crypto.subtle.sign("HMAC", await getSessionKey(), new TextEncoder().encode(p64));
  return p64 + "." + toBase64Url(new Uint8Array(sig));
}
function b64ToBuf(b64: string): ArrayBuffer { const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
function bufToB64(buf: ArrayBuffer): string { const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
async function hashSecret(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, km, 256);
  return "pbkdf2$" + ITERATIONS + "$" + bufToB64(salt) + "$" + bufToB64(bits);
}
async function verifySecret(plain: string, stored: string | null): Promise<{ match: boolean; upgraded: string | null }> {
  if (!stored) return { match: false, upgraded: null };
  if (stored.indexOf("pbkdf2$") !== 0) return stored === plain ? { match: true, upgraded: await hashSecret(plain) } : { match: false, upgraded: null };
  const parts = stored.split("$");
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64ToBuf(parts[2]), iterations: parseInt(parts[1], 10), hash: "SHA-256" }, km, 256);
  return { match: bufToB64(bits) === parts[3], upgraded: null };
}
const clientIp = (req: Request) => (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "?").trim().slice(0, 64);
const maskIp = (ip: string) => ip.includes(".") ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip.split(":").slice(0, 3).join(":") + ":…";
async function sha(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { accountId, password, recoveryCode } = await req.json().catch(() => ({}));
    if (!accountId || typeof accountId !== "string" || (!password && !recoveryCode)) return json({ success: false, error: "missing_fields" }, 400);
    // Défense en plus (audit 28/10/2026) : un identifiant d'admin national ou de
    // partenaire n'ouvre une session que si sa fiche existe vraiment.
    if (/^(national_admin_|dashboard_partner_)/.test(accountId)) {
      const coll = accountId.startsWith("national_admin_") ? "nationalAdmins" : "dashboardPartners";
      const dbc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: doc } = await dbc.from("app_data").select("id").eq("collection", coll).eq("id", accountId.replace(/^(national_admin_|dashboard_partner_)/, "")).maybeSingle();
      if (!doc) return json({ success: false });
    }
    const field = password ? "password_hash" : "recovery_code_hash";
    const plain = String(password || recoveryCode).slice(0, 200);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();
    // Compteur d'essais ratés par adresse IP (tous comptes confondus).
    const ip = clientIp(req);
    const ipId = "iplogin:" + (await sha(ip));
    const { data: ipRow } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", ipId).maybeSingle();
    const ipFails: number[] = (ipRow && ipRow.data && Array.isArray(ipRow.data.hits) ? ipRow.data.hits : []).filter((t: number) => now - t < WINDOW_MS);
    if (ipFails.length >= MAX_IP_FAILS) return json({ success: false, error: "too_many_attempts", retryAfterMs: WINDOW_MS - (now - Math.min(...ipFails)) });
    // Compteur d'essais ratés par compte (collection que seul le serveur peut lire ou écrire).
    const lockId = "lock:" + accountId;
    const { data: lockRow } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", lockId).maybeSingle();
    const fails: number[] = (lockRow && lockRow.data && Array.isArray(lockRow.data.fails) ? lockRow.data.fails : []).filter((t: number) => now - t < WINDOW_MS);
    if (fails.length >= MAX_FAILS) return json({ success: false, error: "too_many_attempts", retryAfterMs: WINDOW_MS - (now - Math.min(...fails)) });
    const saveFails = (list: number[]) => db.from("app_data").upsert({ collection: "loginHistory", id: lockId, data: { id: lockId, accountId, fails: list }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    const { data: row, error } = await db.from("credentials").select(field).eq("account_id", accountId).maybeSingle();
    const stored = row ? (row as Record<string, string | null>)[field] : null;
    const result = (!error && stored) ? await verifySecret(plain, stored) : { match: false, upgraded: null };
    if (!result.match) {
      await saveFails([...fails, now]);
      const nextIp = [...ipFails, now].slice(-200);
      await db.from("app_data").upsert({ collection: "loginHistory", id: ipId, data: { id: ipId, kind: "iplogin", hits: nextIp }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      if (nextIp.length === MAX_IP_FAILS) {
        const aid = "alert-" + now.toString(36) + Math.random().toString(36).slice(2, 7);
        await db.from("app_data").upsert({ collection: "securityAlerts", id: aid, data: { id: aid, at: now, type: "limite", detail: MAX_IP_FAILS + " mots de passe faux en 15 min depuis la même adresse — bloquée 15 min", ip: maskIp(ip) }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      }
      return json({ success: false });
    }
    if (result.upgraded) await db.from("credentials").update({ [field]: result.upgraded }).eq("account_id", accountId);
    if (fails.length) await saveFails([]);
    const sessionToken = password ? await issueToken(accountId, "session", 30 * 24 * 60 * 60 * 1000) : null;
    const passwordResetToken = recoveryCode ? await issueToken(accountId, "password_reset", 10 * 60 * 1000) : null;
    return json({ success: true, sessionToken, passwordResetToken });
  } catch (e) {
    console.error("verify-login", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
