// Sounsouni pour ordinateur (Windows) — la même application que le site
// sounsouni.pro, dans sa propre fenêtre avec son icône. Le site garde ses
// fichiers sur l'ordinateur (marche sans connexion une fois ouvert une fois).
// Les mises à jour du site arrivent toutes seules : il ne faut refabriquer
// ce programme que pour une fonction propre à l'ordinateur.
// Version 1.1 : impression (imprimante normale ou à tickets 58/80 mm, sans
// fenêtre si une imprimante est choisie) et fenêtre de paiement intégrée
// (LigdiCash, Orange Money, Moov…) avec retour automatique.
const { app, BrowserWindow, shell, Menu, session, ipcMain } = require("electron");
const path = require("path");
const TEST = process.env.SNS_TEST_SITE || ""; // essais seulement
const SITE = TEST || "https://sounsouni.pro/";
const OWN = TEST ? /^(https:\/\/([a-z0-9-]+\.)*sounsouni\.pro|http:\/\/localhost:\d+)(\/|$)/i : /^https:\/\/([a-z0-9-]+\.)*sounsouni\.pro(\/|$)/i;
const PAY = /^https:\/\/([a-z0-9-]+\.)*(ligdicash\.com|orange-money\.com|orange\.ml|orangemoney\.[a-z.]+|moov-africa\.ml|moov\.ml|moov-africa\.[a-z.]+|wave\.com|visa\.com|mastercard\.com|3dsecure\.[a-z.]+)(\/|$)/i;
const EXTERNAL = /^(mailto:|tel:|sms:|whatsapp:|intent:)|^https:\/\/(wa\.me|api\.whatsapp\.com|github\.com|([a-z0-9-]+\.)*(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|google\.com))(\/|$)/i;

if (!app.requestSingleInstanceLock()) { app.quit(); }
let win = null, payWin = null;
function offlinePage() { return "file://" + path.join(__dirname, "offline.html"); }
function sendToMain(ch, arg) { try { if (win && !win.isDestroyed()) win.webContents.send(ch, arg); } catch (e) {} }

// ---- Fenêtre de paiement : toute page de paiement y reste, jusqu'au retour sur Sounsouni ----
function openPayment(url) {
  if (payWin && !payWin.isDestroyed()) { payWin.loadURL(url); payWin.focus(); return true; }
  payWin = new BrowserWindow({ parent: win, width: 520, height: 820, minWidth: 360, title: "Paiement — Sounsouni", autoHideMenuBar: true, backgroundColor: "#ffffff",
    icon: path.join(__dirname, "build", "icon.png"), webPreferences: { contextIsolation: true, nodeIntegration: false } });
  const wc = payWin.webContents;
  const tell = (_e, u) => sendToMain("pay-nav", u);
  wc.on("did-navigate", tell); wc.on("did-redirect-navigation", tell); wc.on("did-navigate-in-page", tell); wc.on("will-navigate", tell);
  wc.setWindowOpenHandler(({ url: u }) => { if (EXTERNAL.test(u)) { shell.openExternal(u); return { action: "deny" }; } payWin.loadURL(u); return { action: "deny" }; });
  payWin.on("closed", () => { payWin = null; sendToMain("pay-closed"); });
  payWin.loadURL(url);
  return true;
}

// ---- Impression ----
async function printHtml(html, opts) {
  const w = new BrowserWindow({ show: false, width: opts.widthMm ? Math.round(opts.widthMm * 3.78) + 40 : 900, height: 1200, webPreferences: { contextIsolation: true, nodeIntegration: false, javascript: false } });
  try {
    await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const settings = { silent: !!(opts.silent && opts.deviceName), printBackground: true, deviceName: opts.deviceName || undefined, landscape: !!opts.landscape };
    if (opts.widthMm) {
      // Ticket : largeur du rouleau, hauteur selon le contenu (en microns).
      const hPx = await w.webContents.executeJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)", true).catch(() => 800);
      settings.pageSize = { width: Math.round(opts.widthMm * 1000), height: Math.max(80000, Math.round(hPx * 264.6) + 10000) };
      settings.margins = { marginType: "none" };
    }
    return await new Promise((resolve) => w.webContents.print(settings, (ok, why) => resolve({ ok, error: ok ? null : String(why || "") })));
  } finally { setTimeout(() => { try { w.destroy(); } catch (e) {} }, 500); }
}

function create() {
  win = new BrowserWindow({
    width: 1300, height: 820, minWidth: 380, minHeight: 560,
    title: "Sounsouni", icon: path.join(__dirname, "build", "icon.png"), backgroundColor: "#f3f6f1", show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false, preload: path.join(__dirname, "preload.js") }
  });
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " SounsouniDesktop/" + app.getVersion());
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (OWN.test(url) && !/\.(csv|apk|exe)(\?|$)/i.test(url)) return { action: "allow", overrideBrowserWindowOptions: { width: 480, height: 760, autoHideMenuBar: true } };
    if (PAY.test(url)) { openPayment(url); return { action: "deny" }; }
    shell.openExternal(url); return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://") || OWN.test(url)) return;
    e.preventDefault();
    if (PAY.test(url) || !EXTERNAL.test(url) && /^https:\/\//i.test(url) && !/\.(csv|apk|exe)(\?|$)/i.test(url) && !/^https:\/\/([a-z0-9-]+\.)*supabase\.co\//i.test(url)) openPayment(url);
    else shell.openExternal(url);
  });
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && !String(url).startsWith("file://")) win.loadURL(offlinePage());
  });
  win.loadURL(SITE);
}
ipcMain.handle("app-version", () => app.getVersion());
ipcMain.handle("printers", async () => { try { return (await win.webContents.getPrintersAsync()).map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault })); } catch (e) { return []; } });
ipcMain.handle("print", async (_e, html, opts) => { try { return await printHtml(html, opts || {}); } catch (e) { return { ok: false, error: String(e && e.message || e) }; } });
ipcMain.handle("pay-open", (_e, url) => (/^https:\/\//i.test(url) || (TEST && /^http:\/\/localhost:/.test(url)) ? openPayment(url) : false));
ipcMain.handle("pay-close", () => { try { if (payWin && !payWin.isDestroyed()) payWin.close(); } catch (e) {} return true; });
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  if (process.env.SNS_SELFTEST) setTimeout(() => require(process.env.SNS_SELFTEST)(win), 6000);
  Menu.setApplicationMenu(null);
  // Géolocalisation, notifications, caméra (scanner) : autorisées pour Sounsouni seulement.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(OWN.test(wc.getURL()) && ["geolocation", "notifications", "media", "clipboard-sanitized-write", "fullscreen"].includes(perm)));
  create();
});
app.on("window-all-closed", () => app.quit());
