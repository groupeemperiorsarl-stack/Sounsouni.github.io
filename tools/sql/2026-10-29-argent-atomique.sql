-- Audit de sécurité du 28/10/2026 — faille ARG-2 (double versement par
-- demandes simultanées). Deux petites fonctions SQL utilisées UNIQUEMENT par
-- les fonctions serveur (clé service) :
--  * sns_wallet_batch : mouvements d'argent (portefeuilles et gains) faits en
--    une seule transaction, avec verrou sur chaque portefeuille, refus si le
--    solde devient négatif, et « clé unique » pour qu'un même versement ne
--    puisse jamais être fait deux fois.
--  * sns_doc_patch : modifie seulement quelques champs d'un document, et
--    seulement s'il est encore dans l'état attendu (ex. cagnotte « active »).
-- Personne d'autre (téléphone, clé publique) ne peut les appeler.

create or replace function public.sns_wallet_batch(p_ops jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  op jsonb;
  k record;
  coll text;
  wid text;
  fld text;
  cur jsonb;
  val numeric;
  ukey text;
  tx jsonb;
  out_bal jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'invalid_ops';
  end if;
  -- 1) Crée les documents manquants puis verrouille-les, toujours dans le
  --    même ordre (évite que deux demandes se bloquent l'une l'autre).
  for k in
    select distinct o->>'coll' as c, regexp_replace(coalesce(o->>'phone', ''), '[\s.\-()]', '', 'g') as i, o->>'phone' as ph
    from jsonb_array_elements(p_ops) o
    order by 1, 2
  loop
    if k.c not in ('wallets', 'earningsLedgers') or k.i = '' then
      raise exception 'invalid_target';
    end if;
    insert into app_data (collection, id, data, updated_at)
    values (k.c, k.i,
      case when k.c = 'wallets'
        then jsonb_build_object('id', k.i, 'phone', k.ph, 'balance', 0, 'transactions', '[]'::jsonb)
        else jsonb_build_object('id', k.i, 'phone', k.ph, 'total', 0, 'transactions', '[]'::jsonb) end,
      now())
    on conflict (collection, id) do nothing;
    perform 1 from app_data where collection = k.c and id = k.i for update;
  end loop;
  -- 2) Applique chaque mouvement.
  for op in select * from jsonb_array_elements(p_ops)
  loop
    coll := op->>'coll';
    wid := regexp_replace(coalesce(op->>'phone', ''), '[\s.\-()]', '', 'g');
    fld := case when coll = 'wallets' then 'balance' else 'total' end;
    ukey := nullif(op->>'key', '');
    select data into cur from app_data where collection = coll and id = wid;
    if ukey is not null and exists (
      select 1 from jsonb_array_elements(coalesce(cur->'transactions', '[]'::jsonb)) t where t->>'uniqueKey' = ukey
    ) then
      raise exception 'duplicate';
    end if;
    val := coalesce((cur->>fld)::numeric, 0) + coalesce((op->>'delta')::numeric, 0);
    if coll = 'wallets' and val < 0 then
      raise exception 'insufficient_balance';
    end if;
    tx := coalesce(op->'txn', '{}'::jsonb);
    if ukey is not null then tx := tx || jsonb_build_object('uniqueKey', ukey); end if;
    update app_data
      set data = jsonb_set(
            jsonb_set(cur, array[fld], to_jsonb(val)),
            '{transactions}', coalesce(cur->'transactions', '[]'::jsonb) || jsonb_build_array(tx)),
          updated_at = now()
      where collection = coll and id = wid;
    out_bal := out_bal || jsonb_build_object(coll || ':' || wid, val);
  end loop;
  return jsonb_build_object('ok', true, 'balances', out_bal);
end;
$$;

create or replace function public.sns_doc_patch(p_collection text, p_id text, p_patch jsonb, p_expect jsonb default null)
returns jsonb
language sql
set search_path = public
as $$
  update app_data
     set data = data || p_patch, updated_at = now()
   where collection = p_collection and id = p_id
     and (p_expect is null or data @> p_expect)
  returning data;
$$;

revoke all on function public.sns_wallet_batch(jsonb) from public, anon, authenticated;
revoke all on function public.sns_doc_patch(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sns_wallet_batch(jsonb) to service_role;
grant execute on function public.sns_doc_patch(text, text, jsonb, jsonb) to service_role;
