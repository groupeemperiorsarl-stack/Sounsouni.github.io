import { DB, CALLS } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
const handlers: Record<string, (r: Request) => Promise<Response>> = {};
let current = "";
// @ts-ignore remplace Deno.serve pour récupérer le gestionnaire
Object.defineProperty(Deno, "serve", { value: (h: any) => { handlers[current] = h; return {} as any; }, configurable: true, writable: true });
for (const f of ["order-write", "wallet-write", "personal-data", "secure-write"]) { current = f; await import("../fonctions/" + f + ".ts"); }

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e7 })));
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p)));
  return p + "." + b64u(s);
}
async function call(fn: string, who: string, body: any) {
  const r = await handlers[fn](new Request("http://x/" + fn, { method: "POST", headers: { "X-Session-Token": await token(who), "content-type": "application/json" }, body: JSON.stringify(body) }));
  return await r.json();
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
const get = (c: string, id: string) => (DB.rows.find((r) => r.collection === c && r.id === id) || { data: null }).data;
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }

put("accounts", "B", { name: "Acheteur", phone: "+223 70000001", createdAt: Date.now() });
put("accounts", "S", { name: "Vendeur", shopName: "Boutique S", phone: "+22370000002", role: "vendeur" });
put("accounts", "S2", { name: "Vendeur bis", phone: "+22370000001" }); // même numéro que B
put("accounts", "L", { name: "Livreur", phone: "+22370000003", role: "livreur", livreurApplicationStatus: "approved" });
put("accounts", "L2", { name: "Livreur 2", phone: "+22370000004", role: "livreur", livreurApplicationStatus: "approved" });
put("accounts", "R", { name: "Relais", shopName: "Point R", phone: "+22370000005", role: "point_vente" });
put("accounts", "A", { name: "Attaquant", phone: "+22370000006" });
put("products", "P", { name: "Ventilateur", price: 10000, stock: 20, sellerId: "S", tieredPricing: [{ minQty: 3, price: 9000 }], colorPrices: { Rouge: 12000 }, colors: ["Rouge", "Bleu"] });
put("products", "PB", { name: "Article de B", price: 5000, stock: 5, sellerId: "S2" });
put("settings", "commission_config", { totalCommissionRate: 0.07, affiliateCommission: 0.05 });
put("wallets", "+22370000001", { phone: "+223 70000001", balance: 50000, transactions: [] });

const item = (o: any = {}) => ({ productId: "P", name: "Ventilateur", price: 10000, qty: 1, color: null, sellerId: "S", ...o });
const order = (id: string, o: any = {}) => ({ id, buyerId: "B", items: [item()], subtotal: 10000, deliveryFee: 1000, total: 11000, payment: "paiement_livraison", status: "Nouvelle", deliveryMode: "express", otp: "1234", ...o });

console.log("== Prix (CMD-1)");
let r = await call("order-write", "B", { docId: "o1", data: order("o1", { items: [item({ price: 100 })], subtotal: 100, total: 1100 }) });
check("prix trafiqué refusé", r.error === "price_changed", r);
check("rien créé", !get("orders", "o1"));
r = await call("order-write", "B", { docId: "o2", data: order("o2", { status: "Livrée", deliveryVerified: true, sellerPayoutSettled: { S: true } }) });
check("commande normale créée", r.success === true && r.newTotal === 11000, r);
check("statut imposé « Nouvelle »", get("orders", "o2").status === "Nouvelle");
check("faux champs serveur effacés", !get("orders", "o2").deliveryVerified && !get("orders", "o2").sellerPayoutSettled);
check("stock retiré par le serveur (20→19)", get("products", "P").stock === 19, get("products", "P"));
check("OTP gardé", get("orders", "o2").otp === "1234");
r = await call("order-write", "B", { docId: "o3", data: order("o3", { items: [item({ color: "Rouge", qty: 3, price: 11000 })], subtotal: 33000, total: 34000 }) });
check("prix couleur + dégressif = 11000", r.success && get("orderDetails", "o3").items[0].price === 11000, r);
r = await call("order-write", "B", { docId: "o3b", data: order("o3b", { items: [item({ price: 20000 })], subtotal: 20000, total: 21000 }) });
check("client qui affiche plus cher : serveur prend le vrai prix", r.success && r.newTotal === 11000 && get("orderDetails", "o3b").total === 11000, r);
r = await call("order-write", "B", { docId: "o4", data: order("o4", { items: [{ productId: "PB", price: 5000, qty: 1, sellerId: "S2" }], subtotal: 5000, total: 6000 }) });
check("achat de son propre article (même numéro) refusé", r.error === "own_product", r);
r = await call("order-write", "B", { docId: "o5", data: order("o5", { items: [item({ qty: 50, price: 9000 })], subtotal: 450000, total: 451000 }) });
check("stock insuffisant refusé", r.error === "out_of_stock", r);
r = await call("order-write", "B", { docId: "o6", data: order("o6", { payment: "orange_money" }) });
check("paiement inconnu refusé", r.error === "payment_not_supported", r);

