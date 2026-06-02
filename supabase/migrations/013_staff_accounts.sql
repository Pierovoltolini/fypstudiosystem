-- ============================================================
-- 013_staff_accounts.sql — Cuentas de staff y permisos granulares
-- Ejecutar DESPUÉS de 001_initial.sql
-- ============================================================
-- Cambios en profiles: email, display_name, phone, avatar_url,
--   last_seen_at, onboarded_at, updated_at
-- Tabla staff_permissions: control por módulo por empleado
-- Tabla invitations: token, auditoría, permisos iniciales, revocación
-- Tabla invitation_audit_log: historial de eventos (creado, reenviado, etc.)
-- Triggers: updated_at, log automático, aplicar permisos al aceptar
-- Función: get_my_permissions()
-- RLS + policies de profiles actualizadas
-- ============================================================

-- ── Extender profiles ──────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS display_name  text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz,
  ADD COLUMN IF NOT EXISTS onboarded_at  timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_business
  ON profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON profiles(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles(business_id, role);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_profiles'
  ) THEN
    CREATE TRIGGER set_updated_at_profiles
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── Permisos granulares por miembro del equipo ─────────────────
-- Permite al owner controlar exactamente qué puede ver y hacer cada empleado
-- Un registro por profile — se upsertea al aceptar una invitación o manualmente
CREATE TABLE IF NOT EXISTS staff_permissions (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid    NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  business_id         uuid    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Pedidos
  can_view_orders     boolean NOT NULL DEFAULT true,
  can_manage_orders   boolean NOT NULL DEFAULT true,   -- cambiar estado de pedidos
  -- Productos
  can_view_products   boolean NOT NULL DEFAULT true,
  can_manage_products boolean NOT NULL DEFAULT false,  -- crear / editar / borrar
  -- Clientes y analytics (sensibles — off por defecto)
  can_view_customers  boolean NOT NULL DEFAULT false,
  can_view_analytics  boolean NOT NULL DEFAULT false,
  -- Inventario
  can_view_inventory  boolean NOT NULL DEFAULT false,
  can_manage_inventory boolean NOT NULL DEFAULT false,
  -- Módulos especiales
  can_use_pos         boolean NOT NULL DEFAULT false,  -- terminal POS
  can_manage_tables   boolean NOT NULL DEFAULT true,   -- abrir/cerrar mesas
  -- Meta
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_permissions_profile
  ON staff_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_permissions_business
  ON staff_permissions(business_id);

CREATE TRIGGER set_updated_at_staff_permissions
  BEFORE UPDATE ON staff_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Invitaciones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email                text        NOT NULL,
  role                 text        NOT NULL DEFAULT 'staff' CHECK (role IN ('staff')),
  token                uuid        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Permisos que se aplicarán al aceptar (copiados desde staff_permissions template)
  initial_permissions  jsonb       NOT NULL DEFAULT '{
    "can_view_orders":      true,
    "can_manage_orders":    true,
    "can_view_products":    true,
    "can_manage_products":  false,
    "can_view_customers":   false,
    "can_view_analytics":   false,
    "can_view_inventory":   false,
    "can_manage_inventory": false,
    "can_use_pos":          false,
    "can_manage_tables":    true
  }'::jsonb,
  -- Ciclo de vida
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at          timestamptz,
  accepted_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at           timestamptz,
  revoked_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resend_count         int         NOT NULL DEFAULT 0,
  last_sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- Solo una invitación activa (no revocada, no aceptada) por email por negocio
  CONSTRAINT uq_active_invitation
    UNIQUE (business_id, email)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_business
  ON invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_pending
  ON invitations(business_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ── Log de auditoría de invitaciones ──────────────────────────
-- Registra automáticamente cada evento sobre una invitación
CREATE TABLE IF NOT EXISTS invitation_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event         text NOT NULL
                  CHECK (event IN ('created', 'resent', 'accepted', 'revoked', 'expired')),
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_audit_invitation
  ON invitation_audit_log(invitation_id);
CREATE INDEX IF NOT EXISTS idx_inv_audit_business
  ON invitation_audit_log(business_id, created_at DESC);

-- ── Trigger: log automático de eventos en invitaciones ─────────
CREATE OR REPLACE FUNCTION log_invitation_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO invitation_audit_log
      (invitation_id, business_id, event, actor_id, metadata)
    VALUES (
      NEW.id, NEW.business_id, 'created', NEW.invited_by,
      jsonb_build_object('email', NEW.email, 'role', NEW.role)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Aceptada
    IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
      INSERT INTO invitation_audit_log
        (invitation_id, business_id, event, actor_id)
      VALUES (NEW.id, NEW.business_id, 'accepted', NEW.accepted_by);
    END IF;
    -- Revocada
    IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
      INSERT INTO invitation_audit_log
        (invitation_id, business_id, event, actor_id)
      VALUES (NEW.id, NEW.business_id, 'revoked', NEW.revoked_by);
    END IF;
    -- Reenviada
    IF NEW.resend_count > OLD.resend_count THEN
      INSERT INTO invitation_audit_log
        (invitation_id, business_id, event, actor_id,
         metadata)
      VALUES (NEW.id, NEW.business_id, 'resent', NEW.invited_by,
        jsonb_build_object('resend_count', NEW.resend_count));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_log_invitation'
  ) THEN
    CREATE TRIGGER trg_log_invitation
      AFTER INSERT OR UPDATE ON invitations
      FOR EACH ROW EXECUTE FUNCTION log_invitation_event();
  END IF;
END $$;

-- ── Trigger: aplicar permisos al profile al aceptar invitación ─
-- Cuando se acepta, crea o actualiza staff_permissions con los permisos iniciales
CREATE OR REPLACE FUNCTION apply_invitation_permissions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_profile_id uuid;
  v_perms      jsonb;
BEGIN
  IF NEW.accepted_at IS NOT NULL
    AND OLD.accepted_at IS NULL
    AND NEW.accepted_by IS NOT NULL
  THEN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = NEW.accepted_by
      AND business_id = NEW.business_id
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      v_perms := NEW.initial_permissions;

      INSERT INTO staff_permissions (
        profile_id, business_id,
        can_view_orders,    can_manage_orders,
        can_view_products,  can_manage_products,
        can_view_customers, can_view_analytics,
        can_view_inventory, can_manage_inventory,
        can_use_pos,        can_manage_tables
      ) VALUES (
        v_profile_id, NEW.business_id,
        COALESCE((v_perms->>'can_view_orders')::boolean,    true),
        COALESCE((v_perms->>'can_manage_orders')::boolean,  true),
        COALESCE((v_perms->>'can_view_products')::boolean,  true),
        COALESCE((v_perms->>'can_manage_products')::boolean,false),
        COALESCE((v_perms->>'can_view_customers')::boolean, false),
        COALESCE((v_perms->>'can_view_analytics')::boolean, false),
        COALESCE((v_perms->>'can_view_inventory')::boolean, false),
        COALESCE((v_perms->>'can_manage_inventory')::boolean,false),
        COALESCE((v_perms->>'can_use_pos')::boolean,        false),
        COALESCE((v_perms->>'can_manage_tables')::boolean,  true)
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        can_view_orders      = EXCLUDED.can_view_orders,
        can_manage_orders    = EXCLUDED.can_manage_orders,
        can_view_products    = EXCLUDED.can_view_products,
        can_manage_products  = EXCLUDED.can_manage_products,
        can_view_customers   = EXCLUDED.can_view_customers,
        can_view_analytics   = EXCLUDED.can_view_analytics,
        can_view_inventory   = EXCLUDED.can_view_inventory,
        can_manage_inventory = EXCLUDED.can_manage_inventory,
        can_use_pos          = EXCLUDED.can_use_pos,
        can_manage_tables    = EXCLUDED.can_manage_tables,
        updated_at           = now();

      -- Marcar al perfil como onboarded si no lo estaba
      UPDATE profiles
      SET onboarded_at = COALESCE(onboarded_at, now())
      WHERE id = v_profile_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_apply_invitation_permissions'
  ) THEN
    CREATE TRIGGER trg_apply_invitation_permissions
      AFTER UPDATE OF accepted_at ON invitations
      FOR EACH ROW EXECUTE FUNCTION apply_invitation_permissions();
  END IF;
END $$;

-- ── Función: obtener permisos del usuario actual ───────────────
-- Útil desde el cliente o APIs para verificar acceso antes de mostrar secciones
CREATE OR REPLACE FUNCTION get_my_permissions(p_business_id uuid)
RETURNS TABLE (
  can_view_orders      boolean,
  can_manage_orders    boolean,
  can_view_products    boolean,
  can_manage_products  boolean,
  can_view_customers   boolean,
  can_view_analytics   boolean,
  can_view_inventory   boolean,
  can_manage_inventory boolean,
  can_use_pos          boolean,
  can_manage_tables    boolean
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    sp.can_view_orders,    sp.can_manage_orders,
    sp.can_view_products,  sp.can_manage_products,
    sp.can_view_customers, sp.can_view_analytics,
    sp.can_view_inventory, sp.can_manage_inventory,
    sp.can_use_pos,        sp.can_manage_tables
  FROM staff_permissions sp
  JOIN profiles pr ON pr.id = sp.profile_id
  WHERE pr.user_id = auth.uid()
    AND sp.business_id = p_business_id
  LIMIT 1;
$$;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_audit_log ENABLE ROW LEVEL SECURITY;

-- Invitaciones
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitations' AND policyname = 'owner_manage_invitations'
  ) THEN
    CREATE POLICY "owner_manage_invitations" ON invitations FOR ALL
      USING  (business_id = get_my_business_id() OR is_superadmin())
      WITH CHECK (business_id = get_my_business_id() OR is_superadmin());
  END IF;
  -- Cualquiera puede leer una invitación por token (flujo de aceptación sin sesión)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitations' AND policyname = 'public_read_invitation'
  ) THEN
    CREATE POLICY "public_read_invitation" ON invitations FOR SELECT
      USING (true);
  END IF;
