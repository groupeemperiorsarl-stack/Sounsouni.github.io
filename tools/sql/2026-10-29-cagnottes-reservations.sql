-- Audit 28/10/2026 (ARG-3, ARG-4) — déjà appliqué le 29/10/2026.
-- Cagnottes et réservations : plus aucune écriture directe depuis internet.
-- Elles passent par la fonction serveur secure-write (règles ruleCagnotte /
-- ruleBooking) ; l'argent des cagnottes par wallet-write ; le paiement des
-- réservations par ligdicash-callback / ligdicash-check.
create policy "cagnottes_bookings_no_direct_insert" on public.app_data as restrictive for insert to anon, authenticated
  with check (collection <> all (array['cagnottes'::text, 'bookings'::text]));
create policy "cagnottes_bookings_no_direct_update" on public.app_data as restrictive for update to anon, authenticated
  using (collection <> all (array['cagnottes'::text, 'bookings'::text]))
  with check (collection <> all (array['cagnottes'::text, 'bookings'::text]));
create policy "cagnottes_bookings_no_direct_delete" on public.app_data as restrictive for delete to anon, authenticated
  using (collection <> all (array['cagnottes'::text, 'bookings'::text]));
