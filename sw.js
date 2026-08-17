// Service worker minimal pour Sounsouni.
//
// Rôle volontairement limité : garder juste assez en mémoire pour que
// l'app s'ouvre encore si la connexion coupe un instant, et pour que les
// outils de publication (Bubblewrap/Lighthouse) reconnaissent une vraie
// PWA. Il ne met JAMAIS en cache les données de Supabase (commandes,
// produits, comptes...) — ces informations doivent toujours venir du
// réseau en direct, jamais d'une copie locale périmée.

const CACHE_NAME = "sounsouni-shell-v1";
const SHELL_FILES = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192-any.png",
  "./icons/icon-512-any.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
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
  if (url.indexOf(self.location.origin) !== 0) return;
  if (event.request.method !== "GET") return;

  // Seule la page principale (navigation) profite d'un vrai secours
  // hors-ligne. Réseau en priorité — la copie en cache n'est utilisée
  // que si la connexion échoue complètement.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match("./index.html");
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
