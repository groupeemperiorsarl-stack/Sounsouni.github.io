// Site vitrine Sounsouni : portail d'accueil, cartes lumineuses, apparitions au défilement.
// Pas de « regard en arrière » dans les expressions régulières (anciens iPhone).
(function () {
  "use strict";
  // ---------- Données : quartiers de Bamako [nom, latitude, longitude, type] ----------
  // type 2 = Point de Retrait Sounsouni, 1 = livraison express, 0 = quartier desservi
  var Q = [["Banconi",12.672,-7.982,1],["Boulkassoumbougou",12.676,-7.958,2],["Djélibougou",12.662,-7.968,2],["Doumanzana",12.684,-7.94,0],["Fadjiguila",12.69,-7.955,0],["Sotuba",12.66,-7.925,1],["Korofina Nord",12.666,-7.975,0],["Korofina Sud",12.657,-7.98,1],["Sikoroni",12.684,-7.972,0],["Sangarébougou",12.688,-7.925,0],["Hippodrome",12.651,-7.992,1],["Médina Coura",12.646,-7.996,1],["Bozola",12.644,-8.002,0],["Niarela",12.64,-7.984,1],["Bagadadji",12.639,-7.993,0],["Quinzambougou",12.648,-7.984,0],["TSF",12.656,-7.99,0],["Bougouba",12.652,-7.978,0],["Missira",12.651,-8.006,1],["Zone industrielle",12.631,-7.972,0],["Sotelco",12.654,-7.983,1],["Centre commercial",12.637,-8.001,1],["Dravéla",12.646,-8.012,0],["Bamako-Coura",12.641,-8.006,0],["Darsalam",12.64,-8.016,0],["Ouolofobougou",12.645,-8.022,1],["Badialan",12.649,-8.013,0],["N'Tomikorobougou",12.652,-8.022,0],["Point G",12.668,-8.01,1],["Koulouba",12.662,-8.0,0],["Samé",12.651,-8.052,0],["Sogonafing",12.646,-8.042,0],["Hamdallaye",12.636,-8.031,1],["ACI 2000",12.627,-8.024,1],["Lafiabougou",12.64,-8.05,1],["Djicoroni Para",12.626,-8.046,1],["Sébénikoro",12.622,-8.083,1],["Taliko",12.632,-8.062,0],["Lassa",12.652,-8.072,0],["Sibiribougou",12.63,-8.072,0],["Kalabanbougou",12.618,-8.066,0],["Badalabougou",12.625,-7.991,1],["Quartier Mali",12.616,-7.997,0],["Torokorobougou",12.616,-7.981,1],["Daoudabougou",12.603,-7.981,1],["Sabalibougou",12.592,-7.985,0],["Kalaban Coura",12.587,-8.002,1],["Baco Djicoroni",12.597,-8.022,1],["Garantiguibougou",12.592,-7.968,0],["Baco Djicoroni ACI",12.605,-8.035,0],["Magnambougou",12.611,-7.951,1],["Faladié",12.602,-7.961,1],["Sogoniko",12.606,-7.966,0],["Banankabougou",12.599,-7.941,0],["Niamakoro",12.586,-7.954,1],["Sokorodji",12.579,-7.931,0],["Missabougou",12.606,-7.921,0],["Yirimadio",12.582,-7.902,1],["Sénou",12.555,-7.94,1],["Dianéguéla",12.586,-7.92,0],["Kalaban Coro",12.562,-8.002,1],["Kouralé",12.57,-7.965,0],["Sirakoro",12.565,-7.91,0],["Gouana",12.575,-8.03,0],["Kati Koko",12.7,-8.01,0]];
  var RIVER = [[12.6,-8.11],[12.613,-8.075],[12.622,-8.04],[12.628,-8.015],[12.632,-7.99],[12.636,-7.965],[12.642,-7.94],[12.652,-7.91],[12.66,-7.88]];
  var HUB = [12.654, -7.983]; // Sotelco, siège Sounsouni
  window.SNS_QUARTIERS = Q;
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function defs(svg, id, blur) {
    var d = el("defs", {}, svg), f = el("filter", { id: id, x: "-50%", y: "-50%", width: "200%", height: "200%" }, d);
    el("feGaussianBlur", { stdDeviation: blur, result: "b" }, f);
    var m = el("feMerge", {}, f); el("feMergeNode", { "in": "b" }, m); el("feMergeNode", { "in": "SourceGraphic" }, m);
    return d;
  }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Une petite lumière qui voyage le long d'un tracé.
  function traveller(svg, pathD, dur, delay, r, color) {
    if (reduce) return;
    var c = el("circle", { r: r, fill: color || "#fff", filter: "url(#snsg)", opacity: "0" }, svg);
    var a = el("animateMotion", { dur: dur + "s", begin: delay + "s", repeatCount: "indefinite", path: pathD }, c);
    el("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;.1;.85;1", dur: dur + "s", begin: delay + "s", repeatCount: "indefinite" }, c);
    return a;
  }
  // ---------- Carte de Bamako ----------
  function drawBamako(box) {
    var compact = box.clientWidth < 560;
    var W = 1000, H = compact ? 1080 : 820;
    var LAT0 = 12.545, LAT1 = 12.705, LON0 = -8.105, LON1 = -7.885;
    function X(lon) { return (lon - LON0) / (LON1 - LON0) * W; }
    function Y(lat) { return (LAT1 - lat) / (LAT1 - LAT0) * H; }
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Carte lumineuse des quartiers de Bamako desservis par Sounsouni" });
    var d = defs(svg, "snsg", 4);
    var lg = el("linearGradient", { id: "snsriv", x1: "0", x2: "1" }, d);
    el("stop", { offset: "0", "stop-color": "#1d5a78" }, lg); el("stop", { offset: "1", "stop-color": "#2d7fa3" }, lg);
    var rg = el("radialGradient", { id: "snsvig", cx: ".5", cy: ".5", r: ".72" }, d);
    el("stop", { offset: ".62", "stop-color": "#0f2e14", "stop-opacity": "0" }, rg); el("stop", { offset: "1", "stop-color": "#04140a", "stop-opacity": ".92" }, rg);
    // rues
    var g = el("g", { stroke: "#fff", opacity: ".05" }, svg), s = 7;
    for (var i = 0; i < W; i += 30) { s = (s * 37 + 11) % 61; el("line", { x1: i, y1: 0, x2: i + s - 30, y2: H }, g); }
    for (var j = 0; j < H; j += 30) { s = (s * 41 + 7) % 61; el("line", { x1: 0, y1: j, x2: W, y2: j + s - 30 }, g); }
    // fleuve et ponts
    el("polyline", { points: RIVER.map(function (p) { return X(p[1]).toFixed(1) + "," + Y(p[0]).toFixed(1); }).join(" "), stroke: "url(#snsriv)", "stroke-width": W * 0.045, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    var tx = el("text", { x: X(-8.098), y: Y(12.598) + W * 0.055, "font-size": W * 0.022, fill: "#8cc6e2", "letter-spacing": "6" }, svg); tx.textContent = "FLEUVE NIGER";
    [-8.018, -7.998, -7.962].forEach(function (lo) { el("line", { x1: X(lo), y1: Y(12.646), x2: X(lo + 0.004), y2: Y(12.615), stroke: "#d8e2dc", "stroke-width": W * 0.007, opacity: ".5" }, svg); });
    // tournée lumineuse entre les points illuminés
    var lit = Q.filter(function (q) { return q[3] > 0; }).sort(function (a, b) { return Math.atan2(a[1] - 12.63, a[2] + 7.995) - Math.atan2(b[1] - 12.63, b[2] + 7.995); });
    var tour = lit.map(function (q, ix) { return (ix ? "L" : "M") + X(q[2]).toFixed(1) + " " + Y(q[1]).toFixed(1); }).join(" ") + " Z";
    el("path", { d: tour, stroke: "#c8ff8a", "stroke-width": "2.4", fill: "none", "stroke-dasharray": "6 9", opacity: ".42", "class": "sns-dash" }, svg);
    for (var t = 0; t < 4; t++) traveller(svg, tour, 26, t * 6.5, 5, "#eaffd6");
    // envois depuis le siège vers les quartiers
    var hx = X(HUB[1]), hy = Y(HUB[0]);
    lit.forEach(function (q, ix) {
      if (ix % 2) return;
      var qx = X(q[2]), qy = Y(q[1]);
      var pd = "M" + hx.toFixed(1) + " " + hy.toFixed(1) + " Q" + ((hx + qx) / 2).toFixed(1) + " " + (Math.min(hy, qy) - H * 0.08).toFixed(1) + " " + qx.toFixed(1) + " " + qy.toFixed(1);
      el("path", { d: pd, stroke: "#fff", "stroke-width": "1.6", fill: "none", opacity: ".22" }, svg);
      traveller(svg, pd, 3.2 + (ix % 5) * 0.4, (ix * 0.37) % 4, 3.6, "#ffffff");
    });
    // points et noms
    var fs = compact ? 30 : 17.5, labels = el("g", { "font-family": "Inter Tight, sans-serif", "font-weight": "700" }, svg);
    Q.forEach(function (q, ix) {
      var x = X(q[2]), y = Y(q[1]), type = q[3];
      var grp = el("g", { "class": "sns-q", tabindex: "0" }, svg);
      var title = el("title", {}, grp); title.textContent = q[0] + (type === 2 ? " — Point de Retrait" : "");
      if (type > 0) {
        var halo = el("circle", { cx: x, cy: y, r: type === 2 ? 26 : 20, fill: type === 2 ? "#ffd54a" : "#c8ff8a", opacity: ".16" }, grp);
        if (!reduce) el("animate", { attributeName: "r", values: (type === 2 ? "22;34;22" : "16;26;16"), dur: (2.4 + (ix % 7) * 0.3) + "s", repeatCount: "indefinite" }, halo);
        el("circle", { cx: x, cy: y, r: type === 2 ? 10 : 8, fill: type === 2 ? "#ffd54a" : "#c8ff8a", filter: "url(#snsg)" }, grp);
      } else {
        el("circle", { cx: x, cy: y, r: compact ? 6 : 4.5, fill: "#fff", opacity: ".6" }, grp);
      }
      if (type > 0 || !compact) {
        var right = x > W * 0.8, lb = el("text", { x: x + (right ? -16 : 16), y: y - 10, "font-size": fs * (type ? 1 : 0.82), fill: type === 2 ? "#ffe590" : "#fff", opacity: type ? 1 : 0.62, "text-anchor": right ? "end" : "start" }, labels);
        lb.textContent = q[0];
      }
    });
    el("circle", { cx: hx, cy: hy, r: 15, fill: "#fff", filter: "url(#snsg)" }, svg);
    el("rect", { width: W, height: H, fill: "url(#snsvig)", "pointer-events": "none" }, svg);
    box.innerHTML = ""; box.appendChild(svg);
  }
  // ---------- Carte du monde ----------
  function drawWorld(box) {
    var compact = box.clientWidth < 560, W = 1000, H = 630;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Sounsouni relie la Chine, l'Inde, les Émirats, la Turquie et la France à Bamako" });
    defs(svg, "snsg", 3.4);
    var land = [[0.42,0.18,0.62,0.32],[0.40,0.32,0.58,0.80],[0.58,0.14,0.98,0.48],[0.64,0.48,0.80,0.62],[0.84,0.50,0.95,0.62],[0.05,0.15,0.30,0.48],[0.18,0.50,0.32,0.95],[0.85,0.70,0.97,0.86]];
    var st = 20, g = el("g", {}, svg);
    for (var y = st / 2; y < H; y += st) for (var x = st / 2; x < W; x += st) {
      var u = x / W, v = y / H, on = false;
      for (var i = 0; i < land.length; i++) { var r = land[i]; if (u > r[0] && u < r[2] && v > r[1] && v < r[3]) { on = true; break; } }
      on = on && ((Math.floor(x * 7 + y * 13)) % 11) > 1;
      el("circle", { cx: x, cy: y, r: on ? 4.2 : 1.8, fill: "#9fb8a3", opacity: on ? ".5" : ".12" }, g);
    }
    var bko = [W * 0.445, H * 0.53], P = [["Chine", 0.83, 0.36], ["Inde", 0.72, 0.47], ["Émirats", 0.63, 0.43, "Golfe"], ["", 0.585, 0.415], ["France", 0.455, 0.235, "France & Europe", "end"], ["", 0.47, 0.195], ["", 0.50, 0.20], ["", 0.51, 0.26], ["", 0.43, 0.28], ["Turquie", 0.565, 0.285], ["Maroc", 0.425, 0.335, "Maroc", "end"], ["", 0.55, 0.36]];
    var fs = compact ? 34 : 24;
    P.forEach(function (p, ix) {
      var px = W * p[1], py = H * p[2], mx = (px + bko[0]) / 2, my = Math.min(py, bko[1]) - H * 0.22;
      var pd = "M" + px + " " + py + " Q" + mx + " " + my + " " + bko[0] + " " + bko[1];
      el("path", { d: pd, stroke: "#c8ff8a", "stroke-width": "4", fill: "none", opacity: ".8", filter: "url(#snsg)", "stroke-dasharray": "12 14", "class": "sns-dash" }, svg);
      traveller(svg, pd, 3.4, ix * 0.7, 8, "#ffffff");
      el("circle", { cx: px, cy: py, r: p[0] ? 12 : 8, fill: "#c8ff8a", filter: "url(#snsg)" }, svg);
      var lab = p[3] || p[0]; if (lab) { var endA = p[4] === "end"; var tx = el("text", { x: px + (endA ? -18 : 18), y: py - 16, "text-anchor": endA ? "end" : "start", "font-size": fs, fill: "#fff", "font-family": "Inter Tight, sans-serif", "font-weight": "700" }, svg); tx.textContent = lab; }
    });
    var halo = el("circle", { cx: bko[0], cy: bko[1], r: 40, fill: "#c8ff8a", opacity: ".2" }, svg);
    if (!reduce) el("animate", { attributeName: "r", values: "30;54;30", dur: "2.6s", repeatCount: "indefinite" }, halo);
    el("circle", { cx: bko[0], cy: bko[1], r: 17, fill: "#fff", filter: "url(#snsg)" }, svg);
    var b = el("text", { x: bko[0] - 170, y: bko[1] + 70, "font-size": fs * 1.25, fill: "#fff", "font-family": "Inter Tight, sans-serif", "font-weight": "800", "letter-spacing": "3" }, svg); b.textContent = "BAMAKO";
    box.innerHTML = ""; box.appendChild(svg);
  }
  function drawMaps() {
    var b = document.querySelectorAll("[data-sns-map]");
    for (var i = 0; i < b.length; i++) (b[i].getAttribute("data-sns-map") === "monde" ? drawWorld : drawBamako)(b[i]);
    var n = document.querySelectorAll("[data-sns-count]");
    for (var k = 0; k < n.length; k++) {
      var w = n[k].getAttribute("data-sns-count");
      n[k].textContent = w === "quartiers" ? Q.length : (w === "lumiere" ? Q.filter(function (q) { return q[3] > 0; }).length : Q.filter(function (q) { return q[3] === 2; }).length);
    }
  }
  // ---------- Apparition au défilement ----------
  function reveal() {
    var items = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window) || reduce) { for (var i = 0; i < items.length; i++) items[i].classList.add("in"); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }
  // ---------- Vitrine : l'article touché vient au centre ----------
  function vitrine() {
    var thumbs = document.querySelectorAll("[data-vit]"), feat = document.getElementById("vit-feat");
    if (!feat) return;
    for (var i = 0; i < thumbs.length; i++) thumbs[i].addEventListener("click", function () {
      var t = this;
      feat.classList.remove("pop"); void feat.offsetWidth;
      feat.querySelector("img").src = t.querySelector("img").src;
      feat.querySelector("[data-f=nom]").textContent = t.getAttribute("data-nom");
      feat.querySelector("[data-f=cat]").textContent = t.getAttribute("data-cat");
      feat.querySelector("[data-f=prix]").textContent = t.getAttribute("data-prix");
      feat.querySelector("[data-f=lien]").setAttribute("href", t.getAttribute("data-href"));
      feat.classList.add("pop");
      for (var k = 0; k < thumbs.length; k++) thumbs[k].classList.toggle("on", thumbs[k] === t);
    });
  }
  // ---------- Portail d'accueil (au-dessus de l'application) ----------
  window.snsPortail = {
    fermer: function () {
      try { sessionStorage.setItem("sns_portail_ferme", "1"); } catch (e) {}
      document.documentElement.classList.remove("portail-on");
      var p = document.getElementById("portail"); if (p) p.setAttribute("hidden", "");
      window.scrollTo(0, 0);
    },
    ouvrir: function () {
      document.documentElement.classList.add("portail-on");
      var p = document.getElementById("portail"); if (p) { p.removeAttribute("hidden"); p.scrollTop = 0; }
      start();
    }
  };
  var started = false;
  function start() {
    if (started) return; started = true;
    drawMaps(); reveal(); vitrine();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(drawMaps, 300); });
    var m = document.querySelectorAll("[data-portail-fermer]");
    for (var i = 0; i < m.length; i++) m[i].addEventListener("click", function (e) { e.preventDefault(); window.snsPortail.fermer(); });
  }
  function boot() {
    var p = document.getElementById("portail");
    if (!p || !p.hasAttribute("hidden")) start();
    if (location.hash === "#accueil") window.snsPortail.ouvrir();
    window.addEventListener("hashchange", function () { if (location.hash === "#accueil") window.snsPortail.ouvrir(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
// ---------- Version cinéma : menu qui se fige, voyage du colis commandé par le défilement, compteurs ----------
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tick() {
    var navs = document.querySelectorAll(".navx");
    for (var i = 0; i < navs.length; i++) {
      var hero = navs[i].closest(".cine-hero") || navs[i].parentNode;
      navs[i].classList.toggle("solid", hero.getBoundingClientRect().top < -40);
    }
    var js = document.querySelectorAll(".journey");
    for (var j = 0; j < js.length; j++) {
      var J = js[j], r = J.getBoundingClientRect(), vh = window.innerHeight;
      var total = r.height - vh, p = Math.min(1, Math.max(0, -r.top / total));
      var slides = J.querySelectorAll(".slide"), txs = J.querySelectorAll(".tx"), bars = J.querySelectorAll(".bar b"), n = slides.length;
      var f = p * n, idx = Math.min(n - 1, Math.floor(f)), local = f - idx;
      for (var k = 0; k < n; k++) {
        slides[k].classList.toggle("on", k === idx);
        if (txs[k]) txs[k].classList.toggle("on", k === idx);
        if (bars[k]) bars[k].style.transform = "scaleX(" + (k < idx ? 1 : (k === idx ? local : 0)) + ")";
        if (k === idx && !reduce) { var im = slides[k].querySelector("img"); if (im) im.style.transform = "scale(" + (1.18 - 0.14 * local).toFixed(4) + ")"; }
      }
      var c = J.querySelector(".colis");
      if (c && !reduce) {
        var w = window.innerWidth, x = Math.sin(p * Math.PI * 2.2) * w * 0.08, y = Math.cos(p * Math.PI * 3) * vh * 0.05 + (p - 0.5) * vh * 0.1;
        c.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + (Math.sin(p * 9) * 8).toFixed(2) + "deg) scale(" + (0.85 + 0.3 * Math.sin(p * Math.PI)).toFixed(3) + ")";
      }
    }
    var cs = document.querySelectorAll(".counter[data-to]:not(.done)");
    for (var q = 0; q < cs.length; q++) {
      var e = cs[q], rr = e.getBoundingClientRect();
      if (rr.top < window.innerHeight * 0.9 && rr.bottom > 0) (function (el) {
        el.classList.add("done"); var to = +el.getAttribute("data-to"), t0 = performance.now(), suf = el.getAttribute("data-suf") || "";
        (function step(t) { var a = Math.min(1, (t - t0) / 1400), v = Math.round(to * (1 - Math.pow(1 - a, 3))); el.textContent = v + suf; if (a < 1) requestAnimationFrame(step); })(t0);
      })(e);
    }
  }
  var pending = false;
  function onScroll() { if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; tick(); }); } }
  function boot() {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    var p = document.getElementById("portail"); if (p) p.addEventListener("scroll", onScroll, { passive: true });
    tick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
// ---------- Carrousel du marché (flèches) et bouton Retour qui ramène à l'accueil ----------
(function () {
  "use strict";
  function boot() {
    var w = document.querySelectorAll(".mrow-wrap");
    for (var i = 0; i < w.length; i++) (function (box) {
      var rows = box.querySelector(".mrows");
      function go(d) { rows.scrollBy({ left: d * rows.clientWidth * 0.8, behavior: "smooth" }); }
      box.querySelector(".prev").addEventListener("click", function () { go(-1); });
      box.querySelector(".next").addEventListener("click", function () { go(1); });
    })(w[i]);
    // Quand le visiteur entre au marché depuis l'accueil, on ajoute une étape à l'historique :
    // le bouton Retour du téléphone le ramène alors sur l'accueil, là où il était.
    var p = document.getElementById("portail");
    if (!p || !window.snsPortail) return;
    var fermer = window.snsPortail.fermer, ouvrir = window.snsPortail.ouvrir, pos = 0;
    window.snsPortail.fermer = function () {
      pos = p.scrollTop;
      try { history.replaceState({ snsPortail: 1 }, "", location.pathname + location.search); history.pushState({ snsMarche: 1 }, "", location.pathname + location.search); } catch (e) {}
      fermer();
    };
    window.addEventListener("popstate", function (e) {
      if (e.state && e.state.snsPortail) { try { sessionStorage.removeItem("sns_portail_ferme"); } catch (x) {} ouvrir(); p.scrollTop = pos; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
// ---------- Nouveautés : les derniers articles du marché s'ajoutent en tête du carrousel ----------
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function card(a) {
    return '<a class="mc" href="p/' + esc(a.id) + '.html"><span class="mci"><img src="' + esc(a.img) + '" alt="' + esc(a.name) + '" loading="lazy"></span>' +
      '<span class="mcc">Nouveau · ' + esc(a.cat) + '</span><span class="mcn">' + esc(a.name) + '</span><span class="mcp">' + esc(a.price) + '</span></a>';
  }
  function boot() {
    var rows = document.querySelectorAll(".mrow");
    if (rows.length < 2 || !window.fetch) return;
    fetch("site/nouveautes.json?t=" + Math.floor(Date.now() / 600000)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.articles) return;
      var have = {}, links = document.querySelectorAll(".mrow .mc");
      for (var i = 0; i < links.length; i++) have[(links[i].getAttribute("href") || "").replace(/^p\/|\.html$/g, "")] = 1;
      var a1 = "", a2 = "";
      d.articles.forEach(function (a) { if (have[a.id] || !/^id-[A-Za-z0-9_-]+$/.test(a.id)) return; if (a.mode) a1 += card(a); else a2 += card(a); });
      if (a1) rows[0].insertAdjacentHTML("afterbegin", a1);
      if (a2) rows[1].insertAdjacentHTML("afterbegin", a2);
    }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
