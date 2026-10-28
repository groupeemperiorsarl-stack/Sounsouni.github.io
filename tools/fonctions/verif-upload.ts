// ============================================================
// Fonction serveur : verif-upload (créée le 28/10/2026, audit faille BDD-1)
// Le téléphone envoie ici le selfie ou la pièce d'identité (image en base64).
// Le fichier est rangé dans le seau PRIVÉ « verif » (personne ne peut le
// lire ni le lister depuis internet) et la fonction renvoie une simple
// référence « verif:<chemin> ». Seul l'Admin le voit ensuite, par un lien
// temporaire signé (fonction get-verification-docs).
// Limite : 20 envois par heure et par adresse IP.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clientIp = (req: Request) => (req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "?").trim().slice(0, 64);
async function sha(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { kind, data } = await req.json().catch(() => ({}));
    if (kind !== "selfies" && kind !== "docs") return json({ success: false, error: "invalid_kind" }, 400);
    const m = /^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ""));
    if (!m) return json({ success: false, error: "bad_image" }, 400);
    const bin = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
    if (bin.length > 8_000_000) return json({ success: false, error: "image_too_big" }, 413);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();
    const id = "verifup:" + (await sha(clientIp(req)));
    const { data: row } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", id).maybeSingle();
    const hits: number[] = (row && (row as any).data && Array.isArray((row as any).data.hits) ? (row as any).data.hits : []).filter((t: number) => now - t < 3600000);
    if (hits.length >= 20) return json({ success: false, error: "too_many_attempts" }, 429);
    await db.from("app_data").upsert({ collection: "loginHistory", id, data: { id, kind: "verifup", hits: [...hits, now] }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const ext = m[2] === "png" ? "png" : m[2] === "webp" ? "webp" : "jpg";
    const path = "verification/" + kind + "/" + now + "_" + rnd + "." + ext;
    const { error } = await db.storage.from("verif").upload(path, bin, { contentType: m[1] === "image/jpg" ? "image/jpeg" : m[1], upsert: false });
    if (error) { console.error("verif-upload", error); return json({ success: false, error: "server_error" }, 500); }
    return json({ success: true, ref: "verif:" + path });
  } catch (e) {
    console.error("verif-upload", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
