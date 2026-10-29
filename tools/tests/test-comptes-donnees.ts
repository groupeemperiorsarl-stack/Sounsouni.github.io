// Tests du bloc « comptes, données privées, notifications, avis » (audit du 28/10/2026).
import { DB } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
const handlers: Record<string, (r: Request) => Promise<Response>> = {};
let current = "";
// @ts-ignore remplace Deno.serve pour récupérer le gestionnaire
Object.defineProperty(Deno, "serve", { value: (h: any) => { handlers[current] = h; return {} as any; }, configurable: true, writable: true });
for (const f of ["secure-write", "personal-data", "send-push-fcm", "submit-verification-docs", "filature-write", "set-partner-secret", "find-account-recovery"]) { current = f; await import("../fonctions/" + f + ".ts"); }
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string, expired = false) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const exp = expired ? Date.now() - 1000 : Date.now() + 1e7;
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: exp })));
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
async function call(fn: string, who: string | null, body: any, extra: Record<string, string> = {}) {
  const h: Record<string, string> = { "content-type": "application/json", ...extra };
  if (who) h["X-Session-Token"] = await token(who);
  const r = await handlers[fn](new Request("http://x/" + fn, { method: "POST", headers: h, body: JSON.stringify(body) }));
  return await r.json();
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
const get = (c: string, id: string) => (DB.rows.find((r) => r.collection === c && r.id === id) || { data: null }).data;
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }
put("accounts", "B", { name: "Awa", phone: "+22370000001", role: "acheteur" });
put("accounts", "S", { name: "Vendeur", shopName: "Boutique", phone: "+22370000002", role: "vendeur" });
put("accounts", "A", { name: "Pirate", phone: "+22370000006", role: "acheteur" });
put("accounts", "L", { name: "Livreur", phone: "+22370000003", role: "livreur", livreurApplicationStatus: "approved" });
put("orders", "o1", { buyerId: "B", sellerIds: ["S"], status: "Livrée" });
put("orderDetails", "o1", { items: [{ productId: "P", sellerId: "S", qty: 1, price: 1000 }] });
put("products", "P", { name: "Article", price: 1000, sellerId: "S" });
put("settings", "filature_watchlist", { phones: ["+22370000006"] });

console.log("== find_account (CPT-2, CPT-5)");
let r = await call("secure-write", null, { operation: "find_account", name: "Awa", phone: "70000001", fullPhone: "+22370000001" });
check("compte trouvé mais PAS de clé sans ancienne clé", r.found && !r.sessionToken && r.needsHelp, r);
r = await call("secure-write", null, { operation: "find_account", name: "Awa", phone: "70000001", fullPhone: "+22370000001" }, { "X-Session-Token": await token("B", true) });
check("ancienne clé du même compte : nouvelle clé donnée", r.found && !!r.sessionToken, r);
r = await call("secure-write", null, { operation: "find_account", name: "Awa", phone: "70000001", fullPhone: "+22370000001" }, { "X-Session-Token": await token("A", true) });
check("ancienne clé d'un AUTRE compte : pas de clé", r.found && !r.sessionToken, r);
let last: any = null;
for (let i = 0; i < 20; i++) last = await call("secure-write", null, { operation: "find_account", name: "X" + i, phone: "70000009", fullPhone: "" });
check("21e recherche en 1 h bloquée", last.error === "too_many_attempts", last);

console.log("== Changer de numéro (CPT-3)");
r = await call("secure-write", "A", { operation: "save", collection: "accounts", doc: { ...get("accounts", "A"), phone: "+22370000001" } });
check("prendre le numéro d'un autre : refusé", get("accounts", "A").phone === "+22370000006", get("accounts", "A"));
r = await call("secure-write", "A", { operation: "save", collection: "accounts", doc: { ...get("accounts", "A"), phone: "+22370000099" } });
check("nouveau numéro libre : accepté", get("accounts", "A").phone === "+22370000099", r);
get("accounts", "A").phone = "+22370000006";

