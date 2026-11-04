// Pays partenaires (taux par monnaie) et colis des transitaires — sans toucher la vraie base.
import { DB } from "./faux-supabase.ts";
Deno.env.set("SESSION_SECRET", "test-secret-xyz");
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
Deno.env.set("LIGDICASH_API_KEY", "k"); Deno.env.set("LIGDICASH_AUTH_TOKEN", "t");
globalThis.fetch = (async (url: string) => String(url).includes("checkout-invoice/create") ? new Response(JSON.stringify({ response_code: "00", token: "TK1", response_text: "https://pay/x" })) : new Response("{}")) as any;
const handlers: Record<string, (r: Request) => Promise<Response>> = {};
let current = "";
// @ts-ignore
Object.defineProperty(Deno, "serve", { value: (h: any) => { handlers[current] = h; return {} as any; }, configurable: true, writable: true });
for (const f of ["order-write", "personal-data", "secure-write", "ligdicash-create-payment"]) { current = f; await import("../fonctions/" + f + ".ts"); }
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function token(accountId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-xyz"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const p = b64u(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: Date.now(), expiresAt: Date.now() + 1e7 })));
  return p + "." + b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p))));
}
async function call(fn: string, who: string, body: any) {
  const r = await handlers[fn](new Request("http://x/" + fn, { method: "POST", headers: { "X-Session-Token": await token(who), "content-type": "application/json" }, body: JSON.stringify(body) }));
  return await r.json();
}
const put = (collection: string, id: string, data: any) => DB.rows.push({ collection, id, data: { id, ...data }, updated_at: "" });
const get = (c: string, id: string) => (DB.rows.find((r) => r.collection === c && r.id === id) || { data: null }).data;
const sw = (who: string, doc: any) => call("secure-write", who, { collection: "externalParcels", operation: "save", doc });
let pass = 0, failN = 0;
function check(name: string, cond: boolean, info?: unknown) { if (cond) { pass++; console.log("  ✔", name); } else { failN++; console.log("  ✘", name, JSON.stringify(info)); } }

put("accounts", "B", { name: "Acheteur", phone: "+22370000001", createdAt: Date.now() });
put("accounts", "SC", { name: "Vendeur Chine", phone: "+8613800000001", country: "Chine", sellerType: "international" });
put("accounts", "SI", { name: "Vendeur Inde", phone: "+919800000001", country: "Inde", sellerType: "international" });
put("accounts", "T", { name: "Wang", phone: "+8613900000002", country: "Chine" });
put("accounts", "X", { name: "Inconnu", phone: "+8613900000009" });
put("accounts", "L", { name: "Livreur", phone: "+22370000003", role: "livreur", livreurApplicationStatus: "approved" });
put("accounts", "L2", { name: "Livreur 2", phone: "+22370000004", role: "livreur", livreurApplicationStatus: "approved" });
put("accounts", "R", { name: "Relais", shopName: "Point R", phone: "+22370000005", relaisApplicationStatus: "approved" });
put("accounts", "R2", { name: "Pas approuvé", phone: "+22370000006" });
put("products", "PC", { name: "Coque", price: 20, stock: 100, sellerId: "SC", country: "Chine", sellerType: "international" });
put("products", "PI", { name: "Sari", price: 1000, stock: 100, sellerId: "SI", country: "Inde", sellerType: "international" });
put("settings", "commission_config", { totalCommissionRate: 0.07, affiliateCommission: 0.05 });
put("settings", "transitaires", { list: [{ id: "t1", phone: "+86 139 0000 0002", name: "Wang Transit", country: "Chine", deliveryPayer: "choix", freightMode: "app", commissionPct: 10, customsBy: "destinataire", active: true }] });

const intl = (id: string, pid: string, price: number, rate: number, o: any = {}) => ({ id, buyerId: "B", isInternational: true, items: [{ productId: pid, price, qty: 5 }], subtotalInr: price * 5, exchangeRate: rate, subtotal: Math.round(price * 5 * rate), deliveryFee: 5000, total: Math.round(price * 5 * rate) + 5000, payment: "manuel_international", ...o });

