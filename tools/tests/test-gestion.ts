// Tests de Sounsouni Gestion (fonction gestion-sync), sans toucher la vraie base.
import { DB, TABLES } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
globalThis.fetch = (async () => new Response("{}")) as any; // pas de vraie notification push
let handler: (r: Request) => Promise<Response>;
// @ts-ignore remplace Deno.serve pour récupérer le gestionnaire
Object.defineProperty(Deno, "serve", { value: (h: any) => { handler = h; return {} as any; }, configurable: true, writable: true });
await import("../fonctions/gestion-sync.ts");
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e7 })));
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
async function call(who: string | null, body: any) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (who) h["X-Session-Token"] = await token(who);
  const r = await handler(new Request("http://x/gestion-sync", { method: "POST", headers: h, body: JSON.stringify(body) }));
  return { status: r.status, ...(await r.json()) };
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }
put("accounts", "CHEF", { name: "Moussa", shopName: "Quincaillerie Moussa", sellerType: "entreprise", phone: "+22370000010" });
put("accounts", "COMPTA", { name: "Fanta", phone: "+22370000011" });
put("accounts", "CAISSE", { name: "Ali", phone: "+22370000012" });
put("accounts", "PART", { name: "Oumar", phone: "+22370000013" });
put("accounts", "INTRUS", { name: "Pirate", phone: "+22370000014" });
put("accounts", "ACH", { name: "Simple", phone: "+22370000015" });

console.log("== Création et invitations");
let r = await call(null, { operation: "my" });
check("sans connexion : refusé", r.status === 401, r);
r = await call("ACH", { operation: "create", name: "Ma boutique" });
check("un simple acheteur ne crée pas d'entreprise", r.error === "sellers_only", r);
r = await call("CHEF", { operation: "create", name: "Quincaillerie Moussa" });
check("le vendeur crée son entreprise", r.success && r.company.role === "chef", r);
const cid = r.company.id;
r = await call("COMPTA", { operation: "invite", companyId: cid, phone: "+22370000011", role: "comptable" });
check("un non-membre ne peut pas inviter", r.error === "not_member", r);
r = await call("CHEF", { operation: "invite", companyId: cid, phone: "+223 70 00 00 11", role: "comptable" });
check("le chef invite le comptable", r.success && r.hasAccount === true, r);
check("notification d'invitation envoyée", DB.rows.some((x) => x.collection === "notifications" && x.data.userId === "COMPTA" && x.data.target === "role-menu"));
r = await call("CHEF", { operation: "invite", companyId: cid, phone: "+22370000011", role: "comptable" });
check("pas deux invitations au même numéro", r.error === "already_member", r);
r = await call("CHEF", { operation: "invite", companyId: cid, phone: "+22370000016", role: "chef" });
check("on n'invite pas un deuxième chef", r.error === "bad_role", r);
await call("CHEF", { operation: "invite", companyId: cid, phone: "+22370000012", role: "caissier" });
await call("CHEF", { operation: "invite", companyId: cid, phone: "+22370000013", role: "partenaire" });
r = await call("COMPTA", { operation: "my" });
check("le comptable voit l'invitation", r.invites.length === 1 && r.invites[0].role === "comptable" && r.companies.length === 0, r);
r = await call("COMPTA", { operation: "pull", companyId: cid, since: 0 });
check("avant d'accepter : pas d'accès", r.error === "not_member", r);
r = await call("COMPTA", { operation: "respond", companyId: cid, accept: true });
check("le comptable accepte", r.success, r);
await call("CAISSE", { operation: "respond", companyId: cid, accept: true });
await call("PART", { operation: "respond", companyId: cid, accept: true });
r = await call("COMPTA", { operation: "my" });
check("l'entreprise apparaît chez le comptable", r.companies.length === 1 && r.companies[0].name === "Quincaillerie Moussa", r);

