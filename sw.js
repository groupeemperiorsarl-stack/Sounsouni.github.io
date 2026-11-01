// Service worker minimal pour Sounsouni.
//
// Rôle volontairement limité : garder juste assez en mémoire pour que
// l'app s'ouvre encore si la connexion coupe un instant, et pour que les
// outils de publication (Bubblewrap/Lighthouse) reconnaissent une vraie
// PWA. Il ne met JAMAIS en cache les données de Supabase (commandes,
// produits, comptes...) — ces informations doivent toujours venir du
// réseau en direct, jamais d'une copie locale périmée.

// Le nom change à chaque correctif important (v1 -> v2) : ça force les
// téléphones qui avaient déjà l'ancienne version à tout nettoyer et
// repartir sur une base saine, une bonne fois pour toutes.
const CACHE_NAME = "sounsouni-shell-v3";
// Fichiers de l'application (code, style, textes, images) : gardés sur le
// téléphone. Leur adresse contient le numéro de version (?v=...) ou une
// empreinte (img/e/...), donc une nouvelle version = une nouvelle adresse.
const ASSET_CACHE = "sounsouni-assets-v1";
// Photos des articles (stockage public « photo » de Supabase) : ce sont des
// fichiers, pas des données. Chaque adresse est unique et ne change jamais,
// on peut donc les garder sur le téléphone : une photo déjà vue n'est plus
// jamais retéléchargée (gros gain sur le trafic du forfait Supabase).
// Au plus PHOTO_MAX photos gardées ; les plus anciennes sont effacées.
const PHOTO_CACHE = "sounsouni-photos-v1";
const PHOTO_MAX = 600;
const PHOTO_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photo\//;
const SHELL_FILES = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192-any.png",
  "./icons/icon-512-any.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

// Écran de démarrage (pomme cannelle) : images, son et polices gardés sur le
// téléphone dès l'installation — l'animation démarre tout de suite, même
// avec une connexion faible ou coupée.
const SPLASH_FILES = [
  "./img/e/16fcc21b503f.webp", "./img/e/46edff4ff165.webp", "./img/e/83d96455068c.mp3",
  "./img/e/44b62c8b9ce2.woff2", "./img/e/486c7fa9e908.woff2",
  "./img/e/dabe307e121f.mp4", "./img/e/9e38dc9ad8bd.webp", "./img/e/e58989f1d2f9.webp"
];
// Bibliothèques venant d'autres sites (Supabase, icônes...) : gardées aussi,
// sinon le démarrage attend leur téléchargement à chaque ouverture.
const CDN_RE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/(@supabase\/supabase-js|idiomorph)|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome)\//;