console.log("== Collections privées (BDD-3/4/5)");
r = await call("secure-write", "A", { operation: "save", collection: "livreurApplications", doc: { id: "la1", accountId: "B", status: "pending" } });
check("candidature au nom d'un autre : refusée", r.success === false && !get("livreurApplications", "la1"), r);
r = await call("secure-write", "A", { operation: "save", collection: "livreurApplications", doc: { id: "la2", accountId: "A", status: "approved", resolvedAt: 1 } });
check("sa candidature : créée, statut forcé « pending »", r.success && get("livreurApplications", "la2").status === "pending" && !get("livreurApplications", "la2").resolvedAt, get("livreurApplications", "la2"));
r = await call("secure-write", "A", { operation: "save", collection: "livreurApplications", doc: { ...get("livreurApplications", "la2"), status: "approved" } });
check("s'approuver soi-même : non", get("livreurApplications", "la2").status === "pending");
r = await call("secure-write", "B", { operation: "delete", collection: "livreurApplications", id: "la2" });
check("effacer la fiche d'un autre : non", r.success === false && !!get("livreurApplications", "la2"), r);
r = await call("secure-write", "A", { operation: "save", collection: "passwordRecoveryRequests", doc: { id: "pr1", accountId: "A" } });
check("demandes de mot de passe : Admin seulement", r.success === false, r);
r = await call("secure-write", "A", { operation: "save", collection: "disputes", doc: { id: "d1", orderId: "o1", reason: "x" } });
check("litige sur la commande d'un autre : refusé", r.success === false, r);
r = await call("secure-write", "B", { operation: "save", collection: "disputes", doc: { id: "d2", orderId: "o1", reason: "x", status: "Résolu", buyerId: "A" } });
check("litige de l'acheteur : créé, statut « En litige », bon acheteur", r.success && get("disputes", "d2").status === "En litige" && get("disputes", "d2").buyerId === "B", get("disputes", "d2"));
r = await call("secure-write", "A", { operation: "save", collection: "fcmTokens", doc: { id: "t1", accountId: "B", token: "x" } });
check("jeton push pour un autre compte : refusé", r.success === false, r);
r = await call("secure-write", "B", { operation: "save", collection: "fcmTokens", doc: { id: "t2", accountId: "B", token: "tok" } });
check("son jeton push : accepté", r.success, r);
r = await call("secure-write", "S", { operation: "save", collection: "externalParcels", doc: { id: "ep1", relaisShopId: "R" } });
check("colis externe d'une autre boutique : refusé", r.success === false, r);
r = await call("personal-data", "B", {});
check("chacun reçoit SES fiches privées", r.privates && r.privates.fcmTokens.length === 1 && r.privates.disputes.length === 1 && r.privates.livreurApplications.length === 0, r.privates);
r = await call("personal-data", "S", {});
check("le vendeur voit le litige qui le concerne", r.privates && r.privates.disputes.length === 1 && r.privates.fcmTokens.length === 0, r.privates);
r = await call("personal-data", "admin_owner", {});
check("l'Admin voit tout", r.privates && r.privates.livreurApplications.length === 1 && r.privates.fcmTokens.length === 1, r.privates && Object.keys(r.privates));

console.log("== Avis (CMD-4)");
r = await call("secure-write", "A", { operation: "save", collection: "reviews", doc: { id: "rv1", productId: "P", userId: "A", rating: 5, comment: "top" } });
check("avis sans avoir acheté : refusé", r.success === false, r);
r = await call("secure-write", "B", { operation: "save", collection: "reviews", doc: { id: "rv2", productId: "P", userId: "B", rating: 4, comment: "bien", userName: "Faux nom", verified: false } });
check("avis de l'acheteur livré : accepté, nom et « vérifié » du serveur", r.success && get("reviews", "rv2").userName === "Awa" && get("reviews", "rv2").verified === true, get("reviews", "rv2"));
r = await call("secure-write", "B", { operation: "save", collection: "reviews", doc: { id: "rv3", productId: "P", userId: "B", rating: 5 } });
check("deuxième avis sur le même article : refusé", r.success === false, r);
r = await call("secure-write", "A", { operation: "save", collection: "reviews", doc: { ...get("reviews", "rv2"), rating: 1 } });
check("modifier l'avis d'un autre : refusé", get("reviews", "rv2").rating === 4, r);
r = await call("secure-write", "A", { operation: "delete", collection: "reviews", id: "rv2" });
check("effacer l'avis d'un autre : refusé", r.success === false && !!get("reviews", "rv2"), r);

