// ============================================================
// Fonction serveur : filature-write (version 2026-10-30, audit ADM-5)
// Ajoute des événements au journal de surveillance d'un numéro, SEULEMENT si
// ce numéro est dans la liste de surveillance de l'Admin. Nouveau : il faut
// être connecté ; on ne peut plus effacer ni réécrire le journal, seulement
// ajouter des événements récents (au plus 20 par envoi, 500 gardés).
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
const normP = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const s = await sessionOf(req);
    if (!s) return json({ success: false, error: "session_required" }, 401);
    const { docId, data } = await req.json().catch(() => ({}));
    if (!docId || !data || !Array.isArray(data.events)) return json({ success: false, error: "missing_fields" }, 400);
    const wid = normP(docId);
    if (!wid || wid !== String(docId)) return json({ success: false, error: "bad_id" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: wl } = await db.from("app_data").select("data").eq("collection", "settings").eq("id", "filature_watchlist").maybeSingle();
    const phones: string[] = wl && (wl as any).data && Array.isArray((wl as any).data.phones) ? (wl as any).data.phones : [];
    if (!phones.some((p) => normP(p) === wid)) return json({ success: true, ignored: true });
    const { data: cur } = await db.from("app_data").select("data").eq("collection", "filatureLogs").eq("id", wid).maybeSingle();
    const log: any = cur ? (cur as any).data : { id: wid, phone: String(data.phone || docId).slice(0, 30), events: [] };
    const events: any[] = Array.isArray(log.events) ? log.events : [];
    const lastAt = events.length ? Number(events[events.length - 1].at) || 0 : 0;
    const now = Date.now();
    const fresh = data.events.filter((e: any) => e && Number(e.at) > lastAt && Number(e.at) <= now + 60000 && now - Number(e.at) < 24 * 3600 * 1000).slice(-20)
      .map((e: any) => ({ type: String(e.type || "").slice(0, 60), detail: String(e.detail || "").slice(0, 300), accountName: String(e.accountName || "").slice(0, 80), at: Number(e.at), by: String(s.accountId) }));
    if (!fresh.length) return json({ success: true, added: 0 });
    log.events = events.concat(fresh).slice(-500);
    const { error } = await db.from("app_data").upsert({ collection: "filatureLogs", id: wid, data: log, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, added: fresh.length });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
