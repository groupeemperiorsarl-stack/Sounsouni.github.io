// claude-admin — « clé Claude » : accès technique de l'assistant Claude à Sounsouni.
// - Authentification : en-tête x-claude-key ; seule son empreinte SHA-256 est gardée
//   (collection protégée digitalSecrets, id "sys_claude_key", illisible depuis l'app).
// - Interrupteur : settings/claude_access.enabled doit valoir true (bouton dans l'Admin).
// - Périmètre : lecture de l'état (sans données personnelles), articles de la boutique
//   « Sounsouni Officiel » uniquement, pubs VIP, quelques réglages. Jamais d'argent,
//   jamais de mots de passe, jamais les articles des autres vendeurs.
// - Journal : chaque écriture est notée dans settings/claude_log (visible dans l'Admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const OFFICIAL_ID = "sounsouni-officiel";
const SETTINGS_OK = ["market_fx", "vip_config", "reco_section_config", "category_stars_config", "sector_icons_config", "boost_config"];
const LIST_OK = ["products", "orders", "vipAds", "boosts", "disputes", "publicProfiles", "settings", "productStats", "sellerStats"];
const PRIVATE_KEY = /phone|address|adresse|lat$|lng$|latitude|longitude|repere|contact|email|password|secret|token|recovery|authUid|loginHistory|gps|whatsapp|otp|buyerName|livreurName|specialInstructions|quartier/i;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-claude-key" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const nowIso = () => new Date().toISOString();

async function sha256(s: string) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function sameStr(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function getDoc(c: string, id: string) { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? (data as any).data : null; }
async function putDoc(c: string, doc: any) { const { error } = await db.from("app_data").upsert({ collection: c, id: String(doc.id), data: doc, updated_at: nowIso() }, { onConflict: "collection,id" }); if (error) throw error; }
function scrub(v: any, depth = 0): any {
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => scrub(x, depth + 1));
  const o: any = {}; for (const k of Object.keys(v)) { if (PRIVATE_KEY.test(k)) continue; o[k] = scrub(v[k], depth + 1); } return o;
}
const str = (v: any, n: number) => (v === undefined || v === null ? "" : String(v)).slice(0, n);
async function log(op: string, target: string, summary: string) {
  const cur = (await getDoc("settings", "claude_log")) || { id: "claude_log", entries: [] };
  const entries = Array.isArray(cur.entries) ? cur.entries : [];
  entries.unshift({ at: Date.now(), op, target: str(target, 80), summary: str(summary, 240) });
  await putDoc("settings", { id: "claude_log", entries: entries.slice(0, 300) });
}
async function hashPassword(plain: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const it = 100000;
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: it, hash: "SHA-256" }, km, 256);
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return "pbkdf2$" + it + "$" + b64(salt) + "$" + b64(new Uint8Array(bits));
}
async function uploadImage(b64: string, id: string, i: number) {
  const m = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/.exec(b64); if (!m) throw new Error("bad_image");
  const bin = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)); if (bin.length > 4_000_000) throw new Error("image_too_big");
  const path = "claude/" + id + "-" + i + "-" + Date.now() + "." + (m[2] === "jpeg" ? "jpg" : m[2]);
  const { error } = await db.storage.from("photo").upload(path, bin, { contentType: m[1], upsert: true, cacheControl: "31536000" }); if (error) throw error;
  return db.storage.from("photo").getPublicUrl(path).data.publicUrl;
}

