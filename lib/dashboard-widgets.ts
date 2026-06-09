// lib/dashboard-widgets.ts — Registro de widgets del dashboard
import type { VerticalGroup } from '@/lib/verticals'

export type WidgetSize = 'small' | 'medium' | 'large'

/** Entrada en dashboard_preferences.config.widgets */
export interface WidgetEntry {
  id:   string
  size: WidgetSize
}

export interface WidgetDef {
  id:             string
  label:          string
  description:    string
  iconName:       string
  availableSizes: WidgetSize[]
  defaultSize:    WidgetSize
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Comercio / Gastro / Mercados ──────────────────────────────
  {
    id:             'sales_chart',
    label:          'Gráfico de ventas',
    description:    'Ventas confirmadas por hora del día',
    iconName:       'BarChart2',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'costs_summary',
    label:          'Resumen de costos',
    description:    'Gastos registrados del mes actual',
    iconName:       'TrendingDown',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'low_stock',
    label:          'Stock bajo y alertas',
    description:    'Ítems de inventario con stock crítico',
    iconName:       'AlertTriangle',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'recent_orders',
    label:          'Últimos pedidos',
    description:    'Los pedidos más recientes del negocio',
    iconName:       'ShoppingBag',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'new_customers',
    label:          'Clientes nuevos',
    description:    'Clientes registrados este mes',
    iconName:       'Users',
    availableSizes: ['small', 'medium'],
    defaultSize:    'small',
  },
  {
    id:             'quick_note',
    label:          'Notas rápidas',
    description:    'Carrusel de post-its, se guardan automáticamente',
    iconName:       'StickyNote',
    availableSizes: ['small', 'medium', 'large'],
    defaultSize:    'small',
  },
  {
    id:             'cash_balance',
    label:          'Saldo de caja',
    description:    'Estado actual de la caja abierta',
    iconName:       'Wallet',
    availableSizes: ['small', 'medium'],
    defaultSize:    'small',
  },
  {
    id:             'shortcuts',
    label:          'Accesos directos',
    description:    'Links rápidos a las secciones más usadas',
    iconName:       'Zap',
    availableSizes: ['small', 'medium'],
    defaultSize:    'small',
  },
  // ── Servicios ─────────────────────────────────────────────────
  {
    id:             'bookings_today_kpi',
    label:          'Agenda de hoy',
    description:    'Turnos/consultas del día con ingresos y pendientes',
    iconName:       'CalendarDays',
    availableSizes: ['small', 'medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'bookings_revenue_kpi',
    label:          'Ingresos del período',
    description:    'Ingresos de turnos con selector hoy / 7 días / 30 días',
    iconName:       'TrendingUp',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'bookings_chart',
    label:          'Gráfico de ingresos',
    description:    'Ingresos de turnos completados en los últimos 30 días',
    iconName:       'BarChart2',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'upcoming_agenda',
    label:          'Próxima agenda',
    description:    'Turnos agendados para los próximos 7 días',
    iconName:       'CalendarCheck',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'active_staff',
    label:          'Equipo activo',
    description:    'Integrantes del equipo marcados como activos',
    iconName:       'Users',
    availableSizes: ['small', 'medium'],
    defaultSize:    'small',
  },
  // ── Real estate ───────────────────────────────────────────────
  {
    id:             'leads_kpi',
    label:          'Resumen de consultas',
    description:    'Total de consultas, nuevas esta semana y propiedades activas',
    iconName:       'Target',
    availableSizes: ['small', 'medium'],
    defaultSize:    'medium',
  },
  {
    id:             'recent_leads',
    label:          'Consultas recientes',
    description:    'Últimas consultas con estado y acceso rápido a WhatsApp',
    iconName:       'Target',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'upcoming_visits_list',
    label:          'Próximas visitas',
    description:    'Visitas agendadas para los próximos 7 días',
    iconName:       'CalendarCheck',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
  {
    id:             'closed_deals_kpi',
    label:          'Negocios cerrados',
    description:    'Cantidad de ventas cerradas y revenue total',
    iconName:       'TrendingUp',
    availableSizes: ['small', 'medium'],
    defaultSize:    'small',
  },
  // ── IA ────────────────────────────────────────────────────────────
  {
    id:             'ai_insights',
    label:          'Sugerencias IA',
    description:    'Sugerencias proactivas basadas en los datos reales del negocio',
    iconName:       'Sparkles',
    availableSizes: ['medium', 'large'],
    defaultSize:    'medium',
  },
]

// ── Helpers de registro ───────────────────────────────────────────
export function getAvailableSizes(id: string): WidgetSize[] {
  return WIDGET_REGISTRY.find(w => w.id === id)?.availableSizes ?? ['medium', 'large']
}

export function getDefaultSize(id: string): WidgetSize {
  return WIDGET_REGISTRY.find(w => w.id === id)?.defaultSize ?? 'large'
}

// ── Widgets por defecto por GRUPO ─────────────────────────────────
export const DEFAULT_WIDGETS: Record<VerticalGroup, string[]> = {
  gastro:    ['sales_chart', 'recent_orders', 'ai_insights', 'quick_note', 'shortcuts'],
  comercio:  ['recent_orders', 'low_stock', 'ai_insights', 'quick_note', 'shortcuts'],
  servicios: ['bookings_revenue_kpi', 'upcoming_agenda', 'ai_insights', 'active_staff', 'quick_note', 'shortcuts'],
  mercados:  ['low_stock', 'recent_orders', 'ai_insights', 'cash_balance', 'quick_note'],
}

// ── Widgets por defecto por SUBRUBRO (override del grupo) ─────────
export const DEFAULT_WIDGETS_BY_SUB: Record<string, string[]> = {
  panaderia:    ['low_stock', 'costs_summary', 'cash_balance', 'quick_note'],
  licoreria:    ['low_stock', 'cash_balance', 'quick_note', 'shortcuts'],
  bar:          ['sales_chart', 'cash_balance', 'quick_note', 'shortcuts'],
  cafe:         ['sales_chart', 'cash_balance', 'new_customers', 'quick_note'],
  kiosco:       ['cash_balance', 'costs_summary', 'quick_note', 'shortcuts'],
  minimarket:   ['cash_balance', 'low_stock', 'quick_note', 'shortcuts'],
  barrio:       ['cash_balance', 'low_stock', 'quick_note', 'shortcuts'],
  indumentaria: ['recent_orders', 'new_customers', 'low_stock', 'quick_note'],
  calzado:      ['recent_orders', 'new_customers', 'low_stock', 'quick_note'],
  verduleria:   ['low_stock', 'cash_balance', 'costs_summary', 'quick_note'],
  charcuteria:  ['low_stock', 'cash_balance', 'costs_summary', 'quick_note'],
  real_estate:  ['leads_kpi', 'recent_leads', 'ai_insights', 'upcoming_visits_list', 'closed_deals_kpi', 'quick_note'],
  herreria:            ['low_stock', 'costs_summary', 'recent_orders', 'cash_balance', 'quick_note'],
  carpinteria:         ['low_stock', 'costs_summary', 'recent_orders', 'cash_balance', 'quick_note'],
  jardineria_paisajismo: ['low_stock', 'recent_orders', 'quick_note', 'shortcuts'],
  productor:           ['low_stock', 'costs_summary', 'cash_balance', 'quick_note'],
  agropecuario:        ['low_stock', 'costs_summary', 'cash_balance', 'quick_note'],
}

// ── Helper principal: devuelve los IDs de widgets por defecto ─────
export function getDefaultWidgets(group: VerticalGroup, sub?: string): string[] {
  if (sub && DEFAULT_WIDGETS_BY_SUB[sub]) return DEFAULT_WIDGETS_BY_SUB[sub]
  return DEFAULT_WIDGETS[group] ?? ['quick_note']
}
