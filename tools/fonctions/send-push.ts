// ============================================================
// Fonction serveur : send-push (version 2026-10-30)
// Envoie une notification Web Push (navigateur) aux appareils d'un compte.
// Plus d'envoi anonyme : voir authorizePush.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const input = await req.json().catch(() => ({}));
    const userId = String(input.userId || "");
    if (!userId) return reply({ ok: false, error: "missing_userId" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const allowed = await authorizePush(req, supabase, input);
    if (!allowed.ok) return reply({ ok: false, error: allowed.error });
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY"), vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@sounsouni.app";
    if (!vapidPublicKey || !vapidPrivateKey) return reply({ ok: false, error: "vapid_not_configured" });
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const { data: rows, error } = await supabase.from("app_data").select("id, data").eq("collection", "pushSubscriptions").eq("data->>accountId", userId);
    if (error) throw error;
    const subs = (rows || []).filter((r: any) => r.data && r.data.accountId === userId);
    // Mode diagnostic : envoi SANS contenu du tout.
    const payload = input.noPayload ? undefined : JSON.stringify({ title: String(allowed.title || "Sounsouni").slice(0, 80), body: String(allowed.body || "").slice(0, 300), url: "./" });
    const options = { TTL: 60, headers: { Urgency: "high" } };
    let sent = 0;
    const results: any[] = [];
    for (const row of subs) {
      const sub = row.data;
      const attempt: any = { subscriptionId: row.id, endpointPreview: String(sub.endpoint || "").slice(0, 50) + "…" };
      try {
        const res = await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, options);
        sent++; attempt.success = true; attempt.statusCode = res && res.statusCode ? res.statusCode : null;
      } catch (err: any) {
        attempt.success = false;
        attempt.errorMessage = err && err.message ? err.message : String(err);
        attempt.statusCode = err && err.statusCode != null ? err.statusCode : null;
        attempt.fcmResponseBody = err && err.body ? String(err.body).slice(0, 500) : null;
        // Abonnement expiré ou révoqué : on le retire.
        if (err && (err.statusCode === 404 || err.statusCode === 410)) { await supabase.from("app_data").delete().eq("collection", "pushSubscriptions").eq("id", row.id); attempt.subscriptionRemoved = true; }
      }
      results.push(attempt);
    }
    return reply({ ok: true, sent, totalSubscriptions: subs.length, mode: input.noPayload ? "sans contenu (diagnostic)" : "normal", results });
  } catch (e: any) {
    return reply({ ok: false, error: "server_error", errorMessage: e && e.message ? e.message : String(e) });
  }
});
