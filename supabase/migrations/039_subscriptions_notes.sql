-- ============================================================
-- FYP.STUDIO — Nota interna por suscripción
-- Permite al superadmin registrar observaciones por negocio
-- (ej: "pagó por transferencia el 01/06")
-- ============================================================

alter table subscriptions
  add column if not exists internal_note text;
