# Chantier Pays partenaires + Transitaire — état au 04/11/2026
Décisions d'Issa : livraison Bamako payée au choix (transitaire ou destinataire, par colis) ; fret international géré par le transitaire OU encaissé par l'app (option Admin par transitaire, commission %) ; Sounsouni récupère à l'aéroport/port ; douane : option Admin (transitaire ou destinataire) ; le collègue en Chine = transitaire + agent de sourcing ; tarif livraison = prix par colis selon zone + prix/kg au-delà d'un poids ; colis non retiré au Point de Retrait : tâche « appeler » après 3 jours (réglable), injoignable après plusieurs essais → prévenir le transitaire.

## FAIT (branche transitaire, app NON publiée ; serveur déjà en ligne, compatible avec l'app actuelle)
- js/app.js : pays partenaires (Admin > Sécurité : taux par pays + ajout de pays ; Admin > International : tarifs transport par pays) ; agents de sourcing par pays (liste blanche avec pays, vendeurs ne voient que les agents de leur pays) ; commandes internationales avec intlCountry/intlCurrency, plus de ₹ en dur.
- Module Transitaire : Espace Transitaire (menu des rôles), annonce de colis (Point de Retrait ou domicile, lot, fret), Admin > Partenaires > Transitaires (réglages par transitaire, tarifs par zone, arrivée par lot, douane, colis à appeler, règlement), livreur à domicile avec code vérifié par le serveur, Point de Retrait voit « À encaisser ».
- Serveur déployé le 04/11 (commit 9051896) : secure-write v43, personal-data v36, order-write v37, ligdicash-create-payment v8.
- Tests : tools/tests/test-transitaire.ts (35) + anciens (161) ; écrans : tools/tests/navigateur/test-transitaire-ecrans.py (63).

## RESTE
- Publier la branche transitaire sur main (décision d'Issa) puis ajouter le transitaire Chine dans Admin > Partenaires.
- Plus tard : versement automatique du fret aux transitaires (LigdiCash payout), traduction anglais/hindi des écrans transitaire.

Déploiement fonctions : wrapper import raw.githubusercontent.com/.../<commit>/tools/fonctions/X.ts (marche).
