-- ============================================================
-- FYP.STUDIO — Unificación de notas rápidas con la tabla notes
-- Las notas del widget del dashboard pasan a guardarse en notes
-- para aparecer en /admin/notes con fecha y historial completo.
-- ============================================================

-- Migrar filas existentes de quick_notes → notes
-- title vacío, tags vacío; se preservan id, content y fechas originales
insert into notes (id, business_id, user_id, title, content, tags, created_at, updated_at)
select
  id,
  business_id,
  user_id,
  ''        as title,
  content,
  '{}'      as tags,
  created_at,
  updated_at
from quick_notes
where content != ''
on conflict (id) do nothing;