async function status() {
  const day = Date.now() - 86400000, week = Date.now() - 7 * 86400000;
  const [{ data: orders }, { count: nProducts }, { data: pend }, { data: accts }, { data: disputes }, { data: ligdi }] = await Promise.all([
    db.from("app_data").select("data").eq("collection", "orders").gte("data->>createdAt", String(week)).limit(3000),
    db.from("app_data").select("id", { count: "exact", head: true }).eq("collection", "products"),
    db.from("app_data").select("id").eq("collection", "products").eq("data->>moderationStatus", "pending").limit(500),
    db.from("app_data").select("data->role, data->createdAt, data->verificationStatus").eq("collection", "accounts").limit(20000),
    db.from("app_data").select("data->status").eq("collection", "disputes").limit(2000),
    db.from("app_data").select("data->status, data->createdAt, data->amount").eq("collection", "ligdicashTransactions").gte("data->>createdAt", String(week)).limit(3000),
  ]);
  const o = (orders || []).map((r: any) => r.data);
  const tot: Record<string, number> = {};
  const ids = o.map((x: any) => String(x.id));
  for (let i = 0; i < ids.length; i += 200) {
    const { data: det } = await db.from("app_data").select("id, data->total").eq("collection", "orderDetails").in("id", ids.slice(i, i + 200));
    for (const d of (det || []) as any[]) tot[d.id] = Number(d.total) || 0;
  }
  const paid = (a: any[]) => a.filter((x) => x.status !== "Annulée");
  const sum = (a: any[]) => paid(a).reduce((s, x) => s + (tot[String(x.id)] || 0), 0);
  const byStatus: Record<string, number> = {}; for (const x of o) byStatus[x.status || "?"] = (byStatus[x.status || "?"] || 0) + 1;
  const a = (accts || []) as any[];
  const roles: Record<string, number> = {}; for (const x of a) roles[x.role || "?"] = (roles[x.role || "?"] || 0) + 1;
  const lg = (ligdi || []) as any[]; const lgS: Record<string, number> = {}; for (const x of lg) lgS[x.status || "?"] = (lgS[x.status || "?"] || 0) + 1;
  return {
    at: nowIso(),
    orders: { last24h: o.filter((x) => Number(x.createdAt) >= day).length, last7d: o.length, totalFcfa24h_horsAnnulees: sum(o.filter((x) => Number(x.createdAt) >= day)), totalFcfa7d_horsAnnulees: sum(o), byStatus7d: byStatus },
    products: { total: nProducts || 0, pendingModeration: (pend || []).length },
    accounts: { total: a.length, new24h: a.filter((x) => Number(x.createdAt) >= day).length, byRole: roles, pendingVerification: a.filter((x) => x.verificationStatus === "pending").length },
    disputesOpen: (disputes || []).filter((r: any) => r.status && !/r[ée]solu|closed|ferm/i.test(String(r.status))).length,
    ligdicash7d: lgS,
  };
}

