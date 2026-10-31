// ============================================================
// Fonction serveur : ligdicash-create-payment — version 2026-10-31
// Crée une facture LigdiCash (commande, boost, recharge, réservation et,
// depuis le 31/10/2026, abonnement Sounsouni Gestion « gestion »).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token"
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function fromBase64Url(s: string): Uint8Array {
const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
const str = atob(b64); const out = new Uint8Array(str.length);
for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
return out;
}
async function verifySession(req: Request) {
const token = req.headers.get("X-Session-Token");
const secret = Deno.env.get("SESSION_SECRET");
if (!token || !secret) return null;
const parts = token.split(".");
if (parts.length !== 2) return null;
try {
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
if (!(await crypto.subtle.verify("HMAC", key, fromBase64Url(parts[1]), new TextEncoder().encode(parts[0])))) return null;
const p = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
if (!p.accountId || p.purpose !== "session" || typeof p.expiresAt !== "number" || Date.now() > p.expiresAt) return null;
return p;
} catch { return null; }
}
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
function tierUnit(prod: any, qty: number): number {
let price = num(prod.price);
const tiers = Array.isArray(prod.tieredPricing) ? prod.tieredPricing.slice().sort((a: any, b: any) => num(a.minQty) - num(b.minQty)) : [];
for (const t of tiers) if (qty >= num(t.minQty)) price = num(t.price);
return price;
}
Deno.serve(async (req) => {
if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
try {
const session = await verifySession(req);
if (!session) return json({ success: false, error: "session_required" }, 401);
const callerId: string = session.accountId;
const body = await req.json().catch(() => ({}));
const kind = body.kind === "boost" ? "boost" : body.kind === "wallet" ? "wallet" : body.kind === "booking" ? "booking" : body.kind === "gestion" ? "gestion" : "order";
let refId = String((kind === "boost" ? body.boostId : kind === "wallet" ? "wallet" : kind === "booking" ? body.bookingId : kind === "gestion" ? body.companyId : body.orderId) || "");
if (!refId) return json({ success: false, error: "missing_id" }, 400);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const getDoc = async (collection: string, id: string) => {
const { data } = await db.from("app_data").select("data").eq("collection", collection).eq("id", id).maybeSingle();
return data ? (data as any).data : null;
};
const callerIds = [callerId];
const me = await getDoc("accounts", callerId);
if (me && me.phone) {
const { data: sib } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>phone", me.phone);
(sib || []).forEach((r: any) => { if (r.data && r.data.id && !callerIds.includes(r.data.id)) callerIds.push(r.data.id); });
}
let amount = 0, description = "", customerName = "", customerEmail = "", walletPhone = "", gestionDays = 0;
if (kind === "gestion") {
// Abonnement Sounsouni Gestion : seul le chef de l'entreprise paie, au tarif fixé par l'Admin.
if (!me || !me.phone) return json({ success: false, error: "no_phone" }, 400);
const myPhone = String(me.phone).replace(/\D/g, "");
const { data: mem } = await db.from("gestion_members").select("role, status").eq("company_id", refId).eq("phone", myPhone).maybeSingle();
if (!mem || (mem as any).status !== "active" || (mem as any).role !== "chef") return json({ success: false, error: "chef_only" }, 403);
const { data: comp } = await db.from("gestion_companies").select("name, plan").eq("id", refId).maybeSingle();
if (!comp) return json({ success: false, error: "not_found" }, 404);
const cfg = await getDoc("settings", "gestion_config");
if (!cfg || cfg.mode !== "paid" || (comp as any).plan === "offert") return json({ success: false, error: "not_payable" }, 409);
amount = Math.round(num(cfg.price));
gestionDays = Math.max(1, Math.round(num(cfg.days) || 30));
description = ("Abonnement Sounsouni Gestion " + gestionDays + " jours : " + String((comp as any).name || "")).slice(0, 120);
customerName = String(me.name || "");
customerEmail = String(me.email || "");
} else if (kind === "wallet") {
if (!me || !me.phone) return json({ success: false, error: "no_wallet_phone" }, 400);
walletPhone = String(me.phone);
refId = "wallet:" + walletPhone.replace(/[\s.\-()]/g, "");
amount = Math.round(num(body.amount));
description = "Recharge portefeuille Sounsouni";
customerName = String(me.name || "");
customerEmail = String(me.email || "");
} else if (kind === "booking") {
const bk = await getDoc("bookings", refId);
if (!bk) return json({ success: false, error: "not_found" }, 404);
if (!callerIds.includes(bk.buyerId)) return json({ success: false, error: "not_your_booking" }, 403);
if (bk.paymentStatus === "paid") return json({ success: false, error: "already_paid" }, 409);
if (bk.status !== "Confirmée") return json({ success: false, error: "not_payable" }, 409);
const sp = await getDoc("products", String(bk.productId || ""));
amount = Math.round(num(sp && sp.price != null ? sp.price : bk.price));
description = ("Réservation Sounsouni : " + String(bk.productName || "")).slice(0, 120);
customerName = String(bk.buyerName || (me && me.name) || "");
customerEmail = String((me && me.email) || "");
} else if (kind === "order") {
const order = await getDoc("orders", refId);
if (!order) return json({ success: false, error: "not_found" }, 404);
if (!callerIds.includes(order.buyerId)) return json({ success: false, error: "not_your_order" }, 403);
if (order.paymentStatus === "paid") return json({ success: false, error: "already_paid" }, 409);
if (order.paymentStatus !== "pending_payment" || order.status === "Annulée") return json({ success: false, error: "not_payable" }, 409);
const details = (await getDoc("orderDetails", refId)) || {};
const o = { ...order, ...details };
const items: any[] = Array.isArray(o.items) ? o.items.filter((it: any) => !it.refused) : [];
if (!items.length) return json({ success: false, error: "empty_order" }, 400);
let expected = 0;
for (const it of items) {
const prod = await getDoc("products", String(it.productId || ""));
const qty = Math.max(1, Math.round(num(it.qty)));
expected += prod ? tierUnit(prod, qty) * qty : num(it.price) * qty;
}
const subtotal = o.isInternational ? num(o.subtotalInr) : num(o.subtotal);
if (subtotal + 1 < expected) return json({ success: false, error: "price_changed" }, 409);
if (o.isInternational) {
const rate = num(o.exchangeRate);
if (rate < 5 || rate > 10 || num(o.subtotal) + 1 < subtotal * rate * 0.99) return json({ success: false, error: "price_changed" }, 409);
}
if (num(o.deliveryFee) < 0 || Math.abs(num(o.subtotal) + num(o.deliveryFee) - num(o.total)) > 1) return json({ success: false, error: "amount_mismatch" }, 409);
amount = Math.round(num(o.total));
description = "Commande Sounsouni #" + refId.slice(-5).toUpperCase();
customerName = String(order.buyerName || "");
customerEmail = String((me && me.email) || "");
} else {
const boost = await getDoc("boosts", refId);
if (!boost) return json({ success: false, error: "not_found" }, 404);
if (!callerIds.includes(boost.sellerId)) return json({ success: false, error: "not_your_boost" }, 403);
if (boost.status !== "en_attente") return json({ success: false, error: "not_payable" }, 409);
amount = Math.round(num(boost.price));
description = "Boost Sounsouni " + num(boost.days) + " jour(s)";
customerName = String(boost.sellerName || "");
}
if (amount < 100) return json({ success: false, error: "amount_too_low" }, 400);
if (amount > 2000000) return json({ success: false, error: "amount_too_high" }, 400);
const apiKey = Deno.env.get("LIGDICASH_API_KEY"), authToken = Deno.env.get("LIGDICASH_AUTH_TOKEN");
if (!apiKey || !authToken) return json({ success: false, error: "ligdicash_not_configured" }, 500);
const base = Deno.env.get("LIGDICASH_BASE_URL") || "https://app.ligdicash.com";
const direct = body.operator === "orange" || body.operator === "moov";
const opName = body.operator === "moov" ? "moov" : "orange";
let phone8 = "";
if (direct) {
phone8 = String(body.phone || "").replace(/\D/g, "");
if (phone8.length === 11 && phone8.startsWith("223")) phone8 = phone8.slice(3);
if (!/^[5-9]\d{7}$/.test(phone8)) return json({ success: false, error: "bad_phone" }, 400);
}
let mode = direct ? opName + "_direct" : "redirect";
const site = Deno.env.get("FRONTEND_URL") || "https://sounsouni.pro";
const { data: openRows } = await db.from("app_data").select("data").eq("collection", "ligdicashTransactions").eq("data->>refId", refId).eq("data->>status", "pending");
const reuse = (openRows || []).map((r: any) => r.data).find((x: any) => x && x.paymentUrl && !x.released && x.amount === amount && (x.mode || "redirect").split("_")[0] === mode.split("_")[0] && !String(x.mode || "").endsWith("_fallback") && (x.phone || "") === phone8 && Date.now() - num(x.createdAt) < (direct ? 10 : 30) * 60 * 1000);
if (reuse) return json({ success: true, transactionId: reuse.transactionId, paymentUrl: reuse.paymentUrl, returnPrefix: (Deno.env.get("FRONTEND_URL") || "https://sounsouni.pro") + "/?ligdicash=retour", reused: true, mode });
const rand = Array.from(crypto.getRandomValues(new Uint8Array(5))).map((b) => b.toString(36).padStart(2, "0")).join("").toUpperCase();
const transactionId = "SNS" + (kind === "boost" ? "B" : kind === "wallet" ? "W" : kind === "booking" ? "R" : kind === "gestion" ? "G" : "C") + Date.now().toString(36).toUpperCase() + rand;
const txn: Record<string, unknown> = { transactionId, kind, refId, buyerId: callerId, amount, status: "pending", ligdicashToken: null, createdAt: Date.now(), mode, phone: phone8, walletPhone: walletPhone || undefined, days: gestionDays || undefined };
const { error: insErr } = await db.from("app_data").insert({ collection: "ligdicashTransactions", id: transactionId, data: txn, updated_at: new Date().toISOString() });
if (insErr) throw insErr;
const back = site + "/?ligdicash=retour&txn=" + transactionId;
const callCreate = (useDirect: boolean) => fetch(base + (useDirect ? "/pay/v01/straight/checkout-invoice/create" : "/pay/v01/redirect/checkout-invoice/create"), {
method: "POST",
headers: { "Apikey": apiKey, "Authorization": "Bearer " + authToken, "Accept": "application/json", "Content-Type": "application/json" },
body: JSON.stringify({
commande: {
invoice: { items: [], total_amount: amount, devise: "XOF", description, customer: useDirect ? "223" + phone8 : "", customer_firstname: (customerName.trim().split(/\s+/)[0] || "Client").slice(0, 60), customer_lastname: (customerName.trim().split(/\s+/).slice(1).join(" ") || "Sounsouni").slice(0, 60), customer_email: customerEmail.slice(0, 120), external_id: "", otp: "" },
store: { name: "Sounsouni", website_url: site },
actions: { cancel_url: useDirect ? "" : back + "&r=annule", return_url: useDirect ? "" : back + "&r=ok", callback_url: Deno.env.get("SUPABASE_URL") + "/functions/v1/ligdicash-callback" },
custom_data: { transaction_id: transactionId }
}
})
}).then((r) => r.json()).catch(() => null);
let res = await callCreate(direct);
let push = !!(direct && res && res.response_code === "00" && res.token && !/^https:\/\//.test(String(res.response_text || "")));
if (direct && (!res || res.response_code !== "00" || !res.token)) {
console.error("LigdiCash direct refusé (" + opName + "), page LigdiCash à la place", res ? res.response_text : "network");
res = await callCreate(false); mode = opName + "_fallback"; push = false;
}
if (push) mode = opName + "_push";
if (!res || res.response_code !== "00" || !res.token || (!push && !/^https:\/\//.test(String(res.response_text || "")))) {
await db.from("app_data").update({ data: { ...txn, status: "creation_failed", error: String((res && res.response_text) || "network").slice(0, 200), wiki: res && res.wiki ? String(res.wiki).slice(0, 200) : null }, updated_at: new Date().toISOString() }).eq("collection", "ligdicashTransactions").eq("id", transactionId);
console.error("LigdiCash create refusé", res ? res.response_text : "network", res ? res.wiki : "");
return json({ success: false, error: "ligdicash_error", detail: res ? res.response_text : "network" }, 502);
}
await db.from("app_data").update({ data: { ...txn, mode, ligdicashToken: res.token, paymentUrl: push ? "" : res.response_text, history: [{ at: Date.now(), type: "create", response_code: res.response_code }] }, updated_at: new Date().toISOString() }).eq("collection", "ligdicashTransactions").eq("id", transactionId);
return json({ success: true, transactionId, paymentUrl: push ? "" : res.response_text, returnPrefix: site + "/?ligdicash=retour", mode, message: push ? String(res.response_text || "").slice(0, 160) : undefined });
} catch (e) {
console.error("ligdicash-create-payment", e);
return json({ success: false, error: "server_error" }, 500);
}
});
