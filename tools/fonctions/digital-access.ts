// digital-access : produits numériques (fichier, lien, ou formation en leçons).
// Les fichiers simples restent dans le stockage Supabase « digital » (privé).
// Les formations en leçons (vidéos + PDF) sont dans Cloudflare R2
// (compartiment privé « sounsouni-formations ») : l'application reçoit
// seulement des liens signés de courte durée, jamais les clés.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
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
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const normP = (p: unknown) => String(p || "").replace(/[\s.\-()]/g, "");
function tierUnit(prod: any, qty: number): number {
  let price = num(prod.price);
  const tiers = Array.isArray(prod.tieredPricing) ? prod.tieredPricing.slice().sort((a: any, b: any) => num(a.minQty) - num(b.minQty)) : [];
  for (const t of tiers) if (qty >= num(t.minQty)) price = num(t.price);
  return price;
}
const BUCKET = "digital";
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "epub", "mobi", "zip", "rar", "mp3", "m4a", "wav", "mp4", "mov", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "apk", "exe", "dmg", "png", "jpg", "jpeg", "psd", "ai", "svg"];
// --- Formations en leçons (Cloudflare R2) ---
const R2_BASE = "https://4dc588e4145805b60b11dadd718aaec2.r2.cloudflarestorage.com/sounsouni-formations";
const LESSON_EXT: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4", pdf: "application/pdf" };
const LESSON_MAX = 600 * 1024 * 1024;
const MAX_LESSONS = 60;
let r2: AwsClient | null = null;
function R2() {
  if (!r2) r2 = new AwsClient({ accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID") || "", secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") || "", service: "s3", region: "auto" });
  return r2;
}
async function r2Sign(key: string, method: string, seconds: number, extra: Record<string, string> = {}) {
  const u = new URL(R2_BASE + "/" + key.split("/").map(encodeURIComponent).join("/"));
  u.searchParams.set("X-Amz-Expires", String(seconds));
  for (const k in extra) u.searchParams.set(k, extra[k]);
  const signed = await R2().sign(new Request(u.toString(), { method }), { aws: { signQuery: true } });
  return signed.url;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const session = await verifySession(req);
    if (!session) return json({ success: false, error: "session_required" }, 401);
    const callerId: string = session.accountId;
    const body = await req.json().catch(() => ({}));
    const op = String(body.operation || "");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const getDoc = async (c: string, id: string) => { const { data } = await db.from("app_data").select("data").eq("collection", c).eq("id", id).maybeSingle(); return data ? (data as any).data : null; };
    const me = await getDoc("accounts", callerId);
    const callerIds = [callerId];
    if (me && me.phone) {
      const { data: sib } = await db.from("app_data").select("data").eq("collection", "accounts").eq("data->>phone", me.phone);
      (sib || []).forEach((r: any) => { if (r.data && r.data.id && !callerIds.includes(r.data.id)) callerIds.push(r.data.id); });
    }
    let isStaff = callerId === "admin_owner" || callerId.startsWith("national_admin_");
    if (!isStaff && me && me.phone) {
      const mine = normP(me.phone);
      const { data: wl } = await db.from("app_data").select("data").in("collection", ["group2GlobalWhitelist", "nationalAdmins"]);
      isStaff = (wl || []).some((r: any) => { const d = r.data || {}; if (normP(d.phone) === mine) return true; return Array.isArray(d.employeeWhitelist) && d.employeeWhitelist.some((w: any) => w && normP(w.phone) === mine); });
    }
    const samePerson = async (a: string, b: string) => {
      if (!a || !b) return false;
      if (a === b) return true;
      const A = await getDoc("accounts", a), B = await getDoc("accounts", b);
      return !!(A && B && A.phone && normP(A.phone) === normP(B.phone));
    };
    // Vérifie qu'une commande donne bien droit au produit (payée, à cet acheteur).
    const checkPaid = async (orderId: string, productId: string) => {
      const order = orderId ? await getDoc("orders", orderId) : null;
      if (!order || !callerIds.includes(order.buyerId)) return { ok: false, error: "forbidden", order: null as any };
      if (order.status === "Annulée") return { ok: false, error: "order_cancelled", order };
      const details = (await getDoc("orderDetails", orderId)) || {};
      const items: any[] = Array.isArray(details.items) ? details.items : (Array.isArray(order.items) ? order.items : []);
      if (!items.some((it: any) => it && it.productId === productId && !it.refused)) return { ok: false, error: "not_in_order", order };
      let paid = false;
      if (order.payment === "ligdicash") {
        paid = order.paymentStatus === "paid";
      } else if (order.payment === "portefeuille") {
        let expected = 0;
        for (const it of items) {
          if (!it || it.refused) continue;
          const p = await getDoc("products", String(it.productId || ""));
          const q = Math.max(1, Math.round(num(it.qty)));
          expected += p ? tierUnit(p, q) * q : num(it.price) * q;
        }
        const buyer = await getDoc("accounts", String(order.buyerId || ""));
        const w = buyer && buyer.phone ? await getDoc("wallets", normP(buyer.phone)) : null;
        const tx = w && Array.isArray(w.transactions) ? w.transactions : [];
        paid = tx.some((t: any) => t && t.type === "debit" && t.reason === "achat_boutique" && t.orderId === orderId && num(t.amount) + 1 >= expected);
      }
      return paid ? { ok: true, error: "", order } : { ok: false, error: "not_paid", order };
    };
    const markDelivered = async (order: any, orderId: string) => {
      if (!order || !order.isDigital || order.status === "Livrée") return;
      const now = Date.now();
      const vs: Record<string, string> = {};
      for (const sid of (Array.isArray(order.sellerIds) ? order.sellerIds : [])) vs[sid] = "Prête";
      const hist = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      await db.from("app_data").update({ data: { ...order, status: "Livrée", deliveredAt: now, vendorStatuses: vs, statusHistory: [...hist, { status: "Livrée", at: now, note: "Produit numérique remis" }] }, updated_at: new Date().toISOString() }).eq("collection", "orders").eq("id", orderId);
    };
    if (op === "upload_url") {
      if (!me) return json({ success: false, error: "account_required" }, 403);
      const name = String(body.fileName || "fichier").slice(0, 120);
      const ext = (name.split(".").pop() || "").toLowerCase();
      const size = num(body.size);
      if (!ALLOWED_EXT.includes(ext)) return json({ success: false, error: "bad_file_type" }, 400);
      if (size <= 0 || size > MAX_BYTES) return json({ success: false, error: "file_too_big" }, 400);
      const safe = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const path = callerId + "/" + Date.now() + "_" + rand + "_" + safe;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) { console.error("digital upload_url", error); return json({ success: false, error: "storage_error" }, 500); }
      return json({ success: true, path, token: (data as any).token, signedUrl: (data as any).signedUrl });
    }
    // Envoi d'une vidéo ou d'un PDF de leçon vers R2 (lien d'envoi valable 2 h).
    if (op === "lesson_upload_url") {
      if (!me) return json({ success: false, error: "account_required" }, 403);
      const name = String(body.fileName || "lecon").slice(0, 120);
      const ext = (name.split(".").pop() || "").toLowerCase();
      const size = num(body.size);
      if (!LESSON_EXT[ext]) return json({ success: false, error: "bad_file_type" }, 400);
      if (size <= 0 || size > LESSON_MAX) return json({ success: false, error: "file_too_big" }, 400);
      const safe = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = "f/" + callerId + "/" + Date.now() + "_" + rand + "_" + safe;
      const url = await r2Sign(key, "PUT", 7200);
      return json({ success: true, key, url, contentType: LESSON_EXT[ext] });
    }
    if (op === "set_secret") {
      const productId = String(body.productId || "");
      if (!productId) return json({ success: false, error: "missing_id" }, 400);
      const prod = await getDoc("products", productId);
      if (prod && !callerIds.includes(prod.sellerId) && !isStaff) return json({ success: false, error: "not_your_product" }, 403);
      const old = await getDoc("digitalSecrets", productId);
      if (old && !callerIds.includes(old.ownerId) && !isStaff) return json({ success: false, error: "not_your_product" }, 403);
      const kind = body.kind === "link" ? "link" : body.kind === "lessons" ? "lessons" : "file";
      const rec: Record<string, unknown> = { id: productId, ownerId: prod ? prod.sellerId : callerId, kind, updatedAt: Date.now() };
      const ownKey = (k: string) => typeof k === "string" && callerIds.some((id) => k.startsWith("f/" + id + "/")) || (isStaff && /^f\/[^/]+\/[^/]+$/.test(String(k || "")));
      if (kind === "link") {
        const link = String(body.link || "").trim();
        if (!/^https:\/\/[^\s]{4,490}$/.test(link)) return json({ success: false, error: "bad_link" }, 400);
        rec.link = link;
      } else if (kind === "lessons") {
        const raw: any[] = Array.isArray(body.lessons) ? body.lessons.slice(0, MAX_LESSONS) : [];
        const oldL: any[] = old && Array.isArray(old.lessons) ? old.lessons : [];
        const known = (k: string) => oldL.some((l: any) => l && (l.video === k || l.pdf === k));
        const lessons = [];
        for (const l of raw) {
          if (!l) continue;
          const video = String(l.video || ""), pdf = String(l.pdf || "");
          if (!video && !pdf) continue;
          if (video && !ownKey(video) && !known(video)) return json({ success: false, error: "bad_path" }, 400);
          if (pdf && !ownKey(pdf) && !known(pdf)) return json({ success: false, error: "bad_path" }, 400);
          lessons.push({ title: String(l.title || "Leçon").slice(0, 120), video: video || null, pdf: pdf || null, free: !!l.free, dur: Math.max(0, Math.round(num(l.dur))) });
        }
        if (!lessons.length) return json({ success: false, error: "no_lessons" }, 400);
        rec.lessons = lessons;
      } else {
        const path = String(body.path || "");
        if (!path || !callerIds.some((id) => path.startsWith(id + "/"))) return json({ success: false, error: "bad_path" }, 400);
        rec.path = path;
        rec.fileName = String(body.fileName || path.split("/").pop() || "fichier").slice(0, 120);
        rec.size = num(body.size);
      }
      await db.from("app_data").upsert({ collection: "digitalSecrets", id: productId, data: rec, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
      return json({ success: true });
    }
    if (op === "my_secret") {
      const productId = String(body.productId || "");
      const sec = productId ? await getDoc("digitalSecrets", productId) : null;
      if (!sec) return json({ success: true, secret: null });
      if (!callerIds.includes(sec.ownerId) && !isStaff) return json({ success: false, error: "forbidden" }, 403);
      return json({ success: true, secret: { kind: sec.kind, fileName: sec.fileName || null, size: sec.size || null, link: sec.link || null, lessons: sec.lessons || null } });
    }
    // Lien de lecture d'une leçon (vidéo ou PDF), valable 3 h.
    // Leçon gratuite : pour tout compte connecté. Sinon : vendeur, équipe, ou acheteur ayant payé.
    if (op === "lesson_url") {
      const productId = String(body.productId || "");
      const idx = Math.round(num(body.index));
      const what = body.what === "pdf" ? "pdf" : "video";
      const prod = productId ? await getDoc("products", productId) : null;
      const sec = productId ? await getDoc("digitalSecrets", productId) : null;
      if (!prod || !sec || sec.kind !== "lessons" || !Array.isArray(sec.lessons)) return json({ success: false, error: "no_content" }, 404);
      if (!(await samePerson(sec.ownerId, prod.sellerId))) return json({ success: false, error: "no_content" }, 404);
      const lesson = sec.lessons[idx];
      if (!lesson || !lesson[what]) return json({ success: false, error: "no_content" }, 404);
      let allowed = !!lesson.free || isStaff || callerIds.includes(prod.sellerId);
      if (!allowed) {
        const r = await checkPaid(String(body.orderId || ""), productId);
        if (!r.ok) return json({ success: false, error: r.error }, r.error === "not_paid" ? 402 : 403);
        allowed = true;
        await markDelivered(r.order, String(body.orderId || ""));
      }
      const url = await r2Sign(lesson[what], "GET", 10800, what === "pdf" ? { "response-content-disposition": "inline" } : {});
      return json({ success: true, url, title: lesson.title, what });
    }
    if (op === "get_access") {
      const productId = String(body.productId || "");
      const orderId = String(body.orderId || "");
      const prod = productId ? await getDoc("products", productId) : null;
      const sec = productId ? await getDoc("digitalSecrets", productId) : null;
      if (!prod || !sec) return json({ success: false, error: "no_content" }, 404);
      if (!(await samePerson(sec.ownerId, prod.sellerId))) return json({ success: false, error: "no_content" }, 404);
      const allowed = isStaff || callerIds.includes(prod.sellerId);
      let order: any = null;
      if (!allowed) {
        const r = await checkPaid(orderId, productId);
        order = r.order;
        if (!r.ok) return json({ success: false, error: r.error }, r.error === "not_paid" ? 402 : (r.error === "order_cancelled" ? 409 : 403));
        await markDelivered(order, orderId);
      }
      if (sec.kind === "lessons") return json({ success: true, kind: "lessons", count: (sec.lessons || []).length, delivered: !!order });
      if (sec.kind === "link") return json({ success: true, kind: "link", url: sec.link, delivered: !!order });
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(String(sec.path), 3600, { download: String(sec.fileName || "fichier") });
      if (error || !data) { console.error("digital signed url", error); return json({ success: false, error: "storage_error" }, 500); }
      return json({ success: true, kind: "file", url: (data as any).signedUrl, fileName: sec.fileName || null, delivered: !!order });
    }
    return json({ success: false, error: "unknown_operation" }, 400);
  } catch (e) {
    console.error("digital-access", e);
    return json({ success: false, error: "server_error" }, 500);
  }
});
