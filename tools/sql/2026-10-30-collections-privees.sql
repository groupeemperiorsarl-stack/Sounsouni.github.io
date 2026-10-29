-- Audit 28/10/2026 (BDD-3, BDD-4, BDD-5, CMD-4) — déjà appliqué le 30/10/2026
-- (migration collections_privees_2026_10_30).
-- Ces collections ne sont plus lisibles ni modifiables directement depuis
-- internet : lecture via la fonction personal-data (« privates »), écriture
-- via secure-write (règles par collection). Les avis (reviews) restent
-- lisibles par tous, mais ne s'écrivent plus que via secure-write.
create policy "private_collections_no_direct_read" on public.app_data as restrictive for select to anon, authenticated
  using (collection <> all (array['verificationRequests','livreurApplications','relaisApplications','relaisEditRequests','autreQuartierApplications','adminConversations','fcmTokens','pushSubscriptions','externalParcelChangeRequests','passwordRecoveryRequests','pendingPayments','disputes','externalParcels','filatureLogs']::text[]));
create policy "private_collections_no_direct_insert" on public.app_data as restrictive for insert to anon, authenticated
  with check (collection <> all (array['verificationRequests','livreurApplications','relaisApplications','relaisEditRequests','autreQuartierApplications','adminConversations','fcmTokens','pushSubscriptions','externalParcelChangeRequests','passwordRecoveryRequests','pendingPayments','disputes','externalParcels','filatureLogs','reviews']::text[]));
create policy "private_collections_no_direct_update" on public.app_data as restrictive for update to anon, authenticated
  using (collection <> all (array['verificationRequests','livreurApplications','relaisApplications','relaisEditRequests','autreQuartierApplications','adminConversations','fcmTokens','pushSubscriptions','externalParcelChangeRequests','passwordRecoveryRequests','pendingPayments','disputes','externalParcels','filatureLogs','reviews']::text[]))
  with check (collection <> all (array['verificationRequests','livreurApplications','relaisApplications','relaisEditRequests','autreQuartierApplications','adminConversations','fcmTokens','pushSubscriptions','externalParcelChangeRequests','passwordRecoveryRequests','pendingPayments','disputes','externalParcels','filatureLogs','reviews']::text[]));
create policy "private_collections_no_direct_delete" on public.app_data as restrictive for delete to anon, authenticated
  using (collection <> all (array['verificationRequests','livreurApplications','relaisApplications','relaisEditRequests','autreQuartierApplications','adminConversations','fcmTokens','pushSubscriptions','externalParcelChangeRequests','passwordRecoveryRequests','pendingPayments','disputes','externalParcels','filatureLogs','reviews']::text[]));
