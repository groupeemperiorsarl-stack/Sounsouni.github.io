// Sounsouni pour ordinateur (Windows) — la même application que le site
// sounsouni.pro, dans sa propre fenêtre avec son icône. Le site garde ses
// fichiers sur l'ordinateur (marche sans connexion une fois ouvert une fois).
const { app, BrowserWindow, shell, Menu, session } = require("electron");
const path = require("path");
const SITE = "https://sounsouni.pro/";
// Pages autorisées DANS l'application (paiement LigdiCash / Orange / Moov).
const INSIDE = /^https:\/\/([a-z0-9-]+\.)*(sounsouni\.pro|ligdicash\.com|orange-money\.com|orange\.ml|moov-africa\.ml|moov\.ml)(\/|$)/i;

if (!app.requestSingleInstanceLock()) { app.quit(); }
let win = null;
function offlinePage() { return "file://" + path.join(__dirname, "offline.html"); }
function create() {
  win = new BrowserWindow({
    width: 1300, height: 820, minWidth: 380, minHeight: 560,
    title: "Sounsouni", icon: path.join(__dirname, "build", "icon.png"), backgroundColor: "#f3f6f1", show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " SounsouniDesktop/" + app.getVersion());
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (INSIDE.test(url)) return { action: "allow", overrideBrowserWindowOptions: { width: 480, height: 760, autoHideMenuBar: true } };
    shell.openExternal(url); return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://") || INSIDE.test(url)) return;
    e.preventDefault(); shell.openExternal(url);
  });
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && !String(url).startsWith("file://")) win.loadURL(offlinePage());
  });
  win.loadURL(SITE);
}
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Géolocalisation, notifications, caméra (scanner) : autorisées pour Sounsouni seulement.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(INSIDE.test(wc.getURL()) && ["geolocation", "notifications", "media", "clipboard-sanitized-write", "fullscreen"].includes(perm)));
  create();
});
app.on("window-all-closed", () => app.quit());
