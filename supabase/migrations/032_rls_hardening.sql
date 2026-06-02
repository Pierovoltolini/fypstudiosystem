-- ============================================================
-- FYP.STUDIO — RLS Hardening
-- Problema: las policies de INSERT en orders, order_items y
-- customers tenían WITH CHECK (true), lo que permitía que
-- cualquier usuario (incluso sin autenticar via anon key)
-- insertar filas para cualquier business_id.
-- ============================================================

-- ── orders: require active business on insert ─────────────────
drop policy if exists "api inserta pedidos" on orders;
create policy "api inserta pedidos" on orders for insert
  with check (
    exists (
      select 1 from businesses b
      where b.id = business_id
        and b.active = true
        and b.subscription_status not in ('canceled', 'suspended')
    )
  );

-- ── order_items: require valid order for an active business ───
drop policy if exists "api inserta items" on order_items;
create policy "api inserta items" on order_items for insert
  with check (
    exists (
      select 1 from orders o
      join businesses b on b.id = o.business_id
      where o.id = order_id
        and b.active = true
    )
  );

-- ── customers: separar la policy combinada en operaciones ─────
-- La policy anterior "comercio clientes" cubría ALL, incluyendo
-- INSERT, lo que impedía que la API (service role) upsertease
-- clientes para negocios ajenos. Separamos en 4 policies claras.
drop policy if exists "comercio clientes" on customers;

create policy "comercio lee clientes" on customers for select
  using (business_id = get_my_business_id() or is_superadmin());

create policy "comercio edita clientes" on customers for update
  using (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "comercio borra clientes" on customers for delete
  using (business_id = get_my_business_id() or is_superadmin());

-- INSERT: la API de pedidos hace upsert de clientes para negocios
-- activos. Se permite siempre que el negocio sea válido y activo.
create policy "api inserta clientes" on customers for insert
  with check (
    exists (
      select 1 from businesses b
      where b.id = business_id and b.active = true
    )
  );

-- ── profiles: agregar policy de UPDATE faltante ───────────────
-- Sin esto los usuarios no pueden actualizar su propio perfil
-- (display_name, avatar_url, phone, etc.)
-- La condición with check impide que un usuario escale su rol.
create policy if not exists "actualizar propio perfil" on profiles for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- no permite cambiar el rol propio
    and role = (select role from profiles p2 where p2.user_id = auth.uid() limit 1)
  );

-- ── profiles: agregar policy de INSERT para onboarding ────────
-- Al crear un negocio en el onboarding se hace upsert del profile.
-- La API usa service role que bypasea RLS, pero esto protege
-- el caso de que se use el anon key directamente.
create policy if not exists "insertar propio perfil" on profiles for insert
  with check (user_id = auth.uid());