console.log("== Notifications push (ADM-2)");
r = await call("send-push-fcm", null, { userId: "B", title: "Votre compte est bloqué", body: "cliquez ici" });
check("sans connexion : refusé", r.error === "session_required", r);
r = await call("send-push-fcm", "A", { userId: "B", title: "Votre compte est bloqué", body: "cliquez ici" });
check("texte libre vers un autre : refusé", r.error === "forbidden", r);
put("notifications", "n1", { userId: "B", message: "Votre commande est prête", time: Date.now() });
r = await call("send-push-fcm", "A", { userId: "B", body: "pirate", notificationId: "n1" });
check("vraie notification récente : autorisée (texte du serveur)", r.error === "firebase_not_configured", r);
r = await call("send-push-fcm", "A", { userId: "A", body: "test" });
check("test sur son propre compte : autorisé", r.error === "firebase_not_configured", r);
r = await call("send-push-fcm", null, { userId: "B", body: "x" }, { Authorization: "Bearer svc-secret" });
check("le serveur (clé service) : autorisé", r.error === "firebase_not_configured", r);

console.log("== Pièces d'identité (ADM-4)");
put("relaisApplications", "ra1xx", { accountId: "B", status: "pending" });
r = await call("submit-verification-docs", null, { docKey: "relais_app_ra1xx", selfiePhoto: "verif:verification/selfies/1_a.jpg" });
check("sans connexion : refusé", r.error === "session_required", r);
r = await call("submit-verification-docs", "A", { docKey: "relais_app_ra1xx", selfiePhoto: "verif:verification/selfies/1_a.jpg" });
check("dossier d'un autre : refusé", r.error === "forbidden", r);
r = await call("submit-verification-docs", "B", { docKey: "relais_app_ra1xx", selfiePhoto: "https://pirate/x.jpg" });
check("photo qui n'est pas du coffre privé : refusée", r.error === "bad_files", r);

console.log("== Journal de surveillance (ADM-5)");
r = await call("filature-write", null, { docId: "+22370000006", data: { events: [] } });
check("sans connexion : refusé", r.error === "session_required", r);
const tOld = Date.now() - 5000;
put("filatureLogs", "+22370000006", { phone: "+22370000006", events: [{ type: "ancien", at: tOld }] });
r = await call("filature-write", "A", { docId: "+22370000006", data: { events: [] } });
check("impossible de vider le journal", get("filatureLogs", "+22370000006").events.length === 1, get("filatureLogs", "+22370000006"));
r = await call("filature-write", "A", { docId: "+22370000006", data: { events: [{ type: "ancien", at: tOld }, { type: "open-wallet", at: Date.now() }] } });
check("nouvel événement ajouté", r.added === 1 && get("filatureLogs", "+22370000006").events.length === 2, r);
r = await call("filature-write", "A", { docId: "+22370000001", data: { events: [{ type: "x", at: Date.now() }] } });
check("numéro non surveillé : ignoré", r.ignored === true && !get("filatureLogs", "+22370000001"), r);

console.log("== Clés des partenaires (ADM-1)");
r = await call("set-partner-secret", "A", { partnerId: "p1", type: "apiKey", value: "x" });
check("pas Admin : refusé", r.error === "admin_only", r);

console.log("== Mot de passe oublié (CPT-5)");
for (let i = 0; i < 10; i++) last = await call("find-account-recovery", null, { mode: "phone", name: "Awa", phone: "70000001", birthDate: "2000-01-0" + i });
last = await call("find-account-recovery", null, { mode: "phone", name: "Awa", phone: "70000001", birthDate: "2000-02-01" });
check("11e essai en 1 h bloqué", last.error === "too_many_attempts", last);

console.log("\nRésultat : " + pass + " réussis, " + failN + " échoués");
