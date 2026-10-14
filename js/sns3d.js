// Sounsouni — 3D légère (Three.js) aux deux endroits clés : fourgonnette du
// bandeau "Livraison" et célébration "Paiement confirmé".
// Règles : Three.js n'est chargé que quand un de ces endroits est à l'écran ;
// l'animation ne tourne QUE pendant qu'il est visible (et l'onglet actif) ;
// sur un petit téléphone (peu de mémoire, économie de données, mouvements
// réduits, pas de WebGL) on garde simplement l'image fixe déjà affichée.
(function () {
  "use strict";
  var live = [];           // scènes en cours { host, renderer, ... }
  var io = null;

  function weakDevice() {
    try {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      var c = navigator.connection; if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))) return true;
      if (navigator.deviceMemory && navigator.deviceMemory < 2) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
      var cv = document.createElement("canvas");
      var gl = cv.getContext("webgl") || cv.getContext("experimental-webgl");
      if (!gl) return true;
      var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
    } catch (e) { return true; }
    return false;
  }
  var WEAK = null;

  // Fourgonnette moderne Sounsouni (carrosserie arrondie, peinture laquée)
  function vanDecal() {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 768; const x = c.getContext('2d');
    // vague verte
    const g1 = x.createLinearGradient(0, 0, 2048, 0); g1.addColorStop(0, '#558b2f'); g1.addColorStop(1, '#8bc34a');
    x.fillStyle = g1; x.beginPath(); x.moveTo(0, 470); x.bezierCurveTo(600, 330, 1300, 640, 2048, 420); x.lineTo(2048, 768); x.lineTo(0, 768); x.closePath(); x.fill();
    x.fillStyle = 'rgba(139,195,74,.55)'; x.beginPath(); x.moveTo(0, 420); x.bezierCurveTo(700, 290, 1250, 560, 2048, 370); x.lineTo(2048, 420); x.bezierCurveTo(1300, 640, 600, 330, 0, 470); x.closePath(); x.fill();
    // logo panier
    const lx = 330, ly = 230;
    x.strokeStyle = '#8a5a2e'; x.lineWidth = 22; x.lineCap = 'round'; x.beginPath(); x.arc(lx, ly + 10, 95, Math.PI, 0); x.stroke();
    x.fillStyle = '#7cb342'; x.beginPath(); x.moveTo(lx - 135, ly + 10); x.lineTo(lx + 135, ly + 10); x.bezierCurveTo(lx + 120, ly + 190, lx - 120, ly + 190, lx - 135, ly + 10); x.fill();
    x.fillStyle = '#a7c957'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(lx - 95 + (i % 5) * 48 + (i > 4 ? 24 : 0), ly + 60 + (i > 4 ? 52 : 0), 21, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#2e5d1e'; x.font = '800 190px sans-serif'; x.textBaseline = 'middle'; x.fillText('Sounsouni', 520, 250);
    x.fillStyle = '#4a6a35'; x.font = '600 74px sans-serif'; x.fillText('Livraison partout au Mali', 530, 395);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function makeVan() {
    const g = new THREE.Group();
    const L = 5.1, W = 1.95;
    const sh = new THREE.Shape();
    sh.moveTo(0.05, 0.38);
    sh.lineTo(0.0, 2.05); sh.quadraticCurveTo(0.0, 2.25, 0.25, 2.25);
    sh.lineTo(3.35, 2.25); sh.quadraticCurveTo(3.75, 2.24, 3.95, 1.95);
    sh.lineTo(4.55, 1.22); sh.quadraticCurveTo(4.68, 1.08, 4.9, 1.02);
    sh.quadraticCurveTo(5.12, 0.98, 5.12, 0.72); sh.lineTo(5.1, 0.42); sh.quadraticCurveTo(5.08, 0.36, 4.95, 0.36);
    sh.lineTo(4.55, 0.36); sh.absarc(4.0, 0.36, 0.52, 0, Math.PI, false);
    sh.lineTo(1.6, 0.36); sh.absarc(1.05, 0.36, 0.52, 0, Math.PI, false);
    sh.lineTo(0.05, 0.38);
    const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 8, curveSegments: 28 });
    bodyGeo.translate(-L / 2, 0, -W / 2);
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.16, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05 });
    const body = new THREE.Mesh(bodyGeo, paint); g.add(body);
    // décor latéral (deux côtés)
    const dec = vanDecal();
    const decMat = new THREE.MeshPhysicalMaterial({ map: dec, transparent: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const zz of [W / 2 + 0.141, -W / 2 - 0.141]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 1.33), decMat); d.position.set(-L / 2 + 0.15 + 3.55 / 2, 0.42 + 1.33 / 2, zz);
      if (zz < 0) d.rotation.y = Math.PI; g.add(d);
    }
    // vitres
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x2f4a40, roughness: 0.02, metalness: 0.55, clearcoat: 1, envMapIntensity: 2 });
    const ws = new THREE.Shape(); ws.moveTo(3.3, 2.0); ws.lineTo(3.88, 2.0); ws.lineTo(4.42, 1.3); ws.lineTo(3.3, 1.3); ws.lineTo(3.3, 2.0);
    for (const zz of [W / 2 + 0.145, -W / 2 - 0.16]) {
      const sw = new THREE.Mesh(new THREE.ExtrudeGeometry(ws, { depth: 0.015, bevelEnabled: false }), glass); sw.position.set(-L / 2, 0, zz); g.add(sw);
    }
    {
      const x0 = 3.95, y0 = 1.95, x1 = 4.55, y1 = 1.22, len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      const nx = Math.sin(-ang) * -1, ny = Math.cos(ang);
      const wsBox = new THREE.Mesh(new THREE.BoxGeometry(len - 0.06, 0.03, W - 0.05), glass);
      wsBox.position.set(-L / 2 + (x0 + x1) / 2 + Math.sin(ang) * -0.14 * -1 * 0 + 0.1 * Math.abs(Math.sin(ang)), (y0 + y1) / 2 + 0.11, 0); wsBox.rotation.z = ang; g.add(wsBox);
    }
    // phares, calandre, pare-choc, rétroviseurs
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xdfe5e8, metalness: 1, roughness: 0.18 });
    const darkPl = new THREE.MeshStandardMaterial({ color: 0x20261f, roughness: 0.55 });
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.1), darkPl); grille.position.set(L / 2 + 0.16, 0.72, 0); g.add(grille);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, W + 0.2), darkPl); bumper.position.set(L / 2 + 0.1, 0.43, 0); g.add(bumper);
    const rbump = bumper.clone(); rbump.position.x = -L / 2 - 0.1; g.add(rbump);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffbea, emissive: 0xfff2b0, emissiveIntensity: 1.2, roughness: 0.2 });
    for (const zz of [0.68, -0.68]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.36), lampMat); lamp.position.set(L / 2 + 0.17, 0.92, zz); g.add(lamp);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), paint); mir.position.set(-L / 2 + 3.7, 1.55, zz > 0 ? W / 2 + 0.3 : -W / 2 - 0.3); g.add(mir);
    }
    // roues
    const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.75 });
    for (const [x, z] of [[1.05, 1], [4.0, 1], [1.05, -1], [4.0, -1]]) {
      const wg = new THREE.Group(); wg.position.set(-L / 2 + x, 0.36, z * (W / 2 + 0.02));
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 20, 48), tire); wg.add(t);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.18, 40), chrome); rim.rotation.x = Math.PI / 2; wg.add(rim);
      for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.05), darkPl); sp.rotation.z = (k / 5) * Math.PI; sp.position.z = z * 0.1; wg.add(sp); }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 24), new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.3 })); cap.rotation.x = Math.PI / 2; wg.add(cap);
      wg.userData.wheel = 1; g.add(wg);
    }
    return g;
  }


  function softShadowTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 128; var x = c.getContext("2d");
    var g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(10,30,5,.55)"); g.addColorStop(1, "rgba(10,30,5,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  function studio(renderer, scene) {
    var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x5d6f58, side: THREE.BackSide })));
    function panel(c, x, y, z, w, h) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); }
    panel(0xffffff, 6, 8, 6, 10, 6); panel(0xfff3d6, -8, 4, 4, 6, 8); panel(0x2f4a28, 0, -8, 0, 20, 20);
    scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    scene.add(new THREE.HemisphereLight(0xf4fff0, 0x3d5a2a, 0.55));
    var key = new THREE.DirectionalLight(0xfff6e5, 2.4); key.position.set(4, 7, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xd8ffd0, 1.2); rim.position.set(-5, 3, -4); scene.add(rim);
  }

  // ---------- scènes ----------
  function buildVan(scene, cam) {
    var v = makeVan(); v.position.set(0, -1.0, 0); v.rotation.y = -0.62; scene.add(v);
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.4), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.rotation.z = 0.62; sh.position.set(0, -1.0, 0); scene.add(sh);
    cam.position.set(2.6, 2.0, 8.8); cam.lookAt(0.15, -0.12, 0);
    var wheels = []; v.traverse(function (o) { if (o.userData && o.userData.wheel) wheels.push(o); });
    return function (t) { // t en secondes ; doux "roule sur place"
      v.position.y = -1.0 + Math.abs(Math.sin(t * 5.2)) * 0.035;
      v.rotation.y = -0.62 + Math.sin(t * 0.7) * 0.07;
      v.rotation.z = Math.sin(t * 2.6) * 0.008;
      sh.rotation.z = -v.rotation.y;
      for (var i = 0; i < wheels.length; i++) wheels[i].rotation.z = -t * 6;
      return true; // continue tant que c'est visible
    };
  }
  function buildSuccess(scene, cam) {
    var ringMat = new THREE.MeshPhysicalMaterial({ color: 0x2e8b3a, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    var badge = new THREE.Group(); scene.add(badge);
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.35, 72), ringMat); disc.rotation.x = Math.PI / 2; badge.add(disc);
    badge.add(new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 20, 96), ringMat));
    var s = new THREE.Shape(); s.moveTo(-0.62, 0.02); s.lineTo(-0.2, -0.42); s.lineTo(0.66, 0.46); s.lineTo(0.5, 0.62); s.lineTo(-0.2, -0.08); s.lineTo(-0.46, 0.18); s.lineTo(-0.62, 0.02);
    var chk = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5 }), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 }));
    chk.position.z = 0.16; badge.add(chk);
    var coinMat = new THREE.MeshPhysicalMaterial({ color: 0xf2b632, metalness: 0.85, roughness: 0.28, clearcoat: 0.6 });
    var coins = [], seed = 5; function r() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = 0; i < 9; i++) {
      var c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.07, 40), coinMat);
      var a = (i / 9) * Math.PI * 2 + 0.3, d = 1.75 + r() * 0.5;
      c.userData = { tx: Math.cos(a) * d, ty: Math.sin(a) * d * 0.85, tz: -0.3 + r() * 0.8, rx: r() * 3, rz: r() * 3, spin: 2 + r() * 3, delay: 0.15 + i * 0.05 };
      c.position.set(0, 0, -0.4); c.scale.setScalar(0.01); scene.add(c); coins.push(c);
    }
    cam.position.set(0, 0, 8.8); cam.lookAt(0, 0, 0);
    function ease(x) { x = Math.min(1, Math.max(0, x)); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); } // léger dépassement
    return function (t) { // ~2 s de fête, puis tout se pose et on arrête
      var k = ease(t / 0.9);
      badge.scale.setScalar(0.2 + 0.8 * k);
      badge.rotation.y = (1 - Math.min(1, t / 1.1)) * -Math.PI * 1.2;
      for (var i = 0; i < coins.length; i++) {
        var u = coins[i].userData, q = ease((t - u.delay) / 0.9);
        coins[i].position.set(u.tx * q, u.ty * q, -0.4 + (u.tz + 0.4) * q);
        coins[i].scale.setScalar(Math.max(0.01, q));
        var spinLeft = Math.max(0, 2.2 - t);
        coins[i].rotation.set(u.rx + Math.PI / 2 - spinLeft * u.spin * 0.5, 0, u.rz + spinLeft * u.spin);
      }
      return t < 2.3;
    };
  }
  var BUILDERS = { van: buildVan, success: buildSuccess };

  // ---------- cycle de vie ----------
  function start(host) {
    var kind = host.getAttribute("data-sns3d"); if (!BUILDERS[kind]) return;
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(kind === "van" ? 32 : 30, w / h, 0.1, 100);
    studio(renderer, scene);
    var step = BUILDERS[kind](scene, cam);
    if (kind === "van") {
      // Cadrage : la fourgonnette remplit ~92 % de la zone, quelle que soit sa forme
      // (mesuré sur le rendu de référence : à 32°, elle occupe 64 % de la hauteur, rapport 1,55).
      var aspect = w / h, f = 0.86 / Math.max(1, 1.55 / aspect);
      cam.fov = 2 * Math.atan(0.64 * Math.tan(16 * Math.PI / 180) / f) * 180 / Math.PI;
      cam.updateProjectionMatrix();
    }
    var cv = renderer.domElement; cv.className = "sns3d-canvas"; cv.setAttribute("aria-hidden", "true");
    host.appendChild(cv);
    var inst = { host: host, renderer: renderer, scene: scene, cam: cam, step: step, t0: 0, tAcc: 0, last: 0, raf: 0, visible: true, done: false };
    live.push(inst);
    step(0); renderer.render(scene, cam);
    host.classList.add("sns3d-live");
    loop(inst);
  }
  function loop(inst) {
    if (inst.raf || inst.done) return;
    inst.last = 0;
    var tick = function (now) {
      inst.raf = 0;
      if (!inst.host.isConnected) { stop(inst); return; }
      if (!inst.visible || document.hidden || covered(inst)) return; // en pause : on ne relance plus rien
      if (inst.last) { var dt = Math.min(0.1, (now - inst.last) / 1000); if (dt < 1 / 32) { inst.raf = requestAnimationFrame(tick); return; } inst.tAcc += dt; }
      inst.last = now;
      var more = inst.step(inst.tAcc); inst.renderer.render(inst.scene, inst.cam);
      if (more === false) { inst.done = true; return; } // animation terminée : la page reste calme
      inst.raf = requestAnimationFrame(tick);
    };
    inst.raf = requestAnimationFrame(tick);
  }
  // Une fenêtre (fiche article, paiement…) recouvre la scène : inutile de l'animer.
  function covered(inst) {
    var ov = document.querySelectorAll(".modal-overlay");
    for (var i = 0; i < ov.length; i++) if (!ov[i].contains(inst.host)) return true;
    return false;
  }
  function stop(inst) {
    if (inst.raf) cancelAnimationFrame(inst.raf); inst.raf = 0;
    try { if (io) io.unobserve(inst.host); } catch (e) {}
    try {
      inst.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      if (inst.scene.environment) inst.scene.environment.dispose();
      inst.renderer.dispose(); if (inst.renderer.forceContextLoss) inst.renderer.forceContextLoss();
    } catch (e) {}
    var i = live.indexOf(inst); if (i >= 0) live.splice(i, 1);
  }
  function findInst(host) { for (var i = 0; i < live.length; i++) if (live[i].host === host) return live[i]; return null; }

  function onSeen(entries) {
    entries.forEach(function (en) {
      var host = en.target, inst = findInst(host);
      if (inst) { inst.visible = en.isIntersecting; if (inst.visible) loop(inst); return; }
      if (!en.isIntersecting || host.getAttribute("data-sns3d-state")) return;
      host.setAttribute("data-sns3d-state", "loading");
      var lib = window.snsLoadLib ? window.snsLoadLib("three") : Promise.reject();
      lib.then(function () {
        if (!host.isConnected) return;
        host.setAttribute("data-sns3d-state", "on");
        try { start(host); } catch (e) { host.setAttribute("data-sns3d-state", "failed"); }
      }).catch(function () { host.setAttribute("data-sns3d-state", "failed"); });
    });
  }

  // Appelée après chaque affichage de l'app.
  window.snsMount3D = function () {
    for (var i = live.length - 1; i >= 0; i--) if (!live[i].host.isConnected) stop(live[i]);
    for (var j = 0; j < live.length; j++) if (live[j].visible) loop(live[j]); // reprend après fermeture d'une fenêtre
    var hosts = document.querySelectorAll("[data-sns3d]:not([data-sns3d-seen])");
    if (!hosts.length) return;
    if (WEAK === null) WEAK = weakDevice();
    for (var k = 0; k < hosts.length; k++) {
      hosts[k].setAttribute("data-sns3d-seen", "1");
      if (WEAK || !("IntersectionObserver" in window)) continue; // image fixe seulement
      if (!io) io = new IntersectionObserver(onSeen, { threshold: 0.15 });
      io.observe(hosts[k]);
    }
  };
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) for (var i = 0; i < live.length; i++) if (live[i].visible) loop(live[i]);
  });
  window._sns3dLive = live;
})();
