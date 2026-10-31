// ============================================================
// Sounsouni Gestion — gestion et comptabilité simple des entreprises.
// Chargé seulement quand on ouvre « Ma gestion » (ne ralentit pas le marché).
// Principe : tout est gardé dans l'appareil (IndexedDB) et marche sans
// connexion. Chaque saisie devient une petite « ligne » (op) envoyée au
// serveur (fonction gestion-sync) dès qu'il y a du réseau ; les autres
// membres la reçoivent. Une ligne = { id, k (type), e (fiche), a (put|del),
// f (champs), at (heure) }. La fiche la plus récente gagne.
// Affichage : téléphone (barre en bas) et grand écran (menu à gauche,
// tableaux larges). Pas de regard en arrière dans les regex (anciens iPhone).
// ============================================================
(function () {
  "use strict";
  var H = function () { return window.SnsGestionHost || {}; };
  var DAY = 86400000;

  // ---------------- Textes ----------------
  var FR = {
    app: "Sounsouni Gestion", home: "Accueil", sales: "Ventes", purchases: "Achats", expenses: "Dépenses", items: "Articles & stock",
    clients: "Clients", suppliers: "Fournisseurs", employees: "Employés", reports: "Rapports", members: "Membres", settings: "Réglages", more: "Plus",
    close: "Fermer", save: "Enregistrer", cancel: "Annuler", del: "Supprimer", edit: "Modifier", add: "Ajouter", search: "Rechercher…",
    newSale: "Nouvelle vente", newPurchase: "Nouvel achat", newExpense: "Nouvelle dépense", newItem: "Nouvel article", newClient: "Nouveau client",
    newSupplier: "Nouveau fournisseur", newEmployee: "Nouvel employé", today: "Aujourd'hui", week: "Cette semaine", month: "Ce mois", year: "Cette année",
    revenue: "Chiffre d'affaires", grossMargin: "Marge brute", profit: "Bénéfice", netProfit: "Bénéfice net", cogs: "Coût des marchandises vendues",
    cash: "Trésorerie", owedByClients: "Crédits clients", owedToSuppliers: "Dettes fournisseurs", stockValue: "Valeur du stock", lowStock: "Stock bas",
    negStock: "Stock négatif à vérifier", syncOk: "À jour", syncWait: "en attente d'envoi", offline: "Hors connexion", syncing: "Envoi…",
    name: "Nom", phone: "Téléphone", price: "Prix de vente", cost: "Prix d'achat", qty: "Quantité", unit: "Unité", stock: "Stock", total: "Total",
    paid: "Payé", rest: "Reste", date: "Date", note: "Note", category: "Catégorie", mode: "Paiement", client: "Client", supplier: "Fournisseur",
    article: "Article", service: "Service", type: "Type", alertAt: "Alerte si stock ≤", initialStock: "Stock de départ", noData: "Rien pour le moment.",
    receipt: "Reçu", shareWa: "Envoyer par WhatsApp", print: "Imprimer", by: "par", modified: "Modifié", history: "Historique",
    cashMode: "Espèces", om: "Orange Money", moov: "Moov Money", wave: "Wave", bank: "Banque", credit: "À crédit",
    encaisser: "Encaisser un paiement", payBtn: "Payer", balance: "Solde", owes: "doit", weOwe: "on doit", salary: "Salaire", position: "Poste",
    paySalary: "Payer le salaire", inventory: "Inventaire (compter le stock réel)", realQty: "Quantité réelle comptée", adjust: "Ajustement",
    chef: "Chef", comptable: "Comptable", caissier: "Caissier", partenaire: "Partenaire", invite: "Inviter", role: "Rôle", leave: "Quitter l'entreprise",
    owner: "Propriétaire", invited: "Invitation envoyée", remove: "Retirer", pin: "Code PIN", setPin: "Mettre un code PIN", removePin: "Enlever le code PIN",
    enterPin: "Entrez votre code PIN", wrongPin: "Code incorrect", forgotPin: "Code oublié ?", backup: "Sauvegarde", backupDl: "Télécharger la sauvegarde",
    backupShare: "Partager (Google Drive, WhatsApp, e-mail…)", restore: "Restaurer depuis un fichier", backupLate: "Pas de sauvegarde depuis plus de 7 jours.",
    syscohada: "Comptabilité SYSCOHADA", soon: "Bientôt disponible", subscription: "Abonnement", subActive: "Actif jusqu'au", subExpired: "Abonnement terminé : lecture seule. Le chef doit payer pour continuer.",
    subFree: "Gratuit", subOffert: "Offert par Sounsouni", openingCash: "Caisse de départ", companyName: "Nom de l'entreprise",
    importItems: "Importer mes articles Sounsouni", importDone: "articles importés", snsSales: "Ventes Sounsouni importées automatiquement",
    readOnly: "Lecture seule", period: "Période", from: "Du", to: "au", exportCsv: "Exporter (tableur)", topItems: "Meilleures ventes",
    byCategory: "Dépenses par catégorie", salesDay: "Ventes par jour", cashIn: "Entrées d'argent", cashOut: "Sorties d'argent", lines: "Lignes",
    addLine: "Ajouter une ligne", otherLine: "Autre (texte libre)", qtyShort: "Qté", unitPrice: "Prix unitaire", confirmDel: "Supprimer définitivement ?",
    saved: "Enregistré", required: "Champ obligatoire", amount: "Montant", desc: "Description", back: "Retour", payments: "Paiements",
    welcome: "Bienvenue dans votre gestion", startHint: "Commencez par ajouter vos articles ou faites directement une vente.",
    salesCount: "ventes", itemsCount: "articles", lastOps: "Dernières opérations", seeAll: "Tout voir", members_hint: "Le chef invite avec le numéro Sounsouni de la personne. Elle accepte dans « Changer de rôle ».",
    payNow: "Payer l'abonnement", perDays: "jours", catLoyer: "Loyer", catTransport: "Transport", catElec: "Électricité / eau", catSal: "Salaires",
    catCom: "Communication / internet", catTax: "Impôts et taxes", catMarch: "Fournitures", catRep: "Entretien / réparation", catAutre: "Autre",
    partnerHint: "Vous êtes partenaire : vous voyez les chiffres, sans pouvoir modifier.", restoreDone: "lignes restaurées", lastBackup: "Dernière sauvegarde",
    never: "jamais", pinSet: "Code PIN enregistré", pending: "en attente", sold: "vendus", profitOf: "Bénéfice", margin: "Marge",
    caisseHint: "Vous saisissez les ventes et les encaissements.", invitePhoneHint: "Numéro avec l'indicatif, ex. +223 76 12 34 56",
    newLabel: "Nouveau", fiche: "Fiche", contact: "Contact", total_due: "Total dû", stockMoves: "Mouvements de stock", in: "Entrée", out: "Sortie",
    loading: "Chargement…", errNet: "Pas de connexion : enregistré sur l'appareil, envoi automatique plus tard.", errGeneric: "Erreur, réessayez.",
    forbidden: "Votre rôle ne permet pas cette action.", serverRefused: "lignes refusées par le serveur", pinForgotConfirm: "Le code sera enlevé et les données de cet appareil rechargées depuis le serveur. Continuer ?",
    leaveConfirm: "Quitter cette entreprise ? Vous n'y aurez plus accès.", removeConfirm: "Retirer cette personne ? Elle n'aura plus accès.",
    receiptThanks: "Merci pour votre achat !", unpaid: "Non payé", partial: "Partiel", ok: "Payé", mustOnline: "Il faut une connexion pour cette action.",
    invitedOk: "Invitation envoyée. La personne doit accepter dans « Changer de rôle ».", noAccountYet: "Ce numéro n'a pas encore de compte Sounsouni : l'invitation l'attendra.",
    address: "Adresse", tableView: "Tableau",
    ohada: "Comptabilité", ohadaOn: "Activer la comptabilité SYSCOHADA", ohadaOff: "Désactiver SYSCOHADA", ohadaHint: "Les écritures sont faites automatiquement à partir de vos ventes, achats, dépenses et paiements : rien à ressaisir.",
    journal: "Journal", ledger: "Grand livre", trial: "Balance", incomeSt: "Compte de résultat", balanceSh: "Bilan", account: "Compte", label: "Libellé", debit: "Débit", credit2: "Crédit",
    totals: "Totaux", soldeD: "Solde débiteur", soldeC: "Solde créditeur", charges: "Charges", produits: "Produits", actif: "Actif", passif: "Passif", resultat: "Résultat de l'exercice",
    stockVar: "Variation des stocks", balanced: "Équilibré", notBalanced: "Non équilibré", ohadaNote: "Stock évalué au dernier prix d'achat de chaque article. À faire vérifier par votre expert-comptable avant dépôt officiel.",
    printer: "Imprimante", printFmt: "Format d'impression", fmtA4: "Page normale (A4)", fmt80: "Ticket 80 mm", fmt58: "Ticket 58 mm", printerSel: "Imprimante de cet ordinateur", printerAsk: "Me demander à chaque fois",
    rawbt: "Imprimante Bluetooth (application RawBT)", rawbtHint: "Sur téléphone Android : installez l'application gratuite « RawBT » (Play Store), reliez-la à votre imprimante à tickets Bluetooth, puis cochez cette case.",
    testPrint: "Imprimer un essai", printErr: "Impression impossible", printSent: "Envoyé à l'imprimante", reportPrint: "Imprimer", hideZero: "Masquer stock 0", sortBy: "Trier", alerts: "Alertes", seller: "Vendeur"
  };
  var EN = {
    app: "Sounsouni Business", home: "Home", sales: "Sales", purchases: "Purchases", expenses: "Expenses", items: "Items & stock", clients: "Customers",
    suppliers: "Suppliers", employees: "Staff", reports: "Reports", members: "Members", settings: "Settings", more: "More", close: "Close", save: "Save",
    cancel: "Cancel", del: "Delete", edit: "Edit", add: "Add", search: "Search…", newSale: "New sale", newPurchase: "New purchase", newExpense: "New expense",
    newItem: "New item", newClient: "New customer", newSupplier: "New supplier", newEmployee: "New staff member", today: "Today", week: "This week",
    month: "This month", year: "This year", revenue: "Revenue", grossMargin: "Gross margin", profit: "Profit", netProfit: "Net profit",
    cogs: "Cost of goods sold", cash: "Cash", owedByClients: "Customer credit", owedToSuppliers: "Supplier debts", stockValue: "Stock value",
    lowStock: "Low stock", negStock: "Negative stock to check", syncOk: "Up to date", syncWait: "waiting to send", offline: "Offline", syncing: "Sending…",
    name: "Name", phone: "Phone", price: "Selling price", cost: "Cost price", qty: "Quantity", unit: "Unit", stock: "Stock", total: "Total", paid: "Paid",
    rest: "Balance", date: "Date", note: "Note", category: "Category", mode: "Payment", client: "Customer", supplier: "Supplier", article: "Product",
    service: "Service", type: "Type", alertAt: "Alert when stock ≤", initialStock: "Opening stock", noData: "Nothing yet.", receipt: "Receipt",
    shareWa: "Send by WhatsApp", print: "Print", by: "by", modified: "Edited", history: "History", cashMode: "Cash", credit: "On credit",
    encaisser: "Record a payment", payBtn: "Pay", balance: "Balance", owes: "owes", weOwe: "we owe", salary: "Salary", position: "Position",
    paySalary: "Pay salary", inventory: "Stock count", realQty: "Real counted quantity", adjust: "Adjustment", chef: "Owner", comptable: "Accountant",
    caissier: "Cashier", partenaire: "Partner", invite: "Invite", role: "Role", leave: "Leave the business", owner: "Owner", invited: "Invitation sent",
    remove: "Remove", pin: "PIN code", setPin: "Set a PIN code", removePin: "Remove PIN code", enterPin: "Enter your PIN code", wrongPin: "Wrong code",
    forgotPin: "Forgot code?", backup: "Backup", backupDl: "Download backup", backupShare: "Share (Google Drive, WhatsApp, email…)",
    restore: "Restore from a file", backupLate: "No backup for more than 7 days.", syscohada: "SYSCOHADA accounting", soon: "Coming soon",
    subscription: "Subscription", subActive: "Active until", subExpired: "Subscription ended: read only. The owner must pay to continue.",
    subFree: "Free", subOffert: "Offered by Sounsouni", openingCash: "Opening cash", companyName: "Business name", importItems: "Import my Sounsouni items",
    importDone: "items imported", snsSales: "Sounsouni sales imported automatically", readOnly: "Read only", period: "Period", from: "From", to: "to",
    exportCsv: "Export (spreadsheet)", topItems: "Best sellers", byCategory: "Expenses by category", salesDay: "Sales per day", cashIn: "Money in",
    cashOut: "Money out", lines: "Lines", addLine: "Add a line", otherLine: "Other (free text)", qtyShort: "Qty", unitPrice: "Unit price",
    confirmDel: "Delete permanently?", saved: "Saved", required: "Required field", amount: "Amount", desc: "Description", back: "Back", payments: "Payments",
    welcome: "Welcome to your business", startHint: "Start by adding your items or record a sale right away.", salesCount: "sales", itemsCount: "items",
    lastOps: "Latest operations", seeAll: "See all", members_hint: "The owner invites with the person's Sounsouni number. They accept in “Switch role”.",
    payNow: "Pay subscription", perDays: "days", catLoyer: "Rent", catTransport: "Transport", catElec: "Electricity / water", catSal: "Salaries",
    catCom: "Phone / internet", catTax: "Taxes", catMarch: "Supplies", catRep: "Maintenance / repair", catAutre: "Other",
    partnerHint: "You are a partner: you see the figures but cannot edit.", restoreDone: "lines restored", lastBackup: "Last backup", never: "never",
    pinSet: "PIN saved", pending: "pending", sold: "sold", profitOf: "Profit", margin: "Margin", caisseHint: "You record sales and payments.",
    invitePhoneHint: "Number with country code, e.g. +223 76 12 34 56", newLabel: "New", fiche: "Record", contact: "Contact", total_due: "Total due",
    stockMoves: "Stock movements", in: "In", out: "Out", loading: "Loading…", errNet: "No connection: saved on the device, will be sent later.",
    errGeneric: "Error, try again.", forbidden: "Your role does not allow this.", serverRefused: "lines refused by the server",
    pinForgotConfirm: "The code will be removed and this device's data reloaded from the server. Continue?", leaveConfirm: "Leave this business? You will lose access.",
    removeConfirm: "Remove this person? They will lose access.", receiptThanks: "Thank you for your purchase!", unpaid: "Unpaid", partial: "Partial", ok: "Paid",
    mustOnline: "This action needs a connection.", invitedOk: "Invitation sent. The person must accept in “Switch role”.",
    noAccountYet: "This number has no Sounsouni account yet: the invitation will wait.", tableView: "Table", hideZero: "Hide zero stock", sortBy: "Sort",
    alerts: "Alerts", seller: "Seller", address: "Address",
    ohada: "Accounting", ohadaOn: "Turn on SYSCOHADA accounting", ohadaOff: "Turn off SYSCOHADA", ohadaHint: "Entries are made automatically from your sales, purchases, expenses and payments: nothing to type again.",
    journal: "Journal", ledger: "General ledger", trial: "Trial balance", incomeSt: "Income statement", balanceSh: "Balance sheet", account: "Account", label: "Label", debit: "Debit", credit2: "Credit",
    totals: "Totals", soldeD: "Debit balance", soldeC: "Credit balance", charges: "Expenses", produits: "Income", actif: "Assets", passif: "Liabilities & equity", resultat: "Profit for the period",
    stockVar: "Change in inventory", balanced: "Balanced", notBalanced: "Not balanced", ohadaNote: "Stock valued at each item's latest purchase price. Have it checked by your accountant before any official filing.",
    printer: "Printer", printFmt: "Print format", fmtA4: "Normal page (A4)", fmt80: "80 mm ticket", fmt58: "58 mm ticket", printerSel: "Printer of this computer", printerAsk: "Ask me every time",
    rawbt: "Bluetooth printer (RawBT app)", rawbtHint: "On Android phones: install the free “RawBT” app (Play Store), connect it to your Bluetooth ticket printer, then tick this box.",
    testPrint: "Test print", printErr: "Printing failed", printSent: "Sent to the printer", reportPrint: "Print", om: "Orange Money", moov: "Moov Money", wave: "Wave", bank: "Bank"
  };
  function L(k) { var en = (H().lang && H().lang() || "fr") !== "fr"; return (en ? EN[k] : FR[k]) || FR[k] || k; }
  var MODES = ["cash", "om", "moov", "wave", "bank"];
  function modeLabel(m) { return m === "cash" ? L("cashMode") : m === "credit" ? L("credit") : L(m) || m; }
  var EXP_CATS = ["loyer", "transport", "elec", "sal", "com", "tax", "march", "rep", "autre"];
  function catLabel(c) { return L("cat" + c.charAt(0).toUpperCase() + c.slice(1)) || c; }

  // ---------------- Outils ----------------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v) { var n = Number(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
  function money(n) { n = Math.round(Number(n) || 0); return (n < 0 ? "-" : "") + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F"; }
  function qtyFmt(n) { n = Math.round((Number(n) || 0) * 100) / 100; return String(n).replace(".", ","); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateFr(d) { if (!d) return ""; var p = String(d).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : d; }
  function dtFr(ms) { var d = new Date(ms); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function rid(p) { return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function toast(m) { if (H().toast) H().toast(m); else alert(m); }
  function isWide() { return window.innerWidth >= 900; }
  function profile() { return (H().profile && H().profile()) || null; }

  // ---------------- Stockage local (IndexedDB) ----------------
  var idb = null;
  function openDb() {
    return new Promise(function (res) {
      if (idb) return res(idb);
      try {
        var rq = indexedDB.open("sns_gestion", 1);
        rq.onupgradeneeded = function () {
          var d = rq.result;
          if (!d.objectStoreNames.contains("ops")) { var s = d.createObjectStore("ops", { keyPath: "key" }); s.createIndex("cid", "cid"); }
          if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "cid" });
        };
        rq.onsuccess = function () { idb = rq.result; res(idb); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function dbAll(cid) {
    return openDb().then(function (d) {
      if (!d) return [];
      return new Promise(function (res) {
        try { var rq = d.transaction("ops").objectStore("ops").index("cid").getAll(cid); rq.onsuccess = function () { res(rq.result || []); }; rq.onerror = function () { res([]); }; } catch (e) { res([]); }
      });
    });
  }
  function dbPut(rows) {
    return openDb().then(function (d) {
      if (!d || !rows.length) return;
      return new Promise(function (res) { try { var tx = d.transaction("ops", "readwrite"); var st = tx.objectStore("ops"); rows.forEach(function (r) { st.put(r); }); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
    });
  }
  function dbMeta(cid, val) {
    return openDb().then(function (d) {
      if (!d) return val || null;
      return new Promise(function (res) {
        try {
          var tx = d.transaction("meta", val ? "readwrite" : "readonly"), st = tx.objectStore("meta");
          if (val) { st.put(val); tx.oncomplete = function () { res(val); }; tx.onerror = function () { res(val); }; }
          else { var rq = st.get(cid); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; }
        } catch (e) { res(val || null); }
      });
    });
  }
  function dbClear(cid) {
    return dbAll(cid).then(function (rows) {
      return openDb().then(function (d) {
        if (!d) return;
        return new Promise(function (res) { try { var tx = d.transaction(["ops", "meta"], "readwrite"); rows.forEach(function (r) { tx.objectStore("ops").delete(r.key); }); tx.objectStore("meta").delete(cid); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
      });
    });
  }

  // ---------------- État de l'entreprise ouverte ----------------
  var S = null; // { cid, name, role, isOwner, expired, ops:{}, ent:{}, pending:[], lastSeq, meta, page, ... }
  function blankEnt() { var e = {}; ["item", "sale", "purchase", "expense", "client", "supplier", "payment", "employee", "adjust", "settings"].forEach(function (k) { e[k] = {}; }); return e; }
  function newer(a, b) { return !b || a.at > b.at || (a.at === b.at && String(a.id) > String(b.id)); }
  function applyOp(o) {
    var bucket = S.ent[o.k]; if (!bucket) return;
    var cur = bucket[o.e];
    if (cur && !newer(o, cur._op)) { (cur._hist = cur._hist || []).push(o); return; }
    var rec = o.a === "del" ? { _del: true } : JSON.parse(JSON.stringify(o.f || {}));
    rec.id = o.e; rec._op = { id: o.id, at: o.at }; rec._at = o.at; rec._by = o.by; rec._bn = o.bn;
    rec._hist = (cur && cur._hist ? cur._hist : []).concat(cur ? [cur._opFull] : []);
    rec._opFull = o;
    if (!cur) rec._created = o.at; else rec._created = cur._created || o.at;
    bucket[o.e] = rec;
  }
  function rebuild() {
    S.ent = blankEnt();
    var list = Object.keys(S.ops).map(function (k) { return S.ops[k]; });
    list.sort(function (a, b) { return a.at - b.at || (String(a.id) < String(b.id) ? -1 : 1); });
    list.forEach(applyOp);
  }
  function live(k) { var b = S.ent[k], out = []; for (var id in b) if (!b[id]._del) out.push(b[id]); return out; }
  function getE(k, id) { var r = S.ent[k][id]; return r && !r._del ? r : null; }
  function setting(key, def) { var s = getE("settings", "main"); return s && s[key] !== undefined ? s[key] : def; }

  function can(action) {
    var r = S.role;
    if (S.expired) return false;
    if (r === "chef" || r === "comptable") return action !== "members";
    if (r === "caissier") return action === "sale" || action === "client" || action === "cpay";
    return false;
  }
  function isChef() { return S.role === "chef"; }

  // Saisir une ligne : gardée tout de suite dans l'appareil, envoyée ensuite.
  function write(k, e, f, del) {
    var p = profile() || {};
    var o = { id: rid("op_"), k: k, e: e, a: del ? "del" : "put", f: del ? null : f, at: Date.now(), by: p.id || "", bn: p.name || "", local: true };
    S.ops[o.id] = o; applyOp(o);
    S.pending.push(o.id);
    dbPut([{ key: S.cid + "|" + o.id, cid: S.cid, op: o, pending: true }]);
    schedulePush(400);
    return o;
  }

  // ---------------- Échanges avec le serveur ----------------
  function api(op, body) {
    var h = H();
    if (!h.url) return Promise.resolve({ success: false, error: "no_host" });
    body = body || {}; body.operation = op;
    return fetch(h.url + "/functions/v1/gestion-sync", { method: "POST", headers: h.headers(), body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { success: false, error: "bad_json" }; }); })
      .catch(function () { return { success: false, error: "network_error" }; });
  }
  var pushTimer = null, pulling = false, pushing = false, pullTimer = null;
  function schedulePush(ms) { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, ms || 1500); }
  function pushNow() {
    if (!S || pushing || !S.pending.length) return Promise.resolve();
    if (navigator.onLine === false) { paintSync(); return Promise.resolve(); }
    pushing = true; paintSync();
    var cid = S.cid, ids = S.pending.slice(0, 150);
    var ops = ids.map(function (id) { var o = S.ops[id]; return o ? { id: o.id, k: o.k, e: o.e, a: o.a, f: o.f, at: o.at } : null; }).filter(Boolean);
    return api("push", { companyId: cid, ops: ops }).then(function (r) {
      pushing = false;
      if (!S || S.cid !== cid) return;
      if (!r.success) {
        if (r.error === "subscription_required") { S.expired = true; render(); }
        else if (r.error === "not_member") { toast(L("forbidden")); }
        paintSync(); return;
      }
      var done = {}; (r.accepted || []).forEach(function (id) { done[id] = 1; });
      var refused = (r.rejected || []);
      refused.forEach(function (x) { done[x.id] = 1; var o = S.ops[x.id]; if (o) { delete S.ops[x.id]; } });
      S.pending = S.pending.filter(function (id) { return !done[id]; });
      var rows = []; (r.accepted || []).forEach(function (id) { var o = S.ops[id]; if (o) { o.local = false; rows.push({ key: cid + "|" + id, cid: cid, op: o, pending: false }); } });
      dbPut(rows);
      if (refused.length) {
        openDb().then(function (d) { if (!d) return; try { var tx = d.transaction("ops", "readwrite"); refused.forEach(function (x) { tx.objectStore("ops").delete(cid + "|" + x.id); }); } catch (e) {} });
        rebuild(); render(); toast(refused.length + " " + L("serverRefused"));
      }
      paintSync();
      if (S.pending.length) schedulePush(300); else pullNow();
    });
  }
  function pullNow() {
    if (!S || pulling) return Promise.resolve();
    if (navigator.onLine === false) { paintSync(); return Promise.resolve(); }
    pulling = true; paintSync();
    var cid = S.cid;
    return api("pull", { companyId: cid, since: S.lastSeq, limit: 800 }).then(function (r) {
      pulling = false;
      if (!S || S.cid !== cid) return;
      if (!r.success) {
        if (r.error === "not_member") { kicked(); return; }
        paintSync(); return;
      }
      var changed = r.role !== S.role || r.expired !== S.expired || r.name !== S.name;
      S.role = r.role; S.expired = !!r.expired; S.name = r.name; S.paidUntil = r.paidUntil; S.plan = r.plan;
      var rows = [], outOfOrder = false;
      (r.ops || []).forEach(function (o) {
        if (o.s > S.lastSeq) S.lastSeq = o.s;
        var mine = S.ops[o.id];
        if (mine && !mine.local) return;
        o.local = false; S.ops[o.id] = o;
        if (mine) { S.pending = S.pending.filter(function (x) { return x !== o.id; }); return; }
        var cur = S.ent[o.k] && S.ent[o.k][o.e];
        if (cur && !newer(o, cur._op)) outOfOrder = true; else applyOp(o);
        rows.push({ key: cid + "|" + o.id, cid: cid, op: o, pending: false });
        changed = true;
      });
      if (outOfOrder) rebuild();
      dbPut(rows);
      S.meta.lastSeq = S.lastSeq; S.meta.name = S.name; S.meta.role = S.role; dbMeta(cid, S.meta);
      if (changed) render(); else paintSync();
      if (r.more) pullNow();
    });
  }
  function kicked() {
    var cid = S.cid; toast(L("forbidden")); dbClear(cid); close();
    if (H().refreshRoles) H().refreshRoles();
  }
  window.addEventListener("online", function () { if (S) { pushNow(); pullNow(); } });
  window.addEventListener("offline", function () { paintSync(); });

  // ---------------- Ouverture ----------------
  var root = null;
  function open(company) {
    if (!company || !company.id) return;
    injectCss();
    if (!root) { root = document.createElement("div"); root.id = "gx-root"; document.body.appendChild(root); bindEvents(); }
    root.style.display = "";
    document.documentElement.classList.add("gx-open");
    S = { cid: company.id, name: company.name, role: company.role, isOwner: !!company.isOwner, ownerId: company.ownerId, expired: !!company.expired,
      plan: company.plan, paidUntil: company.paidUntil, ops: {}, ent: blankEnt(), pending: [], lastSeq: 0, meta: { cid: company.id }, page: "home", modal: null,
      q: "", period: "month", locked: false, loading: true };
    try { history.pushState({ gx: 1 }, ""); } catch (e) {}
    render();
    var cid = company.id;
    Promise.all([dbAll(cid), dbMeta(cid)]).then(function (res) {
      if (!S || S.cid !== cid) return;
      var rows = res[0], meta = res[1];
      rows.forEach(function (r) { S.ops[r.op.id] = r.op; if (r.pending) S.pending.push(r.op.id); });
      if (meta) { S.meta = meta; S.lastSeq = meta.lastSeq || 0; }
      S.meta.cid = cid;
      rebuild(); S.loading = false;
      S.locked = !!localPin();
      render();
      pushNow(); pullNow();
      setTimeout(importSounsouniSales, 2500);
      clearInterval(pullTimer);
      pullTimer = setInterval(function () { if (S && document.visibilityState === "visible") { pullNow(); if (S.pending.length) pushNow(); } }, 20000);
    });
  }
  function close() {
    clearInterval(pullTimer);
    if (S && S.pending.length) pushNow();
    S = null;
    if (root) { root.className = ""; root.innerHTML = ""; }
    document.documentElement.classList.remove("gx-open");
  }
  window.addEventListener("popstate", function () { if (!S) return; if (S.modal) { S.modal = null; render(); try { history.pushState({ gx: 1 }, ""); } catch (e) {} } else close(); });

  // ---------------- Code PIN (propre à cet appareil) ----------------
  function pinKey() { return "sns_gx_pin_" + S.cid + "_" + ((profile() || {}).id || ""); }
  function localPin() { try { return localStorage.getItem(pinKey()); } catch (e) { return null; } }
  function hashPin(p) {
    var s = "sns|" + S.cid + "|" + p;
    if (window.crypto && crypto.subtle && window.TextEncoder) return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Promise.resolve("h" + h);
  }

  // ---------------- Calculs ----------------
  function saleLines(s) { return Array.isArray(s.lines) ? s.lines : []; }
  function stockMap() {
    var m = {};
    live("adjust").forEach(function (a) { m[a.item] = (m[a.item] || 0) + num(a.qty); });
    live("purchase").forEach(function (p) { (p.lines || []).forEach(function (l) { if (l.item) m[l.item] = (m[l.item] || 0) + num(l.qty); }); });
    live("sale").forEach(function (s) { saleLines(s).forEach(function (l) { if (l.item) m[l.item] = (m[l.item] || 0) - num(l.qty); }); });
    return m;
  }
  function clientBalances() {
    var b = {};
    live("sale").forEach(function (s) { if (s.client) b[s.client] = (b[s.client] || 0) + num(s.total) - num(s.paid); });
    live("payment").forEach(function (p) { if (p.side === "client" && p.party) b[p.party] = (b[p.party] || 0) - num(p.amount); });
    return b;
  }
  function supplierBalances() {
    var b = {};
    live("purchase").forEach(function (s) { if (s.supplier) b[s.supplier] = (b[s.supplier] || 0) + num(s.total) - num(s.paid); });
    live("payment").forEach(function (p) { if (p.side === "supplier" && p.party) b[p.party] = (b[p.party] || 0) - num(p.amount); });
    return b;
  }
  function periodRange(p) {
    var d = new Date(), y = d.getFullYear(), mo = d.getMonth(), from, to = today();
    if (p === "today") from = to;
    else if (p === "week") { var w = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY); from = w.getFullYear() + "-" + pad(w.getMonth() + 1) + "-" + pad(w.getDate()); }
    else if (p === "year") from = y + "-01-01";
    else if (p === "custom") { from = S.pFrom || (y + "-" + pad(mo + 1) + "-01"); to = S.pTo || to; }
    else from = y + "-" + pad(mo + 1) + "-01";
    return [from, to];
  }
  function inRange(d, r) { return d >= r[0] && d <= r[1]; }
  function figures(r) {
    var f = { revenue: 0, cogs: 0, expenses: 0, salesN: 0, cashIn: 0, cashOut: 0, byCat: {}, byItem: {}, byDay: {}, purchases: 0 };
    live("sale").forEach(function (s) {
      if (!inRange(s.d, r)) return;
      f.salesN++; f.revenue += num(s.total); f.cashIn += num(s.paid);
      f.byDay[s.d] = (f.byDay[s.d] || 0) + num(s.total);
      saleLines(s).forEach(function (l) {
        f.cogs += num(l.cost) * num(l.qty);
        var key = l.item || ("txt:" + l.name);
        var bi = f.byItem[key] || (f.byItem[key] = { name: l.name, qty: 0, total: 0, margin: 0 });
        bi.qty += num(l.qty); bi.total += num(l.qty) * num(l.price); bi.margin += num(l.qty) * (num(l.price) - num(l.cost));
      });
      // remise éventuelle : le total peut être plus petit que la somme des lignes
    });
    live("expense").forEach(function (x) { if (!inRange(x.d, r)) return; f.expenses += num(x.amount); f.cashOut += num(x.amount); f.byCat[x.cat || "autre"] = (f.byCat[x.cat || "autre"] || 0) + num(x.amount); });
    live("purchase").forEach(function (p) { if (!inRange(p.d, r)) return; f.purchases += num(p.total); f.cashOut += num(p.paid); });
    live("payment").forEach(function (p) { if (!inRange(p.d, r)) return; if (p.side === "client") f.cashIn += num(p.amount); else f.cashOut += num(p.amount); });
    f.margin = f.revenue - f.cogs; f.net = f.margin - f.expenses;
    return f;
  }
  function cashTotal() {
    var t = num(setting("openingCash", 0));
    live("sale").forEach(function (s) { t += num(s.paid); });
    live("payment").forEach(function (p) { t += p.side === "client" ? num(p.amount) : -num(p.amount); });
    live("purchase").forEach(function (p) { t -= num(p.paid); });
    live("expense").forEach(function (x) { t -= num(x.amount); });
    return t;
  }
  function itemName(id) { var i = getE("item", id); return i ? i.name : ""; }
  function partyName(k, id) { var p = getE(k, id); return p ? p.name : ""; }

  // ---------------- Import des ventes Sounsouni ----------------
  // Sur l'appareil du propriétaire : chaque commande Sounsouni livrée devient
  // une vente (identifiant fixe → jamais en double, même sur deux appareils).
  function importSounsouniSales() {
    if (!S || !S.isOwner || !can("sale")) return;
    var shopId = S.ownerId, orders = (H().orders && H().orders()) || [];
    var n = 0;
    orders.forEach(function (o) {
      if (!o || o.status !== "Livrée" || !Array.isArray(o.items)) return;
      var mine = o.items.filter(function (it) { return it && it.sellerId === shopId && !it.refused; });
      if (!mine.length) return;
      var e = "sns_" + o.id;
      if (S.ent.sale[e]) return;
      var d = new Date(o.deliveredAt || o.createdAt || Date.now());
      var lines = mine.map(function (it) {
        var gi = getE("item", "snsp_" + it.productId);
        return { item: gi ? gi.id : null, name: String(it.name || it.productName || (gi && gi.name) || "Article").slice(0, 80), qty: num(it.qty) || 1, price: num(it.price), cost: gi ? num(gi.cost) : 0 };
      });
      var total = lines.reduce(function (a, l) { return a + l.qty * l.price; }, 0);
      write("sale", e, { d: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), lines: lines, total: total, paid: total, mode: "sounsouni", client: null, note: "Commande Sounsouni #" + String(o.id).slice(-5).toUpperCase(), src: "sounsouni" });
      n++;
    });
    if (n) render();
  }
  function importSounsouniItems() {
    var prods = (H().myProducts && H().myProducts(S.ownerId)) || [];
    var n = 0;
    prods.forEach(function (p) {
      var e = "snsp_" + p.id;
      if (S.ent.item[e]) return;
      write("item", e, { name: String(p.name || "").slice(0, 80), type: "article", price: num(p.price), cost: 0, unit: "", cat: String(p.category || "").slice(0, 40), alertAt: 2, sns: p.id });
      if (typeof p.stock === "number" && p.stock > 0) write("adjust", rid("adj_"), { item: e, qty: p.stock, d: today(), note: L("initialStock") });
      n++;
    });
    toast(n + " " + L("importDone")); render();
  }

  // ---------------- Affichage ----------------
  var NAV = [
    ["home", "fa-house"], ["sales", "fa-cash-register"], ["items", "fa-boxes-stacked"], ["expenses", "fa-money-bill-wave"], ["purchases", "fa-truck-ramp-box"],
    ["clients", "fa-users"], ["suppliers", "fa-industry"], ["employees", "fa-id-badge"], ["reports", "fa-chart-column"], ["ohada", "fa-scale-balanced"], ["members", "fa-user-shield"], ["settings", "fa-gear"]
  ];
  function allowedPages() {
    var r = S.role;
    var oh = !!setting("ohada", false);
    if (r === "partenaire") return oh ? ["home", "reports", "ohada", "members"] : ["home", "reports", "members"];
    if (r === "caissier") return ["home", "sales", "items", "clients", "members"];
    return NAV.map(function (n) { return n[0]; }).filter(function (p) { return p !== "ohada" || oh; });
  }
  function render() {
    if (!S || !root) return;
    var wide = isWide();
    root.className = "gx " + (wide ? "gx-wide" : "gx-narrow") + (document.body.classList.contains("dark-mode") ? " gx-dark" : "");
    if (S.loading || S.locked) root.className = "gx" + (document.body.classList.contains("dark-mode") ? " gx-dark" : "");
    if (S.loading) { root.innerHTML = '<div class="gx-center"><i class="fa-solid fa-spinner fa-spin"></i> ' + L("loading") + '</div>'; return; }
    if (S.locked) { root.innerHTML = renderPin(); var pi = document.getElementById("gx-pin"); if (pi) setTimeout(function () { pi.focus(); }, 50); return; }
    var pages = allowedPages();
    if (pages.indexOf(S.page) < 0 && S.page !== "more") S.page = "home";
    var html = "";
    if (wide) {
      html += '<aside class="gx-side"><div class="gx-brand"><img src="icons/icon-192-any.png" alt=""><div><b>' + L("app") + '</b><span>' + esc(S.name) + '</span></div></div><nav>';
      NAV.forEach(function (n) { if (pages.indexOf(n[0]) >= 0) html += '<button class="gx-nav' + (S.page === n[0] ? ' on' : '') + '" data-a="page" data-v="' + n[0] + '"><i class="fa-solid ' + n[1] + '"></i>' + L(n[0]) + '</button>'; });
      html += '</nav><div class="gx-side-foot"><span class="gx-role">' + L(S.role) + '</span><button class="gx-btn gx-ghost" data-a="close"><i class="fa-solid fa-arrow-left"></i> Sounsouni</button></div></aside>';
      html += '<main class="gx-main"><header class="gx-top"><h1>' + L(S.page) + '</h1><div class="gx-top-r"><span id="gx-sync"></span>' + topActions() + '</div></header>' + banners() + '<div class="gx-content">' + page() + '</div></main>';
    } else {
      html += '<header class="gx-top"><button class="gx-icon" data-a="close" aria-label="' + L("close") + '"><i class="fa-solid fa-arrow-left"></i></button><div class="gx-title"><b>' + esc(S.name) + '</b><span>' + L(S.page) + ' · ' + L(S.role) + '</span></div><span id="gx-sync"></span></header>';
      html += '<main class="gx-main">' + banners() + '<div class="gx-actions-m">' + topActions() + '</div><div class="gx-content">' + page() + '</div></main>';
      var bottom = pages.slice(0, 4); if (pages.length > 4) bottom.push("more");
      html += '<nav class="gx-bottom">';
      bottom.forEach(function (p) { var ic = p === "more" ? "fa-ellipsis" : NAV.filter(function (n) { return n[0] === p; })[0][1]; var on = p === S.page || (p === "more" && bottom.indexOf(S.page) < 0); html += '<button class="' + (on ? 'on' : '') + '" data-a="page" data-v="' + p + '"><i class="fa-solid ' + ic + '"></i><span>' + L(p) + '</span></button>'; });
      html += '</nav>';
    }
    html += '<div id="gx-modal">' + (S.modal ? modalHtml() : "") + '</div>';
    root.innerHTML = html;
    paintSync();
  }
  function renderModalOnly() { var m = document.getElementById("gx-modal"); if (m) m.innerHTML = S.modal ? modalHtml() : ""; }
  function paintSync() {
    var el = document.getElementById("gx-sync"); if (!el || !S) return;
    var n = S.pending.length, off = navigator.onLine === false;
    var cls = off ? "off" : n ? "wait" : "ok";
    var txt = off ? '<i class="fa-solid fa-wifi"></i> ' + L("offline") + (n ? " · " + n + " " + L("pending") : "")
      : n ? '<i class="fa-solid fa-cloud-arrow-up"></i> ' + n + " " + L("syncWait") : (pulling || pushing ? '<i class="fa-solid fa-rotate fa-spin"></i> ' + L("syncing") : '<i class="fa-solid fa-circle-check"></i> ' + L("syncOk"));
    el.className = "gx-sync " + cls; el.innerHTML = txt;
  }
  function banners() {
    var h = "";
    if (S.expired) h += '<div class="gx-banner bad"><i class="fa-solid fa-lock"></i> ' + L("subExpired") + (isChef() ? ' <button class="gx-btn" data-a="pay">' + L("payNow") + '</button>' : '') + '</div>';
    if (S.role === "partenaire") h += '<div class="gx-banner"><i class="fa-solid fa-eye"></i> ' + L("partnerHint") + '</div>';
    if ((S.role === "chef" || S.role === "comptable") && Object.keys(S.ops).length > 20) {
      var lb = S.meta.lastBackup || 0;
      if (Date.now() - lb > 7 * DAY) h += '<div class="gx-banner warn"><i class="fa-solid fa-floppy-disk"></i> ' + L("backupLate") + ' <button class="gx-btn" data-a="backup-share">' + L("backup") + '</button></div>';
    }
    return h;
  }
  function topActions() {
    var h = "";
    if (S.page === "home" || S.page === "sales") { if (can("sale")) h += '<button class="gx-btn gx-primary" data-a="new" data-v="sale"><i class="fa-solid fa-plus"></i> ' + L("newSale") + '</button>'; }
    if (S.page === "home" && can("expense")) h += '<button class="gx-btn" data-a="new" data-v="expense"><i class="fa-solid fa-minus"></i> ' + L("newExpense") + '</button>';
    var map = { purchases: ["purchase", "newPurchase"], expenses: ["expense", "newExpense"], items: ["item", "newItem"], clients: ["client", "newClient"], suppliers: ["supplier", "newSupplier"], employees: ["employee", "newEmployee"] };
    var m = map[S.page];
    if (m && can(m[0] === "client" ? "client" : m[0])) h += '<button class="gx-btn gx-primary" data-a="new" data-v="' + m[0] + '"><i class="fa-solid fa-plus"></i> ' + L(m[1]) + '</button>';
    if (S.page === "reports") h += '<button class="gx-btn" data-a="csv"><i class="fa-solid fa-file-csv"></i> ' + L("exportCsv") + '</button>';
    if (S.page === "ohada") h += '<button class="gx-btn" data-a="csv-ohada"><i class="fa-solid fa-file-csv"></i> ' + L("exportCsv") + '</button>';
    if (S.page === "reports" || S.page === "ohada") h += '<button class="gx-btn" data-a="print-page"><i class="fa-solid fa-print"></i> ' + L("reportPrint") + '</button>';
    return h;
  }
  function page() {
    switch (S.page) {
      case "home": return pHome();
      case "sales": return pSales();
      case "purchases": return pPurchases();
      case "expenses": return pExpenses();
      case "items": return pItems();
      case "clients": return pParties("client");
      case "suppliers": return pParties("supplier");
      case "employees": return pEmployees();
      case "reports": return pReports();
      case "members": return pMembers();
      case "settings": return pSettings();
      case "more": return pMore();
      case "ohada": return pOhada();
    }
    return "";
  }
  function kpi(label, value, cls, icon) { return '<div class="gx-kpi ' + (cls || "") + '"><span><i class="fa-solid ' + (icon || "fa-circle") + '"></i> ' + label + '</span><b>' + value + '</b></div>'; }
  function empty() { return '<div class="gx-empty"><i class="fa-regular fa-folder-open"></i><p>' + L("noData") + '</p></div>'; }
  function searchBox() { return '<input class="gx-search" id="gx-q" data-f="q" placeholder="' + L("search") + '" value="' + esc(S.q) + '">'; }
  function match(s) { return !S.q || String(s || "").toLowerCase().indexOf(S.q.toLowerCase()) >= 0; }

  function pHome() {
    var h = "", r = periodRange("today"), fT = figures(r), fM = figures(periodRange("month"));
    var st = stockMap(), low = [], neg = [];
    live("item").forEach(function (i) { if (i.type === "service") return; var q = st[i.id] || 0; if (q < 0) neg.push(i); else if (q <= num(i.alertAt)) low.push(i); });
    if (!live("item").length && !live("sale").length && can("sale")) h += '<div class="gx-card gx-hello"><h2>' + L("welcome") + '</h2><p>' + L("startHint") + '</p>' + (S.isOwner && H().myProducts && H().myProducts(S.ownerId).length ? '<button class="gx-btn" data-a="import-items"><i class="fa-solid fa-download"></i> ' + L("importItems") + '</button>' : '') + '</div>';
    if (S.role === "caissier") h += '<div class="gx-banner"><i class="fa-solid fa-cash-register"></i> ' + L("caisseHint") + '</div>';
    h += '<div class="gx-kpis">';
    h += kpi(L("today") + " — " + L("revenue"), money(fT.revenue), "green", "fa-sun");
    if (S.role !== "caissier") {
      h += kpi(L("month") + " — " + L("revenue"), money(fM.revenue), "", "fa-calendar");
      h += kpi(L("month") + " — " + L("netProfit"), money(fM.net), fM.net < 0 ? "red" : "green", "fa-sack-dollar");
      h += kpi(L("cash"), money(cashTotal()), "", "fa-wallet");
      var cb = clientBalances(), owed = 0; for (var k in cb) if (cb[k] > 0) owed += cb[k];
      h += kpi(L("owedByClients"), money(owed), owed ? "warn" : "", "fa-hand-holding-dollar");
      var sb = supplierBalances(), owe = 0; for (var k2 in sb) if (sb[k2] > 0) owe += sb[k2];
      h += kpi(L("owedToSuppliers"), money(owe), owe ? "warn" : "", "fa-file-invoice-dollar");
    }
    h += '</div>';
    if ((neg.length || low.length) && S.role !== "partenaire") {
      h += '<div class="gx-card"><h3><i class="fa-solid fa-triangle-exclamation"></i> ' + L("alerts") + '</h3><div class="gx-chips">';
      neg.forEach(function (i) { h += '<button class="gx-chip bad" data-a="open" data-k="item" data-v="' + esc(i.id) + '">' + esc(i.name) + ' : ' + qtyFmt(st[i.id]) + ' — ' + L("negStock") + '</button>'; });
      low.forEach(function (i) { h += '<button class="gx-chip warn" data-a="open" data-k="item" data-v="' + esc(i.id) + '">' + esc(i.name) + ' : ' + qtyFmt(st[i.id] || 0) + '</button>'; });
      h += '</div></div>';
    }
    // Dernières opérations
    var lastOps = [];
    live("sale").forEach(function (s) { lastOps.push({ at: s._created, k: "sale", r: s, t: (s.client ? partyName("client", s.client) + " · " : "") + saleLines(s).map(function (l) { return l.name; }).join(", "), v: num(s.total), sign: 1 }); });
    if (S.role !== "caissier") {
      live("expense").forEach(function (x) { lastOps.push({ at: x._created, k: "expense", r: x, t: catLabel(x.cat || "autre") + (x.note ? " · " + x.note : ""), v: num(x.amount), sign: -1 }); });
      live("purchase").forEach(function (p) { lastOps.push({ at: p._created, k: "purchase", r: p, t: L("purchases") + (p.supplier ? " · " + partyName("supplier", p.supplier) : ""), v: num(p.total), sign: -1 }); });
    }
    lastOps.sort(function (a, b) { return b.at - a.at; });
    h += '<div class="gx-card"><h3>' + L("lastOps") + '</h3>';
    if (!lastOps.length) h += empty();
    else {
      h += '<div class="gx-list">';
      lastOps.slice(0, 12).forEach(function (x) { h += row(x.k, x.r, x.t, (x.sign < 0 ? "-" : "") + money(x.v), dateFr(x.r.d) + " · " + esc(x.r._bn || ""), x.sign < 0 ? "red" : "green"); });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }
  function row(k, r, title, value, sub, cls) {
    return '<button class="gx-row" data-a="open" data-k="' + k + '" data-v="' + esc(r.id) + '"><div class="gx-row-t"><b>' + esc(title) + '</b><span>' + sub + '</span></div><div class="gx-row-v ' + (cls || "") + '">' + value + '</div></button>';
  }
  function table(cols, rows) {
    // grand écran : vrai tableau ; téléphone : lignes empilées
    if (!rows.length) return empty();
    if (!isWide()) {
      var h = '<div class="gx-list">';
      rows.forEach(function (r) { h += '<button class="gx-row" data-a="open" data-k="' + r.k + '" data-v="' + esc(r.id) + '"><div class="gx-row-t"><b>' + r.c[0] + '</b><span>' + r.c.slice(1, cols.length - 1).filter(function (x) { return x !== "" && x != null; }).join(" · ") + '</span></div><div class="gx-row-v ' + (r.cls || "") + '">' + r.c[cols.length - 1] + '</div></button>'; });
      return h + '</div>';
    }
    var t = '<div class="gx-table-wrap"><table class="gx-table"><thead><tr>';
    cols.forEach(function (c, i) { t += '<th' + (c.r ? ' class="r"' : '') + '>' + c.t + '</th>'; });
    t += '</tr></thead><tbody>';
    rows.forEach(function (r) { t += '<tr data-a="open" data-k="' + r.k + '" data-v="' + esc(r.id) + '">'; r.c.forEach(function (v, i) { t += '<td' + (cols[i].r ? ' class="r' + (i === cols.length - 1 && r.cls ? " " + r.cls : "") + '"' : '') + '>' + v + '</td>'; }); t += '</tr>'; });
    return t + '</tbody></table></div>';
  }
  function periodBar() {
    var h = '<div class="gx-periods">';
    ["today", "week", "month", "year", "custom"].forEach(function (p) { h += '<button class="' + (S.period === p ? 'on' : '') + '" data-a="period" data-v="' + p + '">' + (p === "custom" ? L("period") : L(p)) + '</button>'; });
    h += '</div>';
    if (S.period === "custom") { var r = periodRange("custom"); h += '<div class="gx-custom">' + L("from") + ' <input type="date" data-f="pFrom" value="' + r[0] + '"> ' + L("to") + ' <input type="date" data-f="pTo" value="' + r[1] + '"></div>'; }
    return h;
  }
  function pSales() {
    var r = periodRange(S.period), list = live("sale").filter(function (s) { return inRange(s.d, r) && (S.role !== "caissier" || s._by === (profile() || {}).id || !s._by); })
      .filter(function (s) { return match(saleLines(s).map(function (l) { return l.name; }).join(" ") + " " + partyName("client", s.client) + " " + (s.note || "")); });
    list.sort(function (a, b) { return (b.d + b._created) > (a.d + a._created) ? 1 : -1; });
    var tot = list.reduce(function (a, s) { return a + num(s.total); }, 0);
    var h = periodBar() + '<div class="gx-toolbar">' + searchBox() + '<span class="gx-sum">' + list.length + ' ' + L("salesCount") + ' · <b>' + money(tot) + '</b></span></div>';
    h += table([{ t: L("desc") }, { t: L("date") }, { t: L("client") }, { t: L("mode") }, { t: L("seller") }, { t: L("total"), r: 1 }], list.map(function (s) {
      var rest = num(s.total) - num(s.paid);
      return { k: "sale", id: s.id, cls: rest > 0 ? "warn" : "green", c: [esc(saleLines(s).map(function (l) { return qtyFmt(l.qty) + "× " + l.name; }).join(", ") || "—"), dateFr(s.d), esc(partyName("client", s.client) || ""), esc(s.mode === "sounsouni" ? "Sounsouni" : modeLabel(s.mode)) + (rest > 0 ? ' <em class="gx-tag warn">' + L("rest") + " " + money(rest) + '</em>' : ''), esc(s._bn || ""), money(s.total)] };
    }));
    return h;
  }
  function pPurchases() {
    var r = periodRange(S.period), list = live("purchase").filter(function (p) { return inRange(p.d, r) && match((p.lines || []).map(function (l) { return l.name; }).join(" ") + partyName("supplier", p.supplier)); });
    list.sort(function (a, b) { return b.d > a.d ? 1 : -1; });
    var tot = list.reduce(function (a, s) { return a + num(s.total); }, 0);
    return periodBar() + '<div class="gx-toolbar">' + searchBox() + '<span class="gx-sum">' + list.length + ' · <b>' + money(tot) + '</b></span></div>' +
      table([{ t: L("desc") }, { t: L("date") }, { t: L("supplier") }, { t: L("rest"), r: 1 }, { t: L("total"), r: 1 }], list.map(function (p) {
        var rest = num(p.total) - num(p.paid);
        return { k: "purchase", id: p.id, cls: "red", c: [esc((p.lines || []).map(function (l) { return qtyFmt(l.qty) + "× " + l.name; }).join(", ")), dateFr(p.d), esc(partyName("supplier", p.supplier)), rest > 0 ? money(rest) : "", money(p.total)] };
      }));
  }
  function pExpenses() {
    var r = periodRange(S.period), list = live("expense").filter(function (x) { return inRange(x.d, r) && match(catLabel(x.cat || "autre") + " " + (x.note || "")); });
    list.sort(function (a, b) { return b.d > a.d ? 1 : -1; });
    var tot = list.reduce(function (a, s) { return a + num(s.amount); }, 0);
    return periodBar() + '<div class="gx-toolbar">' + searchBox() + '<span class="gx-sum">' + list.length + ' · <b>' + money(tot) + '</b></span></div>' +
      table([{ t: L("category") }, { t: L("date") }, { t: L("note") }, { t: L("mode") }, { t: L("amount"), r: 1 }], list.map(function (x) {
        return { k: "expense", id: x.id, cls: "red", c: [esc(catLabel(x.cat || "autre")) + (x.employee ? " · " + esc(partyName("employee", x.employee)) : ""), dateFr(x.d), esc(x.note || ""), esc(modeLabel(x.mode)), money(x.amount)] };
      }));
  }
  function pItems() {
    var st = stockMap();
    var list = live("item").filter(function (i) { return match(i.name + " " + (i.cat || "")) && (!S.hideZero || i.type === "service" || (st[i.id] || 0) !== 0); });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var val = 0; live("item").forEach(function (i) { if (i.type !== "service") val += Math.max(0, st[i.id] || 0) * num(i.cost); });
    var h = '<div class="gx-toolbar">' + searchBox() + '<label class="gx-check"><input type="checkbox" data-a="hidezero"' + (S.hideZero ? " checked" : "") + '> ' + L("hideZero") + '</label>' + (S.role !== "caissier" ? '<span class="gx-sum">' + L("stockValue") + ' : <b>' + money(val) + '</b></span>' : '') + '</div>';
    if (S.isOwner && can("item") && H().myProducts && H().myProducts(S.ownerId).length) h += '<button class="gx-btn gx-small" data-a="import-items"><i class="fa-solid fa-download"></i> ' + L("importItems") + '</button>';
    h += table([{ t: L("name") }, { t: L("category") }, { t: L("price"), r: 1 }, { t: L("cost"), r: 1 }, { t: L("stock"), r: 1 }], list.map(function (i) {
      var q = st[i.id] || 0, svc = i.type === "service";
      return { k: "item", id: i.id, cls: svc ? "" : q < 0 ? "red" : q <= num(i.alertAt) ? "warn" : "green", c: [esc(i.name) + (svc ? ' <em class="gx-tag">' + L("service") + '</em>' : ''), esc(i.cat || ""), money(i.price), S.role === "caissier" ? "" : money(i.cost), svc ? "—" : qtyFmt(q) + (i.unit ? " " + esc(i.unit) : "")] };
    }));
    return h;
  }
  function pParties(k) {
    var bal = k === "client" ? clientBalances() : supplierBalances();
    var list = live(k).filter(function (p) { return match(p.name + " " + (p.phone || "")); });
    list.sort(function (a, b) { return (bal[b.id] || 0) - (bal[a.id] || 0) || a.name.localeCompare(b.name); });
    return '<div class="gx-toolbar">' + searchBox() + '</div>' + table([{ t: L("name") }, { t: L("phone") }, { t: L("note") }, { t: k === "client" ? L("owes") : L("weOwe"), r: 1 }], list.map(function (p) {
      var b = bal[p.id] || 0;
      return { k: k, id: p.id, cls: b > 0 ? "warn" : "", c: [esc(p.name), esc(p.phone || ""), esc(p.note || ""), b ? money(b) : "—"] };
    }));
  }
  function pEmployees() {
    var list = live("employee").filter(function (p) { return match(p.name + " " + (p.position || "")); });
    return '<div class="gx-toolbar">' + searchBox() + '</div>' + table([{ t: L("name") }, { t: L("position") }, { t: L("phone") }, { t: L("salary"), r: 1 }], list.map(function (p) {
      return { k: "employee", id: p.id, c: [esc(p.name), esc(p.position || ""), esc(p.phone || ""), money(p.salary)] };
    }));
  }
  function bars(map, fmtKey) {
    var keys = Object.keys(map).sort(), max = 0; keys.forEach(function (k) { if (map[k] > max) max = map[k]; });
    if (!keys.length) return empty();
    var h = '<div class="gx-bars">';
    keys.forEach(function (k) { var pct = max ? Math.max(2, Math.round(map[k] / max * 100)) : 0; h += '<div class="gx-bar" title="' + esc(fmtKey(k)) + ' : ' + money(map[k]) + '"><i style="height:' + pct + '%"></i><span>' + esc(fmtKey(k)) + '</span></div>'; });
    return h + '</div>';
  }
  function pReports() {
    var r = periodRange(S.period), f = figures(r);
    var h = periodBar() + '<div class="gx-kpis">';
    h += kpi(L("revenue"), money(f.revenue), "", "fa-arrow-trend-up");
    h += kpi(L("cogs"), money(f.cogs), "", "fa-boxes-stacked");
    h += kpi(L("grossMargin"), money(f.margin), f.margin < 0 ? "red" : "green", "fa-percent");
    h += kpi(L("expenses"), money(f.expenses), "red", "fa-money-bill-wave");
    h += kpi(L("netProfit"), money(f.net), f.net < 0 ? "red" : "green", "fa-sack-dollar");
    h += kpi(L("purchases"), money(f.purchases), "", "fa-truck-ramp-box");
    h += kpi(L("cashIn"), money(f.cashIn), "green", "fa-circle-arrow-down");
    h += kpi(L("cashOut"), money(f.cashOut), "red", "fa-circle-arrow-up");
    h += '</div><div class="gx-grid2">';
    h += '<div class="gx-card"><h3>' + L("salesDay") + '</h3>' + bars(f.byDay, function (k) { return k.slice(8) + "/" + k.slice(5, 7); }) + '</div>';
    h += '<div class="gx-card"><h3>' + L("byCategory") + '</h3>';
    var cats = Object.keys(f.byCat).sort(function (a, b) { return f.byCat[b] - f.byCat[a]; });
    if (!cats.length) h += empty(); else { h += '<div class="gx-list">'; cats.forEach(function (c) { var pct = f.expenses ? Math.round(f.byCat[c] / f.expenses * 100) : 0; h += '<div class="gx-line"><span>' + esc(catLabel(c)) + '</span><div class="gx-meter"><i style="width:' + pct + '%"></i></div><b>' + money(f.byCat[c]) + '</b></div>'; }); h += '</div>'; }
    h += '</div></div>';
    var items = Object.keys(f.byItem).map(function (k) { return f.byItem[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 15);
    h += '<div class="gx-card"><h3>' + L("topItems") + '</h3>' + (items.length ? (function () {
      var t = '<div class="gx-table-wrap"><table class="gx-table"><thead><tr><th>' + L("article") + '</th><th class="r">' + L("sold") + '</th><th class="r">' + L("total") + '</th><th class="r">' + L("margin") + '</th></tr></thead><tbody>';
      items.forEach(function (i) { t += '<tr><td>' + esc(i.name) + '</td><td class="r">' + qtyFmt(i.qty) + '</td><td class="r">' + money(i.total) + '</td><td class="r ' + (i.margin < 0 ? "red" : "green") + '">' + money(i.margin) + '</td></tr>'; });
      return t + '</tbody></table></div>';
    })() : empty()) + '</div>';
    if (!setting("ohada", false)) h += '<div class="gx-card gx-soon"><i class="fa-solid fa-scale-balanced"></i> <b>' + L("syscohada") + '</b> — ' + L("ohadaHint") + (can("settings") ? ' <button class="gx-btn gx-small" data-a="ohada-toggle">' + L("ohadaOn") + '</button>' : '') + '</div>';
    return h;
  }
  function pMore() {
    var pages = allowedPages(), h = '<div class="gx-more">';
    NAV.forEach(function (n) { if (pages.indexOf(n[0]) >= 0) h += '<button data-a="page" data-v="' + n[0] + '"><i class="fa-solid ' + n[1] + '"></i><span>' + L(n[0]) + '</span></button>'; });
    return h + '</div>';
  }
  function pMembers() {
    if (!S.members) { loadMembers(); return '<div class="gx-center"><i class="fa-solid fa-spinner fa-spin"></i></div>'; }
    if (S.members === "offline") return '<div class="gx-banner warn"><i class="fa-solid fa-wifi"></i> ' + L("mustOnline") + ' <button class="gx-btn" data-a="reload-members">↻</button></div>';
    var h = '<div class="gx-card"><p class="gx-hint">' + L("members_hint") + '</p>';
    if (isChef() && !S.expired) {
      h += '<div class="gx-form-inline"><input id="gx-inv-phone" type="tel" placeholder="' + L("invitePhoneHint") + '" value="+223 ">';
      h += '<select id="gx-inv-role"><option value="comptable">' + L("comptable") + '</option><option value="caissier">' + L("caissier") + '</option><option value="partenaire">' + L("partenaire") + '</option></select>';
      h += '<button class="gx-btn gx-primary" data-a="invite"><i class="fa-solid fa-user-plus"></i> ' + L("invite") + '</button></div>';
    }
    h += '</div><div class="gx-list">';
    var me = String((profile() || {}).phone || "").replace(/\D/g, "");
    S.members.forEach(function (m) {
      var owner = m.phone === S.membersOwner;
      h += '<div class="gx-row static"><div class="gx-row-t"><b>' + esc(m.name || ("+" + m.phone)) + (owner ? ' <em class="gx-tag">' + L("owner") + '</em>' : '') + (m.status !== "active" ? ' <em class="gx-tag warn">' + L("invited") + '</em>' : '') + '</b><span>+' + esc(m.phone) + '</span></div><div class="gx-row-v">';
      if (isChef() && !owner) {
        h += '<select data-a="member-role" data-v="' + esc(m.phone) + '">' + ["comptable", "caissier", "partenaire"].map(function (r) { return '<option value="' + r + '"' + (m.role === r ? " selected" : "") + '>' + L(r) + '</option>'; }).join("") + '</select>';
        h += ' <button class="gx-icon red" data-a="member-remove" data-v="' + esc(m.phone) + '" title="' + L("remove") + '"><i class="fa-solid fa-user-xmark"></i></button>';
      } else h += L(m.role);
      h += '</div></div>';
      if (m.phone === me && !owner && !isChef()) h += '<button class="gx-btn gx-ghost red" data-a="member-leave">' + L("leave") + '</button>';
    });
    return h + '</div>';
  }
  function loadMembers() {
    if (navigator.onLine === false) { S.members = "offline"; return; }
    api("members", { companyId: S.cid }).then(function (r) {
      if (!S) return;
      if (r.success) { S.members = r.members; S.membersOwner = r.ownerPhone; } else S.members = "offline";
      if (S.page === "members") render();
    });
  }
  function pSettings() {
    var h = '<div class="gx-grid2"><div class="gx-card"><h3>' + L("fiche") + '</h3>';
    h += '<label class="gx-field">' + L("companyName") + '<input id="gx-set-name" value="' + esc(S.name) + '"' + (isChef() ? '' : ' disabled') + '></label>';
    h += '<label class="gx-field">' + L("openingCash") + '<input id="gx-set-cash" inputmode="numeric" value="' + esc(setting("openingCash", 0)) + '"' + (can("settings") ? '' : ' disabled') + '></label>';
    h += '<label class="gx-field">' + L("phone") + '<input id="gx-set-phone" value="' + esc(setting("phone", "")) + '"' + (can("settings") ? '' : ' disabled') + '></label>';
    h += '<label class="gx-field">' + L("address") + '<input id="gx-set-addr" value="' + esc(setting("address", "")) + '"' + (can("settings") ? '' : ' disabled') + '></label>';
    if (can("settings") || isChef()) h += '<button class="gx-btn gx-primary" data-a="save-settings">' + L("save") + '</button>';
    h += '</div><div class="gx-card"><h3>' + L("subscription") + '</h3>';
    var cfg = (H().gestionConfig && H().gestionConfig()) || { mode: "free" };
    if (S.plan === "offert") h += '<p><i class="fa-solid fa-gift"></i> ' + L("subOffert") + '</p>';
    else if (cfg.mode !== "paid") h += '<p><i class="fa-solid fa-circle-check"></i> ' + L("subFree") + '</p>';
    else {
      h += S.expired ? '<p class="red">' + L("subExpired") + '</p>' : '<p>' + L("subActive") + ' ' + new Date(S.paidUntil).toLocaleDateString() + '</p>';
      if (isChef()) h += '<button class="gx-btn gx-primary" data-a="pay"><i class="fa-solid fa-mobile-screen"></i> ' + L("payNow") + ' — ' + money(cfg.price) + ' / ' + cfg.days + ' ' + L("perDays") + '</button>';
    }
    h += '</div><div class="gx-card"><h3>' + L("backup") + '</h3><p class="gx-hint">' + L("lastBackup") + ' : ' + (S.meta.lastBackup ? dtFr(S.meta.lastBackup) : L("never")) + '</p>';
    h += '<button class="gx-btn" data-a="backup-share"><i class="fa-solid fa-share-nodes"></i> ' + L("backupShare") + '</button> ';
    h += '<button class="gx-btn" data-a="backup-dl"><i class="fa-solid fa-download"></i> ' + L("backupDl") + '</button>';
    if (can("settings")) h += ' <label class="gx-btn"><i class="fa-solid fa-upload"></i> ' + L("restore") + '<input type="file" accept=".json,application/json" id="gx-restore" hidden></label>';
    h += '</div><div class="gx-card"><h3>' + L("pin") + '</h3>';
    if (localPin()) h += '<button class="gx-btn" data-a="pin-remove">' + L("removePin") + '</button>';
    else h += '<div class="gx-form-inline"><input id="gx-newpin" type="password" inputmode="numeric" maxlength="8" placeholder="1234"><button class="gx-btn" data-a="pin-set">' + L("setPin") + '</button></div>';
    h += '</div><div class="gx-card"><h3><i class="fa-solid fa-scale-balanced"></i> ' + L("syscohada") + '</h3><p class="gx-hint">' + L("ohadaHint") + '</p>';
    if (can("settings")) h += '<button class="gx-btn' + (setting("ohada", false) ? '' : ' gx-primary') + '" data-a="ohada-toggle">' + (setting("ohada", false) ? L("ohadaOff") : L("ohadaOn")) + '</button>';
    h += '</div>' + printerCard() + '</div>';
    return h;
  }
  function renderPin() {
    return '<div class="gx-center gx-pinbox"><img src="icons/icon-192-any.png" alt=""><h2>' + esc(S.name) + '</h2><p>' + L("enterPin") + '</p><input id="gx-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"><button class="gx-btn gx-primary" data-a="pin-check">OK</button><button class="gx-btn gx-ghost" data-a="pin-forgot">' + L("forgotPin") + '</button><button class="gx-btn gx-ghost" data-a="close">' + L("close") + '</button></div>';
  }

  // ---------------- Fenêtres (formulaires et fiches) ----------------
  function modalHtml() {
    var m = S.modal, body = "";
    if (m.t === "sale") body = fSale();
    else if (m.t === "purchase") body = fPurchase();
    else if (m.t === "expense") body = fExpense();
    else if (m.t === "item") body = fItem();
    else if (m.t === "client" || m.t === "supplier") body = fParty(m.t);
    else if (m.t === "employee") body = fEmployee();
    else if (m.t === "payment") body = fPayment();
    else if (m.t === "adjust") body = fAdjust();
    else if (m.t === "receipt") body = vReceipt();
    else if (m.t === "view") body = vRecord();
    return '<div class="gx-overlay" data-a="modal-bg"><div class="gx-sheet' + (m.big ? ' big' : '') + '" role="dialog"><button class="gx-x" data-a="modal-close" aria-label="' + L("close") + '"><i class="fa-solid fa-xmark"></i></button>' + body + '</div></div>';
  }
  function field(label, id, val, attrs) { return '<label class="gx-field">' + label + '<input id="' + id + '" data-f="' + id + '" value="' + esc(val == null ? "" : val) + '" ' + (attrs || "") + '></label>'; }
  function selectF(label, id, val, opts) { return '<label class="gx-field">' + label + '<select id="' + id + '" data-f="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val == null ? "" : val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join("") + '</select></label>'; }
  function partyOpts(k) { return [["", "—"]].concat(live(k).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (p) { return [p.id, p.name]; })); }
  function modeOpts(withCredit) { var o = MODES.map(function (m) { return [m, modeLabel(m)]; }); return o; }
  function draftLines(d) { return d.lines || (d.lines = []); }
  function linesEditor(d, priceField) {
    var st = stockMap(), h = '<div class="gx-lines">';
    draftLines(d).forEach(function (l, i) {
      h += '<div class="gx-lrow"><div class="gx-lname">' + (l.item ? esc(l.name) : '<input data-line="' + i + '" data-lf="name" value="' + esc(l.name) + '" placeholder="' + L("desc") + '">') +
        (l.item && getE("item", l.item) && getE("item", l.item).type !== "service" ? '<small>' + L("stock") + ' ' + qtyFmt(st[l.item] || 0) + '</small>' : '') + '</div>' +
        '<div class="gx-qty"><button data-a="lqty" data-v="' + i + '" data-d="-1">−</button><input inputmode="decimal" data-line="' + i + '" data-lf="qty" value="' + qtyFmt(l.qty) + '"><button data-a="lqty" data-v="' + i + '" data-d="1">+</button></div>' +
        '<input class="gx-lprice" inputmode="numeric" data-line="' + i + '" data-lf="' + priceField + '" value="' + esc(l[priceField]) + '">' +
        '<b class="gx-ltot">' + money(num(l.qty) * num(l[priceField])) + '</b><button class="gx-icon red" data-a="ldel" data-v="' + i + '"><i class="fa-solid fa-trash"></i></button></div>';
    });
    h += '</div>';
    // choix rapide des articles
    var items = live("item").filter(function (i) { return !d.pick || (i.name + " " + (i.cat || "")).toLowerCase().indexOf(d.pick.toLowerCase()) >= 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 40);
    h += '<div class="gx-picker"><input class="gx-search" data-f="pick" id="gx-pick" placeholder="' + L("search") + '" value="' + esc(d.pick || "") + '"><div class="gx-pick-list">';
    items.forEach(function (i) { h += '<button data-a="ladd" data-v="' + esc(i.id) + '">' + esc(i.name) + '<small>' + money(priceField === "cost" ? i.cost : i.price) + (i.type !== "service" ? " · " + qtyFmt(st[i.id] || 0) : "") + '</small></button>'; });
    h += '<button data-a="ladd" data-v="" class="gx-other"><i class="fa-solid fa-pen"></i> ' + L("otherLine") + '</button></div></div>';
    return h;
  }
  function linesTotal(d, pf) { return draftLines(d).reduce(function (a, l) { return a + num(l.qty) * num(l[pf]); }, 0); }
  function fSale() {
    var d = S.modal.d, tot = linesTotal(d, "price");
    if (!d.paidTouched) d.paid = d.mode === "credit" ? 0 : tot;
    var h = '<h2><i class="fa-solid fa-cash-register"></i> ' + (S.modal.id ? L("edit") : L("newSale")) + '</h2>' + linesEditor(d, "price");
    h += '<div class="gx-total">' + L("total") + ' <b>' + money(tot) + '</b></div><div class="gx-fgrid">';
    h += selectF(L("client"), "client", d.client, partyOpts("client"));
    h += selectF(L("mode"), "mode", d.mode, modeOpts().concat([["credit", modeLabel("credit")]]));
    h += field(L("paid"), "paid", d.paid, 'inputmode="numeric"');
    h += field(L("date"), "d", d.d, 'type="date"');
    h += '</div>' + field(L("note"), "note", d.note, "");
    if (num(d.paid) < tot && !d.client) h += '<p class="gx-hint warn">' + L("client") + ' : ' + L("required") + ' (' + L("rest") + ' ' + money(tot - num(d.paid)) + ')</p>';
    h += '<div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-sale"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fPurchase() {
    var d = S.modal.d, tot = linesTotal(d, "cost");
    if (!d.paidTouched) d.paid = tot;
    var h = '<h2><i class="fa-solid fa-truck-ramp-box"></i> ' + (S.modal.id ? L("edit") : L("newPurchase")) + '</h2>' + linesEditor(d, "cost");
    h += '<div class="gx-total">' + L("total") + ' <b>' + money(tot) + '</b></div><div class="gx-fgrid">';
    h += selectF(L("supplier"), "supplier", d.supplier, partyOpts("supplier"));
    h += selectF(L("mode"), "mode", d.mode, modeOpts());
    h += field(L("paid"), "paid", d.paid, 'inputmode="numeric"');
    h += field(L("date"), "d", d.d, 'type="date"');
    h += '</div>' + field(L("note"), "note", d.note, "");
    h += '<div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-purchase"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fExpense() {
    var d = S.modal.d;
    var h = '<h2><i class="fa-solid fa-money-bill-wave"></i> ' + (S.modal.id ? L("edit") : L("newExpense")) + '</h2><div class="gx-fgrid">';
    h += selectF(L("category"), "cat", d.cat, EXP_CATS.map(function (c) { return [c, catLabel(c)]; }));
    h += field(L("amount"), "amount", d.amount, 'inputmode="numeric"');
    h += selectF(L("mode"), "mode", d.mode, modeOpts());
    h += field(L("date"), "d", d.d, 'type="date"');
    if (d.cat === "sal") h += selectF(L("employees"), "employee", d.employee, partyOpts("employee"));
    h += '</div>' + field(L("note"), "note", d.note, "");
    h += '<div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-expense"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fItem() {
    var d = S.modal.d;
    var h = '<h2><i class="fa-solid fa-box"></i> ' + (S.modal.id ? L("edit") : L("newItem")) + '</h2><div class="gx-fgrid">';
    h += field(L("name"), "name", d.name, 'maxlength="80"');
    h += selectF(L("type"), "type", d.type, [["article", L("article")], ["service", L("service")]]);
    h += field(L("price"), "price", d.price, 'inputmode="numeric"');
    h += field(L("cost"), "cost", d.cost, 'inputmode="numeric"');
    h += field(L("category"), "cat", d.cat, 'maxlength="40"');
    if (d.type !== "service") {
      h += field(L("unit"), "unit", d.unit, 'maxlength="12" placeholder="pièce, kg, sac…"');
      h += field(L("alertAt"), "alertAt", d.alertAt, 'inputmode="numeric"');
      if (!S.modal.id) h += field(L("initialStock"), "stock0", d.stock0, 'inputmode="decimal"');
    }
    h += '</div><div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-item"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fParty(k) {
    var d = S.modal.d;
    var h = '<h2><i class="fa-solid ' + (k === "client" ? "fa-user" : "fa-industry") + '"></i> ' + (S.modal.id ? L("edit") : L(k === "client" ? "newClient" : "newSupplier")) + '</h2><div class="gx-fgrid">';
    h += field(L("name"), "name", d.name, 'maxlength="80"') + field(L("phone"), "phone", d.phone, 'type="tel"') + field(L("note"), "note", d.note, "");
    h += '</div><div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-party" data-v="' + k + '"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fEmployee() {
    var d = S.modal.d;
    var h = '<h2><i class="fa-solid fa-id-badge"></i> ' + (S.modal.id ? L("edit") : L("newEmployee")) + '</h2><div class="gx-fgrid">';
    h += field(L("name"), "name", d.name, 'maxlength="80"') + field(L("position"), "position", d.position, "") + field(L("phone"), "phone", d.phone, 'type="tel"') + field(L("salary"), "salary", d.salary, 'inputmode="numeric"');
    h += '</div><div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-employee"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fPayment() {
    var d = S.modal.d;
    var h = '<h2><i class="fa-solid fa-hand-holding-dollar"></i> ' + (d.side === "client" ? L("encaisser") : L("payBtn")) + ' — ' + esc(partyName(d.side, d.party)) + '</h2><div class="gx-fgrid">';
    h += field(L("amount"), "amount", d.amount, 'inputmode="numeric"') + selectF(L("mode"), "mode", d.mode, modeOpts()) + field(L("date"), "d", d.d, 'type="date"') + field(L("note"), "note", d.note, "");
    h += '</div><div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-payment"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function fAdjust() {
    var d = S.modal.d, cur = stockMap()[d.item] || 0;
    var h = '<h2><i class="fa-solid fa-clipboard-check"></i> ' + L("inventory") + ' — ' + esc(itemName(d.item)) + '</h2><p class="gx-hint">' + L("stock") + ' : <b>' + qtyFmt(cur) + '</b></p><div class="gx-fgrid">';
    h += field(L("realQty"), "real", d.real, 'inputmode="decimal"') + field(L("note"), "note", d.note, "");
    h += '</div><div class="gx-sheet-foot"><button class="gx-btn" data-a="modal-close">' + L("cancel") + '</button><button class="gx-btn gx-primary" data-a="save-adjust"><i class="fa-solid fa-check"></i> ' + L("save") + '</button></div>';
    return h;
  }
  function histHtml(r) {
    var hs = (r._hist || []).filter(Boolean).slice(-6).reverse();
    var h = '<div class="gx-meta"><i class="fa-regular fa-clock"></i> ' + dtFr(r._at) + ' ' + L("by") + ' ' + esc(r._bn || "") + '</div>';
    if (hs.length) h += '<details class="gx-hist"><summary>' + L("history") + ' (' + hs.length + ')</summary>' + hs.map(function (o) { return '<div>' + dtFr(o.at) + ' — ' + esc(o.bn || "") + (o.a === "del" ? " (" + L("del") + ")" : "") + (o.f && (o.f.total != null || o.f.amount != null) ? " · " + money(o.f.total != null ? o.f.total : o.f.amount) : "") + '</div>'; }).join("") + '</details>';
    return h;
  }
  function vRecord() {
    var m = S.modal, k = m.k, r = getE(k, m.id);
    if (!r) return '<p>' + L("noData") + '</p>';
    var h = "", editable = can(k === "payment" ? (r.side === "client" ? "cpay" : "payment") : k) && (S.role !== "caissier" || r._by === (profile() || {}).id) && S.role !== "caissier";
    if (k === "sale") {
      var rest = num(r.total) - num(r.paid);
      h += '<h2>' + L("sales") + ' — ' + dateFr(r.d) + '</h2>' + linesView(saleLines(r), "price");
      h += '<div class="gx-total">' + L("total") + ' <b>' + money(r.total) + '</b></div><p>' + L("paid") + ' : ' + money(r.paid) + ' (' + esc(r.mode === "sounsouni" ? "Sounsouni" : modeLabel(r.mode)) + ')' + (rest > 0 ? ' · <b class="warn">' + L("rest") + ' ' + money(rest) + '</b>' : '') + '</p>';
      if (r.client) h += '<p>' + L("client") + ' : <b>' + esc(partyName("client", r.client)) + '</b></p>';
      if (r.note) h += '<p class="gx-hint">' + esc(r.note) + '</p>';
      h += histHtml(r) + '<div class="gx-sheet-foot"><button class="gx-btn" data-a="receipt" data-v="' + esc(r.id) + '"><i class="fa-solid fa-receipt"></i> ' + L("receipt") + '</button>';
    } else if (k === "purchase") {
      h += '<h2>' + L("purchases") + ' — ' + dateFr(r.d) + '</h2>' + linesView(r.lines || [], "cost") + '<div class="gx-total">' + L("total") + ' <b>' + money(r.total) + '</b></div><p>' + L("paid") + ' : ' + money(r.paid) + (r.supplier ? ' · ' + esc(partyName("supplier", r.supplier)) : '') + '</p>' + (r.note ? '<p class="gx-hint">' + esc(r.note) + '</p>' : '') + histHtml(r) + '<div class="gx-sheet-foot">';
    } else if (k === "expense") {
      h += '<h2>' + esc(catLabel(r.cat || "autre")) + ' — ' + money(r.amount) + '</h2><p>' + dateFr(r.d) + ' · ' + esc(modeLabel(r.mode)) + (r.employee ? ' · ' + esc(partyName("employee", r.employee)) : '') + '</p>' + (r.note ? '<p class="gx-hint">' + esc(r.note) + '</p>' : '') + histHtml(r) + '<div class="gx-sheet-foot">';
    } else if (k === "item") {
      var st = stockMap()[r.id] || 0;
      h += '<h2>' + esc(r.name) + '</h2><div class="gx-kpis small">' + kpi(L("price"), money(r.price)) + (S.role !== "caissier" ? kpi(L("cost"), money(r.cost)) + kpi(L("margin"), money(num(r.price) - num(r.cost))) : '') + (r.type !== "service" ? kpi(L("stock"), qtyFmt(st) + (r.unit ? " " + esc(r.unit) : ""), st < 0 ? "red" : "") : '') + '</div>';
      if (r.type !== "service") {
        var moves = [];
        live("adjust").forEach(function (a) { if (a.item === r.id) moves.push([a.d, L("adjust") + (a.note ? " · " + a.note : ""), num(a.qty)]); });
        live("purchase").forEach(function (p) { (p.lines || []).forEach(function (l) { if (l.item === r.id) moves.push([p.d, L("purchases") + (p.supplier ? " · " + partyName("supplier", p.supplier) : ""), num(l.qty)]); }); });
        live("sale").forEach(function (s) { saleLines(s).forEach(function (l) { if (l.item === r.id) moves.push([s.d, L("sales") + (s.client ? " · " + partyName("client", s.client) : ""), -num(l.qty)]); }); });
        moves.sort(function (a, b) { return b[0] > a[0] ? 1 : -1; });
        h += '<h3>' + L("stockMoves") + '</h3><div class="gx-list">' + (moves.length ? moves.slice(0, 30).map(function (x) { return '<div class="gx-line"><span>' + dateFr(x[0]) + ' · ' + esc(x[1]) + '</span><b class="' + (x[2] < 0 ? "red" : "green") + '">' + (x[2] > 0 ? "+" : "") + qtyFmt(x[2]) + '</b></div>'; }).join("") : empty()) + '</div>';
      }
      h += histHtml(r) + '<div class="gx-sheet-foot">';
      if (can("adjust") && r.type !== "service") h += '<button class="gx-btn" data-a="new" data-v="adjust" data-x="' + esc(r.id) + '"><i class="fa-solid fa-clipboard-check"></i> ' + L("inventory") + '</button>';
    } else if (k === "client" || k === "supplier") {
      var bal = (k === "client" ? clientBalances() : supplierBalances())[r.id] || 0;
      h += '<h2>' + esc(r.name) + '</h2><p>' + esc(r.phone || "") + (r.note ? ' · ' + esc(r.note) : '') + '</p><div class="gx-kpis small">' + kpi(k === "client" ? L("owes") : L("weOwe"), money(bal), bal > 0 ? "warn" : "") + '</div>';
      var hist = [];
      if (k === "client") live("sale").forEach(function (s) { if (s.client === r.id) hist.push([s.d, L("sales") + " " + money(s.total), num(s.total) - num(s.paid)]); });
      else live("purchase").forEach(function (p) { if (p.supplier === r.id) hist.push([p.d, L("purchases") + " " + money(p.total), num(p.total) - num(p.paid)]); });
      live("payment").forEach(function (p) { if (p.party === r.id && p.side === k) hist.push([p.d, L("payments") + " (" + modeLabel(p.mode) + ")", -num(p.amount)]); });
      hist.sort(function (a, b) { return b[0] > a[0] ? 1 : -1; });
      h += '<div class="gx-list">' + (hist.length ? hist.slice(0, 40).map(function (x) { return '<div class="gx-line"><span>' + dateFr(x[0]) + ' · ' + esc(x[1]) + '</span><b class="' + (x[2] > 0 ? "warn" : "green") + '">' + (x[2] > 0 ? "+" : "") + money(x[2]) + '</b></div>'; }).join("") : empty()) + '</div>';
      h += histHtml(r) + '<div class="gx-sheet-foot">';
      if (can(k === "client" ? "cpay" : "payment")) h += '<button class="gx-btn gx-primary" data-a="new" data-v="payment" data-x="' + k + ':' + esc(r.id) + '"><i class="fa-solid fa-hand-holding-dollar"></i> ' + (k === "client" ? L("encaisser") : L("payBtn")) + '</button>';
      if (r.phone) h += '<a class="gx-btn" href="https://wa.me/' + esc(String(r.phone).replace(/\D/g, "")) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i></a>';
    } else if (k === "employee") {
      h += '<h2>' + esc(r.name) + '</h2><p>' + esc(r.position || "") + ' · ' + esc(r.phone || "") + '</p><div class="gx-kpis small">' + kpi(L("salary"), money(r.salary)) + '</div>';
      var paidList = live("expense").filter(function (x) { return x.employee === r.id; }).sort(function (a, b) { return b.d > a.d ? 1 : -1; });
      h += '<div class="gx-list">' + (paidList.length ? paidList.slice(0, 24).map(function (x) { return '<div class="gx-line"><span>' + dateFr(x.d) + ' · ' + esc(x.note || L("salary")) + '</span><b>' + money(x.amount) + '</b></div>'; }).join("") : empty()) + '</div>';
      h += histHtml(r) + '<div class="gx-sheet-foot">';
      if (can("expense")) h += '<button class="gx-btn gx-primary" data-a="new" data-v="salary" data-x="' + esc(r.id) + '"><i class="fa-solid fa-money-check-dollar"></i> ' + L("paySalary") + '</button>';
    } else if (k === "payment") {
      h += '<h2>' + L("payments") + ' — ' + money(r.amount) + '</h2><p>' + dateFr(r.d) + ' · ' + esc(partyName(r.side, r.party)) + ' · ' + esc(modeLabel(r.mode)) + '</p>' + histHtml(r) + '<div class="gx-sheet-foot">';
    }
    if (editable && r.src !== "sounsouni") h += '<button class="gx-btn" data-a="edit" data-k="' + k + '" data-v="' + esc(r.id) + '"><i class="fa-solid fa-pen"></i> ' + L("edit") + '</button>';
    if (editable) h += '<button class="gx-btn red" data-a="delete" data-k="' + k + '" data-v="' + esc(r.id) + '"><i class="fa-solid fa-trash"></i> ' + L("del") + '</button>';
    h += '</div>';
    return h;
  }
  function linesView(lines, pf) {
    return '<div class="gx-list">' + lines.map(function (l) { return '<div class="gx-line"><span>' + qtyFmt(l.qty) + ' × ' + esc(l.name) + ' <small>(' + money(l[pf]) + ')</small></span><b>' + money(num(l.qty) * num(l[pf])) + '</b></div>'; }).join("") + '</div>';
  }
  function receiptText(r) {
    var t = "*" + S.name + "*\n" + L("receipt") + " — " + dateFr(r.d) + "\n";
    if (setting("phone", "")) t += setting("phone", "") + "\n";
    t += "------------------\n";
    saleLines(r).forEach(function (l) { t += qtyFmt(l.qty) + " x " + l.name + " : " + money(num(l.qty) * num(l.price)) + "\n"; });
    t += "------------------\n" + L("total") + " : *" + money(r.total) + "*\n" + L("paid") + " : " + money(r.paid) + "\n";
    if (num(r.total) - num(r.paid) > 0) t += L("rest") + " : " + money(num(r.total) - num(r.paid)) + "\n";
    t += "\n" + L("receiptThanks") + "\n— Sounsouni Gestion";
    return t;
  }
  function vReceipt() {
    var r = getE("sale", S.modal.id); if (!r) return "";
    var c = r.client ? getE("client", r.client) : null;
    var phone = c && c.phone ? String(c.phone).replace(/\D/g, "") : "";
    var h = '<div class="gx-receipt" id="gx-receipt-print"><h2>' + esc(S.name) + '</h2>' + (setting("address", "") ? '<p>' + esc(setting("address", "")) + '</p>' : '') + (setting("phone", "") ? '<p>' + esc(setting("phone", "")) + '</p>' : '');
    h += '<p><b>' + L("receipt") + '</b> · ' + dateFr(r.d) + ' · N° ' + esc(String(r.id).slice(-6).toUpperCase()) + (c ? '<br>' + L("client") + ' : ' + esc(c.name) : '') + '</p>' + linesView(saleLines(r), "price");
    h += '<div class="gx-total">' + L("total") + ' <b>' + money(r.total) + '</b></div><p>' + L("paid") + ' : ' + money(r.paid) + (num(r.total) - num(r.paid) > 0 ? ' · ' + L("rest") + ' : ' + money(num(r.total) - num(r.paid)) : '') + '</p><p class="gx-hint">' + L("receiptThanks") + '</p></div>';
    h += '<div class="gx-sheet-foot"><a class="gx-btn gx-primary" target="_blank" rel="noopener" href="https://wa.me/' + phone + '?text=' + encodeURIComponent(receiptText(r)) + '"><i class="fa-brands fa-whatsapp"></i> ' + L("shareWa") + '</a><button class="gx-btn" data-a="print"><i class="fa-solid fa-print"></i> ' + L("print") + '</button></div>';
    return h;
  }

  // ---------------- Actions ----------------
  function openForm(t, id, extra) {
    var r = id ? getE(t, id) : null, d;
    var base = { d: today(), mode: "cash", note: "" };
    if (t === "sale") d = r ? copy(r) : merge(base, { lines: [], paid: 0, client: "" });
    else if (t === "purchase") d = r ? copy(r) : merge(base, { lines: [], paid: 0, supplier: "" });
    else if (t === "expense") d = r ? copy(r) : merge(base, { cat: "autre", amount: "" });
    else if (t === "item") d = r ? copy(r) : { type: "article", name: "", price: "", cost: "", cat: "", unit: "", alertAt: 2, stock0: "" };
    else if (t === "client" || t === "supplier" || t === "employee") d = r ? copy(r) : { name: "", phone: "", note: "" };
    else if (t === "payment") { var p = String(extra || "").split(":"); d = merge(base, { side: p[0], party: p.slice(1).join(":"), amount: Math.max(0, ((p[0] === "client" ? clientBalances() : supplierBalances())[p.slice(1).join(":")] || 0)) || "" }); }
    else if (t === "adjust") d = { item: extra, real: "", note: "" };
    if (r) { d.paidTouched = true; delete d._hist; delete d._opFull; }
    S.modal = { t: t, id: id || null, d: d, big: t === "sale" || t === "purchase" };
    render();
  }
  function copy(o) { var c = JSON.parse(JSON.stringify(o, function (k, v) { return k === "_hist" || k === "_opFull" || k === "_op" ? undefined : v; })); return c; }
  function merge(a, b) { var o = {}; for (var k in a) o[k] = a[k]; for (var k2 in b) o[k2] = b[k2]; return o; }
  function clean(d, keys) { var o = {}; keys.forEach(function (k) { if (d[k] !== undefined) o[k] = d[k]; }); return o; }
  function done(msg) { S.modal = null; render(); toast("✅ " + (msg || L("saved")) + (navigator.onLine === false ? " — " + L("offline") : "")); }
  function cleanLines(d, pf) {
    return draftLines(d).filter(function (l) { return (l.item || String(l.name || "").trim()) && num(l.qty) > 0; }).map(function (l) {
      var o = { item: l.item || null, name: String(l.name || "").trim().slice(0, 80), qty: num(l.qty), price: num(l.price), cost: num(l.cost) };
      if (pf === "price" && l.item && !l.costSet) { var it = getE("item", l.item); o.cost = it ? num(it.cost) : 0; }
      return o;
    });
  }
  function saveSale() {
    var d = S.modal.d, lines = cleanLines(d, "price");
    if (!lines.length) return toast(L("lines") + " : " + L("required"));
    var tot = lines.reduce(function (a, l) { return a + l.qty * l.price; }, 0);
    var paid = d.mode === "credit" ? num(d.paid) : num(d.paid);
    if (paid < tot && !d.client) return toast(L("client") + " : " + L("required"));
    var e = S.modal.id || rid("s_");
    write("sale", e, { d: d.d || today(), lines: lines, total: tot, paid: Math.min(paid, tot), mode: d.mode === "credit" ? (paid > 0 ? "cash" : "credit") : d.mode, client: d.client || null, note: String(d.note || "").slice(0, 200) });
    S.modal = { t: "receipt", id: e }; render();
    toast("✅ " + L("saved"));
  }
  function savePurchase() {
    var d = S.modal.d, lines = cleanLines(d, "cost");
    if (!lines.length) return toast(L("lines") + " : " + L("required"));
    var tot = lines.reduce(function (a, l) { return a + l.qty * l.cost; }, 0);
    if (num(d.paid) < tot && !d.supplier) return toast(L("supplier") + " : " + L("required"));
    write("purchase", S.modal.id || rid("p_"), { d: d.d || today(), lines: lines, total: tot, paid: Math.min(num(d.paid), tot), mode: d.mode, supplier: d.supplier || null, note: String(d.note || "").slice(0, 200) });
    // le prix d'achat de l'article suit le dernier achat
    lines.forEach(function (l) { var it = l.item && getE("item", l.item); if (it && num(it.cost) !== l.cost && l.cost > 0) write("item", it.id, merge(clean(it, ["name", "type", "price", "cost", "cat", "unit", "alertAt", "sns"]), { cost: l.cost })); });
    done();
  }
  function saveExpense() {
    var d = S.modal.d; if (num(d.amount) <= 0) return toast(L("amount") + " : " + L("required"));
    write("expense", S.modal.id || rid("x_"), { d: d.d || today(), cat: d.cat || "autre", amount: num(d.amount), mode: d.mode, note: String(d.note || "").slice(0, 200), employee: d.cat === "sal" ? (d.employee || null) : null });
    done();
  }
  function saveItem() {
    var d = S.modal.d; if (!String(d.name || "").trim()) return toast(L("name") + " : " + L("required"));
    var e = S.modal.id || rid("i_");
    write("item", e, { name: String(d.name).trim().slice(0, 80), type: d.type === "service" ? "service" : "article", price: num(d.price), cost: num(d.cost), cat: String(d.cat || "").slice(0, 40), unit: String(d.unit || "").slice(0, 12), alertAt: num(d.alertAt), sns: d.sns || null });
    if (!S.modal.id && num(d.stock0)) write("adjust", rid("a_"), { item: e, qty: num(d.stock0), d: today(), note: L("initialStock") });
    done();
  }
  function saveParty(k) {
    var d = S.modal.d; if (!String(d.name || "").trim()) return toast(L("name") + " : " + L("required"));
    write(k, S.modal.id || rid(k.charAt(0) + "_"), { name: String(d.name).trim().slice(0, 80), phone: String(d.phone || "").slice(0, 30), note: String(d.note || "").slice(0, 200) });
    done();
  }
  function saveEmployee() {
    var d = S.modal.d; if (!String(d.name || "").trim()) return toast(L("name") + " : " + L("required"));
    write("employee", S.modal.id || rid("e_"), { name: String(d.name).trim().slice(0, 80), position: String(d.position || "").slice(0, 60), phone: String(d.phone || "").slice(0, 30), salary: num(d.salary) });
    done();
  }
  function savePayment() {
    var d = S.modal.d; if (num(d.amount) <= 0) return toast(L("amount") + " : " + L("required"));
    write("payment", rid("y_"), { side: d.side, party: d.party, amount: num(d.amount), mode: d.mode, d: d.d || today(), note: String(d.note || "").slice(0, 200) });
    done();
  }
  function saveAdjust() {
    var d = S.modal.d; if (String(d.real).trim() === "") return toast(L("realQty") + " : " + L("required"));
    var delta = num(d.real) - (stockMap()[d.item] || 0);
    if (delta) write("adjust", rid("a_"), { item: d.item, qty: delta, d: today(), note: String(d.note || L("inventory")).slice(0, 200) });
    done();
  }
  function backupData() {
    var ops = Object.keys(S.ops).map(function (k) { var o = S.ops[k]; return { id: o.id, k: o.k, e: o.e, a: o.a, f: o.f, at: o.at, by: o.by, bn: o.bn }; });
    return JSON.stringify({ app: "sounsouni-gestion", v: 1, company: { id: S.cid, name: S.name }, savedAt: Date.now(), ops: ops });
  }
  function backupName() { return "sounsouni-gestion-" + S.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase() + "-" + today() + ".json"; }
  function markBackup() { S.meta.lastBackup = Date.now(); dbMeta(S.cid, S.meta); render(); }
  function backupDownload() {
    var blob = new Blob([backupData()], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = backupName(); document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    markBackup();
  }
  function backupShare() {
    try {
      var file = new File([backupData()], backupName(), { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: L("backup") + " — " + S.name }).then(markBackup).catch(function () {});
        return;
      }
    } catch (e) {}
    backupDownload();
  }
  function restoreFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result);
        if (!j || j.app !== "sounsouni-gestion" || !Array.isArray(j.ops)) throw new Error("bad");
        var n = 0;
        j.ops.forEach(function (o) {
          if (!o || !o.id || S.ops[o.id]) return;
          o.local = true; S.ops[o.id] = o; S.pending.push(o.id); n++;
          dbPut([{ key: S.cid + "|" + o.id, cid: S.cid, op: o, pending: true }]);
        });
        rebuild(); render(); schedulePush(300);
        toast("✅ " + n + " " + L("restoreDone"));
      } catch (e) { toast("❌ " + L("errGeneric")); }
    };
    rd.readAsText(file);
  }
  function csvExport() {
    var r = periodRange(S.period), rowsOut = [["Type", "Date", "Description", "Tiers", "Paiement", "Montant", "Payé", "Saisi par"]];
    live("sale").forEach(function (s) { if (inRange(s.d, r)) rowsOut.push(["Vente", s.d, saleLines(s).map(function (l) { return l.qty + "x " + l.name; }).join(" / "), partyName("client", s.client), s.mode, s.total, s.paid, s._bn]); });
    live("purchase").forEach(function (p) { if (inRange(p.d, r)) rowsOut.push(["Achat", p.d, (p.lines || []).map(function (l) { return l.qty + "x " + l.name; }).join(" / "), partyName("supplier", p.supplier), p.mode, -num(p.total), -num(p.paid), p._bn]); });
    live("expense").forEach(function (x) { if (inRange(x.d, r)) rowsOut.push(["Dépense", x.d, catLabel(x.cat || "autre") + (x.note ? " - " + x.note : ""), partyName("employee", x.employee), x.mode, -num(x.amount), -num(x.amount), x._bn]); });
    live("payment").forEach(function (p) { if (inRange(p.d, r)) rowsOut.push([p.side === "client" ? "Encaissement" : "Paiement fournisseur", p.d, p.note || "", partyName(p.side, p.party), p.mode, p.side === "client" ? num(p.amount) : -num(p.amount), "", p._bn]); });
    var csv = "﻿" + rowsOut.map(function (r2) { return r2.map(function (v) { var s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "rapport-" + r[0] + "-" + r[1] + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
  }

  function bindEvents() {
    root.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-a]"); if (!el || !S) return;
      var a = el.getAttribute("data-a"), v = el.getAttribute("data-v"), k = el.getAttribute("data-k");
      if (a === "modal-bg" && ev.target !== el) return;
      if (el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type !== "checkbox")) return;
      switch (a) {
        case "close": close(); break;
        case "page": S.page = v; S.q = ""; S.members = v === "members" ? null : S.members; window.scrollTo(0, 0); render(); var mn = root.querySelector(".gx-main"); if (mn) mn.scrollTop = 0; break;
        case "period": S.period = v; render(); break;
        case "hidezero": S.hideZero = el.checked; render(); break;
        case "new":
          if (v === "salary") { var emp = getE("employee", el.getAttribute("data-x")); openForm("expense"); S.modal.d.cat = "sal"; S.modal.d.employee = emp.id; S.modal.d.amount = emp.salary; S.modal.d.note = L("salary") + " " + emp.name; render(); }
          else openForm(v, null, el.getAttribute("data-x"));
          break;
        case "open": S.modal = { t: "view", k: k, id: v }; render(); break;
        case "edit": openForm(k, v); break;
        case "delete": if (confirm(L("confirmDel"))) { write(k, v, null, true); done(); } break;
        case "receipt": S.modal = { t: "receipt", id: v }; render(); break;
        case "print": printReceipt(); break;
        case "modal-close": case "modal-bg": S.modal = null; render(); break;
        case "ladd": {
          var d = S.modal.d, it = v ? getE("item", v) : null;
          var ex = it && draftLines(d).filter(function (l) { return l.item === it.id; })[0];
          if (ex) ex.qty = num(ex.qty) + 1;
          else draftLines(d).push(it ? { item: it.id, name: it.name, qty: 1, price: num(it.price), cost: num(it.cost) } : { item: null, name: "", qty: 1, price: 0, cost: 0 });
          renderModalOnly(); break;
        }
        case "lqty": { var ln = S.modal.d.lines[+v]; ln.qty = Math.max(0, num(ln.qty) + num(el.getAttribute("data-d"))); renderModalOnly(); break; }
        case "ldel": S.modal.d.lines.splice(+v, 1); renderModalOnly(); break;
        case "save-sale": saveSale(); break;
        case "save-purchase": savePurchase(); break;
        case "save-expense": saveExpense(); break;
        case "save-item": saveItem(); break;
        case "save-party": saveParty(v); break;
        case "save-employee": saveEmployee(); break;
        case "save-payment": savePayment(); break;
        case "save-adjust": saveAdjust(); break;
        case "import-items": importSounsouniItems(); break;
        case "csv": csvExport(); break;
        case "csv-ohada": csvOhada(); break;
        case "print-page": printPage(); break;
        case "print-test": printTest(); break;
        case "oh-tab": S.ohTab = v; render(); break;
        case "ohada-toggle": { var on = !setting("ohada", false); write("settings", "main", merge(clean(getE("settings", "main") || {}, ["openingCash", "phone", "address", "ohada"]), { ohada: on })); if (on) S.page = "ohada"; render(); break; }
        case "backup-dl": backupDownload(); break;
        case "backup-share": backupShare(); break;
        case "pay": if (H().payGestion) { var cid = S.cid; close(); H().payGestion(cid); } break;
        case "reload-members": S.members = null; render(); break;
        case "invite": {
          var ph = (document.getElementById("gx-inv-phone") || {}).value || "", role = (document.getElementById("gx-inv-role") || {}).value;
          if (String(ph).replace(/\D/g, "").length < 8) return toast(L("phone") + " : " + L("required"));
          el.disabled = true;
          api("invite", { companyId: S.cid, phone: ph, role: role }).then(function (r) {
            el.disabled = false;
            if (!r.success) return toast("❌ " + (r.error === "already_member" ? L("invited") : r.error === "network_error" ? L("mustOnline") : L("errGeneric")));
            toast("✅ " + L("invitedOk") + (r.hasAccount ? "" : " " + L("noAccountYet")));
            S.members = null; render();
          });
          break;
        }
        case "member-remove":
          if (!confirm(L("removeConfirm"))) break;
          api("member_remove", { companyId: S.cid, phone: v }).then(function (r) { if (!r.success) toast("❌ " + L("mustOnline")); S.members = null; render(); });
          break;
        case "member-leave":
          if (!confirm(L("leaveConfirm"))) break;
          api("member_remove", { companyId: S.cid, phone: String((profile() || {}).phone || "").replace(/\D/g, "") }).then(function (r) { if (!r.success) return toast("❌ " + L("mustOnline")); var c = S.cid; dbClear(c); close(); if (H().refreshRoles) H().refreshRoles(); });
          break;
        case "save-settings": {
          var nm = (document.getElementById("gx-set-name") || {}).value || "";
          if (can("settings")) write("settings", "main", merge(clean(getE("settings", "main") || {}, ["openingCash", "phone", "address", "ohada"]), { openingCash: num((document.getElementById("gx-set-cash") || {}).value), phone: (document.getElementById("gx-set-phone") || {}).value || "", address: (document.getElementById("gx-set-addr") || {}).value || "" }));
          if (isChef() && nm.trim() && nm.trim() !== S.name) api("rename", { companyId: S.cid, name: nm.trim() }).then(function (r) { if (r.success) { S.name = nm.trim(); render(); if (H().refreshRoles) H().refreshRoles(); } else toast("❌ " + L("mustOnline")); });
          done(); break;
        }
        case "pin-set": {
          var np = (document.getElementById("gx-newpin") || {}).value || "";
          if (!/^\d{4,8}$/.test(np)) return toast(L("pin") + " : 4-8 chiffres");
          hashPin(np).then(function (hh) { try { localStorage.setItem(pinKey(), hh); } catch (e) {} toast("✅ " + L("pinSet")); render(); });
          break;
        }
        case "pin-remove": try { localStorage.removeItem(pinKey()); } catch (e) {} render(); break;
        case "pin-check": {
          var pv = (document.getElementById("gx-pin") || {}).value || "";
          hashPin(pv).then(function (hh) { if (hh === localPin()) { S.locked = false; render(); } else { toast("❌ " + L("wrongPin")); var pe = document.getElementById("gx-pin"); if (pe) { pe.value = ""; pe.focus(); } } });
          break;
        }
        case "pin-forgot":
          if (!confirm(L("pinForgotConfirm"))) break;
          try { localStorage.removeItem(pinKey()); } catch (e) {}
          var comp = { id: S.cid, name: S.name, role: S.role, isOwner: S.isOwner, ownerId: S.ownerId, expired: S.expired, plan: S.plan, paidUntil: S.paidUntil };
          var keepPending = S.pending.length;
          if (keepPending) { S.locked = false; render(); break; } // ne jamais effacer des lignes pas encore envoyées
          dbClear(S.cid).then(function () { open(comp); });
          break;
      }
    });
    root.addEventListener("input", function (ev) {
      var el = ev.target; if (!S) return;
      var f = el.getAttribute("data-f"), li = el.getAttribute("data-line");
      if (li !== null && S.modal && S.modal.d) {
        var ln = S.modal.d.lines[+li], lf = el.getAttribute("data-lf");
        ln[lf] = lf === "name" ? el.value : num(el.value);
        if (lf === "cost") ln.costSet = true;
        var tot = el.closest(".gx-lrow") && el.closest(".gx-lrow").querySelector(".gx-ltot");
        var pf = S.modal.t === "purchase" ? "cost" : "price";
        if (tot) tot.textContent = money(num(ln.qty) * num(ln[pf]));
        refreshTotal(); return;
      }
      if (!f) return;
      if (f === "q") { S.q = el.value; clearTimeout(S._qt); S._qt = setTimeout(function () { var pos = el.selectionStart; render(); var q = document.getElementById("gx-q"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } }, 250); return; }
      if (f === "pick") { S.modal.d.pick = el.value; clearTimeout(S._pt); S._pt = setTimeout(function () { var pos = el.selectionStart; renderModalOnly(); var q = document.getElementById("gx-pick"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } }, 200); return; }
      if (f === "pFrom" || f === "pTo") { S[f] = el.value; render(); return; }
      if (S.modal && S.modal.d) {
        S.modal.d[f] = el.value;
        if (f === "paid") S.modal.d.paidTouched = true;
        if (f === "mode" && S.modal.t === "sale") { S.modal.d.paidTouched = false; renderModalOnly(); }
        if (f === "cat" && S.modal.t === "expense") renderModalOnly();
        if (f === "type" && S.modal.t === "item") renderModalOnly();
        if (f === "client" && S.modal.t === "sale") renderModalOnly();
      }
    });
    root.addEventListener("change", function (ev) {
      var el = ev.target; if (!S) return;
      if (el.id === "gx-restore" && el.files && el.files[0]) { restoreFile(el.files[0]); el.value = ""; return; }
      if (el.id === "gx-pfmt" || el.id === "gx-pdev" || el.id === "gx-prawbt") { var pc = printCfg(); if (el.id === "gx-pfmt") pc.fmt = el.value; else if (el.id === "gx-pdev") pc.printer = el.value; else pc.rawbt = el.checked; setPrintCfg(pc); toast("✅ " + L("saved")); return; }
      if (el.getAttribute("data-a") === "member-role") {
        api("member_update", { companyId: S.cid, phone: el.getAttribute("data-v"), role: el.value }).then(function (r) { if (!r.success) toast("❌ " + L("mustOnline")); S.members = null; render(); });
        return;
      }
      if (el.tagName === "SELECT" && el.getAttribute("data-f")) el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    root.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target.id === "gx-pin") { var b = root.querySelector('[data-a="pin-check"]'); if (b) b.click(); } });
    window.addEventListener("resize", function () { if (!S) return; var w = isWide(); if (w !== S._wide) { S._wide = w; render(); } });
  }
  function refreshTotal() {
    var el = root.querySelector(".gx-total b"); if (!el || !S.modal) return;
    var pf = S.modal.t === "purchase" ? "cost" : "price", tot = linesTotal(S.modal.d, pf);
    el.textContent = money(tot);
    if (!S.modal.d.paidTouched) { S.modal.d.paid = S.modal.d.mode === "credit" ? 0 : tot; var pi = document.getElementById("paid"); if (pi) pi.value = S.modal.d.paid; }
  }
  // ---------------- Impression ----------------
  // Réglage propre à CET appareil : format (A4, ticket 80 ou 58 mm),
  // imprimante choisie (application Windows), RawBT (téléphone Android).
  function printCfg() { try { return JSON.parse(localStorage.getItem("sns_gx_print") || "{}") || {}; } catch (e) { return {}; } }
  function setPrintCfg(c) { try { localStorage.setItem("sns_gx_print", JSON.stringify(c)); } catch (e) {} }
  function isAndroid() { return /Android/i.test(navigator.userAgent); }
  function printerCard() {
    var c = printCfg(), d = window.SnsDesktop, h = '<div class="gx-card"><h3><i class="fa-solid fa-print"></i> ' + L("printer") + '</h3>';
    h += '<label class="gx-field">' + L("printFmt") + '<select id="gx-pfmt">' + [["a4", L("fmtA4")], ["t80", L("fmt80")], ["t58", L("fmt58")]].map(function (o) { return '<option value="' + o[0] + '"' + ((c.fmt || "a4") === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>';
    if (d && d.listPrinters) {
      h += '<label class="gx-field">' + L("printerSel") + '<select id="gx-pdev"><option value="">' + L("printerAsk") + '</option>';
      (S.printers || []).forEach(function (p) { h += '<option value="' + esc(p.name) + '"' + (c.printer === p.name ? " selected" : "") + '>' + esc(p.displayName || p.name) + (p.isDefault ? " ★" : "") + '</option>'; });
      h += '</select></label>';
      if (!S.printers) { S.printers = []; d.listPrinters().then(function (l) { if (!S) return; S.printers = l || []; if (S.page === "settings") render(); }); }
    } else if (isAndroid()) {
      h += '<label class="gx-check" style="margin-bottom:6px"><input type="checkbox" id="gx-prawbt"' + (c.rawbt ? " checked" : "") + '> ' + L("rawbt") + '</label><p class="gx-hint">' + L("rawbtHint") + '</p>';
    }
    h += '<button class="gx-btn" data-a="print-test"><i class="fa-solid fa-receipt"></i> ' + L("testPrint") + '</button></div>';
    return h;
  }
  function docHtml(body, fmt) {
    var w = fmt === "t58" ? 58 : fmt === "t80" ? 80 : 0;
    var css = w ? "@page{size:" + w + "mm auto;margin:0}body{width:" + (w - 6) + "mm;margin:0 3mm;font-family:'Courier New',monospace;font-size:" + (w === 58 ? 10.5 : 12) + "px;color:#000}h2{font-size:1.3em;text-align:center;margin:4px 0}p{margin:2px 0}.c{text-align:center}.l{display:flex;justify-content:space-between;gap:4px}.l span{flex:1;min-width:0;word-break:break-word}.sep{border-top:1px dashed #000;margin:4px 0}.tot{font-size:1.25em;font-weight:bold}"
      : "@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}h1,h2{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #bbb;padding:5px 7px;text-align:left}td.r,th.r{text-align:right}.l{display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding:4px 0}.tot{font-size:16px;font-weight:bold;text-align:right;margin-top:8px}.c{text-align:center}.sep{border-top:1px solid #999;margin:8px 0}.muted{color:#666}";
    return '<!doctype html><html><head><meta charset="utf-8"><title>Sounsouni</title><style>' + css + '</style></head><body>' + body + '</body></html>';
  }
  function ticketBody(r) {
    var c = r.client ? getE("client", r.client) : null, h = '<h2>' + esc(S.name) + '</h2>';
    if (setting("address", "")) h += '<p class="c">' + esc(setting("address", "")) + '</p>';
    if (setting("phone", "")) h += '<p class="c">' + esc(setting("phone", "")) + '</p>';
    h += '<div class="sep"></div><p>' + L("receipt") + ' N° ' + esc(String(r.id).slice(-6).toUpperCase()) + '</p><p>' + dateFr(r.d) + (r._bn ? ' · ' + esc(r._bn) : '') + '</p>' + (c ? '<p>' + L("client") + ' : ' + esc(c.name) + '</p>' : '') + '<div class="sep"></div>';
    saleLines(r).forEach(function (l) { h += '<div class="l"><span>' + qtyFmt(l.qty) + ' x ' + esc(l.name) + '</span><b>' + money(num(l.qty) * num(l.price)) + '</b></div>'; });
    h += '<div class="sep"></div><div class="l tot"><span>' + L("total") + '</span><span>' + money(r.total) + '</span></div><div class="l"><span>' + L("paid") + ' (' + esc(r.mode === "sounsouni" ? "Sounsouni" : modeLabel(r.mode)) + ')</span><span>' + money(r.paid) + '</span></div>';
    if (num(r.total) - num(r.paid) > 0) h += '<div class="l"><span>' + L("rest") + '</span><span>' + money(num(r.total) - num(r.paid)) + '</span></div>';
    return h + '<div class="sep"></div><p class="c">' + L("receiptThanks") + '</p><p class="c">Sounsouni Gestion</p>';
  }
  function ticketText(r) {
    var W = printCfg().fmt === "t58" ? 32 : 42, out = [];
    var fold = function (s) { return String(s || "").normalize ? String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "") : String(s || ""); };
    var center = function (s) { s = fold(s).slice(0, W); var p = Math.max(0, Math.floor((W - s.length) / 2)); return new Array(p + 1).join(" ") + s; };
    var two = function (a, b) { a = fold(a); b = fold(b); var sp = W - b.length - 1; if (a.length > sp) { out.push(a.slice(0, W)); a = ""; } return a + new Array(Math.max(1, W - a.length - b.length) + 1).join(" ") + b; };
    var line = new Array(W + 1).join("-");
    out.push(center(S.name)); if (setting("phone", "")) out.push(center(setting("phone", "")));
    out.push(line, fold(L("receipt") + " " + String(r.id).slice(-6).toUpperCase() + "  " + dateFr(r.d)), line);
    saleLines(r).forEach(function (l) { out.push(two(qtyFmt(l.qty) + " x " + l.name, money(num(l.qty) * num(l.price)))); });
    out.push(line, two(L("total"), money(r.total)), two(L("paid"), money(r.paid)));
    if (num(r.total) - num(r.paid) > 0) out.push(two(L("rest"), money(num(r.total) - num(r.paid))));
    out.push(line, center(L("receiptThanks")), "", "", "");
    return out.join("\n");
  }
  function printDoc(body, opts) {
    opts = opts || {};
    var c = printCfg(), fmt = opts.a4 ? "a4" : (c.fmt || "a4"), d = window.SnsDesktop, html = docHtml(body, fmt);
    if (d && d.print) {
      d.print(html, { deviceName: c.printer || undefined, silent: !!c.printer, widthMm: fmt === "t58" ? 58 : fmt === "t80" ? 80 : 0 })
        .then(function (r) { toast(r && r.ok ? "🖨️ " + L("printSent") : "❌ " + L("printErr") + (r && r.error && r.error !== "cancelled" ? " (" + r.error + ")" : "")); });
      return;
    }
    if (!opts.a4 && c.rawbt && isAndroid() && opts.text) {
      var b64 = btoa(unescape(encodeURIComponent(opts.text)));
      window.location.href = "rawbt:base64," + b64;
      return;
    }
    var fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    document.body.appendChild(fr);
    var dd = fr.contentWindow.document; dd.open(); dd.write(html); dd.close();
    setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast("❌ " + L("printErr")); } setTimeout(function () { fr.remove(); }, 60000); }, 300);
  }
  function printReceipt() {
    var r = S.modal && getE("sale", S.modal.id); if (!r) return;
    printDoc(ticketBody(r), { text: ticketText(r) });
  }
  function printTest() {
    var r = { id: "TEST00", d: today(), lines: [{ name: "Article d'essai", qty: 2, price: 1500 }], total: 3000, paid: 3000, mode: "cash", _bn: (profile() || {}).name };
    printDoc(ticketBody(r), { text: ticketText(r) });
  }
  function printPage() {
    var el = root.querySelector(".gx-content"); if (!el) return;
    var clone = el.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll("button, input, select, .gx-periods, .gx-custom, .gx-tabs"), function (x) { if (x.closest(".gx-periods") || x.closest(".gx-tabs") || x.tagName !== "BUTTON" || !x.closest("table")) x.remove(); });
    var r = periodRange(S.period);
    printDoc('<h1>' + esc(S.name) + '</h1><p class="muted">' + esc(L(S.page === "ohada" ? (S.ohTab || "journal") : "reports")) + ' — ' + L("from") + ' ' + dateFr(r[0]) + ' ' + L("to") + ' ' + dateFr(r[1]) + '</p>' + clone.innerHTML.replace(/<i class="fa[^"]*"><\/i>/g, ""), { a4: true });
  }

  // ---------------- Comptabilité SYSCOHADA (écritures automatiques) ----------------
  var ACC = {
    "101": "Capital", "311": "Marchandises", "401": "Fournisseurs", "411": "Clients", "4118": "Sounsouni (ventes en ligne à encaisser)",
    "521": "Banques", "5521": "Orange Money", "5522": "Moov Money", "5523": "Wave", "571": "Caisse",
    "601": "Achats de marchandises", "6031": "Variation des stocks de marchandises", "605": "Autres achats (eau, électricité, fournitures)",
    "618": "Autres frais de transport", "622": "Locations et charges locatives", "624": "Entretien, réparations et maintenance",
    "628": "Frais de télécommunications", "641": "Impôts et taxes", "658": "Charges diverses", "661": "Rémunérations du personnel",
    "701": "Ventes de marchandises", "706": "Services vendus"
  };
  var CAT_ACC = { loyer: "622", transport: "618", elec: "605", sal: "661", com: "628", tax: "641", march: "605", rep: "624", autre: "658" };
  function treso(mode) { return mode === "om" ? "5521" : mode === "moov" ? "5522" : mode === "wave" ? "5523" : mode === "bank" ? "521" : mode === "sounsouni" ? "4118" : "571"; }
  function isSvcLine(l) { var it = l.item && getE("item", l.item); return !!(it && it.type === "service"); }
  function stockValueAt(dEnd) {
    var q = {};
    live("adjust").forEach(function (a) { if (a.d <= dEnd) q[a.item] = (q[a.item] || 0) + num(a.qty); });
    live("purchase").forEach(function (p) { if (p.d <= dEnd) (p.lines || []).forEach(function (l) { if (l.item) q[l.item] = (q[l.item] || 0) + num(l.qty); }); });
    live("sale").forEach(function (s) { if (s.d <= dEnd) saleLines(s).forEach(function (l) { if (l.item) q[l.item] = (q[l.item] || 0) - num(l.qty); }); });
    var v = 0; for (var id in q) { var it = getE("item", id); if (it && it.type !== "service") v += Math.max(0, q[id]) * num(it.cost); }
    return Math.round(v);
  }
  function isOpening(a) { return String(a.note || "") === FR.initialStock || String(a.note || "") === EN.initialStock; }
  // Toutes les écritures jusqu'à dEnd (date incluse) ; chaque écriture = { d, ref, lib, lines:[[compte, débit, crédit]] }
  function entries(dEnd) {
    var E = [], add = function (d, ref, lib, lines) { lines = lines.filter(function (x) { return Math.round(x[1]) || Math.round(x[2]); }); if (lines.length && d <= dEnd) E.push({ d: d, ref: ref, lib: lib, lines: lines }); };
    var st = getE("settings", "main");
    if (st && num(st.openingCash)) add(new Date(st._created || Date.now()).toISOString().slice(0, 10), "OUV", L("openingCash"), [["571", num(st.openingCash), 0], ["101", 0, num(st.openingCash)]]);
    live("adjust").forEach(function (a) { if (!isOpening(a) || num(a.qty) <= 0) return; var it = getE("item", a.item); var v = Math.round(num(a.qty) * (it ? num(it.cost) : 0)); if (v) add(a.d, "STK", L("initialStock") + " — " + (it ? it.name : ""), [["311", v, 0], ["101", 0, v]]); });
    live("sale").forEach(function (s) {
      var svc = 0, art = 0; saleLines(s).forEach(function (l) { var v = num(l.qty) * num(l.price); if (isSvcLine(l)) svc += v; else art += v; });
      var tot = num(s.total), k = tot && (svc + art) ? tot / (svc + art) : 1, paid = Math.min(num(s.paid), tot);
      var lib = L("sales") + (s.client ? " — " + partyName("client", s.client) : "") + (s.note ? " — " + s.note : "");
      add(s.d, "V" + String(s.id).slice(-5).toUpperCase(), lib, [[treso(s.mode), paid, 0], [s.mode === "sounsouni" ? "4118" : "411", tot - paid, 0], ["701", 0, Math.round(art * k)], ["706", 0, tot - Math.round(art * k)]]);
    });
    live("purchase").forEach(function (p) {
      var tot = num(p.total), paid = Math.min(num(p.paid), tot);
      add(p.d, "A" + String(p.id).slice(-5).toUpperCase(), L("purchases") + (p.supplier ? " — " + partyName("supplier", p.supplier) : ""), [["601", tot, 0], [treso(p.mode), 0, paid], ["401", 0, tot - paid]]);
    });
    live("expense").forEach(function (x) {
      add(x.d, "D" + String(x.id).slice(-5).toUpperCase(), catLabel(x.cat || "autre") + (x.employee ? " — " + partyName("employee", x.employee) : "") + (x.note ? " — " + x.note : ""), [[CAT_ACC[x.cat] || "658", num(x.amount), 0], [treso(x.mode), 0, num(x.amount)]]);
    });
    live("payment").forEach(function (p) {
      if (p.side === "client") add(p.d, "R" + String(p.id).slice(-5).toUpperCase(), L("payments") + " — " + partyName("client", p.party), [[treso(p.mode), num(p.amount), 0], ["411", 0, num(p.amount)]]);
      else add(p.d, "P" + String(p.id).slice(-5).toUpperCase(), L("payments") + " — " + partyName("supplier", p.party), [["401", num(p.amount), 0], [treso(p.mode), 0, num(p.amount)]]);
    });
    E.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    return E;
  }
  function dayBefore(d) { var t = new Date(d + "T12:00:00"); t.setDate(t.getDate() - 1); return t.toISOString().slice(0, 10); }
  // Inventaire de fin de période : variation des stocks (6031) pour [d1, d2].
  function variationEntry(d1, d2, all) {
    var si = d1 <= "0001" ? 0 : stockValueAt(dayBefore(d1)), sf = stockValueAt(d2), apports = 0;
    all.forEach(function (e) { if (e.ref === "STK" && e.d >= d1 && e.d <= d2) apports += e.lines[0][1]; });
    var v = Math.round(si + apports - sf); // > 0 : le stock a baissé (charge)
    return { d: d2, ref: "INV", lib: L("stockVar") + " (" + L("stock") + " " + money(sf) + ")", lines: v >= 0 ? [["6031", v, 0], ["311", 0, v]] : [["311", -v, 0], ["6031", 0, -v]], si: si, sf: sf };
  }
  function balances(list) { var b = {}; list.forEach(function (e) { e.lines.forEach(function (x) { var a = b[x[0]] || (b[x[0]] = { d: 0, c: 0 }); a.d += x[1]; a.c += x[2]; }); }); return b; }
  function accLabel(a) { return a + " " + (ACC[a] || ""); }
  function pOhada() {
    var r = periodRange(S.period), tab = S.ohTab || "journal";
    var all = entries(r[1]), inPer = all.filter(function (e) { return e.d >= r[0]; });
    var varE = variationEntry(r[0], r[1], all), perAll = inPer.concat([varE]);
    var h = periodBar() + '<div class="gx-tabs">';
    ["journal", "ledger", "trial", "incomeSt", "balanceSh"].forEach(function (t) { h += '<button class="' + (tab === t ? 'on' : '') + '" data-a="oh-tab" data-v="' + t + '">' + L(t) + '</button>'; });
    h += '</div><p class="gx-hint">' + L("ohadaNote") + '</p>';
    var tbl = function (head, rows, foot) {
      var t = '<div class="gx-table-wrap"><table class="gx-table gx-acc"><thead><tr>' + head.map(function (c) { return '<th' + (c.r ? ' class="r"' : '') + '>' + c.t + '</th>'; }).join("") + '</tr></thead><tbody>';
      t += rows.length ? rows.map(function (rw) { return '<tr' + (rw.cls ? ' class="' + rw.cls + '"' : '') + '>' + rw.c.map(function (v, i) { return '<td' + (head[i].r ? ' class="r"' : '') + '>' + v + '</td>'; }).join("") + '</tr>'; }).join("") : '<tr><td colspan="' + head.length + '">' + L("noData") + '</td></tr>';
      if (foot) t += '<tr class="gx-foot">' + foot.map(function (v, i) { return '<td' + (head[i].r ? ' class="r"' : '') + '>' + v + '</td>'; }).join("") + '</tr>';
      return t + '</tbody></table></div>';
    };
    var m = function (n) { return n ? money(n) : ""; };
    if (tab === "journal") {
      var rows = [], td = 0, tc = 0;
      perAll.forEach(function (e) { e.lines.forEach(function (x, i) { td += x[1]; tc += x[2]; rows.push({ cls: i === 0 ? "gx-first" : "", c: [i === 0 ? dateFr(e.d) : "", i === 0 ? esc(e.ref) : "", esc(accLabel(x[0])), i === 0 ? esc(e.lib) : "", m(x[1]), m(x[2])] }); }); });
      h += tbl([{ t: L("date") }, { t: "N°" }, { t: L("account") }, { t: L("label") }, { t: L("debit"), r: 1 }, { t: L("credit2"), r: 1 }], rows, ["", "", "", L("totals") + " — " + (Math.round(td) === Math.round(tc) ? "✅ " + L("balanced") : "❌ " + L("notBalanced")), money(td), money(tc)]);
    } else if (tab === "ledger" || tab === "trial") {
      var b = balances(perAll), accs = Object.keys(b).sort();
      if (tab === "trial") {
        var T = [0, 0, 0, 0];
        h += tbl([{ t: L("account") }, { t: L("debit"), r: 1 }, { t: L("credit2"), r: 1 }, { t: L("soldeD"), r: 1 }, { t: L("soldeC"), r: 1 }], accs.map(function (a) {
          var x = b[a], sd = Math.max(0, x.d - x.c), sc = Math.max(0, x.c - x.d); T[0] += x.d; T[1] += x.c; T[2] += sd; T[3] += sc;
          return { c: [esc(accLabel(a)), m(x.d), m(x.c), m(sd), m(sc)] };
        }), [L("totals"), money(T[0]), money(T[1]), money(T[2]), money(T[3])]);
      } else {
        accs.forEach(function (a) {
          var rows2 = [], sold = 0;
          perAll.forEach(function (e) { e.lines.forEach(function (x) { if (x[0] !== a) return; sold += x[1] - x[2]; rows2.push({ c: [dateFr(e.d), esc(e.ref), esc(e.lib), m(x[1]), m(x[2]), money(sold)] }); }); });
          h += '<div class="gx-card"><h3>' + esc(accLabel(a)) + '</h3>' + tbl([{ t: L("date") }, { t: "N°" }, { t: L("label") }, { t: L("debit"), r: 1 }, { t: L("credit2"), r: 1 }, { t: L("balance"), r: 1 }], rows2, null) + '</div>';
        });
        if (!accs.length) h += empty();
      }
    } else if (tab === "incomeSt") {
      var b2 = balances(perAll), ch = [], pr = [], tch = 0, tpr = 0;
      Object.keys(b2).sort().forEach(function (a) { var x = b2[a]; if (a.charAt(0) === "6") { var v = x.d - x.c; tch += v; ch.push({ c: [esc(accLabel(a)), money(v)] }); } else if (a.charAt(0) === "7") { var v2 = x.c - x.d; tpr += v2; pr.push({ c: [esc(accLabel(a)), money(v2)] }); } });
      h += '<div class="gx-grid2"><div>' + tbl([{ t: L("charges") }, { t: L("amount"), r: 1 }], ch, [L("totals"), money(tch)]) + '</div><div>' + tbl([{ t: L("produits") }, { t: L("amount"), r: 1 }], pr, [L("totals"), money(tpr)]) + '</div></div>';
      h += '<div class="gx-kpis">' + kpi(L("resultat"), money(tpr - tch), tpr - tch < 0 ? "red" : "green", "fa-scale-balanced") + '</div>';
    } else {
      // Bilan à la date de fin : tout depuis le début + inventaire final
      var cum = all.concat([variationEntry("0000-01-01", r[1], all)]), b3 = balances(cum), act = [], pas = [], ta = 0, tp = 0, res = 0;
      Object.keys(b3).sort().forEach(function (a) {
        var x = b3[a], s = x.d - x.c, c1 = a.charAt(0);
        if (c1 === "6") { res -= s; return; } if (c1 === "7") { res -= s; return; }
        if (a === "101" || a === "401" || ((c1 === "5") && s < 0)) { pas.push({ c: [esc(accLabel(a)), money(-s)] }); tp += -s; }
        else { act.push({ c: [esc(accLabel(a)), money(s)] }); ta += s; }
      });
      pas.push({ cls: "gx-first", c: [L("resultat"), money(res)] }); tp += res;
      h += '<div class="gx-grid2"><div>' + tbl([{ t: L("actif") }, { t: L("amount"), r: 1 }], act, [L("totals"), money(ta)]) + '</div><div>' + tbl([{ t: L("passif") }, { t: L("amount"), r: 1 }], pas, [L("totals"), money(tp)]) + '</div></div>';
      h += '<p class="gx-hint">' + (Math.round(ta) === Math.round(tp) ? "✅ " + L("balanced") : "❌ " + L("notBalanced")) + ' — ' + L("to") + ' ' + dateFr(r[1]) + '</p>';
    }
    return h;
  }
  function csvOhada() {
    var r = periodRange(S.period), all = entries(r[1]), list = all.filter(function (e) { return e.d >= r[0]; }).concat([variationEntry(r[0], r[1], all)]);
    var out = [["Date", "Piece", "Compte", "Intitule", "Libelle", "Debit", "Credit"]];
    list.forEach(function (e) { e.lines.forEach(function (x) { out.push([e.d, e.ref, x[0], ACC[x[0]] || "", e.lib, Math.round(x[1]) || "", Math.round(x[2]) || ""]); }); });
    var csv = "﻿" + out.map(function (r2) { return r2.map(function (v) { var s2 = String(v == null ? "" : v); return /[";\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2; }).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "journal-syscohada-" + r[0] + "-" + r[1] + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
  }

  // ---------------- Styles ----------------
  function injectCss() {
    if (document.getElementById("gx-css")) return;
    var css = [
      "html.gx-open,html.gx-open body{overflow:hidden}",
      "#gx-root{position:fixed;inset:0;z-index:99000;display:none;font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;--g:#2e7d32;--g2:#7bcb3a;--bg:#f3f6f1;--card:#fff;--tx:#1a1a2e;--dim:#6b7280;--bd:#e5e9e2;--red:#d93848;--warn:#c77700;background:var(--bg);color:var(--tx);font-size:14px}",
      "#gx-root.gx-dark{--bg:#10140f;--card:#1a2019;--tx:#eef2ea;--dim:#9aa59a;--bd:#2a3229}",
      "#gx-root *{box-sizing:border-box}#gx-modal{display:contents}",
      "#gx-root button{font-family:inherit;cursor:pointer}",
      ".gx-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:100%;padding:24px;text-align:center;color:var(--dim)}",
      ".gx-pinbox img{width:72px;height:72px;border-radius:18px}.gx-pinbox input{font-size:26px;letter-spacing:10px;text-align:center;width:200px;padding:10px;border-radius:14px;border:2px solid var(--bd);background:var(--card);color:var(--tx)}",
      // téléphone
      "#gx-root.gx{display:block}#gx-root.gx-narrow{display:flex;flex-direction:column}",
      ".gx-narrow .gx-top{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:var(--g);color:#fff;flex:0 0 auto}",
      ".gx-narrow .gx-title{flex:1;min-width:0;display:flex;flex-direction:column}.gx-narrow .gx-title b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gx-narrow .gx-title span{font-size:11px;opacity:.85}",
      ".gx-narrow .gx-top .gx-icon{color:#fff;background:rgba(255,255,255,.15)}",
      ".gx-narrow .gx-main{flex:1;overflow-y:auto;overflow-x:hidden;padding:12px 12px 90px;-webkit-overflow-scrolling:touch}",
      ".gx-narrow .gx-sync{font-size:10.5px;padding:4px 8px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;white-space:nowrap}",
      ".gx-actions-m{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.gx-actions-m:empty{display:none}.gx-actions-m .gx-btn{flex:1 1 auto;justify-content:center}",
      ".gx-bottom{position:fixed;left:0;right:0;bottom:0;display:flex;background:var(--card);border-top:1px solid var(--bd);padding-bottom:env(safe-area-inset-bottom);z-index:2}",
      ".gx-bottom button{flex:1;min-width:0;background:none;border:0;padding:8px 2px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--dim);font-size:10px}.gx-bottom button i{font-size:17px}.gx-bottom button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gx-bottom button.on{color:var(--g);font-weight:800}",
      // grand écran
      "#gx-root.gx-wide{display:grid;grid-template-columns:250px minmax(0,1fr);height:100%}",
      ".gx-side{background:#163a19;color:#e8f3e3;display:flex;flex-direction:column;padding:18px 12px;overflow-y:auto}",
      ".gx-brand{display:flex;gap:10px;align-items:center;padding:0 6px 18px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:12px}.gx-brand img{width:40px;height:40px;border-radius:10px}.gx-brand b{display:block;font-size:14px}.gx-brand span{font-size:12px;opacity:.75;display:block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".gx-nav{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;color:inherit;padding:10px 12px;border-radius:10px;font-size:14px;text-align:left;opacity:.85}.gx-nav i{width:18px;text-align:center}.gx-nav:hover{background:rgba(255,255,255,.07);opacity:1}.gx-nav.on{background:var(--g2);color:#10300f;font-weight:800;opacity:1}",
      ".gx-side-foot{margin-top:auto;padding-top:14px;display:flex;flex-direction:column;gap:8px}.gx-side-foot .gx-btn{color:#e8f3e3;border-color:rgba(255,255,255,.25)}.gx-role{font-size:11px;opacity:.7;padding:0 6px}",
      ".gx-wide .gx-main{overflow-y:auto;padding:0 28px 40px}",
      ".gx-wide .gx-top{position:sticky;top:0;z-index:2;background:var(--bg);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0 14px}.gx-wide .gx-top h1{margin:0;font-size:24px}.gx-top-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}",
      ".gx-wide .gx-sync{font-size:12px;padding:6px 10px;border-radius:20px;background:var(--card);border:1px solid var(--bd)}",
      ".gx-sync.ok{color:var(--g)}.gx-sync.wait{color:var(--warn)}.gx-sync.off{color:var(--red)}",
      ".gx-wide .gx-content{max-width:1400px}",
      // éléments
      ".gx-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:12px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font-weight:700;font-size:13px;text-decoration:none;line-height:1.2}.gx-btn:disabled{opacity:.5}",
      ".gx-primary{background:var(--g);border-color:var(--g);color:#fff}.gx-ghost{background:transparent}.gx-small{padding:6px 10px;font-size:12px;margin-bottom:10px}",
      ".gx-btn.red,.gx-icon.red,.red{color:var(--red)}.green{color:var(--g)}.warn{color:var(--warn)}",
      ".gx-icon{width:36px;height:36px;border-radius:10px;border:0;background:var(--bd);color:var(--tx);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}",
      ".gx-card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:14px;margin-bottom:12px}.gx-card h3{margin:0 0 10px;font-size:14px}.gx-card p{margin:6px 0}",
      ".gx-hello{background:linear-gradient(135deg,#2e7d32,#5fa83a);color:#fff;border:0}.gx-hello h2{margin:0 0 4px;font-size:18px}.gx-hello .gx-btn{margin-top:8px}",
      ".gx-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}.gx-wide .gx-kpis{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}",
      ".gx-kpi{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:12px;min-width:0}.gx-kpi span{display:block;font-size:11.5px;color:var(--dim);margin-bottom:6px;line-height:1.3}.gx-kpi b{font-size:17px;word-break:break-word}.gx-wide .gx-kpi b{font-size:21px}",
      ".gx-kpi.green b{color:var(--g)}.gx-kpi.red b{color:var(--red)}.gx-kpi.warn b{color:var(--warn)}.gx-kpis.small{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}",
      ".gx-banner{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#e8f5e3;border:1px solid #cfe6c6;color:#245d27;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:13px}.gx-banner.warn{background:#fff6e5;border-color:#f3dcaa;color:#8a5600}.gx-banner.bad{background:#fdecee;border-color:#f5c2c8;color:#a1202f}.gx-dark .gx-banner{background:#1d2b1c;color:#cfe8c7;border-color:#2f4a2d}",
      ".gx-list{display:flex;flex-direction:column;gap:6px}",
      ".gx-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:10px 12px;color:var(--tx)}.gx-row.static{cursor:default}",
      ".gx-row-t{flex:1;min-width:0}.gx-row-t b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gx-row-t span{display:block;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".gx-row-v{font-weight:800;white-space:nowrap;font-size:13.5px;display:flex;align-items:center;gap:6px}.gx-row-v select{max-width:120px}",
      ".gx-line{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:7px 2px;border-bottom:1px dashed var(--bd);font-size:13px}.gx-line span{min-width:0;overflow:hidden;text-overflow:ellipsis}.gx-line b{white-space:nowrap}",
      ".gx-meter{flex:1;height:8px;background:var(--bd);border-radius:6px;overflow:hidden;min-width:40px}.gx-meter i{display:block;height:100%;background:var(--g2)}",
      ".gx-table-wrap{background:var(--card);border:1px solid var(--bd);border-radius:14px;overflow:auto}",
      ".gx-table{width:100%;border-collapse:collapse;font-size:13.5px}.gx-table th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--dim);padding:11px 14px;border-bottom:1px solid var(--bd);background:var(--card);position:sticky;top:0}",
      ".gx-table td{padding:11px 14px;border-bottom:1px solid var(--bd)}.gx-table tbody tr{cursor:pointer}.gx-table tbody tr:hover{background:rgba(123,203,58,.08)}.gx-table .r{text-align:right;white-space:nowrap}.gx-table td.r:last-child{font-weight:800}",
      ".gx-tag{font-style:normal;font-size:10.5px;padding:2px 7px;border-radius:20px;background:var(--bd);color:var(--dim);font-weight:700;white-space:nowrap}.gx-tag.warn{background:#fff1d6;color:#8a5600}",
      ".gx-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.gx-sum{font-size:13px;color:var(--dim)}.gx-sum b{color:var(--tx)}",
      ".gx-search{flex:1 1 200px;min-width:0;padding:10px 12px;border-radius:12px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font-size:14px}",
      ".gx-check{font-size:12.5px;display:flex;align-items:center;gap:6px;color:var(--dim)}",
      ".gx-periods{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px}.gx-periods button{flex:0 0 auto;border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:20px;padding:7px 12px;font-size:12.5px}.gx-periods button.on{background:var(--g);border-color:var(--g);color:#fff;font-weight:800}",
      ".gx-custom{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;font-size:13px}.gx-custom input{padding:7px;border-radius:10px;border:1px solid var(--bd);background:var(--card);color:var(--tx)}",
      ".gx-chips{display:flex;flex-wrap:wrap;gap:6px}.gx-chip{border:1px solid var(--bd);background:var(--card);border-radius:20px;padding:6px 10px;font-size:12px;color:var(--tx)}.gx-chip.bad{border-color:#f5c2c8;color:var(--red)}.gx-chip.warn{border-color:#f3dcaa;color:var(--warn)}",
      ".gx-empty{text-align:center;color:var(--dim);padding:22px 10px}.gx-empty i{font-size:26px;opacity:.6}",
      ".gx-grid2{display:grid;grid-template-columns:1fr;gap:0 14px}.gx-wide .gx-grid2{grid-template-columns:1fr 1fr}",
      ".gx-bars{display:flex;align-items:flex-end;gap:4px;height:150px;overflow-x:auto;padding-top:6px}.gx-bar{flex:1 0 18px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}.gx-bar i{display:block;width:100%;background:linear-gradient(180deg,var(--g2),var(--g));border-radius:5px 5px 2px 2px;min-height:2px}.gx-bar span{font-size:9.5px;color:var(--dim);white-space:nowrap}",
      ".gx-more{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.gx-more button{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:16px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--tx);font-size:12px;font-weight:700}.gx-more button i{font-size:22px;color:var(--g)}",
      ".gx-tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px}.gx-tabs button{flex:0 0 auto;border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:700}.gx-tabs button.on{background:#163a19;color:#fff;border-color:#163a19}",
      ".gx-acc td{font-size:12.5px;padding:7px 10px}.gx-acc tbody tr{cursor:default}.gx-acc tr.gx-first td{border-top:2px solid var(--bd)}.gx-acc tr.gx-foot td{font-weight:800;background:rgba(123,203,58,.1)}",
      ".gx-soon{color:var(--dim)}.gx-hint{font-size:12.5px;color:var(--dim)}",
      ".gx-form-inline{display:flex;gap:8px;flex-wrap:wrap}.gx-form-inline input,.gx-form-inline select{flex:1 1 160px;min-width:0;padding:10px;border-radius:12px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font-size:14px}",
      ".gx-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--dim);margin-bottom:10px;min-width:0}.gx-field input,.gx-field select,.gx-row-v select{padding:10px;border-radius:11px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font-size:15px;font-weight:600;min-width:0;width:100%}",
      ".gx-fgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 10px}",
      // fenêtres
      ".gx-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;z-index:5}",
      ".gx-sheet{position:relative;background:var(--card);color:var(--tx);width:100%;max-height:92vh;overflow-y:auto;border-radius:20px 20px 0 0;padding:18px 14px calc(16px + env(safe-area-inset-bottom))}",
      ".gx-wide .gx-overlay{align-items:center}.gx-wide .gx-sheet{width:560px;border-radius:20px;padding:24px}.gx-wide .gx-sheet.big{width:860px}",
      ".gx-sheet h2{margin:0 36px 12px 0;font-size:17px}.gx-sheet h3{font-size:14px;margin:14px 0 8px}.gx-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:0;background:var(--bd);color:var(--tx)}",
      ".gx-sheet-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end}.gx-narrow .gx-sheet-foot .gx-btn{flex:1 1 auto;justify-content:center}",
      ".gx-total{text-align:right;font-size:15px;margin:10px 0}.gx-total b{font-size:21px;color:var(--g)}",
      ".gx-lines{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}",
      ".gx-lrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:'n n t' 'q p d';gap:6px 8px;align-items:center;border:1px solid var(--bd);border-radius:12px;padding:8px}",
      ".gx-wide .gx-lrow{grid-template-columns:1fr auto 110px 110px 36px;grid-template-areas:'n q p t d'}",
      ".gx-lname{grid-area:n;min-width:0;font-weight:700;font-size:13.5px}.gx-lname small{display:block;font-weight:500;color:var(--dim);font-size:11px}.gx-lname input{width:100%;padding:8px;border-radius:9px;border:1px solid var(--bd);background:var(--card);color:var(--tx)}",
      ".gx-qty{grid-area:q;display:flex;align-items:center}.gx-qty button{width:34px;height:34px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font-size:18px;border-radius:9px}.gx-qty input{width:52px;text-align:center;padding:7px 2px;border:1px solid var(--bd);border-radius:9px;margin:0 4px;background:var(--card);color:var(--tx);font-size:14px}",
      ".gx-lprice{grid-area:p;width:100%;padding:8px;border-radius:9px;border:1px solid var(--bd);text-align:right;background:var(--card);color:var(--tx);font-size:14px}.gx-ltot{grid-area:t;text-align:right;white-space:nowrap}.gx-lrow .gx-icon{grid-area:d;justify-self:end;width:32px;height:32px}",
      ".gx-picker{border:1px dashed var(--bd);border-radius:14px;padding:8px;margin-bottom:6px}.gx-pick-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:170px;overflow-y:auto}",
      ".gx-pick-list button{border:1px solid var(--bd);background:var(--bg);color:var(--tx);border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:700;text-align:left;max-width:100%}.gx-pick-list button small{display:block;font-weight:500;color:var(--dim);font-size:11px}.gx-pick-list .gx-other{color:var(--g)}",
      ".gx-meta{font-size:11.5px;color:var(--dim);margin-top:10px}.gx-hist{font-size:11.5px;color:var(--dim);margin-top:6px}.gx-hist div{padding:3px 0}",
      ".gx-receipt{border:1px dashed var(--bd);border-radius:12px;padding:14px;text-align:left}.gx-receipt h2{margin:0 0 4px}",
      "@media (max-width:360px){.gx-fgrid{grid-template-columns:1fr}.gx-kpi b{font-size:15px}}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "gx-css"; st.textContent = css; document.head.appendChild(st);
  }

  window.SnsGestion = { open: open, close: close, isOpen: function () { return !!S; }, onPaid: function () { if (S) pullNow(); } };
})();
