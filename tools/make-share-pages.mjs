// Fabrique une petite page par article (p/<id>.html) avec la photo, le prix et
// une courte description, pour que WhatsApp / Facebook affichent un bel aperçu
// quand on partage le lien. Les visiteurs sont renvoyés aussitôt vers l'article dans l'app ;
// les robots (Google…) lisent la vraie fiche produit, identique, pour le référencement.
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
const smap = [];
for (const { id, data: p } of rows) {
  if (!p || !safeId(id) || p.banned || p.deleted) continue;
  const name = String(p.name || "Article").slice(0, 90);
  const price = Number(p.price) > 0 ? fmt(p.price) + " FCFA" : "";
  const shop = p.shopName || p.sellerName || "";
  const desc = String(p.description || "").replace(/\s+/g, " ").trim();
  const title = price ? `${name} — ${price}` : name;
  const description = ((shop ? shop + " · " : "") + (desc || "Disponible sur Sounsouni, le marché digital du Mali.")).slice(0, 180);
  const img = (Array.isArray(p.images) ? p.images : []).find((u) => typeof u === "string" && /^https:\/\//.test(u)) || SITE + "/og-image.jpg";
  const imgs = (Array.isArray(p.images) ? p.images : []).filter((u) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 6);
  const indexable = !p.hidden && p.moderationStatus !== "pending" && p.moderationStatus !== "rejected" && Number(p.price) > 0 && imgs.length > 0;
  const cat = String(p.category || "");
  const inStock = !(typeof p.stock === "number" && p.stock <= 0);
  const ld = { "@context": "https://schema.org", "@type": "Product", name, image: imgs.length ? imgs : [img], description: desc || name, sku: id,
    ...(cat ? { category: cat } : {}), ...(shop ? { brand: { "@type": "Brand", name: shop } } : {}),
    ...(price ? { offers: { "@type": "Offer", url: `${SITE}/p/${id}.html`, priceCurrency: "XOF", price: Math.round(Number(p.price)), availability: "https://schema.org/" + (inStock ? "InStock" : "OutOfStock"),
      itemCondition: "https://schema.org/" + (p.condition === "occasion" ? "UsedCondition" : "NewCondition"), seller: { "@type": "Organization", name: shop || "Sounsouni" } } } : {}) };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Sounsouni", item: SITE + "/" },
    ...(cat ? [{ "@type": "ListItem", position: 2, name: cat, item: SITE + "/#marche" }] : []), { "@type": "ListItem", position: cat ? 3 : 2, name }] };
  const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Sounsouni Bamako</title>
