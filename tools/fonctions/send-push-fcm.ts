// ============================================================
// Fonction serveur : send-push-fcm (version 2026-10-30)
// Envoie une notification native (Firebase Cloud Messaging) aux téléphones
// (application) d'un compte. Plus d'envoi anonyme : voir authorizePush.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const reply = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
// ---- Qui a le droit d'envoyer ? (audit ADM-2, 30/10/2026) ----
// - le serveur lui-même (clé service) ;
// - l'Admin ou un employé (tests depuis l'administration) ;
// - n'importe qui pour SON propre compte (bouton « tester ») ;
// - sinon seulement pour une vraie notification déjà enregistrée
//   (notificationId) de moins de 15 minutes : le texte envoyé est alors
//   celui de la notification, jamais un texte choisi par le téléphone.
function fromB64u(s: string): Uint8Array { const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); const t = atob(b); const o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; }
async function sessionOf(req: Request) {
  const token = req.headers.get("X-Session-Token"), secret = Deno.env.get("SESSION_SECRET");
  if (!token || !secret) return null;
  const parts = token.split("."); if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", key, fromB64u(parts[1]), new TextEncoder().encode(parts[0])))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[0])));
    if (!p.accountId || p.purpose !== "session" || typeof p.expiresAt !== "number" || Date.now() > p.expiresAt) return null;
    return p;
  } catch { return null; }
}
const normP = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
async function authorizePush(req: Request, db: any, input: any): Promise<{ ok: boolean; title?: string; body?: string; error?: string }> {
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (auth && auth === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { ok: true, title: input.title, body: input.body };
  const s = await sessionOf(req);
  if (!s) return { ok: false, error: "session_required" };
  const callerId = String(s.accountId);
  if (callerId === "admin_owner" || callerId.startsWith("national_admin_")) return { ok: true, title: input.title, body: input.body };
  const { data: meRow } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", callerId).maybeSingle();
  const me = meRow ? meRow.data : null;
  const ids = [callerId];
  if (me && me.phone) {
    const { data: sib } = await db.from("app_data").select("id").eq("collection", "accounts").eq("data->>phone", me.phone);
    (sib || []).forEach((r: any) => { if (r.id && !ids.includes(r.id)) ids.push(r.id); });
    const mine = normP(me.phone);
    const { data: wl } = await db.from("app_data").select("data").in("collection", ["group2GlobalWhitelist", "nationalAdmins"]);
    const staff = (wl || []).some((r: any) => { const d = r.data || {}; if (normP(d.phone) === mine) return true; return Array.isArray(d.employeeWhitelist) && d.employeeWhitelist.some((w: any) => w && normP(w.phone) === mine); });
    if (staff) return { ok: true, title: input.title, body: input.body };
  }
  if (ids.includes(String(input.userId))) return { ok: true, title: input.title, body: input.body };
  const nid = String(input.notificationId || "");
  if (!nid) return { ok: false, error: "forbidden" };
  const { data: nRow } = await db.from("app_data").select("data").eq("collection", "notifications").eq("id", nid).maybeSingle();
  const n = nRow ? nRow.data : null;
  if (!n || n.userId !== input.userId || Date.now() - Number(n.time || 0) > 15 * 60 * 1000) return { ok: false, error: "forbidden" };
  return { ok: true, title: "Sounsouni", body: String(n.message || "").slice(0, 300) };
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = ""; for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Échange la clé de compte de service contre un jeton d'accès Google (1 h)
async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const signingInput = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + base64url(JSON.stringify({ iss: clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now }));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signingInput + "." + base64url(signature) }) });
  const data = await res.json();
  if (!data.access_token) throw new Error("token_exchange_failed: " + JSON.stringify(data));
  return data.access_token;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const input = await req.json().catch(() => ({}));
    const userId = String(input.userId || "");
    if (!userId) return reply({ ok: false, error: "missing_userId" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const allowed = await authorizePush(req, supabase, input);
    if (!allowed.ok) return reply({ ok: false, error: allowed.error });
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) { console.log("[push] Firebase non configuré"); return reply({ ok: false, error: "firebase_not_configured" }); }
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    const { data: rows, error } = await supabase.from("app_data").select("id, data").eq("collection", "fcmTokens").eq("data->>accountId", userId);
    if (error) throw error;
    const tokens = (rows || []).filter((r: any) => r.data && r.data.accountId === userId);
    let sent = 0;
    const results: any[] = [];
    for (const row of tokens) {
      try {
        const fcmRes = await fetch("https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: row.data.token, notification: { title: String(allowed.title || "Sounsouni").slice(0, 80), body: String(allowed.body || "").slice(0, 300) }, android: { priority: "high", notification: { channel_id: "sounsouni_messages", sound: "default", default_vibrate_timings: true, notification_priority: "PRIORITY_HIGH" } } } }),
        });
        const fcmData = await fcmRes.json();
        if (fcmRes.ok) { sent++; results.push({ tokenId: row.id, success: true }); }
        else {
          results.push({ tokenId: row.id, success: false, statusCode: fcmRes.status, error: fcmData });
          // Jeton périmé (désinstallation...) : on le retire
          if (fcmRes.status === 404 || (fcmData.error && fcmData.error.status === "NOT_FOUND")) await supabase.from("app_data").delete().eq("collection", "fcmTokens").eq("id", row.id);
        }
      } catch (err: any) { results.push({ tokenId: row.id, success: false, error: err.message }); }
    }
    console.log("[push] destinataire=" + userId + " jetons=" + tokens.length + " envoyés=" + sent);
    results.forEach((r: any) => { if (!r.success) console.log("[push] ÉCHEC jeton " + r.tokenId + " code=" + (r.statusCode || "-") + " erreur=" + JSON.stringify(r.error).slice(0, 400)); });
    return reply({ ok: true, sent, totalTokens: tokens.length, results });
  } catch (e: any) {
    console.log("[push] ERREUR SERVEUR : " + (e && e.message));
    return reply({ ok: false, error: "server_error", errorMessage: e && e.message });
  }
});