console.log("== Lignes (envoi / réception)");
const op = (id: string, k: string, e: string, f: any, a = "put") => ({ id, k, e, a, f, at: Date.now() });
r = await call("COMPTA", { operation: "push", companyId: cid, ops: [op("op_compta_001", "item", "it1", { name: "Ciment", price: 5000, cost: 4200 }), op("op_compta_002", "expense", "ex1", { amount: 15000, cat: "loyer" })] });
check("le comptable envoie 2 lignes", r.accepted.length === 2, r);
r = await call("COMPTA", { operation: "push", companyId: cid, ops: [op("op_compta_001", "item", "it1", { name: "Ciment", price: 5000 })] });
check("même ligne renvoyée (connexion coupée) : pas de doublon", r.accepted.length === 1 && TABLES.gestion_ops.length === 2, r);
r = await call("CAISSE", { operation: "push", companyId: cid, ops: [op("op_caisse_001", "sale", "s1", { total: 10000, lines: [{ item: "it1", qty: 2, price: 5000 }] }), op("op_caisse_002", "expense", "ex2", { amount: 1 })] });
check("caissier : vente acceptée, dépense refusée", r.accepted.length === 1 && r.rejected[0].reason === "forbidden", r);
r = await call("CAISSE", { operation: "push", companyId: cid, ops: [op("op_caisse_003", "item", "it1", { name: "Ciment", price: 1 })] });
check("caissier : ne change pas les prix", r.rejected.length === 1, r);
r = await call("CAISSE", { operation: "push", companyId: cid, ops: [op("op_caisse_004", "client", "c1", { name: "Client" }), op("op_caisse_005", "payment", "p1", { side: "supplier", amount: 5 })] });
check("caissier : client oui, payer un fournisseur non", r.accepted.length === 1 && r.rejected.length === 1, r);
r = await call("CAISSE", { operation: "push", companyId: cid, ops: [op("op_caisse_006", "sale", "s1", null, "del")] });
check("caissier : ne supprime pas une vente", r.rejected.length === 1, r);
r = await call("PART", { operation: "push", companyId: cid, ops: [op("op_part_0001", "sale", "s9", { total: 1 })] });
check("partenaire : lecture seule", r.error === "read_only", r);
r = await call("PART", { operation: "pull", companyId: cid, since: 0 });
check("partenaire : il voit tout", r.success && r.ops.length === 4 && r.role === "partenaire", r);
const last = r.ops[r.ops.length - 1].s;
r = await call("CHEF", { operation: "pull", companyId: cid, since: last });
check("réception depuis la dernière ligne : rien de nouveau", r.ops.length === 0, r);
r = await call("CHEF", { operation: "push", companyId: cid, ops: [op("op_chef_00001", "sale", "s1", { total: 9000 })] });
r = await call("COMPTA", { operation: "pull", companyId: cid, since: last });
check("le comptable reçoit la correction du chef", r.ops.length === 1 && r.ops[0].by === "CHEF" && r.ops[0].bn === "Moussa", r);
r = await call("INTRUS", { operation: "pull", companyId: cid, since: 0 });
check("un inconnu ne lit rien", r.error === "not_member", r);
r = await call("CHEF", { operation: "push", companyId: cid, ops: [{ id: "op_bad_00001", k: "virus", e: "x", a: "put", f: {} }] });
check("type de ligne inconnu refusé", r.rejected.length === 1, r);

console.log("== Membres");
r = await call("COMPTA", { operation: "member_remove", companyId: cid, phone: "22370000012" });
check("le comptable ne retire personne", r.error === "chef_only", r);
r = await call("CHEF", { operation: "member_remove", companyId: cid, phone: "22370000010" });
check("on ne retire pas le propriétaire", r.error === "owner_locked", r);
r = await call("CHEF", { operation: "member_update", companyId: cid, phone: "22370000012", role: "comptable" });
check("le chef change un rôle", r.success && TABLES.gestion_members.find((m) => m.phone === "22370000012").role === "comptable", r);
r = await call("CHEF", { operation: "member_remove", companyId: cid, phone: "22370000012" });
r = await call("CAISSE", { operation: "pull", companyId: cid, since: 0 });
check("retiré : plus d'accès", r.error === "not_member", r);
r = await call("PART", { operation: "member_remove", companyId: cid, phone: "22370000013" });
check("un membre peut partir de lui-même", r.success, r);
r = await call("CHEF", { operation: "members", companyId: cid });
check("liste des membres", r.members.length === 2, r);

console.log("== Abonnement et administration");
r = await call("CHEF", { operation: "admin_config", mode: "paid", price: 5000, days: 30 });
check("seul l'Admin règle le tarif", r.error === "admin_only", r);
r = await call("admin_owner", { operation: "admin_config", mode: "paid", price: 5000, days: 30 });
check("l'Admin passe en payant", r.success && r.config.price === 5000, r);
r = await call("COMPTA", { operation: "push", companyId: cid, ops: [op("op_compta_003", "expense", "ex3", { amount: 1 })] });
check("abonnement fini : plus d'envoi", r.error === "subscription_required", r);
r = await call("COMPTA", { operation: "pull", companyId: cid, since: 0 });
check("abonnement fini : la lecture reste possible", r.success && r.expired === true, r);
r = await call("admin_owner", { operation: "admin_set_plan", companyId: cid, addDays: 30 });
r = await call("COMPTA", { operation: "push", companyId: cid, ops: [op("op_compta_003", "expense", "ex3", { amount: 1 })] });
check("après 30 jours ajoutés : envoi possible", r.success && r.accepted.length === 1, r);
r = await call("admin_owner", { operation: "admin_set_plan", companyId: cid, plan: "offert", addDays: -1 });
r = await call("COMPTA", { operation: "my" });
check("entreprise offerte : jamais bloquée", r.companies[0].expired === false && r.companies[0].plan === "offert", r);
r = await call("admin_owner", { operation: "admin_list" });
check("l'Admin voit la liste", r.success && r.companies.length === 1 && r.companies[0].ops === 6 && r.companies[0].members === 2, r);
r = await call("admin_owner", { operation: "admin_config", mode: "paid", price: 50, days: 30 });
check("tarif trop petit refusé", r.error === "price_min_100", r);

console.log("\n" + pass + " réussis, " + failN + " échoués");
if (failN) Deno.exit(1);
