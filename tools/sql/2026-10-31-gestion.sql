-- Sounsouni Gestion (31/10/2026) : gestion et comptabilité des entreprises.
-- Trois tables à part (pas dans app_data). Personne ne les lit ni ne les
-- écrit directement : tout passe par la fonction serveur gestion-sync
-- (clé service), qui vérifie le rôle de chaque membre.
create table if not exists public.gestion_companies (
  id text primary key,
  owner_id text not null,
  owner_phone text not null,
  name text not null,
  shop_id text,
  plan text not null default 'free',        -- free | offert
  paid_until bigint not null default 0,      -- fin de l'abonnement (ms)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.gestion_members (
  company_id text not null references public.gestion_companies(id) on delete cascade,
  phone text not null,                       -- chiffres seulement, avec l'indicatif
  role text not null,                        -- chef | comptable | caissier | partenaire
  status text not null default 'invited',    -- invited | active
  name text,
  invited_by text,
  created_at timestamptz not null default now(),
  primary key (company_id, phone)
);
create index if not exists gestion_members_phone on public.gestion_members(phone);
create table if not exists public.gestion_ops (
  seq bigserial primary key,
  company_id text not null references public.gestion_companies(id) on delete cascade,
  op_id text not null,
  entity text not null,
  author_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (company_id, op_id)
);
create index if not exists gestion_ops_company_seq on public.gestion_ops(company_id, seq);
create index if not exists gestion_ops_company_entity on public.gestion_ops(company_id, entity);

alter table public.gestion_companies enable row level security;
alter table public.gestion_members enable row level security;
alter table public.gestion_ops enable row level security;
revoke all on public.gestion_companies, public.gestion_members, public.gestion_ops from anon, authenticated;
revoke all on sequence public.gestion_ops_seq_seq from anon, authenticated;

-- Abonnement payé (LigdiCash) : la fonction gestion-sync repère les paiements
-- « completed » de type gestion et prolonge l'abonnement UNE seule fois par
-- transaction (liste paid_txns, mise à jour atomique).
alter table public.gestion_companies add column if not exists paid_txns jsonb not null default '[]'::jsonb;
create or replace function public.sns_gestion_extend(p_cid text, p_txn text, p_days int)
returns bigint language sql set search_path = public as $$
  update gestion_companies
     set paid_until = greatest((extract(epoch from now()) * 1000)::bigint, paid_until) + p_days::bigint * 86400000,
         paid_txns = paid_txns || to_jsonb(p_txn), updated_at = now()
   where id = p_cid and not (paid_txns ? p_txn)
  returning paid_until;
$$;
revoke all on function public.sns_gestion_extend(text, text, int) from public, anon, authenticated;
grant execute on function public.sns_gestion_extend(text, text, int) to service_role;
