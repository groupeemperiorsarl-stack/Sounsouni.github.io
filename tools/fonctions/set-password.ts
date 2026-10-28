// ============================================================
// Fonction serveur : set-password (version 2026-10-28, sécurité)
// Correctif de l'audit du 28/10/2026 (faille CPT-1) : avant, un compte
// SANS mot de passe recevait le mot de passe demandé sans aucune preuve
// d'identité — n'importe qui pouvait ainsi s'inventer un compte
// « national_admin_… » et devenir administrateur.
// Désormais une preuve est TOUJOURS exigée (jeton X-Session-Token) :
// - compte normal : jeton de session ou de réinitialisation de CE compte,
//   ou jeton de l'Admin principal / d'un admin national existant ;
// - identifiants réservés (admin_owner, national_admin_*, dashboard_partner_*) :
//   jeton de ce même compte (changement de son propre mot de passe), ou
//   jeton de l'Admin principal (admin_owner). Un admin national ou un
//   partenaire doit exister dans sa collection avant de recevoir un mot de passe.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ITERATIONS = 100000;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const RESERVED = /^(admin_owner$|national_admin_|dashboard_partner_)/;
function fromBase64Url(b64url: string): Uint8Array { const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4); const str = atob(b64); const bytes = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i); return bytes; }
async function getSessionKey(): Promise<CryptoKey> { const secret = Deno.env.get("SESSION_SECRET"); if (!secret) throw new Error("SESSION_SECRET manquant"); return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function readToken(req: Request) {
  const token = req.headers.get("X-Session-Token"); if (!token) return null;
  const parts = token.split("."); if (parts.length !== 2) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await getSessionKey(), fromBase64Url(parts[1]), new TextEncoder().encode(parts[0])))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    if (!p.accountId || typeof p.expiresAt !== "number" || Date.now() > p.expiresAt) return null;
    if (p.purpose !== "session" && p.purpose !== "password_reset") return null;
    return p as { accountId: string; purpose: string };
  } catch { return null; }
}
function bufToB64(buf: ArrayBuffer): string { const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
async function hashSecret(plainText: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(plainText), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, km, 256);
  return "pbkdf2$" + ITERATIONS + "$" + bufToB64(salt) + "$" + bufToB64(bits);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { accountId, newPassword, newRecoveryCode, birthDate } = await req.json().catch(() => ({}));
    if (!accountId || typeof accountId !== "string" || accountId.length > 80 || (!newPassword && !newRecoveryCode && !birthDate)) return json({ success: false, error: "invalid_input" }, 400);
    if (newPassword && String(newPassword).length < 4) return json({ success: false, error: "password_too_short" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const proof = await readToken(req);
    if (!proof) return json({ success: false, error: "session_required" }, 401);
    const self = proof.accountId === accountId;
    const isOwner = proof.accountId === "admin_owner" && proof.purpose === "session";
    let isNational = false;
    if (!self && !isOwner && proof.purpose === "session" && proof.accountId.startsWith("national_admin_")) {
      const { data: na } = await db.from("app_data").select("id").eq("collection", "nationalAdmins").eq("id", proof.accountId.slice("national_admin_".length)).maybeSingle();
      isNational = !!na;
    }
    if (RESERVED.test(accountId)) {
      // Un admin national ou un partenaire doit exister avant d'avoir un mot de passe.
      // (l'Admin principal peut créer le mot de passe juste avant que la fiche soit enregistrée)
      if (accountId !== "admin_owner" && !isOwner) {
        const coll = accountId.startsWith("national_admin_") ? "nationalAdmins" : "dashboardPartners";
        const docId = accountId.replace(/^(national_admin_|dashboard_partner_)/, "");
        const { data: doc } = await db.from("app_data").select("id").eq("collection", coll).eq("id", docId).maybeSingle();
        if (!doc) return json({ success: false, error: "unknown_account" }, 404);
      }
      if (!self && !isOwner) return json({ success: false, error: "session_required" }, 401);
    } else {
      if (!self && !isOwner && !isNational) return json({ success: false, error: "session_required" }, 401);
      const { data: acc } = await db.from("app_data").select("id").eq("collection", "accounts").eq("id", accountId).maybeSingle();
      if (!acc) return json({ success: false, error: "unknown_account" }, 404);
    }
    const upsertRow: Record<string, unknown> = { account_id: accountId, updated_at: new Date().toISOString() };
    if (newPassword) upsertRow.password_hash = await hashSecret(String(newPassword));
    if (newRecoveryCode) upsertRow.recovery_code_hash = await hashSecret(String(newRecoveryCode));
    if (birthDate) upsertRow.birth_date = birthDate;
    const { error: credError } = await db.from("credentials").upsert(upsertRow);
    if (credError) return json({ success: false, error: "server_error" }, 500);
    const { data: accRow } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", accountId).maybeSingle();
    if (accRow) {
      const updatedData = { ...(accRow as any).data };
      if (newPassword) updatedData.hasPassword = true;
      if (newRecoveryCode) updatedData.hasRecoveryCode = true;
      await db.from("app_data").update({ data: updatedData }).eq("collection", "accounts").eq("id", accountId);
    }
    return json({ success: true });
  } catch (e) {
    console.error("set-password", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
