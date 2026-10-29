// ============================================================
// Fonction serveur : secure-write (version 2026-10-29)
// Écritures protégées (comptes, articles, boosts, réglages…).
// Nouveau (audit) : cagnottes et réservations passent ici ; le stock d'un
// article ne peut plus être changé par un autre que son vendeur.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token, x-app-secret"
};
const ADMIN_ONLY = ["settings", "nationalAdmins", "sourcingAgentWhitelist", "group2GlobalWhitelist", "apiPartners", "webhookPartners", "dashboardPartners", "platformCommissions", "vipAds"];
const ACCOUNT_PROTECTED = ["verified", "verificationStatus", "banned", "isSourcingAgent", "testModeEnabled", "livreurApplicationStatus", "relaisApplicationStatus", "role", "affiliateCode", "referredBy"];
const ACCOUNT_SERVER_MANAGED = ["affiliateBalance", "affiliateReferrals", "affiliateEarnings", "verifiedSalesTotal", "verifiedSalesCount"];
const ACCOUNT_CROSS_BOOL = ["hasNewBuyerStatusAlert", "hasNewSellerOrderAlert", "hasRefusalAlert"];
const ACCOUNT_CROSS_COUNT = ["livreurRefusalCount", "unclaimedParcelCount"];
interface Ctx { isAdmin: boolean; isEmployee: boolean; callerIds: string[]; onSourcingList: boolean; affiliateCodeTaken?: boolean; }
function sameJson(a: unknown, b: unknown) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
function keepServerManaged(current: any, out: any) {
if (!current) return out;
for (const f of ACCOUNT_SERVER_MANAGED) {
if (f in current) out[f] = current[f]; else delete out[f];
}
return out;
}
function ruleAccount(current: any, incoming: any, ctx: Ctx): any {
if (ctx.isAdmin || ctx.isEmployee) return keepServerManaged(current, { ...(current || {}), ...incoming });
if (!current) return null; // création : uniquement via l'inscription (register-account)
const mine = ctx.callerIds.includes(current.id);
if (mine) {
const out: any = { ...current, ...incoming, id: current.id };
for (const f of ACCOUNT_PROTECTED) {
if (f in current) out[f] = current[f]; else delete out[f];
}
keepServerManaged(current, out);
if (incoming.verificationStatus === "pending" && current.verificationStatus !== "approved") out.verificationStatus = "pending";
if (incoming.livreurApplicationStatus === "pending" && current.livreurApplicationStatus !== "approved") out.livreurApplicationStatus = "pending";
if (incoming.relaisApplicationStatus === "pending" && current.relaisApplicationStatus !== "approved") out.relaisApplicationStatus = "pending";
if (incoming.isSourcingAgent === true && (current.isSourcingAgent === true || ctx.onSourcingList)) out.isSourcingAgent = true;
const r = incoming.role;
const canBe: Record<string, boolean> = {
acheteur: true, vendeur: true,
livreur: current.livreurApplicationStatus === "approved" || current.role === "livreur",
point_vente: current.relaisApplicationStatus === "approved" || current.role === "point_vente",
agent_sourcing: out.isSourcingAgent === true,
};
if (typeof r === "string" && canBe[r]) out.role = r;
if (!current.affiliateCode && typeof incoming.affiliateCode === "string"
&& /^REF[A-Za-z0-9_-]{4,40}$/.test(incoming.affiliateCode) && !ctx.affiliateCodeTaken) {
out.affiliateCode = incoming.affiliateCode;
}
if (!current.referredBy && typeof incoming.referredBy === "string" && /^REF[A-Za-z0-9_-]{4,40}$/.test(incoming.referredBy)
&& incoming.referredBy !== (current.affiliateCode || out.affiliateCode)) {
out.referredBy = incoming.referredBy;
}
return out;
}
const out: any = { ...current };
let changed = false;
for (const f of ACCOUNT_CROSS_BOOL) {
if (f in incoming && typeof incoming[f] === "boolean" && incoming[f] !== current[f]) { out[f] = incoming[f]; changed = true; }
}
for (const f of ACCOUNT_CROSS_COUNT) {
if (f in incoming && typeof incoming[f] === "number") {
const cur = Number(current[f]) || 0, nv = Math.floor(incoming[f]);
if (nv >= 0 && nv <= cur + 1 && nv !== cur) { out[f] = nv; changed = true; }
}
}
return changed ? out : current;
}
function onlyOwnVoteChange(before: unknown, after: unknown, callerIds: string[]): string[] | null {
const b = Array.isArray(before) ? before as string[] : [];
const a = Array.isArray(after) ? after as string[] : [];
const added = a.filter((x) => !b.includes(x)), removed = b.filter((x) => !a.includes(x));
if (added.concat(removed).every((x) => callerIds.includes(x))) return a;
return null;
}
function ruleProduct(current: any, incoming: any, ctx: Ctx): any {
if (ctx.isAdmin || ctx.isEmployee) return incoming;
if (!current) {
if (!incoming || !ctx.callerIds.includes(incoming.sellerId)) return null;
const out: any = { ...incoming };
if (out.moderationStatus !== "pending") delete out.moderationStatus;
delete out.moderationReason;
return out;
}
const isOwner = ctx.callerIds.includes(current.sellerId);
if (isOwner) {
const out: any = { ...current, ...incoming, id: current.id, sellerId: current.sellerId };
for (const f of ["moderationStatus", "moderationReason"]) { if (f in current) out[f] = current[f]; else delete out[f]; }
return out;
}
const out: any = { ...current };
// Audit 28/10/2026 (CMD-5) : le stock d'un article n'est plus modifiable par
// un autre que son vendeur — order-write le retire et le remet lui-même.
for (const f of ["likedBy", "dislikedBy"]) {
if (f in incoming) { const v = onlyOwnVoteChange(current[f], incoming[f], ctx.callerIds); if (v) out[f] = v; }
}
if (Array.isArray(incoming.reportedBy)) {
const before = Array.isArray(current.reportedBy) ? current.reportedBy : [];
const added = incoming.reportedBy.filter((x: string) => !before.includes(x));
if (added.length && added.every((x: string) => ctx.callerIds.includes(x))) {
out.reportedBy = before.concat(added.slice(0, 1));
const reasons = Array.isArray(current.reportReasons) ? current.reportReasons : [];
const newReason = Array.isArray(incoming.reportReasons) ? incoming.reportReasons[incoming.reportReasons.length - 1] : null;
out.reportReasons = newReason ? reasons.concat([{ reason: String(newReason.reason || "").slice(0, 60), at: Date.now() }]) : reasons;
out.reportCount = out.reportedBy.length;
if (out.reportCount >= 3 && current.moderationStatus !== "rejected") { out.moderationStatus = "pending"; out.moderationReason = "Signalé " + out.reportCount + " fois par des utilisateurs"; }
}
}
if (typeof incoming.staleWarningLastSentAt === "number") out.staleWarningLastSentAt = incoming.staleWarningLastSentAt;
return out;
}
// ---- Cagnottes (audit ARG-3) : création par soi-même, argent géré par wallet-write ----
const CAGNOTTE_SERVER = ["balance", "contributions", "status", "closedAt", "closingAt", "creatorId", "createdAt"];
function ruleCagnotte(current: any, incoming: any, ctx: Ctx): any {
const clean = (v: unknown, n: number) => String(v || "").slice(0, n);
if (!current) {
if (!incoming || !ctx.callerIds.includes(String(incoming.creatorId || ""))) return null;
return { id: String(incoming.id), creatorId: String(incoming.creatorId), creatorName: clean(incoming.creatorName, 80), creatorPhone: clean(incoming.creatorPhone, 30),
country: clean(incoming.country || "Mali", 40), title: clean(incoming.title, 120), description: clean(incoming.description, 1000),
targetAmount: typeof incoming.targetAmount === "number" && incoming.targetAmount > 0 ? Math.round(incoming.targetAmount) : null,
balance: 0, contributions: [], status: "active", createdAt: Date.now() };
}
if (!(ctx.isAdmin || ctx.isEmployee || ctx.callerIds.includes(current.creatorId))) return null;
const out: any = { ...current };
for (const f of ["title", "description", "targetAmount", "creatorName", "image"]) if (f in incoming) out[f] = f === "targetAmount" ? (typeof incoming[f] === "number" && incoming[f] > 0 ? Math.round(incoming[f]) : null) : clean(incoming[f], f === "description" ? 1000 : 300);
for (const f of CAGNOTTE_SERVER) { if (f in current) out[f] = current[f]; else delete out[f]; }
return out;
}
// ---- Réservations (audit ARG-4) : le paiement n'est écrit que par LigdiCash (serveur) ----
const BOOKING_PAYMENT = ["paymentStatus", "paidAt", "paymentRef", "paidAmount", "paymentOperator"];
const BOOKING_STATUSES = ["Nouvelle", "Contactée", "Confirmée", "Terminée", "Annulée", "Refusée"];
async function ruleBooking(current: any, incoming: any, ctx: Ctx, getDoc: (c: string, id: string) => Promise<any>): Promise<any> {
if (!current) {
if (!incoming || !ctx.callerIds.includes(String(incoming.buyerId || ""))) return null;
const prod = await getDoc("products", String(incoming.productId || ""));
if (!prod || ctx.callerIds.includes(prod.sellerId)) return null;
const out: any = { ...incoming, id: String(incoming.id), sellerId: prod.sellerId, price: prod.price, productName: String(prod.name || incoming.productName || "").slice(0, 160), status: "Nouvelle", createdAt: Date.now(), note: String(incoming.note || "").slice(0, 1000) };
for (const f of BOOKING_PAYMENT) delete out[f];
return out;
}
const isSeller = ctx.callerIds.includes(current.sellerId), isBuyer = ctx.callerIds.includes(current.buyerId), staff = ctx.isAdmin || ctx.isEmployee;
if (!staff && !isSeller && !isBuyer) return null;
const out: any = staff ? { ...current, ...incoming, id: current.id } : { ...current };
if (!staff) {
const st = incoming.status;
if (typeof st === "string" && st !== current.status && BOOKING_STATUSES.includes(st)) {
if (isSeller || (isBuyer && st === "Annulée")) out.status = st;
}
if (isBuyer && typeof incoming.note === "string") out.note = incoming.note.slice(0, 1000);
}
for (const f of BOOKING_PAYMENT) { if (f in current) out[f] = current[f]; else delete out[f]; }
for (const f of ["buyerId", "sellerId", "productId", "price", "createdAt"]) { if (f in current) out[f] = current[f]; }
return out;
}
function ruleDelete(collection: string, current: any, ctx: Ctx): boolean {
if (ctx.isAdmin) return true;
if (ADMIN_ONLY.includes(collection)) return false;
if (!current) return true; // rien à supprimer
if (ctx.isEmployee && (collection === "accounts" || collection === "products")) return true;
if (collection === "accounts") return ctx.callerIds.includes(current.id);
if (collection === "products") return ctx.callerIds.includes(current.sellerId) || current.sellerId === "seed";
if (collection === "boosts") return ctx.callerIds.includes(current.sellerId);
if (collection === "cagnottes" || collection === "bookings") return ctx.isEmployee;
return false;
}
function fromBase64Url(b64url: string): Uint8Array {
const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
const str = atob(b64);
const bytes = new Uint8Array(str.length);
for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
return bytes;
}
function toBase64Url(bytes: Uint8Array): string {
let str = ""; for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const SESSION_MS = 30 * 24 * 3600 * 1000;
const REFRESH_GRACE_MS = 180 * 24 * 3600 * 1000;
async function hmacKey() {
const secret = Deno.env.get("SESSION_SECRET");
if (!secret) throw new Error("SESSION_SECRET manquant");
return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signSession(accountId: string): Promise<string> {
const now = Date.now();
const p64 = toBase64Url(new TextEncoder().encode(JSON.stringify({ accountId, purpose: "session", issuedAt: now, expiresAt: now + SESSION_MS })));
const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(p64)));
return p64 + "." + toBase64Url(sig);
}
async function readSignedToken(token: string | null): Promise<any> {
if (!token) return null;
const parts = token.split(".");
if (parts.length !== 2) return null;
try {
if (!(await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(parts[1]), new TextEncoder().encode(parts[0])))) return null;
const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
if (!payload.accountId || payload.purpose !== "session" || typeof payload.expiresAt !== "number") return null;
return payload;
} catch { return null; }
}
const isStaffId = (id: string) => /^(admin_|national_admin_|dashboard_partner_)/.test(id);
const isLowRiskAccount = (a: any) => a && !a.banned && (!a.role || a.role === "acheteur") && !a.shopName && !a.payoutNumber && !(Number(a.affiliateBalance) > 0) && a.livreurApplicationStatus !== "approved" && a.relaisApplicationStatus !== "approved" && !a.isSourcingAgent;
async function verifySession(req: Request) {
const token = req.headers.get("X-Session-Token");
if (!token) return null;
const parts = token.split(".");
if (parts.length !== 2) return null;
try {
const secret = Deno.env.get("SESSION_SECRET");
if (!secret) return null;
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
if (!valid) return null;
const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
if (!payload.accountId || payload.purpose !== "session" || typeof payload.expiresAt !== "number" || Date.now() > payload.expiresAt) return null;
return payload;
} catch { return null; }
}
function json(body: Record<string, unknown>, status = 200) {
return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const norm = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
const SECURE = ["accounts", "products", "boosts", "cagnottes", "bookings", ...ADMIN_ONLY];
Deno.serve(async (req) => {
if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
try {
const body = await req.json();
const op = body.operation, collection = String(body.collection || "");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
if (op === "find_account") {
const name = String(body.name || "").trim().toLowerCase();
const digits = String(body.phone || "").replace(/\D/g, "");
const full = String(body.fullPhone || "").replace(/\D/g, "");
if (!name || digits.length < 6) return json({ success: false, error: "invalid_input" }, 400);
const { data: rows } = await db.from("app_data").select("data").eq("collection", "accounts").ilike("data->>phone", "%" + digits);
const match = (rows || []).map((r: any) => r.data).find((a: any) => {
const ad = String(a.phone || "").replace(/\D/g, "");
return (ad === full || ad.endsWith(digits)) && String(a.name || "").trim().toLowerCase() === name;
});
if (!match) return json({ success: true, found: false });
const out: Record<string, unknown> = { success: true, found: true, accountId: match.id, hasPassword: !!match.hasPassword };
if (!match.hasPassword && isLowRiskAccount(match)) out.sessionToken = await signSession(match.id);
else if (!match.hasPassword) out.needsHelp = true;
return json(out);
}
if (op === "stale_products_sweep") {
const now = Date.now();
const { data: stRow } = await db.from("app_data").select("data").eq("collection", "settings").eq("id", "stale_sweep_state").maybeSingle();
const last = stRow && stRow.data ? Number(stRow.data.lastRunAt) || 0 : 0;
if (!body.force && now - last < 6 * 3600 * 1000) return json({ success: true, skipped: true });
await db.from("app_data").upsert({ collection: "settings", id: "stale_sweep_state", data: { id: "stale_sweep_state", lastRunAt: now }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
const DAY = 24 * 3600 * 1000, WARN = 60 * DAY, DEL = 90 * DAY, EVERY = 4 * DAY;
const { data: rows } = await db.from("app_data").select("data").eq("collection", "products").eq("data->>sellerType", "particulier").lt("data->>createdAt", String(now - WARN)).limit(2000);
let deleted = 0, warned = 0;
const notify = async (userId: string, message: string) => {
if (!userId) return;
const nid = "n-" + now.toString(36) + Math.random().toString(36).slice(2, 8);
await db.from("app_data").insert({ collection: "notifications", id: nid, data: { id: nid, channel: "whatsapp", message, userId, time: Date.now(), read: false, target: "seller-products", senderId: "system" }, updated_at: new Date().toISOString() });
};
for (const r of (rows || [])) {
const p: any = r.data;
if (!p || !p.id) continue;
const created = Number(p.createdAt) || 0;
if (!created || now - created < WARN) continue; // sécurité : jamais un article récent
if (now - created >= DEL) {
await db.from("app_data").delete().eq("collection", "products").eq("id", p.id);
await notify(p.sellerId, "🗑️ Votre article \"" + String(p.name || "").slice(0, 80) + "\" a été supprimé automatiquement après 3 mois sans actualisation.");
deleted++;
} else if (now - (Number(p.staleWarningLastSentAt) || 0) >= EVERY) {
const delDate = new Date(created + DEL).toLocaleDateString("fr-FR", { timeZone: "Africa/Bamako" });
await notify(p.sellerId, "⏳ Votre article \"" + String(p.name || "").slice(0, 80) + "\" n'a pas été actualisé depuis longtemps. Il sera supprimé automatiquement le " + delDate + " si vous ne l'actualisez pas.");
p.staleWarningLastSentAt = now;
await db.from("app_data").upsert({ collection: "products", id: p.id, data: p, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
warned++;
}
}
return json({ success: true, deleted, warned });
}
if (op === "track_visit") {
const vid = String(body.vid || "");
if (!/^[a-z0-9]{10,40}$/.test(vid)) return json({ success: false, error: "invalid_input" }, 400);
const day = new Date().toISOString().slice(0, 10);
const src = ["google", "facebook", "whatsapp", "tiktok", "lien_article", "parrainage", "autre_site", "direct"].includes(body.src) ? body.src : "direct";
const member = body.member === true;
const { data: idsRow } = await db.from("app_data").select("data").eq("collection", "visitIds").eq("id", day).maybeSingle();
const ids: Record<string, number> = (idsRow && idsRow.data && idsRow.data.ids) || {};
const seenAs = ids[vid];
if (seenAs === 2 || (seenAs === 1 && !member)) return json({ success: true, counted: false });
const { data: stRow2 } = await db.from("app_data").select("data").eq("collection", "visitStats").eq("id", day).maybeSingle();
const st: any = (stRow2 && stRow2.data) || { id: day, visitors: 0, guests: 0, members: 0, sources: {} };
if (seenAs === 1 && member) { st.guests = Math.max(0, st.guests - 1); st.members++; ids[vid] = 2; }
else {
if (Object.keys(ids).length >= 50000) return json({ success: true, counted: false });
st.visitors++; if (member) st.members++; else st.guests++;
st.sources[src] = (st.sources[src] || 0) + 1;
ids[vid] = member ? 2 : 1;
}
const nowIso = new Date().toISOString();
await db.from("app_data").upsert([
{ collection: "visitIds", id: day, data: { id: day, ids }, updated_at: nowIso },
{ collection: "visitStats", id: day, data: st, updated_at: nowIso }
], { onConflict: "collection,id" });
return json({ success: true, counted: true });
}
if (op === "refresh_session") {
const old = await readSignedToken(req.headers.get("X-Session-Token"));
if (!old || isStaffId(old.accountId)) return json({ success: false, error: "cannot_refresh" }, 401);
if (Date.now() - old.expiresAt > REFRESH_GRACE_MS) return json({ success: false, error: "too_old" }, 401);
const { data: r1 } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", old.accountId).maybeSingle();
const owner: any = r1 ? r1.data : null;
if (!owner || owner.banned) return json({ success: false, error: "account_not_found" }, 401);
let target = owner;
const wanted = String(body.accountId || "");
if (wanted && wanted !== owner.id) {
const { data: r2 } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", wanted).maybeSingle();
const other: any = r2 ? r2.data : null;
if (!other || other.banned || !norm(other.phone) || norm(other.phone) !== norm(owner.phone)) return json({ success: false, error: "not_linked" }, 403);
target = other;
}
return json({ success: true, sessionToken: await signSession(target.id), accountId: target.id });
}
if (!SECURE.includes(collection)) return json({ success: false, error: "collection_not_handled" }, 400);
const getDoc = async (col: string, id: string) => {
const { data } = await db.from("app_data").select("data").eq("collection", col).eq("id", id).maybeSingle();
return data ? data.data : null;
};
if (collection === "settings" && op === "save" && body.doc && body.doc.id === "exchange_rates") {
const cur = await getDoc("settings", "exchange_rates");
if (cur && cur.updatedAt && Date.now() - cur.updatedAt < 20 * 3600 * 1000) return json({ success: true, doc: cur });
const r = await fetch("https://open.er-api.com/v6/latest/XOF");
const d = await r.json();
if (!d || d.result !== "success" || !d.rates) return json({ success: false, error: "rates_unavailable" }, 502);
const doc = { id: "exchange_rates", base: "XOF", rates: d.rates, updatedAt: Date.now() };
await db.from("app_data").upsert({ collection: "settings", id: "exchange_rates", data: doc, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
return json({ success: true, doc });
}
const session = await verifySession(req);
if (!session) return json({ success: false, error: "session_required" }, 401);
const callerId: string = session.accountId;
const isAdmin = callerId === "admin_owner" || callerId.startsWith("national_admin_");
let callerIds = [callerId], isEmployee = false, onSourcingList = false;
if (!isAdmin) {
const me = await getDoc("accounts", callerId);
if (!me) return json({ success: false, error: "account_not_found" }, 404);
if (me.phone) {
const { data: sib } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>phone", me.phone);
(sib || []).forEach((r: any) => { if (r.data && r.data.id && !callerIds.includes(r.data.id)) callerIds.push(r.data.id); });
const myNorm = norm(me.phone);
const [{ data: g2 }, { data: sa }, { data: nas }] = await Promise.all([
db.from("app_data").select("data").eq("collection", "group2GlobalWhitelist"),
db.from("app_data").select("data").eq("collection", "sourcingAgentWhitelist"),
db.from("app_data").select("data").eq("collection", "nationalAdmins"),
]);
const onList = (rows: any[] | null) => (rows || []).some((r: any) => r.data && norm(r.data.phone) === myNorm);
const nationalEmployee = (nas || []).some((r: any) => Array.isArray(r.data && r.data.employeeWhitelist) && r.data.employeeWhitelist.some((w: any) => norm(w && w.phone) === myNorm));
isEmployee = onList(g2) || nationalEmployee;
onSourcingList = onList(sa);
}
}
const ctx: Ctx = { isAdmin, isEmployee, callerIds, onSourcingList };
if (op === "delete") {
const id = String(body.id || "");
if (!id) return json({ success: false, error: "invalid_id" }, 400);
const current = await getDoc(collection, id);
if (!ruleDelete(collection, current, ctx)) return json({ success: false, error: "forbidden" }, 403);
await db.from("app_data").delete().eq("collection", collection).eq("id", id);
if (collection === "accounts" && current) {
await db.from("app_data").delete().eq("collection", "products").eq("data->>sellerId", id);
await db.from("app_data").delete().eq("collection", "fcmTokens").eq("data->>accountId", id);
await db.from("app_data").delete().eq("collection", "publicProfiles").eq("id", id);
}
return json({ success: true });
}
if (op === "save") {
const incoming = body.doc;
if (!incoming || typeof incoming !== "object" || !incoming.id) return json({ success: false, error: "invalid_doc" }, 400);
if (ADMIN_ONLY.includes(collection) && !isAdmin) return json({ success: false, error: "admin_only" }, 403);
const current = await getDoc(collection, String(incoming.id));
let toSave: any = incoming;
if (collection === "accounts" && incoming && typeof incoming.affiliateCode === "string" && current && !current.affiliateCode) {
const { data: sameCode } = await db.from("app_data").select("id").eq("collection", "accounts").eq("data->>affiliateCode", incoming.affiliateCode).neq("id", String(incoming.id)).limit(1);
ctx.affiliateCodeTaken = !!(sameCode && sameCode.length);
}
if (collection === "accounts") toSave = ruleAccount(current, incoming, ctx);
else if (collection === "products") toSave = ruleProduct(current, incoming, ctx);
else if (collection === "cagnottes") toSave = ruleCagnotte(current, incoming, ctx);
else if (collection === "bookings") toSave = await ruleBooking(current, incoming, ctx, getDoc);
else if (collection === "boosts") {
if (ctx.isAdmin || ctx.isEmployee) toSave = { ...(current || {}), ...incoming };
else if (current) toSave = null; // seule l'administration valide ou refuse un boost
else {
const cfgDoc: any = await getDoc("settings", "boost_config");
const cfgB = cfgDoc || { mode: "auto", itemTiers: [{ days: 1, price: 500 }, { days: 3, price: 1200 }, { days: 7, price: 2500 }, { days: 30, price: 8000 }], shopTiers: [{ days: 7, price: 5000 }, { days: 30, price: 15000 }] };
const isShop = incoming.targetType === "shop";
const tiers: any[] = (isShop ? cfgB.shopTiers : cfgB.itemTiers) || [];
const tier = tiers.find((t: any) => Number(t.days) === Number(incoming.days) && Number(t.price) === Number(incoming.price));
let owns = false;
if (isShop) owns = ctx.callerIds.includes(String(incoming.targetId)) && ctx.callerIds.includes(String(incoming.sellerId));
else { const prod: any = await getDoc("products", String(incoming.targetId || "")); owns = !!prod && ctx.callerIds.includes(prod.sellerId) && ctx.callerIds.includes(String(incoming.sellerId)); }
if (!tier || !owns) toSave = null;
else {
const now = Date.now(), auto = cfgB.mode === "auto";
toSave = { id: String(incoming.id), targetType: isShop ? "shop" : "product", targetId: String(incoming.targetId), sellerId: String(incoming.sellerId), sellerName: String(incoming.sellerName || "").slice(0, 80), country: String(incoming.country || "Mali").slice(0, 40), days: Number(tier.days), price: Number(tier.price), mode: cfgB.mode, status: auto ? "actif" : "en_attente", createdAt: now, activatedAt: auto ? now : null, expiresAt: auto ? now + Number(tier.days) * 86400000 : null };
}
}
}
if (!toSave) return json({ success: false, error: "forbidden", doc: current }, 403);
if (current && sameJson(current, toSave)) return json({ success: true, doc: current, unchanged: true });
const { error } = await db.from("app_data").upsert({ collection, id: String(toSave.id), data: toSave, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
if (error) throw error;
return json({ success: true, doc: toSave });
}
return json({ success: false, error: "unknown_operation" }, 400);
} catch (e) {
return json({ success: false, error: String(e) }, 500);
}
});
