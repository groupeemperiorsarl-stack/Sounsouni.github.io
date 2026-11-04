// Données de démonstration pour les vidéos (jamais envoyées : réseau simulé).
window.noteSessionRejected = function(){}; window.ensureFreshSession = function(){};
window.renderDownloadNudge = function(){ return ''; };
(function(){
  var now = Date.now(), H = 3600000, D = 86400000;
  state.language = 'fr';
  state.accounts = [
    {id:"T", name:"Wang Lei", phone:"+8613900000002", country:"Chine", isSourcingAgent:true},
    {id:"R", name:"Moussa", shopName:"Point Sotuba", phone:"+22370000005", relaisApplicationStatus:"approved", commune:"Commune I", quartier:"Sotuba"},
    {id:"R2", name:"Fanta", shopName:"Boutique Kalaban", phone:"+22370000006", relaisApplicationStatus:"approved", commune:"Commune VI", quartier:"Kalaban Coura"},
    {id:"R3", name:"Ali", shopName:"Point Badalabougou", phone:"+22370000007", relaisApplicationStatus:"approved", commune:"Commune V", quartier:"Badalabougou"},
    {id:"L", name:"Seydou", phone:"+22370000003", role:"livreur", livreurApplicationStatus:"approved"},
    {id:"B1", name:"Awa Traoré", phone:"+22370112233", country:"Mali"},
    {id:"SC", name:"Li Na", shopName:"Shenzhen Phone Store", phone:"+8613800000001", country:"Chine", sellerType:"international", sourcingAgentId:"T", shopAddress:"Huaqiangbei, Futian, Shenzhen"}
  ];
  state.sourcingAgentWhitelist = [{id:"w1", phone:"+8613900000002", name:"Wang Lei", country:"Chine"}];
  state.settings = (state.settings || []).filter(function(x){ return ["transitaires","exchange_rate_cny_xof","intl_countries","transitaire_config"].indexOf(x.id) === -1; });
  state.settings.push({id:"intl_countries", list:["Inde","Chine"]});
  state.settings.push({id:"exchange_rate_cny_xof", mode:"manual", manualRate:84, currency:"CNY"});
  state.settings.push({id:"transitaires", list:[{id:"t1", phone:"+8613900000002", name:"Wang Transit", country:"Chine", deliveryPayer:"choix", freightMode:"app", commissionPct:10, customsBy:"destinataire", active:true}]});
  var mk = function(o){ return Object.assign({platform:"Transitaire", transitaireId:"T", transitaireName:"Wang Transit", transitairePhone:"+8613900000002", transitaireCountry:"Chine", deliveryPaidBy:"destinataire", freightMode:"app", freightCurrency:"CNY", freightRate:84, customsBy:"destinataire", customsXof:null, codeDepot:"5521", callAttempts:0, settled:false}, o); };
  window.DEMO_PARCELS = {
    annonce: mk({id:"p1", trackingNumber:"TR-8K2Q4M", lotNumber:"LTA 235-4471", recipientName:"Awa Traoré", recipientPhone:"70112233", weight:7, deliveryType:"relais", relaisShopId:"R", relaisShopName:"Point Sotuba", deliveryFeeXof:1400, freightAmount:100, freightXof:8400, status:"Annoncé", codeRetrait:"4137", createdAt:now, statusHistory:[{status:"Annoncé", at:now}]}),
    domicile: mk({id:"p2", trackingNumber:"TR-5H7W2C", lotNumber:"LTA 235-4471", recipientName:"Fanta Diarra", recipientPhone:"76554433", weight:2, deliveryType:"domicile", address:{commune:"Commune V", quartier:"Badalabougou", repere:"Près du lycée"}, deliveryFeeXof:2000, freightAmount:0, freightXof:0, status:"Annoncé", codeRetrait:"6066", createdAt:now-2*H, statusHistory:[{status:"Annoncé", at:now-2*H}]}),
    suivi: mk({id:"p3", trackingNumber:"TR-3J9D1K", lotNumber:"LTA 231-0907", recipientName:"Moussa Keïta", recipientPhone:"66778899", weight:3, deliveryType:"relais", relaisShopId:"R2", relaisShopName:"Boutique Kalaban", deliveryFeeXof:1000, freightAmount:60, freightXof:5040, customsXof:2500, status:"Retiré", codeRetrait:"1180", createdAt:now-6*D,
      statusHistory:[{status:"Annoncé", at:now-6*D}, {status:"Créé", at:now-2*D-5*H}, {status:"Pris en charge par le livreur", at:now-2*D-3*H}, {status:"Reçu au point de retrait", at:now-2*D-2*H}, {status:"Disponible pour retrait", at:now-2*D-2*H+600000}, {status:"Retiré", at:now-D-4*H}]})
  };
  state.externalParcels = [window.DEMO_PARCELS.annonce, window.DEMO_PARCELS.domicile];
  state.orders = [];
  state.notifications = [];
  state.profile = Object.assign({}, state.accounts[0]);
  state.adminUnlocked = false; state.view = "market"; state.showRoleMenu = false;
  window.DEMO_ORDER = function(status, extra){
    var hist = [], flow = ["Paiement reçu","Vérification agent","Transitaire","En transit","Arrivé","En route","Livrée"], at = now - 9*D;
    var notes = {"Arrivé":"Colis scanné à Bamako par l'équipe Sounsouni"};
    for (var i = 0; i <= flow.indexOf(status); i++) { hist.push({status:flow[i], at:at, note:notes[flow[i]]||null}); at += (i < 3 ? 1.2*D : (i === 3 ? 3*D : 5*H)); }
    return Object.assign({id:"ord8f3ab12c", isInternational:true, country:"Chine", intlCountry:"Chine", intlCurrency:"CNY", buyerId:"B1", buyerName:"Awa Traoré", buyerPhone:"70112233", items:[{productId:"p", name:"Coque iPhone 15 antichoc", qty:20, price:12, sellerId:"SC", sellerName:"Shenzhen Phone Store"}, {productId:"p2", name:"Câble USB-C 2 m", qty:30, price:6, sellerId:"SC", sellerName:"Shenzhen Phone Store"}], totalInr:420, total:61280, status:status, statusHistory:hist, createdAt:now-9*D, shippingMode:"aerien", otp:"4321", city:"Bamako", zone:"Commune I", commune:"Commune I", quartier:"Sotuba", payment:"ligdicash", paymentStatus:"paid", specialInstructions:""}, extra||{});
  };
})();
