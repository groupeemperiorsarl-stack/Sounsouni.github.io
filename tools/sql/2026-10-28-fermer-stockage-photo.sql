-- Audit de sécurité du 28/10/2026 (failles BDD-1 et BDD-2)
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Effet : on peut toujours AJOUTER des photos dans les dossiers du site,
-- mais plus personne ne peut lister, remplacer ou supprimer les fichiers
-- des autres. Les pièces d'identité ne peuvent plus être déposées dans le
-- stockage public (elles vont dans le coffre privé « verif »).
-- Les photos restent visibles normalement sur le site (seau public).

drop policy if exists "Modification ouverte photo" on storage.objects;
drop policy if exists "Suppression ouverte photo" on storage.objects;
drop policy if exists "Lecture ouverte photo (v2)" on storage.objects;
drop policy if exists "Envoi ouvert photo" on storage.objects;

create policy "Envoi photo dossiers du site" on storage.objects for insert to public
with check (
  bucket_id = 'photo'
  and (storage.foldername(name))[1] in ('products', 'shop', 'brand', 'vipads', 'chat', 'bgpattern', 'thumbs')
  and name not like 'thumbs/verification/%'
);

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/*', 'video/*', 'audio/*']
where id = 'photo';
