// ============================================================
// Fonction serveur : ligdicash-callback (appelée par LigdiCash) — version 2026-10-29
// (audit : recharges et gains crédités de façon atomique, une seule fois ;
// seuls les champs du paiement sont modifiés sur les commandes et réservations)
// Règles LigdiCash : retrouver NOTRE transaction_id dans custom_data,
// ignorer toute transaction inconnue, revérifier avec "confirm" (avec le
// token gardé à la création), n'agir que sur la réponse de confirm,
// traiter une seule fois (LigdiCash envoie chaque callback deux fois).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (status: number, text = "ok") => new Response(text, { status, headers: corsHeaders });
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
// ---- fin de la partie commune ----
// Règle LigdiCash : toujours lire NOTRE transaction_id dans le tableau
// custom_data (filtre sur keyof_customdata), jamais external_id.
function extractTxnId(p: any): string {
  let cd = p ? p.custom_data : null;
  if (typeof cd === "string") { try { cd = JSON.parse(cd); } catch { cd = null; } }
  if (cd && !Array.isArray(cd) && typeof cd === "object" && !cd.transaction_id) cd = Object.values(cd);
  if (Array.isArray(cd)) { const e = cd.find((x: any) => x && x.keyof_customdata === "transaction_id"); if (e) return String(e.valueof_customdata || ""); }
  else if (cd && typeof cd === "object" && cd.transaction_id) return String(cd.transaction_id);
  return "";
}
// Formulaire : custom_data peut arriver en texte JSON, ou en champs
// custom_data[0][keyof_customdata]=… (notation à crochets).
function formToPayload(form: FormData): any {
  const out: any = {};
  for (const [k, v] of form.entries()) {
    const val = typeof v === "string" ? v : "";
    const m = k.match(/^([^\[]+)((?:\[[^\]]*\])+)$/);
    if (!m) { out[k] = val; continue; }
    const path = [m[1], ...Array.from(m[2].matchAll(/\[([^\]]*)\]/g)).map((x) => x[1])];
    let cur = out;
    for (let i = 0; i < path.length - 1; i++) { if (typeof cur[path[i]] !== "object" || cur[path[i]] === null) cur[path[i]] = {}; cur = cur[path[i]]; }
    cur[path[path.length - 1]] = val;
  }
  return out;
}
// Journal brut de CHAQUE requête reçue (même invalide ou de test), pour la
// traçabilité demandée par LigdiCash. Rangé dans la collection protégée
// ligdicashTransactions (illisible depuis l'app), avec status "callback_log"
// pour ne jamais être confondu avec une vraie transaction.
async function logRequest(db: any, req: Request, raw: string, payload: any, transactionId: string) {
  const id = "CBLOG" + Date.now().toString(36).toUpperCase() + Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const h: Record<string, string> = {};
  for (const k of ["content-type", "user-agent", "x-forwarded-for", "x-real-ip", "content-length"]) { const v = req.headers.get(k); if (v) h[k] = v.slice(0, 300); }
  const rec = { id, kind: "callback_log", status: "callback_log", receivedAt: Date.now(), receivedAtIso: new Date().toISOString(), method: req.method, headers: h, rawBody: raw.slice(0, 20000), payload, transactionId: transactionId || null, outcome: "received" };
  await db.from("app_data").insert({ collection: "ligdicashTransactions", id, data: rec, updated_at: new Date().toISOString() }).then(() => {}, () => {});
  return async (outcome: string, httpStatus: number, extra: any = {}) => {
    await db.from("app_data").update({ data: { ...rec, outcome, httpStatus, ...extra }, updated_at: new Date().toISOString() }).eq("collection", "ligdicashTransactions").eq("id", id).then(() => {}, () => {});
  };
}
function parseBody(type: string, raw: string): any {
  if (type.includes("application/json")) { try { return JSON.parse(raw); } catch { return {}; } }
  if (type.includes("application/x-www-form-urlencoded") || (!type.includes("multipart") && raw.includes("="))) {
    const out: any = {};
    for (const [k, val] of new URLSearchParams(raw).entries()) {
      const m = k.match(/^([^\[]+)((?:\[[^\]]*\])+)$/);
      if (!m) { out[k] = val; continue; }
      const path = [m[1], ...Array.from(m[2].matchAll(/\[([^\]]*)\]/g)).map((x) => x[1])];
      let cur = out;
      for (let i = 0; i < path.length - 1; i++) { if (typeof cur[path[i]] !== "object" || cur[path[i]] === null) cur[path[i]] = {}; cur = cur[path[i]]; }
      cur[path[path.length - 1]] = val;
    }
    return out;
  }
  return {};
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply(200);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let done: (o: string, s: number, e?: any) => Promise<void> = async () => {};
  try {
    const type = req.headers.get("content-type") || "";
    let raw = "", payload: any = {};
    if (type.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (form) { payload = formToPayload(form); raw = JSON.stringify(payload); }
    } else {
      raw = await req.text().catch(() => "");
      payload = parseBody(type, raw);
    }
    const transactionId = extractTxnId(payload);
    done = await logRequest(db, req, raw, payload, transactionId);
    if (!/^SNS[A-Z0-9]{6,40}$/.test(transactionId)) { await done("missing_transaction_id", 400); return reply(400, "missing transaction_id"); }
    const { data: row } = await db.from("app_data").select("data").eq("collection", "ligdicashTransactions").eq("id", transactionId).maybeSingle();
    if (!row) { await done("unknown_transaction", 404); return reply(404, "unknown transaction"); }
    const txn = (row as any).data;
    if (txn.status !== "pending" || !txn.ligdicashToken) { await done("already_processed:" + txn.status, 200); return reply(200); }
    const conf = await confirmInvoice(txn.ligdicashToken);
    const cbInfo = { at: Date.now(), status: String(payload.status || ""), request_id: String(payload.request_id || ""), operator: String(payload.operator_name || "") };
    await noteCheck(db, txn, "callback", conf, { lastCallback: cbInfo, callbackReceivedAt: Date.now() });
    const result = await applyConfirmed(db, txn, conf);
    await done("processed:" + result, 200, { confirm: conf ? { response_code: conf.response_code, status: conf.status, amount: conf.amount ?? conf.montant, operator_name: conf.operator_name, request_id: conf.request_id } : null });
    return reply(200);
  } catch (e) {
    console.error("ligdicash-callback", e);
    await done("error:" + (e instanceof Error ? e.message : "unknown"), 200);
    return reply(200);
  }
});
