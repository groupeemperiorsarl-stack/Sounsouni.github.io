// Vitrines des boutiques : une belle page par vendeur, à l'adresse
// sounsouni.pro/<nom-de-la-boutique> (fichier <nom>.html à la racine du site).
// Le vendeur choisit dans l'application (Espace vendeur › Ma vitrine) son adresse,
// un des 5 modèles et sa couleur ; ces choix arrivent ici par son profil public
// (champ « vitrine »). Une boutique n'a sa vitrine qu'à partir de MIN_ARTICLES
// articles en ligne. La commande passe toujours par Sounsouni (aucun téléphone).
import fs from "node:fs";
const html0 = fs.readFileSync(fs.existsSync("js/app.js") ? "js/app.js" : "index.html", "utf8");
const url = (html0.match(/url:\s*"(https:\/\/[a-z0-9]+\.supabase\.co)"/) || [])[1];
const key = (html0.match(/anonKey:\s*"([^"]+)"/) || [])[1];
if (!url || !key) throw new Error("configuration Supabase introuvable");
const SITE = "https://sounsouni.pro";
const MIN_ARTICLES = 3;
async function all(col) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/app_data?select=id,data&collection=eq.${col}&order=id`, { headers: { apikey: key, Authorization: "Bearer " + key, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(col + " : " + r.status);
    const p = await r.json(); rows.push(...p); if (p.length < 1000) break;
  }
  return rows;
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const safeId = (id) => /^[A-Za-z0-9_\-]{1,80}$/.test(id);
const https = (u) => typeof u === "string" && /^https:\/\//.test(u) ? u : "";
export const slugify = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/^boutique\s+de\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
const THEMES = { classique: "#1b5e20", elegance: "#d9b46a", wax: "#d2541f", minimal: "#111111", nuit: "#c8ff8a" };

const [profiles, products] = await Promise.all([all("publicProfiles"), all("products")]);
const bySeller = new Map();
for (const { id, data: p } of products) {
  if (!p || !safeId(id) || p.banned || p.deleted || p.hidden || p.status === "deleted") continue;
  if (p.moderationStatus === "pending" || p.moderationStatus === "rejected") continue;
  const img = (Array.isArray(p.images) ? p.images : []).map(https).find(Boolean);
  if (!img || !(Number(p.price) > 0) || !safeId(String(p.sellerId || ""))) continue;
  if (!bySeller.has(p.sellerId)) bySeller.set(p.sellerId, []);
  bySeller.get(p.sellerId).push({ id, name: String(p.name || "Article").replace(/\s*\((SM|KAM|RMTS)\)\s*$/i, "").slice(0, 80), price: fmt(p.price) + " FCFA", cat: String(p.category || "Autre"), img, at: Number(p.createdAt) || 0 });
}

// Noms réservés : tout ce qui existe déjà à la racine du site et n'est pas une vitrine.
const old = fs.existsSync("site/vitrines.json") ? JSON.parse(fs.readFileSync("site/vitrines.json", "utf8")) : { boutiques: {} };
const oldSlugs = new Set(Object.keys(old.boutiques || {}));
const reserved = new Set(["p", "c", "site", "img", "js", "css", "admin", "app", "boutique", "boutiques", "marche", "sounsouni", "api", "www", "aide", "contact"]);
for (const f of fs.readdirSync(".")) { const b = f.replace(/\.html$/, ""); if (!oldSlugs.has(b)) reserved.add(b.toLowerCase()); }

const shops = profiles.map((r) => r.data).filter((a) => a && safeId(a.id) && a.shopName && !a.banned && (a.vitrine || {}).on !== false && (bySeller.get(a.id) || []).length >= MIN_ARTICLES)
  .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
const taken = new Set(), out = {};
for (const a of shops) {
  const v = a.vitrine || {};
  let base = slugify(v.slug) || slugify(a.shopName) || "boutique";
  if (base.length < 3) base = (base + "-shop").slice(0, 40);
  let slug = base, n = 2;
  while (reserved.has(slug) || taken.has(slug)) slug = base.slice(0, 36) + "-" + n++;
  taken.add(slug);
  out[slug] = a;
}

function page(slug, a) {
  const v = a.vitrine || {};
  const theme = THEMES[v.theme] ? v.theme : "classique";
  const color = /^#[0-9a-fA-F]{6}$/.test(v.color || "") ? v.color : THEMES[theme];
  const name = String(a.shopName).replace(/^Boutique de\s+/i, "").trim();
  const items = (bySeller.get(a.id) || []).sort((x, y) => y.at - x.at).slice(0, 60);
  const cats = [...new Set(items.map((x) => x.cat))].slice(0, 8);
  const place = [a.shopQuartier, a.shopCity || (a.country === "Mali" || !a.country ? "Bamako" : a.country)].filter(Boolean).join(", ");
  const bio = String(a.shopDescription || "").trim() || `${cats.slice(0, 4).join(", ")}. Commandez en toute confiance et faites-vous livrer partout à Bamako.`;
  const logo = https(a.shopProfilePhoto), cover = https(a.shopCoverPhoto);
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "S";
  const title = `${name} — Boutique en ligne${a.shopQuartier ? " à " + a.shopQuartier : ""}, Bamako | Sounsouni`;
  const desc = (`${name} : ${bio}`).replace(/\s+/g, " ").slice(0, 170);
  const ogimg = cover || logo || items[0].img;
  const ld = { "@context": "https://schema.org", "@type": "Store", name, url: `${SITE}/${slug}`, image: ogimg, description: bio.slice(0, 500),
    address: { "@type": "PostalAddress", addressLocality: a.shopCity || "Bamako", addressCountry: "ML", ...(a.shopQuartier ? { streetAddress: a.shopQuartier } : {}) },
    paymentAccepted: "Orange Money, Moov Money, espèces à la livraison", currenciesAccepted: "XOF",
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Articles de " + name, itemListElement: items.slice(0, 30).map((x) => ({ "@type": "Offer", url: `${SITE}/p/${x.id}.html`, priceCurrency: "XOF", price: Number(x.price.replace(/\D/g, "")), itemOffered: { "@type": "Product", name: x.name, image: x.img } })) } };
  const logoHtml = logo ? `<img class="lg" src="${esc(logo)}" alt="${esc(name)}">` : `<div class="lg">${esc(initials)}</div>`;
  const link = (x) => `/p/${x.id}.html?from=${slug}`;
  const card = (x) => `<a class="it" data-c="${esc(x.cat)}" data-n="${esc(x.name.toLowerCase())}" href="${link(x)}"><img src="${esc(x.img)}" alt="${esc(x.name)}" loading="lazy"><span class="nm">${esc(x.name)}</span><b class="pr">${esc(x.price)}</b><span class="add" aria-hidden="true">+</span></a>`;
  const feat = items[0];
  const since = Number(a.createdAt) ? new Date(Number(a.createdAt)).getFullYear() : null;
  const rayons = cats.map((c) => { const l = items.filter((x) => x.cat === c); return `<button class="ry" data-go="${esc(c)}"><img src="${esc(l[0].img)}" alt="" loading="lazy"><span><b>${esc(c)}</b><small>${l.length} article${l.length > 1 ? "s" : ""}</small></span></button>`; }).join("");
  const news = items.slice(0, 8).map((x) => `<a class="nw" href="${link(x)}"><img src="${esc(x.img)}" alt="${esc(x.name)}" loading="lazy"><span class="nm">${esc(x.name)}</span><b class="pr">${esc(x.price)}</b></a>`).join("");
  const cta = theme === "wax" ? "Je commande" : theme === "elegance" ? "Découvrir la collection" : "Voir les articles";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}/${slug}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Sounsouni"><meta property="og:title" content="${esc(name)} — sur Sounsouni"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${slug}"><meta property="og:image" content="${esc(ogimg)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="${esc(logo || "/favicon-192.png")}"><meta name="theme-color" content="${color}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Playfair+Display:ital,wght@0,600;1,500&family=Baloo+2:wght@600;800&family=Space+Grotesk:wght@500;700&family=Sora:wght@600;800&display=swap">
<link rel="stylesheet" href="/css/vitrine.css?v=2">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head><body class="vt t-${theme}" style="--a:${color}">
<header class="nav"><a class="nb" href="#top">${logo ? `<img src="${esc(logo)}" alt="">` : `<i>${esc(initials)}</i>`}<span>${esc(name)}</span></a><nav><a href="#articles">Articles</a><a href="#apropos">À propos</a><a href="#commander">Commander</a></nav></header>
<div class="pg" id="top">
<div class="cv"${cover ? ` style="background-image:url('${esc(cover)}')"` : ""}><span class="tag">Nouveautés chaque semaine</span></div>
<section class="id">${logoHtml}<div class="kk">Boutique · ${esc(place || "Mali")}</div>
<h1>${esc(name)}</h1>${theme === "elegance" ? `<p class="sl">${esc(cats[0] || "Sélection")}, livrée chez vous.</p>` : ""}
<div class="vf">${a.verified ? "✓ Vendeur vérifié Sounsouni · " : ""}📍 ${esc(place || "Bamako, Mali")}</div>
<p class="bio">${esc(bio.length > 220 ? bio.slice(0, 217) + "…" : bio)}</p>
<div class="st"><div><b>${items.length}</b><span>articles</span></div><div><b>24 h</b><span>livraison</span></div><div><b>${cats.length}</b><span>rayons</span></div></div>
<div class="bt"><a class="b1" href="#articles">${cta}</a><a class="b2" href="#" id="share">Partager</a></div></section>
<section class="ok"><div><i>🚚</i><b>Livraison rapide</b><span>À domicile ou en Point de Retrait</span></div><div><i>💳</i><b>Paiement facile</b><span>Orange Money, Moov ou à la livraison</span></div><div><i>🛡️</i><b>Commande protégée</b><span>Suivie par Sounsouni</span></div><div><i>💬</i><b>Service client</b><span>Une équipe à Bamako</span></div></section>
<a class="ft" href="${link(feat)}"><img src="${esc(feat.img)}" alt="${esc(feat.name)}"><span><i>Pièce du moment</i>${esc(feat.name)}<em>${esc(feat.price)} · Commander →</em></span></a>
${cats.length > 1 ? `<section class="sc"><h2>Nos rayons</h2><div class="rys">${rayons}</div></section>` : ""}
${items.length > 4 ? `<section class="sc"><h2>Nouveautés</h2><div class="nws">${news}</div></section>` : ""}
<section class="sc" id="articles"><h2>Tous nos articles <small>${items.length}</small></h2>
<input class="se" id="se" type="search" placeholder="Rechercher un article…" autocomplete="off">
<nav class="ch"><button class="on" data-c="">Tout</button>${cats.map((c) => `<button data-c="${esc(c)}">${esc(c)}</button>`).join("")}</nav>
<main class="gr">${items.map(card).join("")}</main><p class="none" id="none" hidden>Aucun article ne correspond.</p></section>
<section class="sc ab" id="apropos"><h2>À propos de ${esc(name)}</h2><div class="abx">${logoHtml}<div><p>${esc(bio)}</p>
<ul><li>📍 ${esc(place || "Bamako, Mali")}</li>${since ? `<li>🗓️ Sur Sounsouni depuis ${since}</li>` : ""}<li>🛍️ ${items.length} articles en ligne, ${cats.length} rayon${cats.length > 1 ? "s" : ""}</li>${a.verified ? "<li>✓ Vendeur vérifié par Sounsouni</li>" : ""}</ul></div></div></section>
<section class="sc hw" id="commander"><h2>Comment commander ?</h2><ol><li><b>Choisissez</b><span>Touchez un article pour voir les photos, les tailles et le prix.</span></li><li><b>Commandez</b><span>Indiquez votre adresse ou un Point de Retrait Sounsouni.</span></li><li><b>Recevez</b><span>Payez par Orange Money, Moov Money ou à la livraison.</span></li></ol><a class="b1 big" href="#articles">${cta}</a></section>
<footer class="pw"><div><b>${esc(name)}</b><span>Boutique en ligne · ${esc(place || "Bamako, Mali")}</span></div><a class="mk" href="/">Découvrir tout le marché Sounsouni →</a><small>Boutique propulsée par <a href="/">Sounsouni</a> · Bamako, Mali</small></footer></div>
<script>(function(){var cat="",q="";function f(){var n=0;document.querySelectorAll(".it").forEach(function(i){var ok=(!cat||i.getAttribute("data-c")===cat)&&(!q||i.getAttribute("data-n").indexOf(q)>-1);i.style.display=ok?"":"none";if(ok)n++});document.getElementById("none").hidden=n>0}
function setCat(c){cat=c;document.querySelectorAll(".ch button").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-c")===c)});f()}
document.querySelectorAll(".ch button").forEach(function(b){b.onclick=function(){setCat(b.getAttribute("data-c"))}});
document.querySelectorAll(".ry").forEach(function(b){b.onclick=function(){setCat(b.getAttribute("data-go"));document.getElementById("articles").scrollIntoView({behavior:"smooth"})}});
document.getElementById("se").oninput=function(e){q=e.target.value.trim().toLowerCase();f()};
document.getElementById("share").onclick=function(e){e.preventDefault();var u=location.href.split("#")[0];if(navigator.share)navigator.share({title:document.title,url:u}).catch(function(){});else{try{navigator.clipboard.writeText(u);alert("Lien copié")}catch(x){prompt("",u)}}};})();</script>
</body></html>
`;
}