// Met dans le téléphone tous les fichiers dont une version de la page a
// besoin (code, style, images, bibliothèques) — appelé à l'installation et
// à chaque nouvelle version de la page reçue en arrière-plan.
function precacheFromHtml(html) {
  var urls = SPLASH_FILES.map(function (f) { return new URL(f, self.location.href).href; });
  var re = /(?:src|href)="([^"]+)"/g, m;
  while ((m = re.exec(html))) {
    var u;
    try { u = new URL(m[1], self.location.href); } catch (e) { continue; }
    if ((u.origin === self.location.origin && /^\/(js|css|img\/e)\//.test(u.pathname)) || CDN_RE.test(u.href)) urls.push(u.href);
  }
  return caches.open(ASSET_CACHE).then(function (cache) {
    return Promise.all(urls.map(function (u) {
      return cache.match(u).then(function (hit) {
        if (hit) return;
        return fetch(u).then(function (res) {
          if (!res || !res.ok || res.status !== 200) return;
          return cache.put(u, res).then(function () {
            // Les anciennes versions du même fichier ne servent plus : on les efface.
            var nu = new URL(u);
            if (nu.origin !== self.location.origin) return;
            return cache.keys().then(function (keys) {
              keys.forEach(function (k) { var ku = new URL(k.url); if (ku.pathname === nu.pathname && ku.search !== nu.search) cache.delete(k); });
            });
          });
        }).catch(function () {});
      });
    }));
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // { cache: "reload" } force chaque fichier à être vraiment
      // retéléchargé depuis le serveur au moment de la mise en cache,
      // au lieu d'accepter une copie déjà gardée par le navigateur lui
      // -même — sans ça, on pouvait mettre en cache une version déjà
      // périmée sans jamais s'en rendre compte.
      var requests = SHELL_FILES.map(function (f) { return new Request(f, { cache: "reload" }); });
      return Promise.all(requests.map(function (req) {
        return fetch(req).then(function (res) { return cache.put(req, res); });
      }));
    }).then(function () {
      return caches.match("./index.html").then(function (r) { return r ? r.text().then(precacheFromHtml) : null; });
    }).catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME && name !== ASSET_CACHE && name !== PHOTO_CACHE; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var url = event.request.url;

  // Jamais intercepter les appels vers Supabase, ni aucune requête vers un
  // autre domaine (Chart.js, Leaflet, FontAwesome...) — uniquement le
  // réseau en direct, comme si ce service worker n'existait pas pour eux.
  if (event.request.method === "GET" && PHOTO_RE.test(url) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) && !event.request.headers.get("range")) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(function (cache) {
        return cache.match(url).then(function (hit) {
          if (hit) return hit;
          return fetch(url, { mode: "cors", credentials: "omit" }).then(function (res) {
            if (res && res.ok && res.status === 200) {
              cache.put(url, res.clone()).then(function () {
                cache.keys().then(function (keys) {
                  for (var i = 0; i < keys.length - PHOTO_MAX; i++) cache.delete(keys[i]);
                });
              });
            }
            return res;
          }).catch(function () { return fetch(event.request); });
        });
      })
    );
    return;
  }
  if (event.request.method === "GET" && CDN_RE.test(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(function (cache) {
        return cache.match(url).then(function (hit) {
          var net = fetch(url).then(function (res) { if (res && res.ok && res.status === 200) cache.put(url, res.clone()); return res; });
          if (hit) { event.waitUntil(net.catch(function () {})); return hit; }
          return net;
        });
      })
    );
    return;
  }
  if (url.indexOf(self.location.origin) !== 0) return;
  if (event.request.method !== "GET") return;

  // Seule la page principale (navigation) profite d'un vrai secours
  // hors-ligne. Réseau en priorité, ET surtout sans jamais accepter une
  // copie déjà gardée par le navigateur (cache: "no-store") — c'est ce
  // détail précis qui manquait, et qui pouvait faire réafficher une
  // ancienne version de l'app même après un nouveau déploiement.
  // Page principale : on démarre TOUT DE SUITE sur la copie gardée dans le
  // téléphone (l'animation s'affiche sans attendre le réseau), et on va
  // chercher la nouvelle version en arrière-plan : elle servira à
  // l'ouverture suivante. Sans copie (toute première ouverture) : réseau.
  // Les autres pages (doc.html, confidentialité...) : réseau d'abord.
  if (event.request.mode === "navigate") {
    var navPath = new URL(url).pathname;
    if (navPath === "/" || navPath === "/index.html") {
      event.respondWith(
        caches.open(CACHE_NAME).then(function (cache) {
          return cache.match("./index.html").then(function (hit) {
            var net = fetch(event.request, { cache: "no-store" }).then(function (res) {
              if (res && res.ok && res.status === 200 && !res.redirected) {
                cache.put("./index.html", res.clone());
                res.clone().text().then(precacheFromHtml).catch(function () {});
              }
              return res;
            });
            if (hit) { event.waitUntil(net.catch(function () {})); return hit; }
            return net.catch(function () { return caches.match("./index.html"); });
          });
        })
      );
      return;
    }
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(function () {
        return caches.match("./index.html");
      })
    );
    return;
  }

  // Code, style, textes et images de l'app : cache d'abord (ouverture quasi
  // instantanée), réseau la première fois. Quand une nouvelle version d'un
  // fichier arrive, les anciennes versions de ce même fichier sont effacées.
  var u = new URL(url);
  // Vidéo gardée dans le téléphone : les lecteurs (surtout iPhone) la
  // demandent par morceaux (« Range ») — on découpe la copie gardée.
  var rng = event.request.headers.get("range");
  if (rng && /^\/img\/e\/[^/]+\.mp4$/.test(u.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(function (cache) {
        return cache.match(u.href).then(function (hit) {
          if (!hit) return fetch(event.request);
          return hit.arrayBuffer().then(function (buf) {
            var m = /bytes=(\d*)-(\d*)/.exec(rng) || [], size = buf.byteLength;
            var start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
            if (start >= size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
            return new Response(buf.slice(start, end + 1), { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes " + start + "-" + end + "/" + size, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
          });
        });
      })
    );
    return;
  }
  if (/^\/(js|css|img\/e)\//.test(u.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (hit) {
          if (hit) return hit;
          return fetch(event.request).then(function (res) {
            if (res && res.ok) {
              cache.put(event.request, res.clone());
              cache.keys().then(function (keys) {
                keys.forEach(function (k) { var ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) cache.delete(k); });
              });
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // Pour les icônes/manifeste de la coquille : cache d'abord (rapide),
  // réseau en secours.
  if (SHELL_FILES.some(function (f) { return url.indexOf(f.replace("./", "")) !== -1; })) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request);
      })
    );
  }
});
