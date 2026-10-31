// Abonnement Sounsouni Gestion payé par LigdiCash (création + confirmation), sans toucher la vraie base.
import { DB, TABLES } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
Deno.env.set("LIGDICASH_API_KEY", "k"); Deno.env.set("LIGDICASH_AUTH_TOKEN", "t");
let confirmAnswer: any = { response_code: "00", status: "completed", amount: 5000, operator_name: "ORANGE", request_id: "R1" };
globalThis.fetch = (async (url: string) => {
  const u = String(url);
  if (u.includes("checkout-invoice/create")) return new Response(JSON.stringify({ response_code: "00", token: "TK1", response_text: "https://app.ligdicash.com/pay/x" }));
  if (u.includes("checkout-invoice/confirm")) return new Response(JSON.stringify(confirmAnswer));
  return new Response("{}");
}) as any;
const handlers: Record<string, (r: Request) => Promise<Response>> = {};
let current = "";
// @ts-ignore
Object.defineProperty(Deno, "serve", { value: (h: any) => { handlers[current] = h; return {} as any; }, configurable: true, writable: true });
for (const f of ["gestion-sync", "ligdicash-create-payment", "ligdicash-callback"]) { current = f; await import("../fonctions/" + f + ".ts"); }
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e7 })));
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
async function call(fn: string, who: string | null, body: any) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (who) h["X-Session-Token"] = await token(who);
  const r = await handlers[fn](new Request("http://x/" + fn, { method: "POST", headers: h, body: JSON.stringify(body) }));
  const t = await r.text(); try { return JSON.parse(t); } catch { return { text: t, status: r.status }; }
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }
put("accounts", "CHEF", { name: "Moussa", shopName: "Q", sellerType: "entreprise", phone: "+22370000010" });
put("accounts", "COMPTA", { name: "Fanta", phone: "+22370000011" });
let r = await call("gestion-sync", "CHEF", { operation: "create", name: "Quincaillerie" });
const cid = r.company.id;
await call("gestion-sync", "CHEF", { operation: "invite", companyId: cid, phone: "+22370000011", role: "comptable" });
await call("gestion-sync", "COMPTA", { operation: "respond", companyId: cid, accept: true });
r = await call("ligdicash-create-payment", "CHEF", { kind: "gestion", companyId: cid });
check("mode gratuit : rien à payer", r.error === "not_payable", r);
await call("gestion-sync", "admin_owner", { operation: "admin_config", mode: "paid", price: 5000, days: 30 });
r = await call("ligdicash-create-payment", "COMPTA", { kind: "gestion", companyId: cid });
check("le comptable ne paie pas l'abonnement", r.error === "chef_only", r);
r = await call("ligdicash-create-payment", "CHEF", { kind: "gestion", companyId: cid });
check("le chef obtient une facture LigdiCash au tarif Admin", r.success && /^SNSG/.test(r.transactionId), r);
const txn = DB.rows.find((x) => x.collection === "ligdicashTransactions" && x.id === r.transactionId)!.data;
check("montant = tarif (5000) et durée 30 jours", txn.amount === 5000 && txn.days === 30, txn);
const cb = await handlers["ligdicash-callback"](new Request("http://x/cb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ custom_data: { transaction_id: r.transactionId }, transaction_id: r.transactionId }) }));
check("callback accepté", cb.status === 200, cb.status);
r = await call("gestion-sync", "CHEF", { operation: "my" });
const c = TABLES.gestion_companies.find((x) => x.id === cid);
check("le chef voit l'abonnement actif", r.companies[0].expired === false, r);
check("notification « abonnement payé »", DB.rows.some((x) => x.collection === "notifications" && x.id === "ntf_" + txn.transactionId));
check("abonnement prolongé de 30 jours", c.paid_until > Date.now() + 29 * 86400000 && c.paid_until < Date.now() + 31 * 86400000, c.paid_until);
r = await call("gestion-sync", "COMPTA", { operation: "push", companyId: cid, ops: [{ id: "op_after_pay1", k: "expense", e: "x1", a: "put", f: { amount: 1 }, at: Date.now() }] });
check("après paiement, le comptable peut écrire", r.success && r.accepted.length === 1, r);
await handlers["ligdicash-callback"](new Request("http://x/cb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transaction_id: txn.transactionId }) }));
await call("gestion-sync", "CHEF", { operation: "my" });
await call("gestion-sync", "COMPTA", { operation: "pull", companyId: cid, since: 0 });
check("second callback + nouvelles lectures : pas deux fois 30 jours", TABLES.gestion_companies.find((x) => x.id === cid).paid_until === c.paid_until);
console.log("\n" + pass + " réussis, " + failN + " échoués");
if (failN) Deno.exit(1);
