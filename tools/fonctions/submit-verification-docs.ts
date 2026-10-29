// ============================================================
// Fonction serveur : submit-verification-docs (version 2026-10-30, audit ADM-4)
// Reçoit { docKey, selfiePhoto, verificationDocs } et les range dans la table
// protégée verification_documents. Nouveau : il faut être connecté, et le
// dossier doit être celui de SA propre candidature point de retrait
// (docKey = « relais_app_<id de la candidature> »). Les photos doivent être
// des références du coffre privé (« verif:… », voir verif-upload).
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
async function linkedIds(db: any, callerId: string): Promise<string[]> {
  const { data: meRow } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", callerId).maybeSingle();
  const me = meRow ? meRow.data : null;
  const ids = [callerId];
  if (me && me.phone) {
    const { data: sib } = await db.from("app_data").select("id").eq("collection", "accounts").eq("data->>phone", me.phone);
    (sib || []).forEach((r: any) => { if (r.id && !ids.includes(r.id)) ids.push(r.id); });
  }
  return ids;
}
const isRef = (v: unknown) => typeof v === "string" && v.length <= 300 && /^verif:verification\/(docs|selfies)\/[A-Za-z0-9_.-]+$/.test(v);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const s = await sessionOf(req);
    if (!s) return json({ success: false, error: "session_required" }, 401);
    const { docKey, selfiePhoto, verificationDocs } = await req.json().catch(() => ({}));
    const docs = Array.isArray(verificationDocs) ? verificationDocs : [];
    if (!docKey || (!selfiePhoto && !docs.length)) return json({ success: false, error: "missing_fields" }, 400);
    if ((selfiePhoto && !isRef(selfiePhoto)) || docs.length > 6 || !docs.every(isRef)) return json({ success: false, error: "bad_files" }, 400);
    const m = /^relais_app_([A-Za-z0-9_-]{4,80})$/.exec(String(docKey));
    if (!m) return json({ success: false, error: "bad_doc_key" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appRow } = await db.from("app_data").select("data").eq("collection", "relaisApplications").eq("id", m[1]).maybeSingle();
    const app = appRow ? (appRow as any).data : null;
    const ids = await linkedIds(db, String(s.accountId));
    if (!app || !ids.includes(String(app.accountId))) return json({ success: false, error: "forbidden" }, 403);
    const { error } = await db.from("verification_documents").upsert({ doc_key: String(docKey), selfie_photo: selfiePhoto || null, verification_docs: docs, updated_at: new Date().toISOString() });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
