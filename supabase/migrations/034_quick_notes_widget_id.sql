-- ============================================================
-- FYP.STUDIO — Notas rápidas: soporte multi-instancia (post-its)
-- Agrega widget_id para que cada instancia del widget tenga su propia nota
-- ============================================================

-- 1. Agregar columna widget_id con default 'quick_note' para preservar notas existentes
alter table quick_notes
  add column if not exists widget_id text not null default 'quick_note';

-- 2. Dropear el unique constraint anterior (business_id, user_id)
alter table quick_notes
  drop constraint if exists quick_notes_business_id_user_id_key;

-- 3. Nueva restricción única que incluye widget_id
alter table quick_notes
  add constraint quick_notes_business_user_widget_key
  unique (business_id, user_id, widget_id);

-- 4. Índice para lookup rápido por widget
create index if not exists idx_quick_notes_widget
  on quick_notes(user_id, business_id, widget_id);