console.log("== Portefeuille");
r = await call("order-write", "B", { docId: "w1", walletPay: true, data: order("w1", { payment: "portefeuille" }) });
check("commande portefeuille créée + débit", r.success && get("wallets", "+22370000001").balance === 39000, { r, w: get("wallets", "+22370000001").balance });
check("payée côté serveur", get("orders", "w1").paymentStatus === "paid" && get("orders", "w1").walletPaid === true);
r = await call("order-write", "B", { docId: "w1", walletPay: true, data: order("w1", { payment: "portefeuille" }) });
check("renvoi de la même commande : pas de 2e débit", get("wallets", "+22370000001").balance === 39000);
r = await call("order-write", "B", { docId: "w2", walletPay: true, data: order("w2", { payment: "portefeuille", items: [item({ qty: 5, price: 9000 })], subtotal: 45000, total: 46000 }) });
check("plus assez sur le portefeuille", r.error === "insufficient_balance" && !get("orders", "w2"), r);
r = await call("order-write", "B", { docId: "w3", data: order("w3", { payment: "portefeuille" }) });
check("ancienne app sans débit : refusée", r.error === "not_paid", r);

console.log("== Livraison et codes (CMD-2, CMD-3)");
let o2 = get("orders", "o2");
r = await call("order-write", "S", { docId: "o2", data: { ...o2, status: "Livrée" } });
check("vendeur ne peut pas mettre « Livrée »", r.success && get("orders", "o2").status === "Nouvelle" && r.statusKept, r);
r = await call("order-write", "L2", { docId: "o2", data: { ...o2, deliveryFee: 99999, buyerName: "pirate", status: "Récupérée", livreurId: "L2", livreurName: "L2" } });
o2 = get("orders", "o2");
check("livreur libre : prend la course", o2.livreurId === "L2" && o2.status === "Récupérée", o2);
check("livreur libre : ne change pas le reste", o2.deliveryFee === 1000 && o2.buyerName !== "pirate", o2);
r = await call("order-write", "L", { docId: "o2", data: { ...o2, livreurId: "L", status: "En route" } });
check("autre livreur ne peut plus la prendre", r.error === "not_linked_to_order", r);
r = await call("order-write", "L2", { docId: "o2", data: { ...o2, status: "Livrée" }, deliveryCode: "9999" });
check("mauvais code refusé", r.error === "bad_code" && get("orders", "o2").status === "Récupérée", r);
r = await call("order-write", "B", { docId: "o2", data: { ...o2, status: "Livrée" }, deliveryCode: "1234" });
check("acheteur ne valide pas lui-même la livraison", r.error === "bad_code" || r.error === "not_allowed", r);
r = await call("order-write", "L2", { docId: "o2", data: { ...o2, status: "Livrée", otp: "0000" }, deliveryCode: "1234" });
check("bon code par le livreur : Livrée", r.success && get("orders", "o2").status === "Livrée" && get("orders", "o2").deliveryVerified === true, r);
check("code non modifiable", get("orders", "o2").otp === "1234");
// essais répétés
r = await call("order-write", "B", { docId: "o3", data: { ...get("orders", "o3"), status: "Prête" } });
let o3 = get("orders", "o3");
await call("order-write", "S", { docId: "o3", data: { ...o3, vendorStatuses: { S: "Prête" }, status: "Prête" } });
await call("order-write", "L", { docId: "o3", data: { ...get("orders", "o3"), status: "Récupérée", livreurId: "L" } });
let last: any = null;
for (let i = 0; i < 7; i++) last = await call("order-write", "L", { docId: "o3", data: { ...get("orders", "o3"), status: "Livrée" }, deliveryCode: "000" + i });
check("trop d'essais bloqués", last.error === "too_many_attempts", last);