console.log("== Taux de change par monnaie");
let r = await call("order-write", "B", { docId: "c1", data: intl("c1", "PC", 20, 84) });
check("commande Chine au taux du yuan (84) acceptée", r.success === true, r);
check("monnaie enregistrée par le serveur : CNY", get("orders", "c1").intlCurrency === "CNY" && get("orders", "c1").intlCountry === "Chine", get("orders", "c1"));
r = await call("order-write", "B", { docId: "c2", data: intl("c2", "PC", 20, 7.2) });
check("commande Chine au taux de la roupie (7,2) refusée", r.error === "price_changed", r);
r = await call("order-write", "B", { docId: "i1", data: intl("i1", "PI", 1000, 7.2) });
check("commande Inde inchangée (7,2) acceptée", r.success === true && get("orders", "i1").intlCurrency === "INR", r);
r = await call("order-write", "B", { docId: "i2", data: intl("i2", "PI", 1000, 84) });
check("commande Inde au taux du yuan refusée", r.error === "price_changed", r);
r = await call("order-write", "B", { docId: "c3", data: intl("c3", "PC", 20, 84, { country: "Inde", intlCurrency: "INR" }) });
check("faux pays envoyé par le téléphone : le serveur garde la Chine", r.success && get("orders", "c3").country === "Chine", get("orders", "c3"));
r = await call("order-write", "B", { docId: "c3", data: { ...get("orders", "c3"), country: "Inde", intlCurrency: "INR" } });
check("pays et monnaie verrouillés après création", get("orders", "c3").intlCurrency === "CNY" && get("orders", "c3").country === "Chine", get("orders", "c3"));
put("orders", "pay1", { buyerId: "B", isInternational: true, country: "Chine", intlCurrency: "CNY", paymentStatus: "pending_payment", status: "Paiement reçu", payment: "ligdicash" });
put("orderDetails", "pay1", { items: [{ productId: "PC", price: 20, qty: 5 }], subtotalInr: 100, exchangeRate: 84, subtotal: 8400, total: 13400 });
DB.rows.find((x) => x.collection === "orders" && x.id === "pay1")!.data.deliveryFee = 5000;
r = await call("ligdicash-create-payment", "B", { kind: "order", orderId: "pay1" });
check("paiement LigdiCash d'une commande Chine accepté", r.success === true, r);
put("orders", "pay2", { buyerId: "B", isInternational: true, country: "Chine", intlCurrency: "CNY", paymentStatus: "pending_payment", status: "Paiement reçu", payment: "ligdicash", deliveryFee: 5000 });
put("orderDetails", "pay2", { items: [{ productId: "PC", price: 20, qty: 5 }], subtotalInr: 100, exchangeRate: 7, subtotal: 700, total: 5700 });
r = await call("ligdicash-create-payment", "B", { kind: "order", orderId: "pay2" });
check("paiement LigdiCash avec un taux trop bas refusé", r.error === "price_changed", r);

console.log("== Transitaire : annonce d'un colis");
const parcel = (o: any = {}) => ({ id: "tp1", transitaireId: "T", trackingNumber: "CN001", recipientName: "Awa", recipientPhone: "70112233", weight: 7, zoneId: "pdr_bko", relaisShopId: "R", deliveryPaidBy: "destinataire", freightAmount: 100, freightRate: 84, deliveryFeeXof: 1, customsXof: 0, status: "Retiré", codeRetrait: "1111", ...o });
r = await sw("X", parcel({ id: "bad1", transitaireId: "X" }));
check("compte non transitaire : refusé", r.error === "forbidden", r);
r = await sw("T", parcel({ id: "bad2", relaisShopId: "R2" }));
check("Point de Retrait non approuvé : refusé", r.error === "forbidden", r);
r = await sw("T", parcel({ id: "bad3", freightRate: 7 }));
check("fret avec un faux taux : refusé", r.error === "forbidden", r);
r = await sw("T", parcel());
const tp = get("externalParcels", "tp1");
check("colis annoncé", r.success === true && tp && tp.status === "Annoncé", r);
check("prix livraison recalculé par le serveur (1000 + 2 kg × 200 = 1400)", tp.deliveryFeeXof === 1400, tp);
check("fret converti par le serveur (100 × 84 = 8400)", tp.freightXof === 8400 && tp.freightMode === "app" && tp.freightCurrency === "CNY", tp);
check("douane : réglage Admin (destinataire), montant pas encore fixé", tp.customsBy === "destinataire" && tp.customsXof === null, tp);
check("codes créés par le serveur (pas ceux du téléphone)", tp.codeRetrait !== "1111" && /^\d{4}$/.test(tp.codeRetrait) && tp.codeRetrait !== tp.codeDepot, tp);
check("Point de Retrait relu sur le serveur", tp.relaisShopName === "Point R");
r = await sw("T", { ...tp, deliveryFeeXof: 0, freightXof: 1, status: "Retiré", description: "Habits" });
check("transitaire : corrige la description, pas les prix ni le statut", get("externalParcels", "tp1").description === "Habits" && get("externalParcels", "tp1").deliveryFeeXof === 1400 && get("externalParcels", "tp1").status === "Annoncé");
r = await sw("L", { ...get("externalParcels", "tp1"), livreurId: "L", status: "Pris en charge par le livreur" });
check("livreur ne peut pas prendre un colis pas encore arrivé", r.error === "forbidden", r);
r = await sw("R", { ...get("externalParcels", "tp1"), status: "Reçu au point de retrait" });
check("Point de Retrait ne peut pas le faire avancer avant l'arrivée", r.error === "forbidden", r);
r = await sw("T", parcel({ id: "dom1", zoneId: "dom_bko", relaisShopId: null, weight: 2, address: { commune: "C6", quartier: "Sotuba", repere: "Pharmacie" } }));
check("colis à domicile annoncé (2000 F, sans Point de Retrait)", r.success && get("externalParcels", "dom1").deliveryFeeXof === 2000 && get("externalParcels", "dom1").relaisShopId === null && get("externalParcels", "dom1").deliveryType === "domicile", get("externalParcels", "dom1"));

