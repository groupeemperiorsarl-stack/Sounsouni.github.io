// ============================================================
// Fonction serveur : set-partner-secret (version 2026-10-30, audit ADM-1)
// Enregistre une clé API (apiPartners) ou un jeton webhook (webhookPartners).
// Nouveau : réservé à l'Admin (clé de session Admin : admin_owner ou admin
// national existant).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const s = await sessionOf(req);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let isAdmin = !!s && s.accountId === "admin_owner";
    if (s && !isAdmin && String(s.accountId).startsWith("national_admin_")) {
      const { data: na } = await db.from("app_data").select("id").eq("collection", "nationalAdmins").eq("id", String(s.accountId).slice(15)).maybeSingle();
      isAdmin = !!na;
    }
    if (!isAdmin) return json({ success: false, error: "admin_only" }, 403);
    const { partnerId, type, value } = await req.json().catch(() => ({}));
    if (!partnerId || !type || !value) return json({ success: false, error: "missing_fields" }, 400);
    if (type !== "apiKey" && type !== "authToken") return json({ success: false, error: "invalid_type" }, 400);
    const table = type === "apiKey" ? "api_secrets" : "webhook_secrets";
    const row = type === "apiKey" ? { partner_id: String(partnerId), api_key: String(value), updated_at: new Date().toISOString() } : { partner_id: String(partnerId), auth_token: String(value), updated_at: new Date().toISOString() };
    const { error } = await db.from(table).upsert(row);
    if (error) return json({ success: false, error: error.message }, 500);
    // Simple drapeau true/false sur la fiche partenaire.
    const collection = type === "apiKey" ? "apiPartners" : "webhookPartners";
    const flagField = type === "apiKey" ? "hasApiKey" : "hasAuthToken";
    await db.rpc("sns_doc_patch", { p_collection: collection, p_id: String(partnerId), p_patch: { [flagField]: true }, p_expect: null });
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