console.log("== Versements (ARG-1, ARG-2)");
r = await call("wallet-write", "A", { operation: "settle_order_payouts", orderId: "o3" });
check("commande non livrée : rien", r.error === "order_not_delivered", r);
// Fausse commande « Livrée » écrite à la main (comme un ancien bug) : refusée
put("orders", "fake", { buyerId: "A", sellerIds: ["S"], status: "Livrée", payment: "portefeuille" });
put("orderDetails", "fake", { items: [{ sellerId: "S", price: 5000000, qty: 1 }], subtotal: 5000000, total: 5000000 });
r = await call("wallet-write", "S", { operation: "settle_order_payouts", orderId: "fake" });
check("fausse commande livrée sans preuve : refusée", r.error === "delivery_not_verified", r);
get("orders", "fake").deliveryVerified = true;
r = await call("wallet-write", "S", { operation: "settle_order_payouts", orderId: "fake" });
check("fausse commande sans paiement : refusée", r.error === "payment_not_proven", r);
const [s1, s2, s3] = await Promise.all([1, 2, 3].map(() => call("wallet-write", "A", { operation: "settle_order_payouts", orderId: "o2" })));
const led = get("earningsLedgers", "+22370000002");
check("3 demandes en même temps : 1 seul versement", led && led.transactions.length === 1 && Math.round(led.total) === 9300, { led, s1, s2, s3 });

console.log("== Annulation et stock");
const before = get("products", "P").stock;
r = await call("order-write", "B", { docId: "o3b", data: { ...get("orders", "o3b"), status: "Annulée" } });
check("annulation : stock remis", get("products", "P").stock === before + 1, { before, after: get("products", "P").stock });
r = await call("order-write", "B", { docId: "o3b", data: { ...get("orders", "o3b"), status: "Annulée" } });
check("pas remis deux fois", get("products", "P").stock === before + 1);

console.log("== Transferts et cagnottes");
put("wallets", "+22370000006", { phone: "+22370000006", balance: 1000, transactions: [] });
const tr = await Promise.all([1, 2].map(() => call("wallet-write", "A", { operation: "transfer", toAccountId: "S", amount: 1000, reason: "transfert_envoye" })));
check("2 transferts du même argent : 1 seul passe", tr.filter((x) => x.success).length === 1 && get("wallets", "+22370000006").balance === 0, tr);
put("cagnottes", "C1", { creatorId: "S", title: "Mariage", status: "active", balance: 0, contributions: [] });
put("wallets", "+22370000006", { phone: "+22370000006", balance: 3000, transactions: [] });
DB.rows = DB.rows.filter((x) => !(x.collection === "wallets" && x.id === "+22370000006" && x.data.balance === 0));
r = await call("wallet-write", "A", { operation: "contribute_to_cagnotte", cagnotteId: "C1", amount: 2000 });
check("cotisation", r.success && get("cagnottes", "C1").balance === 2000, r);
const sBefore = get("wallets", "+22370000002").balance;
const wd = await Promise.all([1, 2, 3].map(() => call("wallet-write", "S", { operation: "withdraw_cagnotte", cagnotteId: "C1" })));
check("3 retraits en même temps : 2000 versés une seule fois", get("wallets", "+22370000002").balance === sBefore + 2000 && get("cagnottes", "C1").status === "closed", { wd, after: get("wallets", "+22370000002").balance, sBefore });
r = await call("secure-write", "A", { operation: "save", collection: "cagnottes", doc: { id: "C1", creatorId: "A", status: "active", title: "Vol" } });
check("cagnotte d'un autre non modifiable", r.success === false, r);
r = await call("secure-write", "A", { operation: "save", collection: "cagnottes", doc: { id: "C2", creatorId: "A", title: "Ma cagnotte", balance: 999999, status: "closed" } });
check("création : solde 0, active", r.success && get("cagnottes", "C2").balance === 0 && get("cagnottes", "C2").status === "active", r);

