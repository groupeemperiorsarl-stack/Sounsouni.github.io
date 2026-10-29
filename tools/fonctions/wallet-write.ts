// ============================================================
// Fonction serveur : wallet-write (version 2026-10-29, audit sécurité)
// Toutes les opérations d'argent du portefeuille et des gains.
// Nouveau (failles ARG-1, ARG-2, ARG-3, ARG-5) :
// - Chaque mouvement d'argent passe par la fonction SQL sns_wallet_batch :
//   une seule transaction, portefeuille verrouillé, jamais de solde négatif,
//   et une « clé unique » par versement (une même vente, un même retrait de
//   cagnotte ou un même parrainage ne peut plus être payé deux fois, même
//   avec plusieurs demandes envoyées au même instant).
// - Versement d'une commande livrée : seulement si la livraison a été
//   prouvée par le serveur (bon code saisi, ou Admin), et seulement si le
//   paiement est prouvé (débit portefeuille trouvé, LigdiCash « payé », ou
//   paiement à la livraison confirmé par le code).
// - Retrait d'une cagnotte : la cagnotte est d'abord « réservée » (une seule
//   demande peut passer), puis fermée.
// - Code de paiement : 5 essais faux en 15 minutes au maximum.
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
async function hmacHex(msg: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getSessionKey(), new TextEncoder().encode(msg)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
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
function unauthorized(reason: string) {
  return new Response(JSON.stringify({ success: false, error: reason }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function badRequest(reason: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: false, error: reason, ...extra }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function ok(body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: true, ...body }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
function normalizeWalletPhone(phone: string): string {
  return (phone || "").replace(/[\s.\-()]/g, "");
}
async function isRecognizedAdmin(callerId: string, db: ReturnType<typeof createClient>): Promise<boolean> {
  if (callerId === "admin_owner") return true;
  if (callerId.indexOf("national_admin_") === 0) {
    const { data } = await db.from("app_data").select("id").eq("collection", "nationalAdmins").eq("id", callerId.slice("national_admin_".length)).maybeSingle();
    return !!data;
  }
  return false;
}
async function canManagePayouts(callerId: string, db: ReturnType<typeof createClient>): Promise<boolean> {
  if (await isRecognizedAdmin(callerId, db)) return true;
  const { data: me } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", callerId).maybeSingle();
  const phone = me && (me as any).data && (me as any).data.phone ? normalizeWalletPhone(String((me as any).data.phone)) : "";
  if (!phone) return false;
  const { data: g2 } = await db.from("app_data").select("data").eq("collection", "group2GlobalWhitelist");
  if ((g2 || []).some((r: any) => r.data && normalizeWalletPhone(String(r.data.phone || "")) === phone)) return true;
  const { data: nas } = await db.from("app_data").select("data").eq("collection", "nationalAdmins");
  return (nas || []).some((r: any) => Array.isArray(r.data && r.data.employeeWhitelist) && r.data.employeeWhitelist.some((w: any) => normalizeWalletPhone(String((w && w.phone) || "")) === phone));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const session = await verifySession(req);
    if (!session) return unauthorized("session_required");
    const callerId: string = session.accountId;
    const body = await req.json().catch(() => ({}));
    const operation = body.operation;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const db = supabaseAdmin;

    async function getAccount(accountId: string) {
      if (!accountId) return null;
      const { data } = await db.from("app_data").select("data").eq("collection", "accounts").eq("id", String(accountId)).maybeSingle();
      return data ? (data as any).data : null;
    }
    async function getDoc(c: string, id: string) {
      const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", String(id)).maybeSingle();
      return data ? (data as any).data : null;
    }
    async function getWallet(phone: string) {
      const wid = normalizeWalletPhone(phone);
      return (await getDoc("wallets", wid)) || { id: wid, phone, balance: 0, transactions: [] };
    }
    const txnOf = (delta: number, reason: string, meta: Record<string, any>) => ({
      id: crypto.randomUUID(), type: delta >= 0 ? "credit" : "debit", amount: Math.abs(delta), reason,
      accountId: meta.accountId || null, accountName: meta.accountName || null, orderId: meta.orderId || null,
      cagnotteId: meta.cagnotteId || null, message: meta.message || null, createdAt: Date.now()
    });
    // Mouvements d'argent atomiques (voir sns_wallet_batch).
    async function moveMoney(ops: Array<{ coll: "wallets" | "earningsLedgers"; phone: string; delta: number; txn: any; key?: string | null }>) {
      const { data, error } = await db.rpc("sns_wallet_batch", { p_ops: ops.map((o) => ({ ...o, key: o.key || null })) });
      if (error) {
        const m = String(error.message || "");
        if (m.includes("insufficient_balance")) return { ok: false, error: "insufficient_balance" };
        if (m.includes("duplicate")) return { ok: false, error: "duplicate" };
        throw error;
      }
      return { ok: true, balances: (data as any) && (data as any).balances };
    }
    async function applyWalletDelta(phone: string, delta: number, reason: string, meta: Record<string, any>, key?: string) {
      const r = await moveMoney([{ coll: "wallets", phone, delta, txn: txnOf(delta, reason, meta), key }]);
      if (!r.ok) return r;
      return { ok: true, balance: r.balances ? r.balances["wallets:" + normalizeWalletPhone(phone)] : undefined };
    }
    async function creditEarnings(phone: string, amount: number, reason: string, meta: Record<string, any>, key?: string) {
      if (!phone || !amount || amount <= 0) return { ok: true };
      const t = { id: crypto.randomUUID(), amount, reason, accountId: meta.accountId || null, accountName: meta.accountName || null, orderId: meta.orderId || null, createdAt: Date.now() };
      return await moveMoney([{ coll: "earningsLedgers", phone, delta: amount, txn: t, key }]);
    }
    async function alreadyPaid(phone: string, orderId: string, reason: string): Promise<boolean> {
      if (!phone || !orderId) return false;
      const led = await getDoc("earningsLedgers", normalizeWalletPhone(phone));
      const lt = led && Array.isArray(led.transactions) ? led.transactions : [];
      if (lt.some((t: any) => t && t.orderId === orderId && t.reason === reason)) return true;
      const w: any = await getWallet(phone);
      const wt = w && Array.isArray(w.transactions) ? w.transactions : [];
      return wt.some((t: any) => t && t.orderId === orderId && t.reason === reason && t.type !== "debit");
    }
    async function getCommissionConfig() {
      const cfg: any = await getDoc("settings", "commission_config");
      return {
        totalCommissionRate: cfg && cfg.totalCommissionRate != null ? cfg.totalCommissionRate : 0.07,
        affiliateCommission: cfg && cfg.affiliateCommission != null ? cfg.affiliateCommission : 0.05
      };
    }
    async function patchDoc(c: string, id: string, patch: Record<string, unknown>, expect: Record<string, unknown> | null = null) {
      const { data, error } = await db.rpc("sns_doc_patch", { p_collection: c, p_id: id, p_patch: patch, p_expect: expect });
      if (error) throw error;
      return data;
    }

    if (operation === "get_my_state") {
      const callerAcc = await getAccount(callerId);
      const wallet = callerAcc && callerAcc.phone ? await getWallet(callerAcc.phone) : { balance: 0, transactions: [] };
      const earnings = callerAcc && callerAcc.phone ? ((await getDoc("earningsLedgers", normalizeWalletPhone(callerAcc.phone))) || { total: 0, transactions: [] }) : { total: 0, transactions: [] };
      return ok({ wallet, earnings });
    }

    if (operation === "debit") {
      // Utilisé par les anciennes versions de l'app (achat payé avant la commande).
      const { amount, reason, meta } = body;
      if (reason !== "achat_boutique") return badRequest("reason_not_allowed");
      if (typeof amount !== "number" || !(amount > 0) || amount > 5000000) return badRequest("invalid_amount");
      const callerAcc = await getAccount(callerId);
      if (!callerAcc || !callerAcc.phone) return badRequest("no_wallet_phone");
      const orderId = meta && typeof meta.orderId === "string" ? meta.orderId.slice(0, 100) : null;
      const result: any = await applyWalletDelta(callerAcc.phone, -amount, reason, { orderId, accountName: meta && meta.accountName ? String(meta.accountName).slice(0, 80) : null }, orderId ? "achat:" + orderId : undefined);
      if (!result.ok) return badRequest(result.error === "duplicate" ? "already_paid" : result.error);
      return ok({ balance: result.balance });
    }

    if (operation === "transfer") {
      const { toAccountId, amount, reason, meta } = body;
      if (!["transfert_envoye", "bon_cadeau"].includes(reason)) return badRequest("reason_not_allowed");
      if (typeof amount !== "number" || !(amount > 0) || amount > 5000000) return badRequest("invalid_amount");
      if (!toAccountId || toAccountId === callerId) return badRequest("invalid_recipient");
      const callerAcc = await getAccount(callerId);
      const recipientAcc = await getAccount(toAccountId);
      if (!callerAcc || !callerAcc.phone) return badRequest("no_wallet_phone");
      if (!recipientAcc || !recipientAcc.phone) return badRequest("recipient_not_found");
      if (normalizeWalletPhone(callerAcc.phone) === normalizeWalletPhone(recipientAcc.phone)) return badRequest("invalid_recipient");
      const message = String((meta && meta.message) || "").slice(0, 300);
      const creditReason = reason === "transfert_envoye" ? "transfert_recu" : reason;
      const r = await moveMoney([
        { coll: "wallets", phone: callerAcc.phone, delta: -amount, txn: txnOf(-amount, reason, { accountId: toAccountId, accountName: recipientAcc.shopName || recipientAcc.name, message }) },
        { coll: "wallets", phone: recipientAcc.phone, delta: amount, txn: txnOf(amount, creditReason, { accountId: callerId, accountName: callerAcc.shopName || callerAcc.name, message }) }
      ]);
      if (!r.ok) return badRequest(r.error!);
      return ok();
    }

    if (operation === "contribute_to_cagnotte") {
      const { cagnotteId, amount } = body;
      const message = String(body.message || "").slice(0, 300);
      if (typeof amount !== "number" || !(amount > 0) || amount > 5000000) return badRequest("invalid_amount");
      const cagnotte: any = cagnotteId ? await getDoc("cagnottes", String(cagnotteId)) : null;
      if (!cagnotte) return badRequest("pot_not_found");
      if (cagnotte.status !== "active") return badRequest("pot_closed");
      if (!(await getAccount(cagnotte.creatorId))) return badRequest("pot_not_found");
      const callerAcc = await getAccount(callerId);
      if (!callerAcc || !callerAcc.phone) return badRequest("no_wallet_phone");
      const r: any = await applyWalletDelta(callerAcc.phone, -amount, "cagnotte_contribution", { accountId: cagnotte.creatorId, accountName: cagnotte.title, cagnotteId: cagnotte.id, message });
      if (!r.ok) return badRequest(r.error);
      // Affichage de la cagnotte (le vrai montant est recalculé depuis les portefeuilles au retrait).
      for (let attempt = 0; attempt < 4; attempt++) {
        const c: any = await getDoc("cagnottes", cagnotte.id);
        if (!c) break;
        const contributions = (Array.isArray(c.contributions) ? c.contributions : []).concat([{ id: crypto.randomUUID(), contributorId: callerId, contributorName: callerAcc.shopName || callerAcc.name, amount, message, createdAt: Date.now() }]);
        const done = await patchDoc("cagnottes", cagnotte.id, { balance: num(c.balance) + amount, contributions }, { balance: c.balance ?? 0 });
        if (done) break;
      }
      return ok();
    }

    if (operation === "withdraw_cagnotte") {
      const cagnotteId = String(body.cagnotteId || "");
      const cagnotte: any = cagnotteId ? await getDoc("cagnottes", cagnotteId) : null;
      if (!cagnotte) return badRequest("pot_not_found");
      if (cagnotte.creatorId !== callerId) return unauthorized("not_pot_creator");
      if (cagnotte.status !== "active") return badRequest("pot_already_closed");
      const callerAcc = await getAccount(callerId);
      if (!callerAcc || !callerAcc.phone) return badRequest("no_wallet_phone");
      // Une seule demande peut « réserver » la cagnotte.
      const claimed = await patchDoc("cagnottes", cagnotteId, { status: "closing", closingAt: Date.now() }, { status: "active", creatorId: callerId });
      if (!claimed) return badRequest("pot_already_closed");
      // Montant RÉEL : l'argent vraiment débité pour CETTE cagnotte et CE créateur, moins ce qui a déjà été récupéré.
      const { data: wrows } = await db.from("app_data").select("data").eq("collection", "wallets").limit(10000);
      let given = 0, taken = 0;
      for (const r of (wrows || []) as any[]) {
        for (const t of ((r.data && Array.isArray(r.data.transactions)) ? r.data.transactions : [])) {
          if (!t || t.cagnotteId !== cagnotteId) continue;
          if (t.type === "debit" && t.reason === "cagnotte_contribution" && t.accountId === callerId) given += num(t.amount);
          if (t.type === "credit" && t.reason === "cagnotte_recuperee" && t.accountId === callerId) taken += num(t.amount);
        }
      }
      const amount = Math.max(0, Math.round(given - taken));
      if (amount > 0) {
        const r: any = await applyWalletDelta(callerAcc.phone, amount, "cagnotte_recuperee", { accountId: callerId, accountName: cagnotte.title, cagnotteId }, "cagnotte:" + cagnotteId);
        if (!r.ok && r.error !== "duplicate") {
          await patchDoc("cagnottes", cagnotteId, { status: "active" }, { status: "closing" });
          return badRequest(r.error);
        }
      }
      await patchDoc("cagnottes", cagnotteId, { status: "closed", closedAt: Date.now(), balance: 0 }, null);
      return ok({ amount });
    }

    if (operation === "settle_order_payouts") {
      const orderId = String(body.orderId || "");
      const order: any = orderId ? await getDoc("orders", orderId) : null;
      if (!order) return badRequest("order_not_found");
      if (order.status !== "Livrée") return badRequest("order_not_delivered");
      const staffCaller = await canManagePayouts(callerId, db);
      // Livraison prouvée par le serveur (code saisi) — ou produit numérique remis après paiement — ou Admin.
      if (!(order.deliveryVerified === true || order.isDigital === true || staffCaller)) return badRequest("delivery_not_verified");
      const details: any = (await getDoc("orderDetails", orderId)) || {};
      const items: Array<{ sellerId?: string; price: number; qty: number; refused?: boolean }> = Array.isArray(details.items) ? details.items.filter((it: any) => it && !it.refused) : [];
      const subtotal: number = typeof details.subtotal === "number" ? details.subtotal : 0;
      const total: number = typeof details.total === "number" ? details.total : subtotal;
      // Paiement prouvé.
      let paid = false;
      if (order.payment === "portefeuille") {
        if (order.walletPaid === true) paid = true;
        else {
          const buyer = await getAccount(order.buyerId);
          const w: any = buyer && buyer.phone ? await getWallet(buyer.phone) : null;
          const debits = (w && Array.isArray(w.transactions) ? w.transactions : []).filter((t: any) => t && t.type === "debit" && t.reason === "achat_boutique" && t.orderId === orderId);
          paid = debits.reduce((s: number, t: any) => s + num(t.amount), 0) + 1 >= total;
        }
      } else if (order.payment === "ligdicash") paid = order.paymentStatus === "paid";
      else if (order.payment === "paiement_livraison") paid = order.deliveryVerified === true || staffCaller;
      else if (order.payment === "manuel_international") paid = staffCaller;
      if (!paid) return badRequest("payment_not_proven");
      const cfg = await getCommissionConfig();
      const settled: Record<string, number> = {};
      const skipped: Record<string, string> = {};
      const marks: Record<string, boolean> = { ...(order.sellerPayoutSettled || {}) };
      let affiliateDone = !!order.affiliateCommissionCredited;
      const sellerIds = Array.isArray(order.sellerIds) ? order.sellerIds : [...new Set(items.map((it) => it.sellerId).filter(Boolean))];
      for (const sellerId of sellerIds as string[]) {
        if (marks[sellerId]) continue;
        const sellerAcc = await getAccount(sellerId);
        if (!sellerAcc) { skipped[sellerId] = "compte vendeur introuvable"; continue; }
        if (!sellerAcc.phone) { skipped[sellerId] = "vendeur sans numéro de téléphone"; continue; }
        if (await alreadyPaid(sellerAcc.phone, order.id, "vente")) { marks[sellerId] = true; skipped[sellerId] = "déjà versé (marque rétablie)"; continue; }
        const sellerPortion = items.filter((it) => it.sellerId === sellerId).reduce((sum: number, it) => sum + num(it.price) * num(it.qty), 0);
        if (!(sellerPortion > 0)) { marks[sellerId] = true; skipped[sellerId] = "rien à verser"; continue; }
        const orderRate = order.commissionRate != null ? order.commissionRate : cfg.totalCommissionRate;
        const netAmount = (sellerAcc.sellerType === "international" || order.commissionMode === "add") ? sellerPortion : sellerPortion * (1 - orderRate);
        const key = "vente:" + order.id + ":" + sellerId;
        const r: any = order.payment === "portefeuille"
          ? await applyWalletDelta(sellerAcc.phone, netAmount, "vente", { accountId: order.buyerId, orderId: order.id }, key)
          : await creditEarnings(sellerAcc.phone, netAmount, "vente", { accountId: order.buyerId, orderId: order.id }, key);
        if (!r.ok) { if (r.error === "duplicate") marks[sellerId] = true; skipped[sellerId] = r.error === "duplicate" ? "déjà versé" : String(r.error); continue; }
        marks[sellerId] = true;
        sellerAcc.verifiedSalesTotal = (sellerAcc.verifiedSalesTotal || 0) + netAmount;
        sellerAcc.verifiedSalesCount = (sellerAcc.verifiedSalesCount || 0) + 1;
        await db.from("app_data").upsert({ collection: "accounts", id: sellerId, data: sellerAcc, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
        settled[sellerId] = netAmount;
      }
      if (order.affiliateId && !affiliateDone && !order.isInternational && order.affiliateId !== order.buyerId) {
        const affiliateAcc = await getAccount(order.affiliateId);
        if (!affiliateAcc || !affiliateAcc.phone) {
          skipped[order.affiliateId] = !affiliateAcc ? "compte parrain introuvable" : "parrain sans numéro de téléphone";
        } else if (await alreadyPaid(affiliateAcc.phone, order.id, "parrainage")) {
          affiliateDone = true;
          skipped[order.affiliateId] = "déjà versé (marque rétablie)";
        } else {
          const amount = typeof details.affiliateAmount === "number" ? details.affiliateAmount : subtotal * cfg.affiliateCommission;
          const r: any = await creditEarnings(affiliateAcc.phone, amount, "parrainage", { accountId: order.buyerId, orderId: order.id }, "parrainage:" + order.id);
          affiliateDone = true;
          if (r.ok) {
            affiliateAcc.affiliateBalance = (affiliateAcc.affiliateBalance || 0) + amount;
            affiliateAcc.affiliateReferrals = (affiliateAcc.affiliateReferrals || 0) + 1;
            if (!Array.isArray(affiliateAcc.affiliateEarnings)) affiliateAcc.affiliateEarnings = [];
            affiliateAcc.affiliateEarnings.push({ orderId: order.id, buyerId: order.buyerId, amount, rate: cfg.affiliateCommission, date: Date.now() });
            await db.from("app_data").upsert({ collection: "accounts", id: order.affiliateId, data: affiliateAcc, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
            settled[order.affiliateId] = amount;
          } else skipped[order.affiliateId] = r.error === "duplicate" ? "déjà versé" : String(r.error);
        }
      }
      await patchDoc("orders", order.id, { sellerPayoutSettled: marks, affiliateCommissionCredited: affiliateDone }, null);
      return ok({ settled, skipped });
    }

    if (operation === "admin_search_wallets") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const query = String(body.query || "").toLowerCase().trim();
      const { data: accRows } = await db.from("app_data").select("id, data").eq("collection", "accounts").limit(2000);
      const matches = (accRows || []).filter((row: any) => {
        const a = row.data || {};
        if (!query) return false;
        return String(a.name || "").toLowerCase().includes(query) || String(a.shopName || "").toLowerCase().includes(query) || String(a.phone || "").includes(query);
      }).slice(0, 20);
      const results = [];
      for (const row of matches as any[]) {
        const a = row.data || {};
        const wallet: any = a.phone ? await getWallet(a.phone) : { balance: 0 };
        results.push({ accountId: row.id, name: a.shopName || a.name, phone: a.phone, balance: wallet.balance || 0 });
      }
      return ok({ results });
    }

    if (operation === "admin_get_wallet_detail") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const targetAcc = await getAccount(body.targetAccountId);
      if (!targetAcc || !targetAcc.phone) return badRequest("account_not_found");
      return ok({ wallet: await getWallet(targetAcc.phone) });
    }

    if (operation === "admin_adjust") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const { targetAccountId, amount, reason } = body;
      if (typeof amount !== "number" || amount === 0 || !isFinite(amount)) return badRequest("invalid_amount");
      const targetAcc = await getAccount(targetAccountId);
      if (!targetAcc || !targetAcc.phone) return badRequest("account_not_found");
      const result: any = await applyWalletDelta(targetAcc.phone, amount, String(reason || "Ajustement Admin").slice(0, 80), { accountId: callerId });
      if (!result.ok) return badRequest(result.error);
      return ok({ balance: result.balance });
    }

    if (operation === "admin_delete_wallet_txn") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const { targetAccountId, txnId } = body;
      const targetAcc = await getAccount(targetAccountId);
      if (!targetAcc || !targetAcc.phone) return badRequest("account_not_found");
      for (let attempt = 0; attempt < 4; attempt++) {
        const wallet: any = await getWallet(targetAcc.phone);
        const transactions = (wallet.transactions || []).filter((t: { id: string }) => t.id !== txnId);
        const balance = transactions.reduce((sum: number, t: any) => sum + (t.type === "credit" ? num(t.amount) : -num(t.amount)), 0);
        const done = await patchDoc("wallets", wallet.id, { transactions, balance }, { balance: wallet.balance ?? 0 });
        if (done) return ok({ balance });
      }
      return badRequest("busy_retry");
    }

    if (operation === "generate_payment_code") {
      const callerAcc = await getAccount(callerId);
      if (!callerAcc || !callerAcc.phone) return badRequest("no_wallet_phone");
      const rnd = new Uint32Array(1); crypto.getRandomValues(rnd);
      const code = (100000 + (rnd[0] % 900000)).toString();
      const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes
      // Le code n'est JAMAIS enregistré en clair : seule son empreinte secrète sert d'identifiant.
      const pid = "pc_" + (await hmacHex("pc|" + code));
      const sig = await hmacHex("pcs|" + pid + "|" + callerId + "|" + expiresAt);
      await db.from("app_data").upsert({ collection: "paymentCodes", id: pid, data: { accountId: callerId, expiresAt, sig }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      return ok({ code, expiresAt });
    }

    if (operation === "redeem_payment_code") {
      const { code, amount } = body;
      if (typeof amount !== "number" || !(amount > 0) || amount > 5000000) return badRequest("invalid_amount");
      // Limite d'essais (audit ARG-5) : 5 codes faux en 15 minutes par compte.
      const now = Date.now();
      const lockId = "paycode:" + callerId;
      const lock: any = await getDoc("loginHistory", lockId);
      const fails: number[] = (lock && Array.isArray(lock.fails) ? lock.fails : []).filter((t: number) => now - t < 15 * 60 * 1000);
      if (fails.length >= 5) return badRequest("too_many_attempts");
      const noteFail = () => db.from("app_data").upsert({ collection: "loginHistory", id: lockId, data: { id: lockId, kind: "paycode", fails: [...fails, now] }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      if (!/^\d{6}$/.test(String(code || ""))) { await noteFail(); return badRequest("code_not_found"); }
      const pid = "pc_" + (await hmacHex("pc|" + String(code)));
      const codeData: any = await getDoc("paymentCodes", pid);
      if (!codeData) { await noteFail(); return badRequest("code_not_found"); }
      if (codeData.sig !== (await hmacHex("pcs|" + pid + "|" + codeData.accountId + "|" + codeData.expiresAt))) { await noteFail(); return badRequest("code_not_found"); }
      if (now > codeData.expiresAt) {
        await db.from("app_data").delete().eq("collection", "paymentCodes").eq("id", pid);
        return badRequest("code_expired");
      }
      if (codeData.accountId === callerId) return badRequest("cannot_pay_yourself");
      // Un code ne sert qu'une fois : on le retire AVANT de payer.
      const { data: claimed } = await db.from("app_data").delete().eq("collection", "paymentCodes").eq("id", pid).select("id");
      if (!claimed || !claimed.length) return badRequest("code_not_found");
      const buyerAcc = await getAccount(codeData.accountId);
      const sellerAcc = await getAccount(callerId);
      if (!buyerAcc || !buyerAcc.phone || !sellerAcc || !sellerAcc.phone) return badRequest("account_not_found");
      if (normalizeWalletPhone(buyerAcc.phone) === normalizeWalletPhone(sellerAcc.phone)) return badRequest("cannot_pay_yourself");
      const r = await moveMoney([
        { coll: "wallets", phone: buyerAcc.phone, delta: -amount, txn: txnOf(-amount, "paiement_boutique", { accountId: callerId, accountName: sellerAcc.shopName || sellerAcc.name }) },
        { coll: "wallets", phone: sellerAcc.phone, delta: amount, txn: txnOf(amount, "paiement_boutique", { accountId: codeData.accountId, accountName: buyerAcc.shopName || buyerAcc.name }) }
      ]);
      if (!r.ok) return badRequest(r.error!);
      return ok({ buyerName: buyerAcc.shopName || buyerAcc.name });
    }

    if (operation === "request_diaspora_credit") {
      const { amount, senderName, message } = body;
      if (typeof amount !== "number" || !(amount > 0) || amount > 5000000) return badRequest("invalid_amount");
      const callerAcc = await getAccount(callerId);
      if (!callerAcc) return badRequest("account_not_found");
      const reqId = crypto.randomUUID();
      await db.from("app_data").upsert({
        collection: "diasporaRequests", id: reqId,
        data: { id: reqId, accountId: callerId, accountName: callerAcc.shopName || callerAcc.name, accountPhone: callerAcc.phone, amount, senderName: String(senderName || "").slice(0, 80), message: String(message || "").slice(0, 300), status: "pending", createdAt: Date.now(), sig: await hmacHex("dr|" + reqId + "|" + callerId + "|" + amount) },
        updated_at: new Date().toISOString()
      }, { onConflict: "collection,id" });
      return ok({ requestId: reqId });
    }

    if (operation === "admin_list_diaspora_requests") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const { data: rows } = await db.from("app_data").select("data").eq("collection", "diasporaRequests").order("updated_at", { ascending: false }).limit(100);
      const all = (rows || []).map((r: any) => r.data).filter((r: any) => r && r.status === "pending");
      const requests: any[] = [];
      for (const r of all) if (r.sig && r.sig === (await hmacHex("dr|" + r.id + "|" + r.accountId + "|" + r.amount))) requests.push(r);
      return ok({ requests });
    }

    if (operation === "admin_settle_diaspora_request") {
      if (!(await isRecognizedAdmin(callerId, db))) return unauthorized("not_admin");
      const { requestId, approve } = body;
      const reqData: any = await getDoc("diasporaRequests", String(requestId || ""));
      if (!reqData) return badRequest("request_not_found");
      if (!reqData.sig || reqData.sig !== (await hmacHex("dr|" + requestId + "|" + reqData.accountId + "|" + reqData.amount))) return badRequest("request_not_found");
      if (reqData.status !== "pending") return badRequest("already_settled");
      const claimed = await patchDoc("diasporaRequests", String(requestId), { status: approve ? "approved" : "rejected", settledAt: Date.now() }, { status: "pending" });
      if (!claimed) return badRequest("already_settled");
      if (approve) {
        const targetAcc = await getAccount(reqData.accountId);
        if (!targetAcc || !targetAcc.phone) { await patchDoc("diasporaRequests", String(requestId), { status: "pending" }, null); return badRequest("account_not_found"); }
        const r: any = await applyWalletDelta(targetAcc.phone, reqData.amount, "diaspora", { accountId: callerId, orderId: requestId }, "diaspora:" + requestId);
        if (!r.ok && r.error !== "duplicate") return badRequest(r.error);
      }
      return ok();
    }

    if (operation === "diaspora") return badRequest("operation_not_yet_available");

    function payoutDateFor(ts: number, kind: string): string {
      const d = new Date(ts);
      const day = d.getUTCDay();
      const add = kind === "relais" ? (7 - ((day + 6) % 7)) + 1 : (d.getUTCHours() < 17 ? 0 : 1);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add)).toISOString().slice(0, 10);
    }
    function deliveredAtOf(o: any): number {
      if (typeof o.deliveredAt === "number") return o.deliveredAt;
      const h = Array.isArray(o.statusHistory) ? o.statusHistory.slice().reverse().find((x: any) => x && x.status === "Livrée") : null;
      return h && (h.at || h.time || h.date) ? Number(h.at || h.time || h.date) : (o.createdAt || 0);
    }
    async function accountsByPhone(): Promise<Record<string, any[]>> {
      const { data } = await db.from("app_data").select("data").eq("collection", "accounts").limit(5000);
      const map: Record<string, any[]> = {};
      (data || []).forEach((r: any) => { const a = r.data; if (a && a.phone) { const k = normalizeWalletPhone(a.phone); (map[k] = map[k] || []).push(a); } });
      return map;
    }
    function payoutMethodOf(accs: any[]): { operator: string | null; number: string | null; name: string } {
      const withMethod = (accs || []).find((a: any) => a.payoutOperator && a.payoutNumber);
      const main = (accs || []).find((a: any) => a.shopName) || (accs || [])[0] || {};
      return { operator: withMethod ? withMethod.payoutOperator : null, number: withMethod ? withMethod.payoutNumber : (main.phone || null), name: main.shopName || main.name || "?" };
    }
    async function notifyPayout(userIds: string[], net: number, operator: string, reference: string) {
      const opName: Record<string, string> = { orange: "Orange Money", moov: "Moov Money", wave: "Wave" };
      for (const uid of userIds) {
        const nid = "notif-payout-" + crypto.randomUUID();
        await db.from("app_data").upsert({ collection: "notifications", id: nid, data: { id: nid, type: "info", userId: uid, read: false, time: Date.now(), message: "💰 Sounsouni vous a envoyé " + net + " FCFA sur " + (opName[operator] || operator || "mobile money") + (reference ? " (réf. " + reference + ")" : "") + "." }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      }
    }

    if (operation === "admin_payout_list") {
      if (!(await canManagePayouts(callerId, db))) return unauthorized("not_admin");
      const upTo = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
      const byPhone = await accountsByPhone();
      const items: any[] = [];
      const { data: ledgers } = await db.from("app_data").select("data").eq("collection", "earningsLedgers").limit(5000);
      for (const row of (ledgers || []) as any[]) {
        const l: any = row.data; if (!l) continue;
        const due = (Array.isArray(l.transactions) ? l.transactions : []).filter((t: any) => t && !t.paidOutAt && num(t.amount) > 0 && payoutDateFor(num(t.createdAt), "seller") <= upTo);
        if (!due.length) continue;
        const m = payoutMethodOf(byPhone[l.id] || []);
        items.push({ kind: "ledger", key: l.id, name: m.name, operator: m.operator, number: m.number, amount: Math.round(due.reduce((s: number, t: any) => s + num(t.amount), 0)), count: due.length, txnIds: due.map((t: any) => t.id), feeBy: "beneficiaire" });
      }
      const { data: orders } = await db.from("app_data").select("data").eq("collection", "orders").eq("data->>deliveryMode", "relais").eq("data->>status", "Livrée").limit(5000);
      const byShop: Record<string, any[]> = {};
      (orders || []).forEach((r: any) => { const o = r.data; if (o && o.relaisShopId && !o.commissionSettled && num(o.commissionAmount) > 0 && payoutDateFor(deliveredAtOf(o), "relais") <= upTo) (byShop[o.relaisShopId] = byShop[o.relaisShopId] || []).push(o); });
      for (const shopId of Object.keys(byShop)) {
        const shop = await getAccount(shopId);
        const m = payoutMethodOf(shop && shop.phone ? (byPhone[normalizeWalletPhone(shop.phone)] || [shop]) : [shop || {}]);
        items.push({ kind: "relais", key: shopId, name: (shop && (shop.shopName || shop.name)) || "?", operator: m.operator, number: m.number, amount: Math.round(byShop[shopId].reduce((s: number, o: any) => s + num(o.commissionAmount), 0)), count: byShop[shopId].length, orderIds: byShop[shopId].map((o: any) => o.id), feeBy: "sounsouni" });
      }
      items.sort((a, b) => b.amount - a.amount);
      return ok({ date: upTo, items });
    }

    if (operation === "admin_mark_payout") {
      if (!(await canManagePayouts(callerId, db))) return unauthorized("not_admin");
      const kind = body.kind, key = String(body.key || "");
      const fee = Math.max(0, Math.round(num(body.fee)));
      const reference = String(body.reference || "").slice(0, 80);
      const operator = String(body.operator || "").slice(0, 20);
      const number = String(body.number || "").slice(0, 30);
      const payoutId = crypto.randomUUID();
      const at = Date.now();
      if (kind === "ledger") {
        const ids: string[] = Array.isArray(body.txnIds) ? body.txnIds : [];
        for (let attempt = 0; attempt < 4; attempt++) {
          const l: any = await getDoc("earningsLedgers", key);
          if (!l) return badRequest("ledger_not_found");
          let gross = 0;
          const transactions = (l.transactions || []).map((t: any) => {
            if (t && ids.includes(t.id) && !t.paidOutAt) { gross += num(t.amount); return { ...t, paidOutAt: at, payoutId }; }
            return t;
          });
          if (!gross) return badRequest("nothing_to_pay");
          const net = Math.max(0, Math.round(gross) - fee);
          const payouts = (Array.isArray(l.payouts) ? l.payouts : []).concat([{ id: payoutId, gross: Math.round(gross), fee, net, operator, number, reference, at }]);
          // Écrit seulement si personne n'a modifié ces gains entre-temps.
          const done = await patchDoc("earningsLedgers", key, { transactions, payouts }, { total: l.total ?? 0 });
          if (!done) continue;
          const byPhone = await accountsByPhone();
          await notifyPayout((byPhone[key] || []).map((a: any) => a.id), net, operator, reference);
          return ok({ payoutId, gross: Math.round(gross), fee, net });
        }
        return badRequest("busy_retry");
      }
      if (kind === "relais") {
        const ids: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
        let gross = 0;
        for (const oid of ids) {
          const o: any = await getDoc("orders", String(oid));
          if (!o || o.relaisShopId !== key || o.commissionSettled || o.status !== "Livrée") continue;
          const done = await patchDoc("orders", o.id, { commissionSettled: true, commissionSettledAt: at, payoutId }, ("commissionSettled" in o) ? { commissionSettled: false } : { status: "Livrée" });
          if (done) gross += num(o.commissionAmount);
        }
        if (!gross) return badRequest("nothing_to_pay");
        const net = Math.round(gross);
        await notifyPayout([key], net, operator, reference);
        return ok({ payoutId, gross: net, fee, net, feePaidBySounsouni: fee });
      }
      return badRequest("invalid_kind");
    }

    return badRequest("unknown_operation");
  } catch (e) {
    console.error("wallet-write", e);
    return new Response(JSON.stringify({ success: false, error: "server_error" }), { status: 500, headers: corsHeaders });
  }
});
