// ============================================================
// Fonction serveur : ligdicash-check — version 2026-10-29
// L'app demande ici l'état réel d'un paiement LigdiCash (et le balayage
// régulier des paiements en attente). Même partie commune que
// ligdicash-callback (crédits atomiques, une seule fois).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token" };
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
// ---- Partie commune (callback + vérification) : confirmer auprès de LigdiCash puis appliquer ----
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
async function confirmInvoice(token: string) {
  const base = Deno.env.get("LIGDICASH_BASE_URL") || "https://app.ligdicash.com";
  return await fetch(base + "/pay/v01/redirect/checkout-invoice/confirm/?invoiceToken=" + encodeURIComponent(token), {
    headers: { "Apikey": Deno.env.get("LIGDICASH_API_KEY") || "", "Authorization": "Bearer " + (Deno.env.get("LIGDICASH_AUTH_TOKEN") || ""), "Accept": "application/json" }
  }).then((r) => r.json()).catch(() => null);
}
// Trace de chaque vérification auprès de LigdiCash (utile en cas de litige),
// enregistrée seulement tant que la transaction est encore « pending ».
async function noteCheck(db: any, txn: any, type: string, conf: any, extra: any = {}) {
  const h = Array.isArray(txn.history) ? txn.history.slice(-19) : [];
  h.push({ at: Date.now(), type, response_code: conf ? conf.response_code : null, status: conf ? conf.status : null, response_text: conf ? String(conf.response_text || "").slice(0, 60) : "no_response" });
  txn.history = h; txn.lastCheckedAt = Date.now(); Object.assign(txn, extra);
  await db.from("app_data").update({ data: { ...txn }, updated_at: new Date().toISOString() })
    .eq("collection", "ligdicashTransactions").eq("id", txn.transactionId).eq("data->>status", "pending");
}
async function notify(db: any, id: string, userId: string, message: string, target: string) {
  await db.from("app_data").insert({ collection: "notifications", id, data: { id, channel: "sms", message, userId, time: Date.now(), read: false, target }, updated_at: new Date().toISOString() });
  fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/send-push-fcm", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }, body: JSON.stringify({ userId, title: "Sounsouni", body: message }) }).catch(() => {});
}
// Applique le statut RÉEL donné par confirm. Une seule fois par transaction :
// la mise à jour ne passe que si la transaction est encore "pending"
// (LigdiCash envoie chaque callback deux fois, et le client vérifie aussi).
// Règle LigdiCash : "pending" peut durer des jours (réclamation opérateur) ;
// une transaction n'est donc JAMAIS déclarée perdue de notre côté : seule
// la commande est libérée au bout de 3 h (voir releaseExpired), et un
// paiement confirmé plus tard est quand même enregistré.
async function applyConfirmed(db: any, txn: any, conf: any): Promise<string> {
  let status = conf && conf.response_code === "00" ? String(conf.status || "") : "";
  if (status !== "completed" && status !== "notcompleted") return "pending";
  if (status === "completed" && Math.round(num(conf.amount ?? conf.montant)) !== Math.round(num(txn.amount))) status = "amount_mismatch";
  const now = Date.now();
  const newTxn = { ...txn, status, confirmedAt: now, operator: String(conf.operator_name || ""), requestId: String(conf.request_id || ""), paidAmount: num(conf.amount ?? conf.montant) };
  const { data: claimed } = await db.from("app_data").update({ data: newTxn, updated_at: new Date().toISOString() })
    .eq("collection", "ligdicashTransactions").eq("id", txn.transactionId).eq("data->>status", "pending").select("id");
  if (!claimed || !claimed.length) return "already";
  const get = async (c: string, id: string) => { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? data.data : null; };
  const put = (c: string, d: any) => db.from("app_data").update({ data: d, updated_at: new Date().toISOString() }).eq("collection", c).eq("id", d.id);
  // Audit 29/10/2026 : on ne modifie plus que les champs du paiement (jamais tout le document).
  const patch = (c: string, id: string, fields: any) => db.rpc("sns_doc_patch", { p_collection: c, p_id: id, p_patch: fields, p_expect: null });
  const ref = String(txn.refId);
  const ref2 = " (réf. LigdiCash " + newTxn.requestId + ", transaction " + txn.transactionId + ")";
  if (txn.kind === "wallet") {
    // Recharge du portefeuille : même format que wallet-write (id = téléphone sans espaces).
    const wid = String(txn.walletPhone || "").replace(/[\s.\-()]/g, "");
    if (!wid) return status;
    if (status === "completed") {
      // Crédit atomique, une seule fois par transaction (clé unique).
      const { error: we } = await db.rpc("sns_wallet_batch", { p_ops: [{ coll: "wallets", phone: String(txn.walletPhone), delta: Math.round(num(txn.amount)), key: "recharge:" + txn.transactionId,
        txn: { id: crypto.randomUUID(), type: "credit", amount: Math.round(num(txn.amount)), reason: "recharge_mobile", accountId: txn.buyerId || null, accountName: newTxn.operator || "Mobile money", orderId: null, message: null, ref: txn.transactionId, createdAt: now } }] });
      if (we && !String(we.message || "").includes("duplicate")) { console.error("recharge non créditée", we); await notify(db, "ntf_" + txn.transactionId + "_err", null as any, "⚠️ Recharge payée mais PAS créditée (erreur serveur)" + ref2 + ". À créditer à la main.", "admin"); return status; }
      await notify(db, "ntf_" + txn.transactionId, txn.buyerId, "💰 Votre portefeuille a été rechargé de " + Math.round(num(txn.amount)).toLocaleString("fr-FR") + " F.", "wallet");
    } else if (status === "amount_mismatch") {
      await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Recharge portefeuille : montant LigdiCash différent" + ref2 + ". À vérifier (rien n'a été crédité).", "admin");
    }
    return status;
  }
  if (txn.kind === "booking") {
    const bk = await get("bookings", ref);
    if (!bk) return status;
    if (status === "completed") {
      await patch("bookings", bk.id, { paymentStatus: "paid", paidAt: now, paymentRef: txn.transactionId, paidAmount: Math.round(num(txn.amount)), paymentOperator: newTxn.operator });
      // Part du prestataire (après commission) notée dans ses gains, versée par Sounsouni.
      const { data: cfgRow } = await db.from("app_data").select("data").eq("collection", "settings").eq("id", "commission_config").maybeSingle();
      const cfg = cfgRow ? (cfgRow as any).data : null;
      const rate = cfg && cfg.totalCommissionRate != null ? num(cfg.totalCommissionRate) : 0.07;
      const seller = await get("accounts", String(bk.sellerId || ""));
      if (seller && seller.phone) {
        const eid = String(seller.phone).replace(/[\s.\-()]/g, "");
        const led = await get("earningsLedgers", eid);
        const lt = led && Array.isArray(led.transactions) ? led.transactions : [];
        if (!lt.some((x: any) => x && x.orderId === bk.id && x.reason === "vente")) {
          const net = Math.round(num(txn.amount) * (cfg && cfg.commissionMode === "add" ? 1 : 1 - rate));
          const { error: le } = await db.rpc("sns_wallet_batch", { p_ops: [{ coll: "earningsLedgers", phone: String(seller.phone), delta: net, key: "vente:" + bk.id,
            txn: { id: crypto.randomUUID(), amount: net, reason: "vente", accountId: bk.buyerId || null, accountName: String(bk.productName || "Réservation"), orderId: bk.id, createdAt: now } }] });
          if (le && !String(le.message || "").includes("duplicate")) { console.error("gain réservation non noté", le); await notify(db, "ntf_" + txn.transactionId + "_err", null as any, "⚠️ Réservation payée : gain du prestataire PAS noté (erreur serveur)" + ref2 + ".", "admin"); }
        }
      }
      await notify(db, "ntf_" + txn.transactionId + "_s", bk.sellerId, "💰 Réservation payée en ligne : " + String(bk.productName || "") + " — " + Math.round(num(txn.amount)).toLocaleString("fr-FR") + " F (" + String(bk.buyerName || "") + ").", "seller");
      await notify(db, "ntf_" + txn.transactionId + "_b", bk.buyerId, "✅ Paiement reçu pour votre réservation : " + String(bk.productName || "") + ".", "bookings");
    } else if (status === "amount_mismatch") {
      await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Réservation : montant LigdiCash différent" + ref2 + ". À vérifier.", "admin");
    }
    return status;
  }
  if (txn.kind === "boost") {
    const b = await get("boosts", ref);
    if (!b) return status;
    if (status === "completed") {
      await put("boosts", { ...b, status: "actif", activatedAt: now, expiresAt: now + num(b.days) * 86400000, paidVia: "ligdicash", paymentRef: txn.transactionId });
      await notify(db, "ntf_" + txn.transactionId, b.sellerId, "🚀 Paiement reçu : votre boost de " + num(b.days) + " jour(s) est activé.", "seller");
    } else if (status === "notcompleted") await put("boosts", { ...b, status: "refuse", refusedReason: "paiement_non_abouti" });
    else await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Boost : montant LigdiCash différent du tarif" + ref2 + ". À vérifier.", "admin");
    return status;
  }
  const o = await get("orders", ref);
  if (!o) return status;
  const short = "#" + ref.slice(-5).toUpperCase();
  if (status === "completed") {
    if (o.paymentStatus === "paid" && o.paymentRef && o.paymentRef !== txn.transactionId) {
      // Le client a payé deux fois la même commande (deux factures) : à rembourser.
      await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Commande " + short + " payée deux fois" + ref2 + " — à rembourser au client.", "admin");
    } else if (o.status === "Annulée") {
      // Paiement confirmé après l'annulation automatique (délai dépassé).
      await patch("orders", o.id, { paymentStatus: "paid_after_cancel", paidAt: now, paymentRef: txn.transactionId, paymentOperator: newTxn.operator });
      await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Commande " + short + " payée APRÈS son annulation" + ref2 + " — réactiver ou rembourser.", "admin");
      await notify(db, "ntf_" + txn.transactionId + "_b", o.buyerId, "Nous avons bien reçu votre paiement pour la commande " + short + ". Sounsouni vous contacte pour la suite.", "orders");
    } else {
      if (o.isDigital) {
        // Produit numérique : rien à livrer — la commande est terminée dès le
        // paiement, le client télécharge depuis « Mes achats ».
        const vs: Record<string, string> = {};
        for (const sid of (Array.isArray(o.sellerIds) ? o.sellerIds : [])) vs[sid] = "Prête";
        const hist = Array.isArray(o.statusHistory) ? o.statusHistory : [];
        await patch("orders", o.id, { paymentStatus: "paid", paidAt: now, paymentRef: txn.transactionId, paymentOperator: newTxn.operator, status: "Livrée", deliveredAt: now, deliveryVerified: true, deliveryVerifiedAt: now, deliveryVerifiedBy: "ligdicash", vendorStatuses: vs, statusHistory: [...hist, { status: "Livrée", at: now, note: "Produit numérique payé" }] });
        await notify(db, "ntf_" + txn.transactionId + "_b", o.buyerId, "📥 Paiement reçu (commande " + short + ") : votre achat est prêt, téléchargez-le dans « Mes achats ».", "orders");
        for (const sid of (Array.isArray(o.sellerIds) ? o.sellerIds : [])) {
          await notify(db, "ntf_" + txn.transactionId + "_" + sid, sid, "💰 Vente numérique " + short + " payée — le client a reçu son accès.", "seller-orders");
        }
      } else {
      await patch("orders", o.id, { paymentStatus: "paid", paidAt: now, paymentRef: txn.transactionId, paymentOperator: newTxn.operator });
      await notify(db, "ntf_" + txn.transactionId + "_b", o.buyerId, "✅ Paiement reçu pour votre commande " + short + ". Merci !", "orders");
      for (const sid of (Array.isArray(o.sellerIds) ? o.sellerIds : [])) {
        await notify(db, "ntf_" + txn.transactionId + "_" + sid, sid, "🛍️ Nouvelle commande " + short + " payée — préparez-la.", "seller-orders");
      }
      }
    }
  } else if (status === "notcompleted") {
    if (o.paymentStatus === "pending_payment" && o.status !== "Annulée") await cancelOrder(db, o, "Paiement non abouti", get, put);
  } else {
    await notify(db, "ntf_" + txn.transactionId + "_adm", null as any, "⚠️ Commande " + short + " : montant LigdiCash différent du montant attendu" + ref2 + ". À vérifier.", "admin");
  }
  return status;
}
async function cancelOrder(db: any, o: any, note: string, get: any, put: any) {
  const now = Date.now(), ref = String(o.id), hist = Array.isArray(o.statusHistory) ? o.statusHistory : [];
  const det = await get("orderDetails", ref);
  const released: string[] = Array.isArray(o.stockReleased) ? o.stockReleased : [];
  const back: any[] = [];
  (det && Array.isArray(det.items) ? det.items : []).forEach((it: any, i: number) => { if (it && !it.refused && !released.includes(String(i))) back.push({ it, key: String(i) }); });
  await db.rpc("sns_doc_patch", { p_collection: "orders", p_id: ref, p_patch: { status: "Annulée", paymentStatus: "failed", cancelledAt: now, statusHistory: [...hist, { status: "Annulée", at: now, note }], stockReleased: [...released, ...back.map((b) => b.key)] }, p_expect: null });
  for (const { it } of back) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = await get("products", String(it.productId || ""));
      if (!p || typeof p.stock !== "number") break;
      const { data: okp } = await db.rpc("sns_doc_patch", { p_collection: "products", p_id: p.id, p_patch: { stock: p.stock + Math.max(0, Math.round(num(it.qty))) }, p_expect: { stock: p.stock } });
      if (okp) break;
    }
  }
  await notify(db, "ntf_cancel_" + ref, o.buyerId, "❌ Le paiement de la commande #" + ref.slice(-5).toUpperCase() + " n'a pas été effectué : la commande est annulée. Vous pouvez recommander quand vous voulez.", "orders");
}
// Délai dépassé : on libère la commande (stock remis) SANS déclarer la
// transaction perdue — si LigdiCash confirme plus tard, applyConfirmed le verra.
async function releaseExpired(db: any, txn: any) {
  if (txn.kind !== "order" || txn.released) return "pending";
  const get = async (c: string, id: string) => { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? data.data : null; };
  const put = (c: string, d: any) => db.from("app_data").update({ data: d, updated_at: new Date().toISOString() }).eq("collection", c).eq("id", d.id);
  const { data: claimed } = await db.from("app_data").update({ data: { ...txn, released: true, releasedAt: Date.now() }, updated_at: new Date().toISOString() })
    .eq("collection", "ligdicashTransactions").eq("id", txn.transactionId).eq("data->>status", "pending").select("id");
  if (!claimed || !claimed.length) return "already";
  const o = await get("orders", String(txn.refId));
  if (o && o.paymentStatus === "pending_payment" && o.status !== "Annulée") await cancelOrder(db, o, "Paiement non effectué à temps", get, put);
  return "released";
}
const EXPIRE_MS = 3 * 3600 * 1000, RECHECK_MS = 15 * 60 * 1000;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const session = await verifySession(req);
    if (!session) return json({ success: false, error: "session_required" }, 401);
    const callerId: string = session.accountId;
    const body = await req.json().catch(() => ({}));
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const getDoc = async (c: string, id: string) => { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? (data as any).data : null; };
    const me = await getDoc("accounts", callerId);
    const callerIds = [callerId];
    if (me && me.phone) {
      const { data: sib } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>phone", me.phone);
      (sib || []).forEach((r: any) => { if (r.data && r.data.id && !callerIds.includes(r.data.id)) callerIds.push(r.data.id); });
    }
    const normP = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
    let isStaff = callerId === "admin_owner" || callerId.startsWith("national_admin_");
    if (!isStaff && me && me.phone) {
      const mine = normP(me.phone);
      const { data: wl } = await db.from("app_data").select("data").in("collection", ["group2GlobalWhitelist", "nationalAdmins"]);
      isStaff = (wl || []).some((r: any) => { const d = r.data || {}; if (normP(d.phone) === mine) return true; return Array.isArray(d.employeeWhitelist) && d.employeeWhitelist.some((w: any) => w && normP(w.phone) === mine); });
    }
    if (body.operation === "sweep") {
      const now = Date.now();
      const slot = "SWEEP-" + Math.floor(now / (5 * 60 * 1000));
      const { error: lockErr } = await db.from("app_data").insert({ collection: "ligdicashTransactions", id: slot, data: { sweep: true, at: now, by: isStaff ? "staff" : "client" }, updated_at: new Date().toISOString() });
      if (lockErr && !isStaff) return json({ success: true, skipped: true });
      if (!lockErr) await db.from("app_data").delete().eq("collection", "ligdicashTransactions").eq("data->>sweep", "true").lt("data->>at", String(now - 86400000));
      const { data: rows } = await db.from("app_data").select("data").eq("collection", "ligdicashTransactions").eq("data->>status", "pending").limit(200);
      const done: Record<string, string> = {};
      for (const r of (rows || []) as any[]) {
        const txn = r.data; const age = now - num(txn.createdAt);
        if (age < RECHECK_MS) continue;
        if (age > 3 * 86400000) continue;
        const since = now - num(txn.lastCheckedAt || 0);
        if (age > 86400000 && since < 6 * 3600000) continue;
        if (age > 3600000 && age <= 86400000 && since < 30 * 60000) continue;
        let res = "pending";
        if (txn.ligdicashToken) { const conf = await confirmInvoice(txn.ligdicashToken); await noteCheck(db, txn, "sweep", conf); res = await applyConfirmed(db, txn, conf); }
        if (res === "pending" && age > EXPIRE_MS && !txn.released) res = await releaseExpired(db, txn);
        done[txn.transactionId] = res;
      }
      return json({ success: true, checked: Object.keys(done).length, results: done });
    }
    const transactionId = String(body.transactionId || "");
    const txn = transactionId ? await getDoc("ligdicashTransactions", transactionId) : null;
    if (!txn) return json({ success: false, error: "not_found" }, 404);
    if (!isStaff && !callerIds.includes(txn.buyerId)) return json({ success: false, error: "forbidden" }, 403);
    let status = txn.status;
    if (status === "pending" && txn.ligdicashToken) {
      const conf = await confirmInvoice(txn.ligdicashToken);
      await noteCheck(db, txn, "check", conf);
      const r = await applyConfirmed(db, txn, conf);
      status = r === "already" ? ((await getDoc("ligdicashTransactions", transactionId)) || txn).status : r;
    }
    return json({ success: true, status, kind: txn.kind, refId: txn.refId });
  } catch (e) {
    console.error("ligdicash-check", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
