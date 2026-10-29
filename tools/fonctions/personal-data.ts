// ============================================================
// Fonction serveur : personal-data (version 2026-10-29)
// Renvoie à chacun SES commandes, notifications et conversations.
// Nouveau : codes de livraison masqués pour tous sauf l'acheteur (voir maskCodes).
// Version 2026-10-30 (audit BDD-3/4) : les collections privées (candidatures,
// demandes, litiges, conversations Admin, jetons push, colis externes) ne
// sont plus lisibles par tous ; elles arrivent ici dans « privates » :
// tout pour l'Admin, seulement ses propres fiches pour les autres.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token, x-app-secret"
};
function fromBase64Url(b64url: string): Uint8Array {
const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
const str = atob(b64);
const bytes = new Uint8Array(str.length);
for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
return bytes;
}
async function getSessionKey(): Promise<CryptoKey> {
const secret = Deno.env.get("SESSION_SECRET");
if (!secret) throw new Error("SESSION_SECRET manquant");
return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function verifySession(req: Request) {
const token = req.headers.get("X-Session-Token");
if (!token) return null;
const parts = token.split(".");
if (parts.length !== 2) return null;
const [payloadB64, sigB64] = parts;
try {
const key = await getSessionKey();
const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigB64), new TextEncoder().encode(payloadB64));
if (!valid) return null;
const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
if (!payload.accountId || typeof payload.expiresAt !== "number") return null;
if (payload.purpose !== "session") return null;
if (Date.now() > payload.expiresAt) return null;
return payload;
} catch {
return null;
}
}
function json(body: Record<string, unknown>, status = 200) {
return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
// Audit 28/10/2026 (CMD-2) : les codes de livraison ne sont envoyés qu'à
// l'acheteur. Les autres reçoivent « •••• » (le serveur vérifie lui-même le
// code saisi). Le code de dépôt reste visible pour le livreur, qui le montre
// à la boutique de retrait.
const MASK = "••••";
function maskCodes(o: any, ids: string[], isCourier: boolean) {
if (!o || ids.includes(o.buyerId)) return o;
if (o.otp) o.otp = MASK;
if (o.codeRetrait) o.codeRetrait = MASK;
const courierOk = ids.includes(o.livreurId) || (isCourier && !o.livreurId);
if (o.codeDepot && !courierOk) o.codeDepot = MASK;
return o;
}
const PRIVATE_OWNER: Record<string, string | null> = {
verificationRequests: "accountId", livreurApplications: "accountId", relaisApplications: "accountId", relaisEditRequests: "accountId",
autreQuartierApplications: "accountId", adminConversations: "accountId", fcmTokens: "accountId", pushSubscriptions: "accountId",
externalParcelChangeRequests: "requestedByAccountId", passwordRecoveryRequests: null, pendingPayments: null, disputes: null, externalParcels: null,
};
const COURIER_INACTIVE_STATUSES = ["Annulée", "Non livrable", "Refusée au retrait", "Livrée", "En boutique"];
Deno.serve(async (req) => {
if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
try {
const session = await verifySession(req);
if (!session) return json({ success: false, error: "session_required" }, 401);
const callerId: string = session.accountId;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const q = () => db.from("app_data").select("data");
async function all(build: () => any): Promise<any[]> {
const PAGE = 900;
let offset = 0;
const out: any[] = [];
while (true) {
const { data, error } = await build().range(offset, offset + PAGE - 1);
if (error) throw error;
(data || []).forEach((r: any) => { if (r && r.data) out.push(r.data); });
if (!data || data.length < PAGE) break;
offset += PAGE;
}
return out;
}
const norm = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
async function returnEverything(hideCodes = false) {
const [orders, notifications, conversations, accounts] = await Promise.all([
all(() => q().eq("collection", "orders")),
all(() => q().eq("collection", "notifications")),
all(() => q().eq("collection", "conversations")),
all(() => q().eq("collection", "accounts")), // comptes complets : réservés aux accès complets
]);
let securityAlerts: any[] = [];
if (callerId === "admin_owner") {
const [sa, bs] = await Promise.all([
all(() => q().eq("collection", "securityAlerts")),
all(() => q().eq("collection", "botSignals")),
]);
securityAlerts = sa.concat(bs.map((b: any) => ({ ...b, type: b.type || "formulaire" })))
.sort((a: any, b: any) => (b.at || 0) - (a.at || 0)).slice(0, 200);
}
const recentLimit = Date.now() - 60 * 24 * 3600 * 1000;
const doneSt = ["Livrée", "Annulée", "Non livrable", "Refusée au retrait"];
const want = orders.filter((o: any) => o && (!doneSt.includes(o.status) || (Number(o.createdAt) || 0) > recentLimit));
const wantIds = want.map((o: any) => o.id);
const det: Record<string, any> = {}, ctc: Record<string, any> = {};
for (let i = 0; i < wantIds.length; i += 200) {
const part = wantIds.slice(i, i + 200);
const [d, c] = await Promise.all([
all(() => q().eq("collection", "orderDetails").in("id", part)),
all(() => q().eq("collection", "orderContacts").in("id", part)),
]);
d.forEach((x: any) => { if (x && x.id) det[x.id] = x; });
c.forEach((x: any) => { if (x && x.id) ctc[x.id] = x; });
}
want.forEach((o: any) => {
const d = det[o.id];
if (d) { if (Array.isArray(d.items)) o.items = d.items; for (const f of ["total", "subtotal", "commissionTotal", "affiliateAmount", "platformCommissionAmount"]) if (d[f] !== undefined) o[f] = d[f]; }
const c = ctc[o.id];
if (c) for (const f of ["buyerPhone", "contactPhone", "buyerLat", "buyerLng", "repere"]) if (c[f] !== undefined && c[f] !== null) o[f] = c[f];
});
if (hideCodes) orders.forEach((o: any) => maskCodes(o, [callerId], false));
const privates: Record<string, any[]> = {};
if (!hideCodes) {
const lists = await Promise.all(Object.keys(PRIVATE_OWNER).map((c) => all(() => q().eq("collection", c))));
Object.keys(PRIVATE_OWNER).forEach((c, i) => { privates[c] = lists[i]; });
}
return json({ success: true, full: true, orders, notifications, conversations, securityAlerts, accounts, privates });
}
if (callerId === "admin_owner" || callerId.startsWith("national_admin_")) return await returnEverything();
if (callerId.startsWith("dashboard_partner_")) return json({ success: false, error: "not_applicable" }, 403);
const { data: meRow } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", callerId).maybeSingle();
if (!meRow || !meRow.data) return json({ success: false, error: "account_not_found" }, 404);
const me = meRow.data as { id: string; phone?: string; role?: string; isSourcingAgent?: boolean };
if (me.role === "agent_sourcing" || me.isSourcingAgent) return await returnEverything(true);
if (me.phone) {
const myNorm = norm(me.phone);
const [g2, sa, nas] = await Promise.all([
all(() => q().eq("collection", "group2GlobalWhitelist")),
all(() => q().eq("collection", "sourcingAgentWhitelist")),
all(() => q().eq("collection", "nationalAdmins")),
]);
const onList = (list: any[]) => list.some((w: any) => w && norm(w.phone) === myNorm);
const isNationalEmployee = nas.some((na: any) => Array.isArray(na && na.employeeWhitelist) && onList(na.employeeWhitelist));
if (onList(g2) || isNationalEmployee) return await returnEverything();
if (onList(sa)) return await returnEverything(true);
}
const ids = new Set<string>([callerId]);
if (me.phone) {
const siblings = await all(() => q().eq("collection", "accounts").eq("data->>phone", me.phone));
siblings.forEach((a: any) => { if (a && a.id) ids.add(a.id); });
}
const idList = Array.from(ids);
const myAccounts = await all(() => q().eq("collection", "accounts").in("id", idList));
const tasks: Promise<any[]>[] = [
all(() => q().eq("collection", "notifications").in("data->>userId", idList)),
all(() => q().eq("collection", "conversations").in("data->>buyerId", idList)),
all(() => q().eq("collection", "conversations").in("data->>sellerId", idList)),
all(() => q().eq("collection", "orders").in("data->>buyerId", idList)),
all(() => q().eq("collection", "orders").in("data->>livreurId", idList)),
all(() => q().eq("collection", "orders").in("data->>relaisShopId", idList)),
...idList.map((id) => all(() => q().eq("collection", "orders").contains("data", { sellerIds: [id] }))),
...idList.map((id) => all(() => q().eq("collection", "orders").contains("data", { items: [{ sellerId: id }] })))
];
if (me.role === "livreur") {
const inactive = "(" + COURIER_INACTIVE_STATUSES.map((s) => '"' + s + '"').join(",") + ")";
tasks.push(all(() => q().eq("collection", "orders").not("data->>status", "in", inactive)));
}
const results = await Promise.all(tasks);
const dedupe = (lists: any[][]) => {
const byId: Record<string, any> = {};
lists.forEach((l) => l.forEach((d) => { if (d && d.id) byId[d.id] = d; }));
return Object.values(byId);
};
const notifications = dedupe([results[0]]);
const conversations = dedupe([results[1], results[2]]);
const orders = dedupe(results.slice(3));
const isCourier = me.role === "livreur";
const needs = orders.filter((o: any) => o && (
(isCourier && !COURIER_INACTIVE_STATUSES.includes(o.status)) ||
idList.includes(o.livreurId) || idList.includes(o.relaisShopId)));
if (needs.length) {
const ids = needs.map((o: any) => o.id);
const details: Record<string, any> = {};
for (let i = 0; i < ids.length; i += 200) {
const rows = await all(() => q().eq("collection", "orderDetails").in("id", ids.slice(i, i + 200)));
rows.forEach((d: any) => { if (d && d.id) details[d.id] = d; });
}
const accIds = new Set<string>();
needs.forEach((o: any) => {
const it = (details[o.id] && details[o.id].items) || o.items || [];
(Array.isArray(it) ? it : []).forEach((x: any) => { if (x && x.sellerId) accIds.add(x.sellerId); });
(Array.isArray(o.sellerIds) ? o.sellerIds : []).forEach((sid: string) => accIds.add(sid));
if (o.relaisShopId) accIds.add(o.relaisShopId);
});
const accs: Record<string, any> = {};
const aList = Array.from(accIds);
for (let i = 0; i < aList.length; i += 200) {
const rows = await all(() => q().eq("collection", "accounts").in("id", aList.slice(i, i + 200)));
rows.forEach((a: any) => { if (a && a.id) accs[a.id] = a; });
}
needs.forEach((o: any) => {
const d = details[o.id];
if (d && Array.isArray(d.items)) o.items = d.items.map((x: any) => ({ productId: x.productId, name: x.name, nameTranslations: x.nameTranslations, qty: x.qty, color: x.color, size: x.size, sellerId: x.sellerId, sellerName: x.sellerName, image: x.image }));
if (d && typeof d.total === "number") o.total = d.total;
if (!Array.isArray(o.items)) o.items = [];
if (isCourier || idList.includes(o.livreurId)) {
const sids = new Set<string>([...(Array.isArray(o.sellerIds) ? o.sellerIds : []), ...o.items.map((x: any) => x && x.sellerId).filter(Boolean)]);
o.pickupShops = Array.from(sids).map((sid) => accs[sid]).filter(Boolean).map((a: any) => ({ sellerId: a.id, shopName: a.shopName || a.name || "", phone: a.shopPhone || a.phone || null, shopAddress: a.shopAddress || null, shopLat: a.shopLat ?? null, shopLng: a.shopLng ?? null }));
const r = o.relaisShopId ? accs[o.relaisShopId] : null;
if (r) o.relaisShopInfo = { name: r.shopName || r.name || "", phone: r.shopPhone || r.phone || null, commune: r.commune || null, quartier: r.quartier || null, addressDetail: r.addressDetail || null, shopLat: r.shopLat ?? null, shopLng: r.shopLng ?? null };
}
});
}
orders.forEach((o: any) => maskCodes(o, idList, me.role === "livreur"));
// Fiches privées : seulement les siennes.
const privates: Record<string, any[]> = {};
const ownCols = Object.keys(PRIVATE_OWNER).filter((c) => PRIVATE_OWNER[c]);
const ownLists = await Promise.all(ownCols.map((c) => all(() => q().eq("collection", c).in("data->>" + PRIVATE_OWNER[c], idList))));
ownCols.forEach((c, i) => { privates[c] = ownLists[i]; });
const [dBuyer, ...dSellers] = await Promise.all([
all(() => q().eq("collection", "disputes").in("data->>buyerId", idList)),
...idList.map((id) => all(() => q().eq("collection", "disputes").contains("data", { sellerIds: [id] }))),
]);
privates.disputes = dedupe([dBuyer, ...dSellers]);
const pLists = await Promise.all([
all(() => q().eq("collection", "externalParcels").in("data->>relaisShopId", idList)),
all(() => q().eq("collection", "externalParcels").in("data->>livreurId", idList)),
...(isCourier ? [all(() => q().eq("collection", "externalParcels").eq("data->>status", "Créé"))] : []),
]);
privates.externalParcels = dedupe(pLists);
return json({ success: true, full: false, role: me.role || null, orders, notifications, conversations, accounts: myAccounts, privates });
} catch (e) {
return json({ success: false, error: String(e) }, 500);
}
});
