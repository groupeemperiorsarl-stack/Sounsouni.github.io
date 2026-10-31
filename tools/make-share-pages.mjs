// Fabrique une petite page par article (p/<id>.html) avec la photo, le prix et
// une courte description, pour que WhatsApp / Facebook affichent un bel aperçu
// quand on partage le lien. La page renvoie aussitôt vers l'article dans l'app.
import fs from "node:fs";
const html = fs.readFileSync(fs.existsSync("js/app.js") ? "js/app.js" : "index.html", "utf8");
const url = (html.match(/url:\s*"(https:\/\/[a-z0-9]+\.supabase\.co)"/) || [])[1];
const key = (html.match(/anonKey:\s*"([^"]+)"/) || [])[1];
if (!url || !key) throw new Error("configuration Supabase introuvable dans index.html");
const SITE = "https://sounsouni.pro";
const rows = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${url}/rest/v1/app_data?select=id,data&collection=eq.products&order=id`, { headers: { apikey: key, Authorization: "Bearer " + key, Range: `${from}-${from + 999}` } });
  if (!r.ok) throw new Error("lecture des articles impossible : " + r.status);
  const page = await r.json(); rows.push(...page); if (page.length < 1000) break;
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const safeId = (id) => /^[A-Za-z0-9_\-]{1,80}$/.test(id);
fs.mkdirSync("p", { recursive: true });
const keep = new Set();
let written = 0;
for (const { id, data: p } of rows) {
  if (!p || !safeId(id) || p.banned || p.deleted) continue;
  const name = String(p.name || "Article").slice(0, 90);
  const price = Number(p.price) > 0 ? fmt(p.price) + " FCFA" : "";
  const shop = p.shopName || p.sellerName || "";
  const desc = String(p.description || "").replace(/\s+/g, " ").trim();
  const title = price ? `${name} — ${price}` : name;
  const description = ((shop ? shop + " · " : "") + (desc || "Disponible sur Sounsouni, le marché digital du Mali.")).slice(0, 180);
  const img = (Array.isArray(p.images) ? p.images : []).find((u) => typeof u === "string" && /^https:\/\//.test(u)) || SITE + "/og-image.jpg";
  const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Sounsouni</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Sounsouni">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}/p/${id}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:alt" content="${esc(name)}">
${price ? `<meta property="product:price:amount" content="${Math.round(Number(p.price))}"><meta property="product:price:currency" content="XOF">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${SITE}/?product=${id}">
<script>var q=new URLSearchParams(location.search),r=q.get("ref");location.replace("/?product=${id}"+(r?"&ref="+encodeURIComponent(r):""));</script>
</head><body style="font-family:sans-serif;text-align:center;padding:40px 16px">
<p>Ouverture de l'article sur Sounsouni…</p>
<p><a href="/?product=${id}">Voir l'article</a></p>
</body></html>
`;
  const file = `p/${id}.html`;
  keep.add(`${id}.html`);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== page) { fs.writeFileSync(file, page); written++; }
}
// ---- Catalogues Facebook / Instagram / WhatsApp (31/10/2026) ----
// c/<boutique>.csv : un catalogue par boutique, au format « flux de données »
// de Meta (Commerce Manager le relit tout seul chaque jour). c/sounsouni.csv :
// tous les articles, pour les publicités de Sounsouni.
const csvCell = (v) => { const s = String(v ?? "").replace(/\r?\n|\r/g, " ").trim(); return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const HEAD = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link", "brand", "product_type"];
const bySeller = new Map(), all = [];
for (const { id, data: p } of rows) {
  if (!p || !safeId(id) || p.banned || p.deleted || p.hidden) continue;
  if (p.moderationStatus === "pending" || p.moderationStatus === "rejected") continue;
  if (!(Number(p.price) > 0)) continue;
  const imgs = (Array.isArray(p.images) ? p.images : []).filter((u) => typeof u === "string" && /^https:\/\//.test(u));
  if (!imgs.length) continue;
  const shop = String(p.shopName || p.sellerName || "Sounsouni").slice(0, 100);
  const desc = (String(p.description || "").replace(/\s+/g, " ").trim() || String(p.name || "")).slice(0, 4900);
  const line = [id, String(p.name || "Article").slice(0, 150), desc, typeof p.stock === "number" && p.stock <= 0 ? "out of stock" : "in stock", p.condition === "occasion" ? "used" : "new",
    Math.round(Number(p.price)) + " XOF", `${SITE}/p/${id}.html?ref=fb`, imgs[0], imgs.slice(1, 10).join(","), shop, String(p.category || "").slice(0, 120)].map(csvCell).join(",");
  all.push(line);
  const sid = String(p.sellerId || "");
  if (safeId(sid)) { if (!bySeller.has(sid)) bySeller.set(sid, []); bySeller.get(sid).push(line); }
}
fs.mkdirSync("c", { recursive: true });
const keepC = new Set();
const writeCsv = (name, lines) => { const body = HEAD.join(",") + "\n" + lines.join("\n") + "\n"; const f = "c/" + name; keepC.add(name); if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== body) fs.writeFileSync(f, body); };
writeCsv("sounsouni.csv", all);
for (const [sid, lines] of bySeller) writeCsv(sid + ".csv", lines);
for (const f of fs.readdirSync("c")) if (f.endsWith(".csv") && !keepC.has(f)) fs.unlinkSync("c/" + f);
console.log(`catalogues : ${keepC.size} (articles : ${all.length})`);
let removed = 0;
for (const f of fs.readdirSync("p")) if (f.endsWith(".html") && !keep.has(f)) { fs.unlinkSync("p/" + f); removed++; }
console.log(`articles : ${keep.size}, pages écrites : ${written}, supprimées : ${removed}`);
