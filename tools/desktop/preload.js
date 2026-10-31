// Pont entre le site Sounsouni et l'ordinateur : imprimantes et fenêtre de
// paiement. Seules ces quelques fonctions sont visibles par la page.
const { contextBridge, ipcRenderer } = require("electron");
const listeners = { nav: new Set(), closed: new Set() };
ipcRenderer.on("pay-nav", (_e, url) => listeners.nav.forEach((f) => { try { f({ url }); } catch (e) {} }));
ipcRenderer.on("pay-closed", () => listeners.closed.forEach((f) => { try { f({}); } catch (e) {} }));
contextBridge.exposeInMainWorld("SnsDesktop", {
  version: () => ipcRenderer.invoke("app-version"),
  listPrinters: () => ipcRenderer.invoke("printers"),
  // html : page complète ; opts : { deviceName, silent, widthMm (58/80 pour un ticket), landscape }
  print: (html, opts) => ipcRenderer.invoke("print", String(html || ""), opts || {}),
  openPayment: (url) => ipcRenderer.invoke("pay-open", String(url || "")),
  closePayment: () => ipcRenderer.invoke("pay-close"),
  onPayment: (type, fn) => { const s = listeners[type]; if (!s || typeof fn !== "function") return { remove() {} }; s.add(fn); return { remove() { s.delete(fn); } }; }
});
