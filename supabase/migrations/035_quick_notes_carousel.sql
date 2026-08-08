-- ============================================================
-- FYP.STUDIO — Notas rápidas: rediseño a carrusel horizontal
-- Las notas ya no se identifican por widget_id sino por su UUID.
-- Un único widget contenedor muestra todas las notas del usuario.
-- ============================================================

-- 1. Quitar índice y constraint de widget_id (de migración 034)
drop index if exists idx_quick_notes_widget;

alter table quick_notes
  drop constraint if exists quick_notes_business_user_widget_key;

-- 2. Quitar columna widget_id (ya no se usa)
alter table quick_notes
  drop column if exists widget_id;

-- 3. Quitar el viejo unique(business_id, user_id) de migración 033 (si sobrevivió)
alter table quick_notes
  drop constraint if exists quick_notes_business_id_user_id_key;

-- 4. Agregar created_at para ordenar notas del carrusel
alter table quick_notes
  add column if not exists created_at timestamptz not null default now();

-- 5. Índice para listar todas las notas de un usuario ordenadas
create index if not exists idx_quick_notes_user_list
  on quick_notes(user_id, business_id, created_at);
