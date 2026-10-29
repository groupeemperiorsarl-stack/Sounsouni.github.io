// ============================================================
// Fonction serveur : find-account-recovery (version 2026-10-30, audit CPT-5)
// Mot de passe oublié : retrouve un compte par nom + téléphone (ou e-mail)
// + date de naissance, et peut créer une demande d'aide pour l'Admin.
// Nouveau : 10 essais par heure et par adresse IP (empêche de deviner des
// dates de naissance ou de lister les comptes).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const digits = (p: string) => (p || "").replace(/\D/g, "");
const clientIp = (req: Request) => (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "?").trim().slice(0, 64);
async function sha32(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { mode, name, phone, countryCode, email, birthDate, createRequest, senderRequestMessage } = await req.json().catch(() => ({}));
    if (!name || !birthDate || (mode !== "phone" && mode !== "email")) return json({ success: false, error: "invalid_input" }, 400);
    if (mode === "phone" && !phone) return json({ success: false, error: "invalid_input" }, 400);
    if (mode === "email" && !email) return json({ success: false, error: "invalid_input" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now(), lid = "recovery:" + (await sha32(clientIp(req)));
    const { data: lr } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", lid).maybeSingle();
    const hits: number[] = (lr && (lr as any).data && Array.isArray((lr as any).data.hits) ? (lr as any).data.hits : []).filter((t: number) => now - t < 3600000);
    if (hits.length >= 10) return json({ success: false, error: "too_many_attempts" }, 429);
    await db.from("app_data").upsert({ collection: "loginHistory", id: lid, data: { id: lid, kind: "recovery", hits: [...hits, now] }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    const nameNorm = String(name).trim().toLowerCase();
    const { data: accRows } = await db.from("app_data").select("id, data").eq("collection", "accounts");
    const candidates = (accRows || []).map((r: any) => ({ id: r.id, data: r.data || {} }))
      .filter((r: any) => String(r.data.name || "").trim().toLowerCase() === nameNorm)
      .filter((r: any) => {
        if (mode === "phone") { const a = digits(r.data.phone || ""); return a === digits((countryCode || "") + phone) || a.endsWith(digits(phone)); }
        return String(r.data.email || "").trim().toLowerCase() === String(email).trim().toLowerCase();
      });
    let matchedId: string | null = null;
    for (const c of candidates) {
      const { data: cred } = await db.from("credentials").select("birth_date").eq("account_id", c.id).maybeSingle();
      if (cred && (cred as any).birth_date === birthDate) { matchedId = c.id; break; }
    }
    if (!matchedId) return json({ success: true, found: false });
    if (createRequest) {
      const acc: any = candidates.find((c: any) => c.id === matchedId)!.data;
      const reqId = crypto.randomUUID();
      await db.from("app_data").upsert({ collection: "passwordRecoveryRequests", id: reqId, data: { id: reqId, accountId: matchedId, name: acc.name, phone: acc.phone, email: acc.email, message: String(senderRequestMessage || "").slice(0, 500), status: "pending", createdAt: Date.now() }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    }
    return json({ success: true, found: true, accountId: matchedId });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