<meta name="description" content="${esc(description)}">
${indexable ? "" : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="product">
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
<link rel="canonical" href="${SITE}/p/${id}.html">
<link rel="icon" type="image/png" href="/favicon-192.png">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<script type="application/ld+json">${JSON.stringify(crumbs).replace(/</g, "\\u003c")}</script>
<script>if(!/bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegram|twitter|linkedin|lighthouse/i.test(navigator.userAgent)){var q=new URLSearchParams(location.search),r=q.get("ref");location.replace("/?product=${id}"+(r?"&ref="+encodeURIComponent(r):""));}</script>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2433;background:#f5f7f3}a{color:inherit}.w{max-width:960px;margin:auto;padding:16px}
.h{display:flex;align-items:center;gap:10px;font-weight:800;text-decoration:none;color:#1b5e20}.h img{width:34px;height:34px;border-radius:9px}
.g{display:grid;gap:20px;margin-top:16px}.ph{display:grid;gap:8px}.ph img{width:100%;border-radius:18px;background:#fff;aspect-ratio:1;object-fit:cover}.ph .t{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ph .t img{border-radius:10px}
h1{font-size:24px;line-height:1.2;margin:4px 0 8px}.pr{font-size:26px;font-weight:900;color:#1b5e20}.c{font-size:13px;color:#5e7462;text-transform:uppercase;letter-spacing:1px}.d{white-space:pre-line;line-height:1.6;font-size:15px}
.b{display:block;text-align:center;background:#2e7d32;color:#fff;text-decoration:none;font-weight:800;padding:15px;border-radius:999px;margin:16px 0}.i{font-size:13.5px;color:#5e7462;line-height:1.7}
@media(min-width:760px){.g{grid-template-columns:1fr 1fr}}</style>
</head><body><div class="w">
<a class="h" href="/"><img src="/favicon-192.png" alt="Sounsouni">Sounsouni</a>
<div class="g"><div class="ph"><img src="${esc(img)}" alt="${esc(name)}">${imgs.length > 1 ? '<div class="t">' + imgs.slice(1, 5).map((u) => `<img src="${esc(u)}" alt="${esc(name)}" loading="lazy">`).join("") + "</div>" : ""}</div>
<div>${cat ? `<div class="c">${esc(cat)}</div>` : ""}<h1>${esc(name)}</h1>${price ? `<div class="pr">${price}</div>` : ""}
<a class="b" href="/?product=${id}">Commander sur Sounsouni</a>
${desc ? `<div class="d">${esc(String(p.description || "").trim().slice(0, 3000))}</div>` : ""}
<p class="i">${shop ? "Vendu par <b>" + esc(shop) + "</b> · " : ""}Livraison à domicile à Bamako ou au Point de Retrait, partout au Mali. Paiement Orange Money, Moov Money ou à la livraison.</p></div></div>
<p class="i" style="margin-top:28px"><a href="/">Sounsouni</a> · <a href="/logistique.html">Logistique</a> · <a href="/services.html">Services</a> · <a href="/a-propos.html">À propos</a></p>
</div></body></html>
`;
  if (indexable) smap.push(`  <url><loc>${SITE}/p/${id}.html</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
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
{ // Plan du site des articles, pour Google
  const out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + smap.join("\n") + "\n</urlset>\n";
  if (!fs.existsSync("sitemap-produits.xml") || fs.readFileSync("sitemap-produits.xml", "utf8") !== out) fs.writeFileSync("sitemap-produits.xml", out);
  console.log(`plan du site des articles : ${smap.length}`);
}

// ---- Nouveautés du carrousel de l'accueil (site/nouveautes.json) ----
// Les articles publiés APRÈS la sélection faite à la main le 24/11/2026 (avec photo et prix),
// au plus 12, 4 par catégorie, ajoutés automatiquement devant la sélection de l'accueil.
{
  const when = ({ id, p }) => Number(p.createdAt) || Date.parse(p.createdAt) || parseInt(String(id).replace(/^id-(sso-)?/, "").slice(0, 8), 36) || 0;
  const BAD = /rolex|celine|birken|gucci|louis ?vuitton|dior|chanel|nike|adidas/i;
  const fresh = rows.map((r) => ({ id: r.id, p: r.data || {} }))
    .filter(({ id, p }) => safeId(id) && !p.banned && !p.deleted && p.status !== "deleted" && Number(p.price) > 0 && !BAD.test(p.name || "")
      && Array.isArray(p.images) && typeof p.images[0] === "string" && /^https:\/\//.test(p.images[0]))
    .filter((x) => when(x) > Date.parse("2026-11-24T18:00:00Z"))
    .sort((a, b) => when(b) - when(a));
  const perCat = {}, list = [];
  for (const { id, p } of fresh) {
    const c = p.category || "Autre"; if ((perCat[c] = (perCat[c] || 0) + 1) > 4) continue;
    list.push({ id, cat: c, name: String(p.name).replace(/\s*\((SM|KAM|RMTS)\)\s*$/i, "").slice(0, 60), price: fmt(p.price) + " FCFA", img: p.images[0], mode: /^Mode /.test(c) });
    if (list.length >= 12) break;
  }
  fs.mkdirSync("site", { recursive: true });
  const out = JSON.stringify({ maj: new Date().toISOString().slice(0, 10), articles: list }, null, 0);
  if (!fs.existsSync("site/nouveautes.json") || fs.readFileSync("site/nouveautes.json", "utf8") !== out) fs.writeFileSync("site/nouveautes.json", out);
}