console.log("== Arrivée, livraison à domicile, code vérifié par le serveur");
// L'équipe Sounsouni (Admin) marque l'arrivée.
const dom = get("externalParcels", "dom1");
dom.status = "Créé"; dom.customsXof = 3000;
r = await sw("L", { ...dom, livreurId: "L", livreurName: "Livreur", status: "Pris en charge par le livreur", customsXof: 0, deliveryFeeXof: 0 });
check("livreur prend le colis arrivé", r.success && get("externalParcels", "dom1").livreurId === "L", r);
check("le livreur ne touche pas aux montants", get("externalParcels", "dom1").customsXof === 3000 && get("externalParcels", "dom1").deliveryFeeXof === 2000);
r = await sw("L2", { ...get("externalParcels", "dom1"), livreurId: "L2" });
check("un autre livreur ne peut pas le reprendre", r.error === "forbidden" || get("externalParcels", "dom1").livreurId === "L", r);
r = await call("personal-data", "L", {});
const seen = (r.privates && r.privates.externalParcels || []).find((p: any) => p.id === "dom1");
check("le livreur reçoit le colis SANS le code de retrait", !!seen && seen.codeRetrait === undefined && !!seen.codeDepot, seen);
r = await call("personal-data", "T", {});
check("le transitaire voit ses colis avec le code de retrait", (r.privates.externalParcels || []).filter((p: any) => p.transitaireId === "T").length === 2 && !!(r.privates.externalParcels.find((p: any) => p.id === "dom1") || {}).codeRetrait, r.privates && r.privates.externalParcels);
r = await sw("L", { ...get("externalParcels", "dom1"), status: "Retiré", retrievalCode: "0000" });
check("mauvais code de retrait : refusé", r.error === "forbidden" && get("externalParcels", "dom1").status === "Pris en charge par le livreur", r);
r = await sw("L", { ...get("externalParcels", "dom1"), status: "Retiré", retrievalCode: get("externalParcels", "dom1").codeRetrait });
check("bon code : colis remis", r.success && get("externalParcels", "dom1").status === "Retiré", r);
check("le code saisi n'est pas gardé", !("retrievalCode" in get("externalParcels", "dom1")));

console.log("== Point de Retrait (ancien parcours, colis Alibaba…)");
r = await sw("R", { id: "ali0", trackingNumber: "LP0", platform: "Alibaba", recipientName: "Moussa", recipientPhone: "70000000", relaisShopId: "R", transitaireId: "T" });
check("Point de Retrait ne peut pas se faire passer pour un transitaire", r.error === "forbidden", r);
r = await sw("R", { id: "ali1", trackingNumber: "LP1", platform: "Alibaba", recipientName: "Moussa", recipientPhone: "70000000", relaisShopId: "R", status: "Disponible pour retrait", codeRetrait: "4321", codeDepot: "1234" });
check("Point de Retrait crée son colis Alibaba (inchangé)", r.success && !!get("externalParcels", "ali1"), r);
r = await sw("R", { ...get("externalParcels", "ali1"), status: "Retiré", retrievalCode: "9999" });
check("retrait avec un faux code : refusé", r.error === "forbidden", r);
r = await sw("R", { ...get("externalParcels", "ali1"), status: "Retiré", retrievalCode: "4321" });
check("retrait avec le bon code : accepté", r.success && get("externalParcels", "ali1").status === "Retiré", r);

r = await sw("T", parcel({ id: "tp9" }));
const tp9 = get("externalParcels", "tp9"); tp9.status = "Disponible pour retrait";
r = await sw("R", { ...tp9, status: "Retiré" });
check("colis transitaire : retrait sans code refusé (même ancienne app)", r.error === "forbidden", r);
console.log("Résultat : " + pass + " réussis, " + failN + " échoués");
if (failN) Deno.exit(1);