END $$;

-- Permisos de staff
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_permissions' AND policyname = 'owner_manage_permissions'
  ) THEN
    CREATE POLICY "owner_manage_permissions" ON staff_permissions FOR ALL
      USING  (business_id = get_my_business_id() OR is_superadmin())
      WITH CHECK (business_id = get_my_business_id() OR is_superadmin());
  END IF;
  -- El propio empleado puede leer sus permisos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_permissions' AND policyname = 'staff_read_own'
  ) THEN
    CREATE POLICY "staff_read_own" ON staff_permissions FOR SELECT
      USING (
        profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Log de auditoría (solo owners y superadmin)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invitation_audit_log' AND policyname = 'owner_read_audit'
  ) THEN
    CREATE POLICY "owner_read_audit" ON invitation_audit_log FOR SELECT
      USING (business_id = get_my_business_id() OR is_superadmin());
  END IF;
END $$;

-- ── Actualizar policies de profiles ───────────────────────────
-- Eliminar la policy simple de "ver propio perfil" y reemplazar por una más completa
DROP POLICY IF EXISTS "ver propio perfil" ON profiles;

DO $$ BEGIN
  -- Cualquier usuario autenticado puede insertar su propio perfil (flujo de aceptación)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'insert_own_profile'
  ) THEN
    CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
  -- Un usuario puede ver su propio perfil, y el owner puede ver todos los de su negocio
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'ver perfiles negocio'
  ) THEN
    CREATE POLICY "ver perfiles negocio" ON profiles FOR SELECT
      USING (
        user_id = auth.uid()
        OR business_id = get_my_business_id()
        OR is_superadmin()
      );
  END IF;
  -- Solo el owner puede actualizar roles (no puede tocar superadmins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'owner_update_profile'
  ) THEN
    CREATE POLICY "owner_update_profile" ON profiles FOR UPDATE
      USING (
        (business_id = get_my_business_id() AND role != 'superadmin')
        OR is_superadmin()
      );
  END IF;
  -- Solo el owner puede eliminar staff (no owners, no superadmins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'owner_delete_staff'
  ) THEN
    CREATE POLICY "owner_delete_staff" ON profiles FOR DELETE
      USING (
        (business_id = get_my_business_id() AND role = 'staff')
        OR is_superadmin()
      );
  END IF;
END $$;
