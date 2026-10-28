// ============================================================
// Fonction serveur : get-verification-docs (version 2026-10-28, sécurité)
// Ne renvoie les photos QUE si un vrai identifiant Admin (propriétaire ou
// national) est fourni et vérifié à chaque appel.
// Nouveau (audit 28/10/2026, faille BDD-1) : les pièces d'identité et selfies
// sont rangés dans le seau PRIVÉ « verif ». La base garde une référence
// « verif:<chemin> » ; cette fonction renvoie un lien temporaire signé
// (10 minutes), jamais une adresse publique.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function b64ToBuf(b64: string) { const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
async function verifySecret(plainText: string, stored: string | null) {
  if (!stored) return false;
  if (stored.indexOf("pbkdf2$") !== 0) return stored === plainText;
  const parts = stored.split("$");
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(plainText), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64ToBuf(parts[2]), iterations: parseInt(parts[1], 10), hash: "SHA-256" }, km, 256);
  const bytes = new Uint8Array(bits); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin) === parts[3];
}
const PUBLIC_VERIF = /\/storage\/v1\/object\/public\/photo\/(verification\/[^?#]+)/;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { adminUsername, adminPassword, docKey } = await req.json().catch(() => ({}));
    if (!adminUsername || !adminPassword || !docKey) return json({ success: false, error: "missing_fields" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let isAuthorized = false;
    const { data: ownerSettings } = await db.from("app_data").select("data").eq("collection", "settings").eq("id", "admin_credentials_owner").maybeSingle();
    const ownerUsername = (ownerSettings as any)?.data?.username || "Issa Haidara";
    if (adminUsername === ownerUsername) {
      const { data: ownerCred } = await db.from("credentials").select("password_hash").eq("account_id", "admin_owner").maybeSingle();
      if (ownerCred) isAuthorized = await verifySecret(adminPassword, (ownerCred as any).password_hash);
    }
    if (!isAuthorized) {
      const { data: nationalAdmins } = await db.from("app_data").select("data").eq("collection", "nationalAdmins");
      const match = (nationalAdmins || []).find((row: any) => row.data?.ownerUsername === adminUsername);
      if (match) {
        const { data: naCred } = await db.from("credentials").select("password_hash").eq("account_id", "national_admin_" + (match as any).data.id).maybeSingle();
        if (naCred) isAuthorized = await verifySecret(adminPassword, (naCred as any).password_hash);
      }
    }
    if (!isAuthorized) { await new Promise((r) => setTimeout(r, 700)); return json({ success: false, error: "unauthorized" }, 403); }
    const { data: doc, error } = await db.from("verification_documents").select("selfie_photo, verification_docs").eq("doc_key", docKey).maybeSingle();
    if (error || !doc) return json({ success: false, error: "not_found" }, 404);
    // Référence « verif:… » (ou ancienne adresse publique) → lien signé du seau privé.
    const sign = async (u: unknown) => {
      if (typeof u !== "string" || !u) return u;
      let path: string | null = null;
      if (u.startsWith("verif:")) path = u.slice(6);
      else { const m = PUBLIC_VERIF.exec(u); if (m) path = decodeURIComponent(m[1]); }
      if (!path) return u;
      const { data: s } = await db.storage.from("verif").createSignedUrl(path, 600);
      return s ? s.signedUrl : null;
    };
    const selfie = await sign((doc as any).selfie_photo);
    const docs = Array.isArray((doc as any).verification_docs) ? await Promise.all((doc as any).verification_docs.map(sign)) : [];
    return json({ success: true, selfiePhoto: selfie, verificationDocs: docs.filter(Boolean) });
  } catch (e) {
    console.error("get-verification-docs", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
