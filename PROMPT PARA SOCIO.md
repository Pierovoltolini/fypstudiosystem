# Prompt para comparar tu copia de FYP Studio contra la referencia

Copiá todo este archivo y pegaselo a tu Claude Code (o decile "leé PROMPT PARA SOCIO.md y hacé lo que dice" si ya lo tenés dentro de tu carpeta del proyecto).

---

Sos Claude Code y no sabés nada de esta conversación previa. Te voy a pedir que compares tu copia local del proyecto **fyp-studio** contra un inventario de referencia que te paso abajo, para detectar diferencias antes de que dos personas sigan trabajando sobre el mismo código sin sincronizar.

## Cómo ubicar el proyecto

Buscá en tu disco una carpeta que tenga un `package.json` con `"name": "fyp-studio"`. Es un proyecto Next.js 14 + Supabase. Puede haber más de una copia en tu máquina — si encontrás varias, decime cuáles son (ruta completa) antes de seguir, no asumas cuál es la buena.

**Importante:** al contar archivos/carpetas, excluí siempre `node_modules/`, `.next/` y `.git/` — si no, los números van a dar disparatados.

## Referencia (repo `Pierovoltolini/fypstudiosystem`, commit `49a3fc9a4d354c4db4757fc3ff84f4880d05bdda`, 2026-08-05)

**Métricas:**
- 30 módulos en `app/admin/`
- 28 rutas API en `app/api/`
- 33 componentes `.tsx` en `components/`
- 15 archivos `.ts` en `lib/` (incluyendo subcarpetas)
- 9 archivos `.ts` en `types/`
- 45 archivos de migración en `supabase/migrations/` (numeración 001 a 043 — hay dos números repetidos: `025` y `034` tienen dos archivos cada uno, por eso 45 archivos y no 43)

**Módulos en `app/admin/` (30):**
ai, analytics, barbershop, billing, caja, campaigns, categories, costs, custom-modules, customers, food, gastro, inventory, leads, loyalty, mercados, notes, onboarding, orders, page-builder, planes, products, promos, riders, servicios, settings, staff-accounts, superadmin, tables, visits

**Rutas API en `app/api/` (28):**
ai/assistant, ai/custom-module, ai/insights, ai/inventory, ai/product, ai/promo, bookings, bookings/availability, bookings/confirm, business/settings, cron/booking-reminders, cron/weekly-summary, invite/accept, loyalty-balance, loyalty-history, orders, plan/usage, products/import, purchase-orders/receive, staff/invite, subscriptions/cancel, subscriptions/create, superadmin/plan, table-alert, tour/complete, validate-coupon, webhooks/mercadopago, welcome-email

**Componentes en `components/` (33):**
admin/AIChat.tsx, admin/AIUsageBanner.tsx, admin/AdminShell.tsx, admin/AiInsightsWidget.tsx, admin/CustomModulesNav.tsx, admin/DashboardCustomizer.tsx, admin/DashboardOnboarding.tsx, admin/DashboardTooltips.tsx, admin/DashboardWidgetWrapper.tsx, admin/DashboardWidgets.tsx, admin/GlobalSearch.tsx, admin/NotificationBell.tsx, admin/PlanGate.tsx, admin/QuickNotesWidget.tsx, admin/RoleGate.tsx, admin/SectionTour.tsx, admin/SplashScreen.tsx, admin/ThemeToggle.tsx, admin/UpgradePrompt.tsx, admin/VerticalProvider.tsx, admin/WelcomeTour.tsx, admin/WidgetPicker.tsx, admin/dashboards/UniversalDashboard.tsx, barbershop/BookingFlow.tsx, food/FoodStore.tsx, providers/ThemeProvider.tsx, store/CartDrawer.tsx, store/CheckoutClient.tsx, store/RealEstateStorefront.tsx, store/StoreFront.tsx, store/StoreHero.tsx, store/StoreSections.tsx, ui/FypLogo.tsx

**Archivos en `lib/` (15, con subcarpetas):**
ai-limits.ts, ai-usage.ts, ai.ts, dashboard-widgets.ts, env.ts, plan-limits.ts, ratelimit.ts, schemas.ts, supabase/client.ts, supabase/server.ts, toast.ts, utils.ts, vertical-context.ts, verticals.ts, whatsapp.ts

**Archivos en `types/` (9):**
bookings.ts, business.ts, custom-modules.ts, gastro.ts, index.ts, inventory.ts, loyalty.ts, orders.ts, products.ts

**Migraciones en `supabase/migrations/` (45 archivos, hasta la 043):**
001_initial, 002_inventory, 003_suppliers, 004_verticals, 005_barbershop, 006_food, 007_calendar, 008_availability, 009_products_costs_recipes, 010_verticals_v2, 011_product_variants, 012_tables, 013_staff_accounts, 014_fix_vertical_constraint, 015_inventory_auto_deduction, 016_caja, 017_customer_notes, 018_table_status_extended, 019_order_events, 020_delivery_riders, 021_discount_codes, 022_table_reservations, 023_loyalty, 024_purchase_orders, 025_delivery_zones, 025_product_variants_size_color, 026_order_item_notes, 027_auto_confirm_trigger, 028_dine_in_delivery_type, 029_product_variants_size_color, 030_table_alert_minutes, 031_inventory_fashion_attrs, 032_rls_hardening, 033_quick_notes, 034_dashboard_preferences, 034_quick_notes_widget_id, 035_ai_usage, 036_custom_modules, 037_notes, 038_billing, 039_subscriptions_notes, 040_migrate_quick_notes, 041_user_onboarding, 042_booking_reminders, 043_section_tours

## Lo que necesito que hagas

1. **Confirmá en qué commit está tu copia** (`git log -1`) y si tiene cambios sin commitear (`git status`).
2. **Contá tus propios números** para las mismas 6 categorías de arriba (módulos admin, rutas API, componentes, lib, types, migraciones) y compará contra la referencia.
3. **Qué te falta** — cualquier módulo, ruta, componente, archivo de lib/types, o migración que esté en la lista de referencia y no exista en tu copia.
4. **Qué tenés de más** — archivos que existan en tu copia y NO estén en la lista de referencia. Esto importa tanto como lo anterior: si vos seguiste trabajando por tu cuenta, acá va a aparecer.
5. **Qué tenés más nuevo** — cualquier archivo modificado después del `2026-08-05 10:04:04 -0300` (la fecha del commit de referencia), o migraciones con número mayor a `043`.
6. Armá un informe corto: coincide / falta / sobra / más nuevo, por categoría.

## Reglas — NO toques nada todavía

- **No hagas `git pull` ni `git reset --hard`** contra ningún remoto de GitHub sin que lo hablemos primero. Hay dos repos distintos dando vueltas para este mismo proyecto (`fypstudiosystem` y un `fyp-studio` viejo, un commit desactualizado) — si tirás un pull o reset a ciegas podés pisar código que el otro todavía no vio.
- **No toques los archivos de `supabase/migrations/`** — hay números repetidos a propósito (`025` y `034` duplicados) por cómo se fue armando el historial; renombrarlos o "ordenarlos" puede romper la sincronía con la base real.
- **Solo analizá y reportá.** No modifiques, borres ni crees archivos hasta que los dos leamos tu informe y decidamos juntos los próximos pasos.