let written = 0, removed = 0;
const manifest = { maj: new Date().toISOString().slice(0, 10), boutiques: {} };
for (const [slug, a] of Object.entries(out)) {
  const f = slug + ".html", body = page(slug, a);
  manifest.boutiques[slug] = a.id;
  if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== body) { fs.writeFileSync(f, body); written++; }
}
for (const s of oldSlugs) if (!manifest.boutiques[s] && fs.existsSync(s + ".html")) { fs.unlinkSync(s + ".html"); removed++; }
fs.mkdirSync("site", { recursive: true });
const mj = JSON.stringify(manifest);
const prev = fs.existsSync("site/vitrines.json") ? fs.readFileSync("site/vitrines.json", "utf8") : "";
if (prev.replace(/"maj":"[^"]*"/, "") !== mj.replace(/"maj":"[^"]*"/, "")) fs.writeFileSync("site/vitrines.json", mj);
const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + Object.keys(manifest.boutiques).map((s) => `  <url><loc>${SITE}/${s}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`).join("\n") + "\n</urlset>\n";
if (!fs.existsSync("sitemap-boutiques.xml") || fs.readFileSync("sitemap-boutiques.xml", "utf8") !== sm) fs.writeFileSync("sitemap-boutiques.xml", sm);
console.log(`vitrines : ${Object.keys(out).length}, écrites : ${written}, supprimées : ${removed}`);
