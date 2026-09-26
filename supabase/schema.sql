-- =====================================================================
-- Boutique impression 3D — schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Administrateurs : rôle porté par le JWT Supabase Auth (app_metadata.role)
-- Pas de table à part : on affecte le rôle directement sur auth.users
-- (voir instructions en bas de fichier), ce qui l'inclut automatiquement
-- dans le JWT de la session.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Nettoyage de l'ancien mécanisme (table admins) si ce script est rejoué
-- sur une base créée avant ce changement.
drop table if exists public.admins;

-- ---------------------------------------------------------------------
-- Paramètres de calcul des prix (une seule ligne, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.pricing_settings (
  id smallint primary key default 1 check (id = 1),
  machine_rate_per_hour numeric(10,2) not null default 0.60,  -- électricité + usure + amortissement
  labor_rate_per_hour   numeric(10,2) not null default 20.00, -- post-traitement
  failure_rate          numeric(5,4)  not null default 0.10,  -- 10 % d'impressions ratées
  packaging_cost        numeric(10,2) not null default 0.80,
  margin_multiplier     numeric(6,3)  not null default 2.50,  -- coût de revient × marge
  vat_rate              numeric(5,4)  not null default 0.00,  -- 0 si franchise en base de TVA
  rounding_step         numeric(6,2)  not null default 0.50,  -- arrondi au 0,50 € supérieur
  min_price             numeric(10,2) not null default 5.00,
  shipping_flat_rate    numeric(10,2) not null default 5.90,
  free_shipping_from    numeric(10,2),                        -- null = jamais gratuit
  updated_at timestamptz not null default now()
);

insert into public.pricing_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Matières (PLA, PETG, résine…)
-- ---------------------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_per_kg numeric(10,2) not null check (price_per_kg >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Produits et variantes
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  name text not null,                          -- ex. « PLA noir – taille M »
  material_id uuid not null references public.materials (id),
  grams numeric(10,2) not null check (grams >= 0),
  print_minutes integer not null check (print_minutes >= 0),
  labor_minutes integer not null default 0 check (labor_minutes >= 0),
  price_override numeric(10,2),                -- si renseigné, remplace le prix calculé
  price numeric(10,2) not null default 0,      -- prix TTC affiché, recalculé par l'app
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULL = stock non suivi (toujours disponible). Ajouté après coup : idempotent
-- pour les bases déjà créées.
alter table public.variants
  add column if not exists stock_quantity integer check (stock_quantity is null or stock_quantity >= 0);

create index if not exists variants_product_idx on public.variants (product_id);

-- Décrémente le stock d'une variante après une commande payée. Fonction
-- security definer réservée au service_role (webhook Stripe) : elle contourne
-- le RLS, donc son exécution est retirée aux rôles publics ci-dessous.
create or replace function public.decrement_stock(p_variant_id uuid, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.variants
  set stock_quantity = greatest(stock_quantity - p_qty, 0)
  where id = p_variant_id and stock_quantity is not null;
$$;

revoke execute on function public.decrement_stock(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  email text,
  customer_name text,
  shipping_address jsonb,
  subtotal numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  currency text not null default 'eur',
  status text not null default 'paid'
    check (status in ('paid', 'printing', 'shipped', 'delivered', 'cancelled')),
  tracking_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.variants (id) on delete set null,
  product_title text not null,
  variant_name text not null,
  sku text,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists variants_touch on public.variants;
create trigger variants_touch before update on public.variants
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.pricing_settings;
create trigger settings_touch before update on public.pricing_settings
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- Principe : le public ne peut LIRE que le catalogue actif.
-- Tout le reste est réservé aux admins. Les commandes sont créées par le
-- webhook Stripe avec la clé service_role (qui contourne le RLS).
-- =====================================================================

alter table public.pricing_settings  enable row level security;
alter table public.materials         enable row level security;
alter table public.products          enable row level security;
alter table public.variants          enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;

-- paramètres : lecture publique (frais de port affichés), écriture admin
drop policy if exists "settings_public_read" on public.pricing_settings;
create policy "settings_public_read" on public.pricing_settings
  for select using (true);
drop policy if exists "settings_admin_write" on public.pricing_settings;
create policy "settings_admin_write" on public.pricing_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- matières
drop policy if exists "materials_public_read" on public.materials;
create policy "materials_public_read" on public.materials
  for select using (active or public.is_admin());
drop policy if exists "materials_admin_all" on public.materials;
create policy "materials_admin_all" on public.materials
  for all using (public.is_admin()) with check (public.is_admin());

-- produits
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (active or public.is_admin());
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- variantes
drop policy if exists "variants_public_read" on public.variants;
create policy "variants_public_read" on public.variants
  for select using (active or public.is_admin());
drop policy if exists "variants_admin_all" on public.variants;
create policy "variants_admin_all" on public.variants
  for all using (public.is_admin()) with check (public.is_admin());

-- commandes : admin uniquement
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Stockage des images produits (bucket public en lecture)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- =====================================================================
-- Données de départ
-- =====================================================================
insert into public.materials (name, price_per_kg) values
  ('PLA', 22.00),
  ('PETG', 25.00),
  ('PLA Silk', 28.00),
  ('TPU', 35.00)
on conflict (name) do nothing;

-- =====================================================================
-- APRÈS avoir créé ton compte dans Authentication > Users, donne-lui le
-- rôle admin en l'ajoutant à son app_metadata (inclus dans son JWT) :
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
--   where email = 'toi@exemple.fr';
--
-- L'utilisateur doit se reconnecter (ou rafraîchir sa session) pour que
-- le nouveau JWT contienne le rôle.
-- =====================================================================