console.log("== Réservations (ARG-4)");
r = await call("secure-write", "A", { operation: "save", collection: "bookings", doc: { id: "BK1", productId: "P", buyerId: "A", price: 1, paymentStatus: "paid" } });
check("réservation créée sans « payé » et au vrai prix", r.success && !get("bookings", "BK1").paymentStatus && get("bookings", "BK1").price === 10000, r);
r = await call("secure-write", "A", { operation: "save", collection: "bookings", doc: { ...get("bookings", "BK1"), paymentStatus: "paid", status: "Confirmée" } });
check("client ne peut pas se marquer payé ni confirmer", !get("bookings", "BK1").paymentStatus && get("bookings", "BK1").status === "Nouvelle", get("bookings", "BK1"));
r = await call("secure-write", "S", { operation: "save", collection: "bookings", doc: { ...get("bookings", "BK1"), status: "Confirmée" } });
check("vendeur confirme", get("bookings", "BK1").status === "Confirmée", r);

console.log("== Stock d'un concurrent (CMD-5)");
const st = get("products", "P").stock;
r = await call("secure-write", "A", { operation: "save", collection: "products", doc: { ...get("products", "P"), stock: 0 } });
check("stock non modifiable par un autre", get("products", "P").stock === st, r);

console.log("== Codes masqués (personal-data)");
r = await call("personal-data", "S", {});
const so = (r.orders || []).find((o: any) => o.id === "o3");
check("vendeur voit •••• au lieu de l'OTP", so && so.otp === "••••", so);
r = await call("personal-data", "B", {});
const bo = (r.orders || []).find((o: any) => o.id === "o3");
check("acheteur voit son OTP", bo && bo.otp === "1234", bo);

console.log("== Code de paiement (ARG-5)");
let lastR: any = null;
for (let i = 0; i < 6; i++) lastR = await call("wallet-write", "A", { operation: "redeem_payment_code", code: "12345" + i, amount: 100 });
check("6e essai bloqué", lastR.error === "too_many_attempts", lastR);


console.log("== Point de retrait");
r = await call("order-write", "B", { docId: "rl", data: order("rl", { deliveryMode: "relais", relaisShopId: "R", otp: undefined, codeDepot: "1111", codeRetrait: "2222", commissionAmount: 999999 }) });
check("commande relais créée, commission recalculée", r.success && get("orders", "rl").commissionAmount === 200, get("orders", "rl"));
let rl = get("orders", "rl");
await call("order-write", "L", { docId: "rl", data: { ...rl, status: "En route", livreurId: "L" } });
r = await call("order-write", "L", { docId: "rl", data: { ...get("orders", "rl"), status: "En boutique" }, deliveryCode: "1111" });
check("livreur ne confirme pas le dépôt à la place de la boutique", r.error === "not_allowed" || r.error === "bad_code", r);
r = await call("order-write", "R", { docId: "rl", data: { ...get("orders", "rl"), status: "En boutique" }, deliveryCode: "1111" });
check("boutique : bon code de dépôt", r.success && get("orders", "rl").status === "En boutique", r);
r = await call("order-write", "R", { docId: "rl", data: { ...get("orders", "rl"), status: "Livrée" }, deliveryCode: "1111" });
check("code de dépôt ne sert pas au retrait", r.error === "bad_code", r);
r = await call("order-write", "R", { docId: "rl", data: { ...get("orders", "rl"), status: "Livrée" }, deliveryCode: "2222" });
check("retrait avec le bon code", r.success && get("orders", "rl").deliveryVerified === true, r);
r = await call("personal-data", "L", {});
const lo = (r.orders || []).find((o: any) => o.id === "rl");
check("livreur attribué voit le code de dépôt, pas le code de retrait", lo && lo.codeDepot === "1111" && lo.codeRetrait === "••••", lo);

console.log("== Ancienne app (débit avant la commande)");
get("wallets", "+22370000006").balance = 20000;
r = await call("wallet-write", "A", { operation: "debit", amount: 11000, reason: "achat_boutique", meta: { orderId: "old1" } });
const r2 = await call("wallet-write", "A", { operation: "debit", amount: 11000, reason: "achat_boutique", meta: { orderId: "old1" } });
check("ancien débit : une seule fois par commande", r.success && r2.error === "already_paid", { r, r2 });
r = await call("order-write", "A", { docId: "old1", data: order("old1", { buyerId: "A", payment: "portefeuille" }) });
check("ancienne app : commande payée acceptée", r.success && get("orders", "old1").paymentStatus === "paid", r);

console.log("\nRésultat : " + pass + " réussis, " + failN + " échoués");