async function productSave(input: any) {
  const shop = await getDoc("accounts", OFFICIAL_ID); if (!shop) throw new Error("official_shop_missing");
  const id = input.id ? String(input.id) : "id-sso-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const cur = await getDoc("products", id);
  if (cur && cur.sellerId !== OFFICIAL_ID) throw new Error("not_official_product");
  const name = str(input.name ?? cur?.name, 120).trim(); const price = Math.round(Number(input.price ?? cur?.price));
  if (!name || !(price > 0)) throw new Error("name_and_price_required");
  let images: string[] = Array.isArray(cur?.images) ? cur.images : [];
  if (Array.isArray(input.images)) {
    images = [];
    for (let i = 0; i < Math.min(input.images.length, 8); i++) { const v = String(input.images[i]); images.push(v.startsWith("data:") ? await uploadImage(v, id, i) : v.slice(0, 600)); }
  }
  const allowed = ["description", "category", "stock", "oldPrice", "sizes", "colors", "colorPrices", "emoji", "itemType", "tieredPricing", "isQuantifiable", "nameByLang", "fieldsByLang", "fitNote", "video"];
  const doc: any = { ...(cur || {}) };
  for (const k of allowed) if (k in input) doc[k] = scrub(input[k]);
  Object.assign(doc, { id, name, price, images, sellerId: OFFICIAL_ID, sellerName: shop.name, shopName: shop.shopName, sellerType: shop.sellerType || "entreprise", sellerSector: shop.sellerSector || "boutique", sellerPhone: shop.shopPhone || shop.phone || "", createdAt: cur?.createdAt || Date.now(), updatedAt: Date.now(), postedBy: "claude" });
  if (typeof doc.stock !== "number") doc.stock = 10;
  delete doc.moderationStatus; delete doc.moderationReason;
  await putDoc("products", doc);
  await log(cur ? "article_modifie" : "article_publie", id, name + " — " + price + " FCFA");
  return { id, product: doc };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = req.headers.get("x-claude-key") || "";
    const rec = await getDoc("digitalSecrets", "sys_claude_key");
    if (!key || !rec || !rec.hash || !sameStr(await sha256(key), String(rec.hash))) { await new Promise((r) => setTimeout(r, 900)); return json({ success: false, error: "bad_key" }, 401); }
    const access = await getDoc("settings", "claude_access");
    if (!access || access.enabled !== true) return json({ success: false, error: "access_disabled" }, 403);
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");

    if (op === "status") return json({ success: true, status: await status() });

    if (op === "list") {
      const c = String(body.collection || ""); if (!LIST_OK.includes(c)) return json({ success: false, error: "collection_not_allowed" }, 403);
      let q = db.from("app_data").select("id, data, updated_at").eq("collection", c).order("updated_at", { ascending: false }).limit(Math.min(Number(body.limit) || 30, 200));
      if (body.sellerId) q = q.eq("data->>sellerId", String(body.sellerId));
      if (body.status) q = q.eq("data->>status", String(body.status));
      if (body.id) q = q.eq("id", String(body.id));
      if (c === "settings" && !body.id) q = q.in("id", SETTINGS_OK.concat(["claude_access", "claude_log"]));
      const { data, error } = await q; if (error) throw error;
      const items = (data || []).map((r: any) => ({ id: r.id, updated_at: r.updated_at, data: scrub(r.data) }));
      if (c === "orders" && items.length) {
        const { data: det } = await db.from("app_data").select("id, data").eq("collection", "orderDetails").in("id", items.map((x: any) => x.id));
        const m: Record<string, any> = {}; for (const d of (det || []) as any[]) m[d.id] = d.data;
        for (const it of items as any[]) if (m[it.id]) it.details = { total: m[it.id].total, items: scrub(m[it.id].items) };
      }
      return json({ success: true, items });
    }

    if (op === "init_official_shop") {
      let shop = await getDoc("accounts", OFFICIAL_ID);
      const created = !shop;
      if (!shop) {
        const phone = str(body.phone, 30); if (!/^\+?\d{8,15}$/.test(phone.replace(/\s/g, ""))) return json({ success: false, error: "phone_required" }, 400);
        shop = { id: OFFICIAL_ID, name: "Sounsouni Officiel", shopName: "Sounsouni Officiel", role: "vendeur", roles: ["vendeur"], sellerType: "entreprise", sellerSector: "boutique", phone, shopPhone: phone, country: "Mali", commune: str(body.commune, 60), quartier: str(body.quartier, 60), shopAddress: str(body.shopAddress, 160), verified: true, createdAt: Date.now(), hasPassword: true, vendorCommissionAccepted: true, isOfficial: true };
        await putDoc("accounts", shop);
      }
      if (body.password) {
        const pw = String(body.password); if (pw.length < 8) return json({ success: false, error: "password_too_short" }, 400);
        const h = await hashPassword(pw);
        const { error } = await db.from("credentials").upsert({ account_id: OFFICIAL_ID, password_hash: h }, { onConflict: "account_id" }); if (error) throw error;
      }
      await log(created ? "boutique_creee" : "boutique_mise_a_jour", OFFICIAL_ID, "Boutique Sounsouni Officiel");
      return json({ success: true, created, shop: scrub(shop) });
    }

    // ---- Économie du trafic : vignettes et mémoire longue des photos ----
    if (op === "thumb_put") {
      // Vignette WebP (≤ 40 Ko) rangée uniquement sous thumbs/<chemin d'une photo existante>.webp
      const path = String(body.path || "");
      if (!/^thumbs\/[A-Za-z0-9._\-\/]+\.(jpe?g|png|webp)\.webp$/.test(path) || path.includes("..")) return json({ success: false, error: "bad_path" }, 400);
      const m = /^data:image\/webp;base64,(.+)$/.exec(String(body.data || "")); if (!m) return json({ success: false, error: "bad_image" }, 400);
      const bin = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); if (bin.length > 40000) return json({ success: false, error: "too_big" }, 400);
      const orig = path.slice(7, -5); const dir = orig.includes("/") ? orig.slice(0, orig.lastIndexOf("/")) : ""; const name = orig.slice(orig.lastIndexOf("/") + 1);
      const { data: ex } = await db.storage.from("photo").list(dir, { search: name, limit: 5 }); if (!(ex || []).some((f: any) => f.name === name)) return json({ success: false, error: "original_missing" }, 404);
      const { error } = await db.storage.from("photo").upload(path, bin, { contentType: "image/webp", upsert: true, cacheControl: "31536000" }); if (error) throw error;
      return json({ success: true, path });
    }
    if (op === "recache") {
      // Réenvoie des photos existantes à l'identique avec « mémoire 1 an » (même adresse, même contenu).
      const paths: string[] = (Array.isArray(body.paths) ? body.paths : []).slice(0, 25).map(String);
      const done: string[] = [], failed: string[] = [];
      for (const p of paths) {
        try {
          if (p.includes("..") || !/\.(jpe?g|png|webp)$/i.test(p)) throw new Error("bad_path");
          const { data: blob, error: e1 } = await db.storage.from("photo").download(p); if (e1 || !blob) throw e1 || new Error("dl");
          const { error: e2 } = await db.storage.from("photo").upload(p, blob, { contentType: blob.type || undefined, upsert: true, cacheControl: "31536000" }); if (e2) throw e2;
          done.push(p);
        } catch (_) { failed.push(p); }
      }
      if (done.length) await log("photos_memoire_longue", String(done.length), done.length + " photo(s) passées à 1 an");
      return json({ success: true, done: done.length, failed });
    }

    if (op === "product_save") return json({ success: true, ...(await productSave(body.product || {})) });

    if (op === "product_delete") {
      const id = String(body.id || ""); const cur = await getDoc("products", id);
      if (!cur) return json({ success: false, error: "not_found" }, 404);
      if (cur.sellerId !== OFFICIAL_ID) return json({ success: false, error: "not_official_product" }, 403);
      await db.from("app_data").delete().eq("collection", "products").eq("id", id);
      await log("article_retire", id, String(cur.name || ""));
      return json({ success: true });
    }

    if (op === "vip_save") {
      const ad = scrub(body.ad || {}); if (!ad || typeof ad !== "object") return json({ success: false, error: "invalid_ad" }, 400);
      ad.id = ad.id ? String(ad.id) : "vip-claude-" + Date.now().toString(36);
      const cur = await getDoc("vipAds", ad.id); const doc = { ...(cur || {}), ...ad, updatedAt: Date.now(), postedBy: "claude" };
      await putDoc("vipAds", doc); await log(cur ? "pub_vip_modifiee" : "pub_vip_creee", doc.id, str(doc.title || doc.text || doc.name, 120));
      return json({ success: true, ad: doc });
    }
    if (op === "vip_delete") {
      const id = String(body.id || ""); const cur = await getDoc("vipAds", id); if (!cur) return json({ success: false, error: "not_found" }, 404);
      await db.from("app_data").delete().eq("collection", "vipAds").eq("id", id); await log("pub_vip_supprimee", id, str(cur.title || cur.text, 120));
      return json({ success: true });
    }

    if (op === "setting_save") {
      const id = String(body.id || ""); if (!SETTINGS_OK.includes(id)) return json({ success: false, error: "setting_not_allowed" }, 403);
      const cur = (await getDoc("settings", id)) || { id };
      const doc = { ...cur, ...scrub(body.patch || {}), id };
      await putDoc("settings", doc); await log("reglage_modifie", id, JSON.stringify(body.patch || {}).slice(0, 200));
      return json({ success: true, setting: doc });
    }

    // ---- Tests d'intégration LigdiCash ----
    if (op === "ligdicash_test_link") {
      // Lien de paiement « test » : ne crédite aucun portefeuille, ne touche à aucune commande.
      const amount = Math.round(Number(body.amount) || 10); if (amount < 1 || amount > 1000) return json({ success: false, error: "amount_1_1000" }, 400);
      const apiKey = Deno.env.get("LIGDICASH_API_KEY"), authToken = Deno.env.get("LIGDICASH_AUTH_TOKEN");
      if (!apiKey || !authToken) return json({ success: false, error: "ligdicash_not_configured" }, 500);
      const base = Deno.env.get("LIGDICASH_BASE_URL") || "https://app.ligdicash.com", site = Deno.env.get("FRONTEND_URL") || "https://sounsouni.pro";
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(5))).map((b) => b.toString(36).padStart(2, "0")).join("").toUpperCase();
      const transactionId = "SNST" + Date.now().toString(36).toUpperCase() + rand;
      const txn: any = { transactionId, kind: "test", refId: "test:" + transactionId, buyerId: null, amount, status: "pending", ligdicashToken: null, createdAt: Date.now(), mode: "redirect", note: "Test d'intégration LigdiCash" };
      await putDoc("ligdicashTransactions", { ...txn, id: transactionId });
      const back = site + "/?ligdicash=retour&txn=" + transactionId;
      const res: any = await fetch(base + "/pay/v01/redirect/checkout-invoice/create", { method: "POST", headers: { "Apikey": apiKey, "Authorization": "Bearer " + authToken, "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ commande: { invoice: { items: [], total_amount: amount, devise: "XOF", description: "Test d'intégration Sounsouni", customer: "", customer_firstname: "Test", customer_lastname: "LigdiCash", customer_email: "", external_id: "", otp: "" },
          store: { name: "Sounsouni", website_url: site }, actions: { cancel_url: back + "&r=annule", return_url: back + "&r=ok", callback_url: Deno.env.get("SUPABASE_URL") + "/functions/v1/ligdicash-callback" }, custom_data: { transaction_id: transactionId } } }) }).then((r) => r.json()).catch(() => null);
      if (!res || res.response_code !== "00" || !res.token) {
        await putDoc("ligdicashTransactions", { ...txn, id: transactionId, status: "creation_failed", error: String((res && res.response_text) || "network").slice(0, 200) });
        return json({ success: false, error: "ligdicash_error", detail: res }, 502);
      }
      await putDoc("ligdicashTransactions", { ...txn, id: transactionId, ligdicashToken: res.token, paymentUrl: res.response_text, history: [{ at: Date.now(), type: "create", response_code: res.response_code }] });
      await log("lien_test_ligdicash", transactionId, amount + " FCFA");
      return json({ success: true, transactionId, amount, paymentUrl: res.response_text });
    }
    if (op === "ligdicash_logs") {
      const since = Number(body.since) || 0;
      const { data } = await db.from("app_data").select("data").eq("collection", "ligdicashTransactions").eq("data->>kind", "callback_log").order("updated_at", { ascending: false }).limit(Math.min(Number(body.limit) || 50, 200));
      return json({ success: true, logs: (data || []).map((r: any) => r.data).filter((x: any) => Number(x.receivedAt) >= since) });
    }
    if (op === "ligdicash_txn") {
      const t = await getDoc("ligdicashTransactions", String(body.id || "")); if (!t) return json({ success: false, error: "not_found" }, 404);
      const { ligdicashToken, ...rest } = t; return json({ success: true, transaction: rest });
    }

    return json({ success: false, error: "unknown_op" }, 400);
  } catch (e) {
    console.error("claude-admin", e);
    return json({ success: false, error: e instanceof Error ? e.message : "server_error" }, 500);
  }
});
