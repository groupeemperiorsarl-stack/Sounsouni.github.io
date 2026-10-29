// ============================================================
// Fonction serveur : order-write (version 2026-10-29, audit sécurité)
// Seul chemin pour créer ou modifier une commande.
// Nouveau (failles CMD-1, CMD-2, CMD-3, CMD-5, ARG-1) :
// - À la création, le serveur relit le VRAI prix de chaque article (prix
//   dégressif et prix par couleur compris) et recalcule le sous-total et le
//   total. Si le vrai total est plus cher que celui affiché au client, la
//   commande est refusée (« price_changed »).
// - On ne peut pas commander son propre article (même numéro de téléphone).
// - Paiement « portefeuille » : le serveur débite lui-même le bon montant,
//   en une seule opération sûre (walletPay). Les anciennes versions de l'app
//   (débit fait avant) sont encore acceptées si le débit est bien trouvé.
// - Statut de départ imposé par le serveur (jamais « Livrée » à la création).
// - Le stock est retiré par le serveur à la création et remis en cas
//   d'annulation ou de refus d'une boutique.
// - « Livrée » et « En boutique » : le serveur vérifie lui-même le code
//   (OTP, code de retrait, code de dépôt), saisi par le livreur ou la
//   boutique de retrait. 6 essais faux par heure au maximum.
// - Les codes, la preuve de livraison et l'état du paiement ne peuvent plus
//   être modifiés depuis un téléphone.
// - Un livreur pas encore attribué peut seulement prendre la course ou la
//   refuser, pas modifier le reste de la commande.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token"
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
  try {
    const valid = await crypto.subtle.verify("HMAC", await getSessionKey(), fromBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    if (!payload.accountId || typeof payload.expiresAt !== "number") return null;
    if (payload.purpose !== "session") return null;
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
const CONTENT_FIELDS = ["items", "subtotal", "total", "subtotalInr", "shippingCostInr", "totalInr", "exchangeRate", "commissionTotal", "affiliateAmount", "platformCommissionAmount"];
const LOCKED_AFTER_CREATION = ["buyerId", "sellerIds", "commissionRate", "commissionMode", "affiliateId", "isDigital", "isInternational", "deliveryMode", "relaisShopId", "createdAt"];
// Champs que seul le serveur écrit (jamais un téléphone, même l'Admin).
const SERVER_ONLY = ["otp", "codeRetrait", "codeDepot", "deliveryVerified", "deliveryVerifiedAt", "deliveryVerifiedBy", "stockReserved", "stockReleased", "walletPaid", "paymentIssue",
  "affiliateCommissionCredited", "sellerPayoutSettled", "commissionAmount", "commissionSettled", "commissionSettledAt", "payoutId"];
const PAYMENT_FIELDS = ["payment", "paymentStatus", "paidAt", "paymentRef", "paymentOperator", "paidAmount"];
const PAYMENTS = ["paiement_livraison", "portefeuille", "ligdicash", "manuel_international"];
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ success: false, error, ...extra }, status);
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const normP = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
const validCode = (c: unknown) => typeof c === "string" && /^\d{4,6}$/.test(c);
function newCode(): string { const r = new Uint32Array(1); crypto.getRandomValues(r); return String(1000 + (r[0] % 9000)); }
// Même calcul que getTieredPrice() dans l'app : prix de la couleur choisie,
// puis prix dégressif décalé du même écart.
function unitPrice(prod: any, qty: number, color: unknown): number {
  const base0 = num(prod.price);
  let base = base0;
  const cp = prod.colorPrices;
  if (color && cp && typeof cp === "object") { const v = Number(cp[String(color)]); if (isFinite(v) && v > 0) base = v; }
  const tiers = Array.isArray(prod.tieredPricing) ? prod.tieredPricing.slice().sort((a: any, b: any) => num(a.minQty) - num(b.minQty)) : [];
  if (!tiers.length) return base;
  const delta = base - base0;
  let price = base;
  for (const t of tiers) if (qty >= num(t.minQty)) price = Math.max(1, num(t.price) + delta);
  return price;
}
const STATUS_RANK: Record<string, number> = { "Nouvelle": 0, "Prête": 1, "Paiement reçu": 1, "Récupérée": 2, "Vérification agent": 2, "En route": 3, "Transitaire": 3, "En transit": 4, "En boutique": 4, "Arrivé": 5, "Non livrable": 8, "Refusée au retrait": 8, "Livrée": 9, "Annulée": 9 };
const VS_RANK: Record<string, number> = { "Nouvelle": 0, "Prête": 1, "Refusée": 2, "Annulée": 2 };
const CODE_WINDOW_MS = 3600 * 1000, CODE_MAX_FAILS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const session = await verifySession(req);
    if (!session) return fail(401, "session_required");
    const callerId: string = session.accountId;
    const body = await req.json().catch(() => ({}));
    const { docId, referralCode } = body;
    const data: any = body.data;
    if (!docId || typeof docId !== "string" || docId.length > 100 || !data || typeof data !== "object" || Array.isArray(data)) return fail(400, "missing_fields");
    data.id = docId;
    const requestedStatus = data.status;
    const deliveryCode = body.deliveryCode != null ? String(body.deliveryCode).trim() : null;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const getDoc = async (c: string, id: string) => { const { data: r } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return r ? (r as any).data : null; };
    const now = Date.now();

    // ---- Qui appelle ? (comptes liés par le même numéro de téléphone) ----
    const callerAcc: any = await getDoc("accounts", callerId);
    const callerPhone = callerAcc && callerAcc.phone ? callerAcc.phone : null;
    const callerIds: string[] = [callerId];
    if (callerPhone) {
      const { data: sib } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>phone", callerPhone);
      (sib || []).forEach((r: any) => { if (r.data && r.data.id && !callerIds.includes(r.data.id)) callerIds.push(r.data.id); });
    }
    let isStaff = callerId === "admin_owner" || callerId.startsWith("national_admin_");
    let isSourcingAgent = !!(callerAcc && (callerAcc.isSourcingAgent === true || callerAcc.role === "agent_sourcing"));
    if (callerPhone) {
      const me = normP(callerPhone);
      const { data: wl } = await db.from("app_data").select("collection, data").in("collection", ["group2GlobalWhitelist", "nationalAdmins", "sourcingAgentWhitelist"]);
      for (const r of (wl || []) as any[]) {
        const d = r.data || {};
        if (r.collection === "sourcingAgentWhitelist") { if (normP(d.phone) === me) isSourcingAgent = true; continue; }
        if (normP(d.phone) === me && r.collection === "group2GlobalWhitelist") isStaff = true;
        if (Array.isArray(d.employeeWhitelist) && d.employeeWhitelist.some((w: any) => w && normP(w.phone) === me)) isStaff = true;
      }
    }

    const existingOrder: any = await getDoc("orders", docId);
    const contentPayload: Record<string, any> = {};
    for (const f of CONTENT_FIELDS) { if (data[f] !== undefined) contentPayload[f] = data[f]; delete data[f]; }

    // =========================== CRÉATION ===========================
    if (!existingOrder) {
      if (!callerIds.includes(data.buyerId)) return fail(401, "not_your_order");
      const isIntl = data.isInternational === true, isDigital = data.isDigital === true;
      const isRelais = !isIntl && !isDigital && data.deliveryMode === "relais";
      const rawItems: any[] = Array.isArray(contentPayload.items) ? contentPayload.items : [];
      if (!rawItems.length || rawItems.length > 100) return fail(400, "empty_order");
      if (!PAYMENTS.includes(data.payment)) return fail(400, "payment_not_supported");
      if (isIntl && !["ligdicash", "manuel_international"].includes(data.payment)) return fail(400, "payment_not_supported");
      if (!isIntl && data.payment === "manuel_international") return fail(400, "payment_not_supported");
      if (isDigital && data.payment === "paiement_livraison") return fail(400, "payment_not_supported");

      // ---- Vrais prix, vrais vendeurs, stock ----
      const items: any[] = [];
      const prods: Record<string, any> = {};
      const qtyByProduct: Record<string, number> = {};
      let subtotal = 0, clientSubtotal = 0;
      for (const it of rawItems) {
        const pid = String((it && it.productId) || "");
        const prod = pid ? (prods[pid] || await getDoc("products", pid)) : null;
        if (!prod) return fail(409, "product_missing", { productId: pid });
        prods[pid] = prod;
        if (callerIds.includes(prod.sellerId)) return fail(409, "own_product");
        const qty = Math.max(1, Math.min(10000, Math.round(num(it.qty))));
        const unit = unitPrice(prod, qty, it.color || null);
        clientSubtotal += num(it.price) * qty;
        subtotal += unit * qty;
        qtyByProduct[pid] = (qtyByProduct[pid] || 0) + qty;
        items.push({ ...it, productId: pid, qty, price: unit, sellerId: prod.sellerId, refused: false });
      }
      for (const pid of Object.keys(qtyByProduct)) {
        const st = prods[pid].stock;
        if (!isDigital && typeof st === "number" && st < qtyByProduct[pid]) return fail(409, "out_of_stock", { productId: pid });
      }
      const sellerIds = [...new Set(items.map((it) => it.sellerId).filter(Boolean))] as string[];
      // Pas d'achat à soi-même, même avec un autre compte du même numéro.
      if (callerPhone) {
        for (const sid of sellerIds) {
          const s = await getDoc("accounts", sid);
          if (s && s.phone && normP(s.phone) === normP(callerPhone)) return fail(409, "own_product");
        }
      }
      if (isRelais && callerIds.includes(String(data.relaisShopId || ""))) return fail(409, "own_product");

      // ---- Montants recalculés ----
      let total: number;
      if (isIntl) {
        if (clientSubtotal + 1 < subtotal || num(contentPayload.subtotalInr) + 1 < subtotal) return fail(409, "price_changed");
        const rate = num(contentPayload.exchangeRate);
        if (rate < 5 || rate > 10 || num(contentPayload.subtotal) + 1 < subtotal * rate * 0.99) return fail(409, "price_changed");
        contentPayload.subtotalInr = subtotal;
        total = num(contentPayload.total);
        data.deliveryFee = Math.max(0, Math.round(num(data.deliveryFee)));
      } else {
        const fee = isDigital ? 0 : Math.max(0, Math.round(num(data.deliveryFee)));
        total = subtotal + fee;
        if (total > num(contentPayload.total) + 1) return fail(409, "price_changed", { newTotal: total });
        data.deliveryFee = fee;
        contentPayload.subtotal = subtotal;
        contentPayload.total = total;
      }
      contentPayload.items = items;

      // ---- Commission et parrainage (inchangé) ----
      const cfg: any = await getDoc("settings", "commission_config");
      const totalRate = cfg && cfg.totalCommissionRate != null ? cfg.totalCommissionRate : 0.07;
      const affiliateRate = cfg && cfg.affiliateCommission != null ? cfg.affiliateCommission : 0.05;
      const commissionMode = (cfg && cfg.commissionMode === "add") ? "add" : "deduct";
      let affiliateId: string | null = null;
      const buyerAcc: any = await getDoc("accounts", String(data.buyerId));
      const effectiveCode = (buyerAcc && buyerAcc.referredBy) || referralCode;
      const buyerCreatedAt = buyerAcc ? (typeof buyerAcc.createdAt === "number" ? buyerAcc.createdAt : Date.parse(buyerAcc.createdAt || "")) : NaN;
      const withinOneYear = !isNaN(buyerCreatedAt) && (now - buyerCreatedAt) <= 365 * 24 * 3600 * 1000;
      if (effectiveCode && !isIntl && withinOneYear) {
        const { data: refRow } = await db.from("app_data").select("id, data").eq("collection", "accounts").eq("data->>affiliateCode", effectiveCode).maybeSingle();
        const samePhone = refRow && buyerAcc && buyerAcc.phone && (refRow as any).data && (refRow as any).data.phone && normP((refRow as any).data.phone) === normP(buyerAcc.phone);
        if (refRow && !callerIds.includes((refRow as any).id) && !samePhone) affiliateId = (refRow as any).id;
      }
      const sub = isIntl ? num(contentPayload.subtotal) : subtotal;
      contentPayload.commissionTotal = sub * totalRate;
      contentPayload.affiliateAmount = affiliateId ? sub * affiliateRate : 0;
      contentPayload.platformCommissionAmount = sub * (totalRate - (affiliateId ? affiliateRate : 0));
      data.commissionRate = totalRate;
      data.commissionMode = commissionMode;
      data.affiliateId = affiliateId;
      data.affiliateCommissionCredited = false;

      // ---- Statut, codes et champs serveur ----
      for (const f of SERVER_ONLY) if (!["otp", "codeRetrait", "codeDepot"].includes(f)) delete data[f];
      data.sellerIds = sellerIds;
      const vs: Record<string, string> = {};
      sellerIds.forEach((s) => { vs[s] = "Nouvelle"; });
      data.vendorStatuses = vs;
      data.status = isIntl ? "Paiement reçu" : "Nouvelle";
      data.statusHistory = [{ status: data.status, at: now, note: null }];
      data.createdAt = now;
      data.deliveredAt = null;
      delete data.cancelledAt;
      data.livreurId = null; data.livreurName = null; data.livreurPhone = null;
      if (isRelais) {
        data.codeDepot = validCode(data.codeDepot) ? data.codeDepot : newCode();
        data.codeRetrait = validCode(data.codeRetrait) ? data.codeRetrait : newCode();
        if (data.codeRetrait === data.codeDepot) data.codeRetrait = newCode();
        delete data.otp;
        const rc: any = await getDoc("settings", "relais_commission");
        const rrate = rc && typeof rc.rate === "number" && rc.rate >= 0 && rc.rate <= 1 ? rc.rate : 0.20;
        data.commissionAmount = Math.round(num(data.deliveryFee) * rrate);
        data.commissionSettled = false;
      } else if (!isIntl && !isDigital) {
        data.otp = validCode(data.otp) ? data.otp : newCode();
        delete data.codeDepot; delete data.codeRetrait;
      } else {
        delete data.otp; delete data.codeDepot; delete data.codeRetrait;
      }

      // ---- Paiement ----
      for (const f of ["paidAt", "paymentRef", "paymentOperator", "paidAmount"]) delete data[f];
      let walletDebited = false;
      if (data.payment === "paiement_livraison") data.paymentStatus = "paid"; // rien à payer d'avance (l'app l'affiche ainsi)
      else if (data.payment === "ligdicash") data.paymentStatus = "pending_payment";
      else if (data.payment === "manuel_international") data.paymentStatus = "pending_verification";
      else if (data.payment === "portefeuille") {
        if (!buyerAcc || !buyerAcc.phone) return fail(400, "no_wallet_phone");
        if (body.walletPay === true) {
          const { error: we } = await db.rpc("sns_wallet_batch", { p_ops: [{ coll: "wallets", phone: buyerAcc.phone, delta: -total, key: "achat:" + docId,
            txn: { id: crypto.randomUUID(), type: "debit", amount: total, reason: "achat_boutique", accountId: null, accountName: "Commande #" + docId.slice(-5).toUpperCase(), orderId: docId, cagnotteId: null, message: null, createdAt: now } }] });
          if (we && /insufficient_balance/.test(we.message)) return fail(402, "insufficient_balance");
          if (we && !/duplicate/.test(we.message)) throw we;
          walletDebited = !we;
          data.paymentStatus = "paid"; data.paidAt = now; data.walletPaid = true;
        } else {
          // Ancienne version de l'app : le débit a été fait juste avant.
          const w: any = await getDoc("wallets", normP(buyerAcc.phone));
          const deb = (w && Array.isArray(w.transactions) ? w.transactions : []).filter((t: any) => t && t.type === "debit" && t.reason === "achat_boutique" && t.orderId === docId);
          if (!deb.length) return fail(402, "not_paid");
          if (deb.reduce((s: number, t: any) => s + num(t.amount), 0) + 1 >= total) { data.paymentStatus = "paid"; data.paidAt = now; data.walletPaid = true; }
          else { data.paymentStatus = "pending_payment"; data.paymentIssue = "montant_debite_insuffisant"; }
        }
      }

      const { error } = await db.from("app_data").upsert({ collection: "orders", id: docId, data, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      if (error) {
        if (walletDebited) {
          await db.rpc("sns_wallet_batch", { p_ops: [{ coll: "wallets", phone: buyerAcc.phone, delta: total, key: "rembourse:" + docId,
            txn: { id: crypto.randomUUID(), type: "credit", amount: total, reason: "remboursement", accountName: "Commande #" + docId.slice(-5).toUpperCase() + " non enregistrée", orderId: docId, createdAt: Date.now() } }] });
        }
        return fail(500, error.message);
      }
      await db.from("app_data").upsert({ collection: "orderDetails", id: docId, data: contentPayload, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      // Stock retiré par le serveur (plus par le téléphone).
      if (!isDigital) {
        for (const pid of Object.keys(qtyByProduct)) {
          for (let attempt = 0; attempt < 3; attempt++) {
            const p: any = attempt === 0 ? prods[pid] : await getDoc("products", pid);
            if (!p || typeof p.stock !== "number") break;
            const { data: ok } = await db.rpc("sns_doc_patch", { p_collection: "products", p_id: pid, p_patch: { stock: Math.max(0, p.stock - qtyByProduct[pid]) }, p_expect: { stock: p.stock } });
            if (ok) break;
          }
        }
        await db.rpc("sns_doc_patch", { p_collection: "orders", p_id: docId, p_patch: { stockReserved: true }, p_expect: null });
      }
      return json({ success: true, created: true, newTotal: total, paymentStatus: data.paymentStatus, codes: { otp: data.otp || null, codeRetrait: data.codeRetrait || null, codeDepot: data.codeDepot || null } });
    }

    // =========================== MODIFICATION ===========================
    const isBuyer = callerIds.includes(existingOrder.buyerId);
    const isSeller = Array.isArray(existingOrder.sellerIds) && existingOrder.sellerIds.some((sid: string) => callerIds.includes(sid));
    const isAssignedLivreur = !!existingOrder.livreurId && callerIds.includes(existingOrder.livreurId);
    const isAvailableLivreur = !existingOrder.livreurId && !!callerAcc && callerAcc.livreurApplicationStatus === "approved";
    const isRelaisShop = !!existingOrder.relaisShopId && callerIds.includes(existingOrder.relaisShopId);
    const isIntlAgent = existingOrder.isInternational === true && isSourcingAgent;
    if (!isStaff && !isBuyer && !isSeller && !isAssignedLivreur && !isAvailableLivreur && !isRelaisShop && !isIntlAgent) return fail(401, "not_linked_to_order");

    // Livreur pas encore attribué : il ne peut que prendre la course (ou la refuser).
    let incoming: any = data;
    if (!isStaff && !isBuyer && !isSeller && !isAssignedLivreur && !isRelaisShop && !isIntlAgent && isAvailableLivreur) {
      const limited: any = { ...existingOrder };
      for (const f of ["status", "statusHistory", "vendorStatuses", "cancelReason", "cancelledAt", "refusalReason"]) if (f in data) limited[f] = data[f];
      if (data.livreurId && callerIds.includes(String(data.livreurId))) {
        limited.livreurId = String(data.livreurId);
        limited.livreurName = String(data.livreurName || "").slice(0, 80);
        limited.livreurPhone = String(data.livreurPhone || "").slice(0, 30);
      }
      if ("deliveryFee" in data) limited.deliveryFee = Math.min(num(existingOrder.deliveryFee), Math.max(0, num(data.deliveryFee)));
      incoming = limited;
    } else if (!isStaff && "livreurId" in data && data.livreurId !== existingOrder.livreurId) {
      // On ne peut s'attribuer une course qu'à soi-même, et seulement si elle est libre.
      if (!(existingOrder.livreurId == null && callerIds.includes(String(data.livreurId)) && isAvailableLivreur)) {
        incoming.livreurId = existingOrder.livreurId ?? null;
        incoming.livreurName = existingOrder.livreurName ?? null;
        incoming.livreurPhone = existingOrder.livreurPhone ?? null;
      }
    }
    const out: any = incoming;
    out.id = docId;
    for (const f of LOCKED_AFTER_CREATION) { if (f in existingOrder) out[f] = existingOrder[f]; else delete out[f]; }
    for (const f of SERVER_ONLY) { if (f in existingOrder) out[f] = existingOrder[f]; else delete out[f]; }
    const onlineUnpaid = existingOrder.payment === "ligdicash" && existingOrder.paymentStatus !== "paid";
    if (!isStaff) {
      for (const f of PAYMENT_FIELDS) { if (f in existingOrder) out[f] = existingOrder[f]; else delete out[f]; }
      if (onlineUnpaid && out.status && out.status !== existingOrder.status && out.status !== "Annulée") out.status = existingOrder.status;
    }

    // Statut par boutique (inchangé).
    if (existingOrder.vendorStatuses && typeof existingOrder.vendorStatuses === "object") {
      const merged: Record<string, string> = { ...existingOrder.vendorStatuses };
      const inc = out.vendorStatuses && typeof out.vendorStatuses === "object" ? out.vendorStatuses : {};
      const isAnyLivreur = isAssignedLivreur || isAvailableLivreur;
      for (const k of Object.keys(merged)) {
        const a = merged[k], b = inc[k];
        if (!b || (VS_RANK[b] ?? 0) <= (VS_RANK[a] ?? 0)) continue;
        const allowed = (isStaff || callerIds.includes(k) || (isAnyLivreur && b === "Refusée") || (isBuyer && b === "Annulée")) && !(onlineUnpaid && !isStaff && b === "Prête");
        if (allowed) merged[k] = b;
      }
      out.vendorStatuses = merged;
      const keys = Object.keys(merged);
      const activeKeys = keys.filter((k) => merged[k] !== "Refusée" && merged[k] !== "Annulée");
      const allReady = activeKeys.length > 0 && activeKeys.every((k) => merged[k] === "Prête");
      if (keys.length > 1 && existingOrder.status === "Nouvelle") {
        if (allReady && (out.status === "Nouvelle" || !out.status)) {
          out.status = "Prête";
          out.__promotedReady = true;
          const h = Array.isArray(out.statusHistory) ? out.statusHistory : [];
          if (!h.some((x: any) => x && x.status === "Prête")) out.statusHistory = [...h, { status: "Prête", at: now }];
        } else if (!allReady && out.status === "Prête" && !isStaff) {
          out.status = "Nouvelle";
        }
      }
    }

    // Changement de statut : pas de retour en arrière, et preuve exigée pour « Livrée » / « En boutique ».
    const oldStatus = existingOrder.status;
    const keepOldStatus = () => {
      out.status = oldStatus;
      out.statusHistory = Array.isArray(existingOrder.statusHistory) ? existingOrder.statusHistory : [];
      if ("deliveredAt" in existingOrder) out.deliveredAt = existingOrder.deliveredAt; else delete out.deliveredAt;
      if ("cancelledAt" in existingOrder) out.cancelledAt = existingOrder.cancelledAt; else delete out.cancelledAt;
    };
    let newStatus = out.status;
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      const isFinal = oldStatus === "Livrée" || oldStatus === "Annulée";
      const isStop = newStatus === "Annulée" || newStatus === "Non livrable" || newStatus === "Refusée au retrait";
      const goesBack = STATUS_RANK[oldStatus] != null && STATUS_RANK[newStatus] != null && STATUS_RANK[newStatus] < STATUS_RANK[oldStatus];
      if (!isStaff && (isFinal || (goesBack && !isStop))) keepOldStatus();
    }
    newStatus = out.status;
    const needsProof = oldStatus !== newStatus && (newStatus === "Livrée" || (newStatus === "En boutique" && existingOrder.deliveryMode === "relais"));
    if (needsProof && isStaff) {
      if (newStatus === "Livrée") { out.deliveryVerified = true; out.deliveryVerifiedAt = now; out.deliveryVerifiedBy = "staff:" + callerId; out.deliveredAt = now; }
    } else if (needsProof) {
      let expected: string | null = null, rightPerson = false;
      if (existingOrder.isDigital || existingOrder.isInternational) {
        // Numérique : remis par le serveur après paiement. International : par l'agent sourcing ou l'Admin.
        rightPerson = existingOrder.isInternational === true && isIntlAgent;
      } else if (newStatus === "En boutique") {
        expected = existingOrder.codeDepot || null; rightPerson = isRelaisShop;
      } else if (existingOrder.deliveryMode === "relais") {
        expected = existingOrder.codeRetrait || null; rightPerson = isRelaisShop;
      } else {
        expected = existingOrder.otp || null; rightPerson = isAssignedLivreur;
      }
      let proofOk = false;
      if (rightPerson && existingOrder.isInternational === true) proofOk = true;
      else if (rightPerson && expected && deliveryCode) {
        const lockId = "code:" + docId;
        const { data: lr } = await db.from("app_data").select("data").eq("collection", "loginHistory").eq("id", lockId).maybeSingle();
        const fails: number[] = (lr && (lr as any).data && Array.isArray((lr as any).data.fails) ? (lr as any).data.fails : []).filter((t: number) => now - t < CODE_WINDOW_MS);
        if (fails.length >= CODE_MAX_FAILS) return fail(429, "too_many_attempts");
        if (deliveryCode === String(expected)) proofOk = true;
        else {
          await db.from("app_data").upsert({ collection: "loginHistory", id: lockId, data: { id: lockId, kind: "ordercode", fails: [...fails, now] }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
          return fail(403, "bad_code", { left: CODE_MAX_FAILS - fails.length - 1 });
        }
      }
      if (!proofOk) {
        if (deliveryCode != null) return fail(403, rightPerson ? "bad_code" : "not_allowed");
        keepOldStatus();
      } else if (newStatus === "Livrée") {
        out.deliveryVerified = true; out.deliveryVerifiedAt = now; out.deliveryVerifiedBy = callerId; out.deliveredAt = now;
      } else {
        out.depotConfirmedAt = now;
      }
    }

    // Articles refusés par une boutique : on recalcule le montant (inchangé) et on remet le stock.
    let detailsUpdate: Record<string, unknown> | null = null;
    let det: any = null;
    const loadDet = async () => { if (!det) det = await getDoc("orderDetails", docId); return det; };
    if (out.vendorStatuses && typeof out.vendorStatuses === "object") {
      const gone = Object.keys(out.vendorStatuses).filter((k) => out.vendorStatuses[k] === "Refusée" || out.vendorStatuses[k] === "Annulée");
      if (gone.length) {
        const d = await loadDet();
        if (d && Array.isArray(d.items)) {
          let changed = false;
          d.items = d.items.map((it: any) => { if (it && gone.includes(it.sellerId) && !it.refused) { changed = true; return { ...it, refused: true }; } return it; });
          if (changed) {
            const subtotal = d.items.filter((it: any) => !it.refused).reduce((s: number, it: any) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
            const oldFee = Number(existingOrder.deliveryFee) || 0, newFee = Number(out.deliveryFee);
            const fee = isStaff ? (isFinite(newFee) ? newFee : oldFee) : Math.min(oldFee, isFinite(newFee) ? newFee : oldFee);
            const rate = Number(existingOrder.commissionRate) || 0;
            out.deliveryFee = subtotal > 0 ? fee : 0;
            const oldSub = Number(d.subtotal) || 0, ratio = oldSub > 0 ? subtotal / oldSub : 0;
            d.subtotal = subtotal;
            d.total = subtotal > 0 ? subtotal + fee : 0;
            d.commissionTotal = subtotal * rate;
            if (typeof d.affiliateAmount === "number") d.affiliateAmount = d.affiliateAmount * ratio;
            if (typeof d.platformCommissionAmount === "number") d.platformCommissionAmount = d.platformCommissionAmount * ratio;
            detailsUpdate = d;
          }
        }
      }
    }
    // Stock remis : articles refusés, ou commande annulée avant livraison.
    let stockBack: Array<{ pid: string; qty: number; key: string }> = [];
    if (existingOrder.stockReserved === true) {
      const d = await loadDet();
      const released: string[] = Array.isArray(existingOrder.stockReleased) ? existingOrder.stockReleased : [];
      const cancelledNow = out.status === "Annulée" && oldStatus !== "Annulée" && oldStatus !== "Livrée";
      (d && Array.isArray(d.items) ? d.items : []).forEach((it: any, i: number) => {
        const key = String(i);
        if (!it || released.includes(key)) return;
        if (it.refused || cancelledNow) stockBack.push({ pid: String(it.productId || ""), qty: Math.max(0, Math.round(num(it.qty))), key });
      });
      if (stockBack.length) out.stockReleased = [...released, ...stockBack.map((s) => s.key)];
    }

    const promotedReady = !!out.__promotedReady;
    delete out.__promotedReady;
    const { error } = await db.from("app_data").upsert({ collection: "orders", id: docId, data: out, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    if (error) return fail(500, error.message);
    if (detailsUpdate) await db.from("app_data").upsert({ collection: "orderDetails", id: docId, data: detailsUpdate, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
    for (const s of stockBack) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const p: any = await getDoc("products", s.pid);
        if (!p || typeof p.stock !== "number") break;
        const { data: ok } = await db.rpc("sns_doc_patch", { p_collection: "products", p_id: s.pid, p_patch: { stock: p.stock + s.qty }, p_expect: { stock: p.stock } });
        if (ok) break;
      }
    }
    return json({ success: true, promotedReady, newTotal: detailsUpdate ? (detailsUpdate as any).total : undefined, status: out.status, statusKept: requestedStatus != null && out.status !== requestedStatus, deliveryVerified: out.deliveryVerified === true });
  } catch (e) {
    console.error("order-write", e);
    return fail(500, String(e));
  }
});
