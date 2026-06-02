-- FYP.STUDIO — Migración inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor

create extension if not exists "uuid-ossp";

create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null, slug text not null unique,
  description text, logo_url text, banner_url text,
  whatsapp text, address text, currency text not null default 'UYU',
  primary_color text not null default '#000000',
  secondary_color text not null default '#ffffff',
  plan text not null default 'basic' check (plan in ('basic','pro','premium')),
  active boolean not null default true,
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial','active','past_due','canceled','suspended')),
  subscription_expires_at timestamptz,
  instagram text, facebook text, tiktok text, website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff','superadmin')),
  created_at timestamptz not null default now(),
  unique(user_id, business_id)
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null, slug text not null, sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(business_id, slug)
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null, slug text not null, description text,
  price numeric(10,2) not null check (price >= 0),
  images text[] not null default '{}', tags text[] not null default '{}',
  stock int, featured boolean not null default false, active boolean not null default true,
  seo_title text, seo_desc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, slug)
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null, phone text, address text, email text,
  total_orders int not null default 0, total_spent numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, phone)
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  order_number int generated always as identity,
  status text not null default 'pending'
    check (status in ('pending','confirmed','preparing','ready','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded')),
  confirmed_sale boolean not null default false,
  delivery_type text not null default 'delivery' check (delivery_type in ('delivery','pickup')),
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  comment text, customer_name text not null,
  customer_phone text, customer_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  subtotal numeric(10,2) generated always as (unit_price * quantity) stored
);

create table if not exists ai_generations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null check (type in ('product','promo','insights')),
  input jsonb, output jsonb, tokens_used int,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_businesses_slug    on businesses(slug);
create index if not exists idx_products_business  on products(business_id, active);
create index if not exists idx_orders_business    on orders(business_id, status);
create index if not exists idx_orders_created     on orders(business_id, created_at desc);
create index if not exists idx_order_items_order  on order_items(order_id);

-- Triggers updated_at
create or replace function update_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger set_updated_at_businesses before update on businesses for each row execute function update_updated_at();
create trigger set_updated_at_products   before update on products   for each row execute function update_updated_at();
create trigger set_updated_at_orders     before update on orders     for each row execute function update_updated_at();
create trigger set_updated_at_customers  before update on customers  for each row execute function update_updated_at();

-- Trigger confirmed_sale automático
create or replace function sync_confirmed_sale() returns trigger language plpgsql as $$
begin new.confirmed_sale = new.status in ('confirmed','delivered'); return new; end; $$;

create trigger trg_confirmed_sale before update of status on orders for each row execute function sync_confirmed_sale();

-- Row Level Security
alter table businesses      enable row level security;
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table customers       enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table ai_generations  enable row level security;

create or replace function get_my_business_id() returns uuid language sql security definer stable as $$
  select business_id from profiles where user_id = auth.uid() limit 1; $$;

create or replace function is_superadmin() returns boolean language sql security definer stable as $$
  select exists(select 1 from profiles where user_id = auth.uid() and role = 'superadmin'); $$;

-- Policies
create policy "leer propio negocio"   on businesses for select using (id = get_my_business_id() or is_superadmin() or active = true);
create policy "superadmin negocios"   on businesses for all    using (is_superadmin()) with check (is_superadmin());
create policy "ver propio perfil"     on profiles   for select using (user_id = auth.uid() or is_superadmin());
create policy "comercio categorias"   on categories for all    using (business_id = get_my_business_id() or is_superadmin()) with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda lee categorias" on categories for select using (active = true);
create policy "comercio productos"    on products   for all    using (business_id = get_my_business_id() or is_superadmin()) with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda lee productos"  on products   for select using (active = true);
create policy "comercio ve pedidos"   on orders     for select using (business_id = get_my_business_id() or is_superadmin());
create policy "comercio edita pedidos" on orders    for update using (business_id = get_my_business_id() or is_superadmin());
create policy "api inserta pedidos"   on orders     for insert with check (true);
create policy "leer items pedido"     on order_items for select using (exists(select 1 from orders o where o.id = order_id and (o.business_id = get_my_business_id() or is_superadmin())));
create policy "api inserta items"     on order_items for insert with check (true);
create policy "comercio clientes"     on customers   for all   using (business_id = get_my_business_id() or is_superadmin()) with check (business_id = get_my_business_id() or is_superadmin());
create policy "comercio ia"           on ai_generations for all using (business_id = get_my_business_id() or is_superadmin()) with check (business_id = get_my_business_id() or is_superadmin());

-- Realtime para pedidos
alter publication supabase_realtime add table orders;

-- Storage bucket para imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "autenticados suben"  on storage.objects for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "lectura publica"     on storage.objects for select using (bucket_id = 'product-images');
create policy "propietario borra"   on storage.objects for delete using (bucket_id = 'product-images' and auth.uid() = owner);
