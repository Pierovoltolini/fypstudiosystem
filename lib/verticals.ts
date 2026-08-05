// lib/verticals.ts
// FYP.STUDIO — Sistema de verticales v2
// 4 grupos principales × N subcategorías + backward compat con valores legacy

// ── Tipos ────────────────────────────────────────────────────────

export type VerticalGroup = 'gastro' | 'comercio' | 'servicios' | 'mercados'

export type SubVertical =
  // gastro
  | 'restaurante' | 'bar' | 'cafe' | 'panaderia' | 'comida_rapida' | 'licoreria'
  // comercio
  | 'ferreteria' | 'ropa' | 'calzado' | 'regalos' | 'floreria'
  | 'minimarket' | 'kiosco' | 'barrio' | 'jardineria' | 'hogar'
  | 'herreria' | 'carpinteria' | 'jardineria_paisajismo'
  // servicios
  | 'barberia' | 'peluqueria' | 'veterinaria' | 'taller'
  | 'limpieza' | 'salud' | 'estetica' | 'profesional'
  // mercados
  | 'supermercado' | 'mayorista' | 'verduleria' | 'charcuteria' | 'minimercado'
  | 'productor' | 'agropecuario'

// Acepta valores nuevos Y los 7 legacy de la DB
export type VerticalType =
  | VerticalGroup
  | 'food' | 'fashion' | 'beauty' | 'barbershop' | 'services' | 'general' | 'real_estate'

// ── Módulos ──────────────────────────────────────────────────────

export type ModuleKey =
  | 'orders'
  | 'products'
  | 'inventory'
  | 'suppliers'
  | 'categories'
  | 'customers'
  | 'ai'
  | 'settings'
  | 'analytics'   // transversal — reportes y métricas por fecha
  | 'agenda'      // servicios — hub agenda / calendario / staff
  | 'kitchen'     // gastro — hub cocina / pedidos activos
  | 'tables'      // gastro — plano de mesas
  | 'pos'         // mercados — terminal POS
  | 'costs'       // transversal — costos y rentabilidad
  | 'leads'       // legacy real_estate / servicios profesionales
  | 'visits'      // legacy real_estate
  | 'caja'        // transversal — caja y arqueo
  | 'promos'      // transversal — cupones de descuento
  | 'loyalty'     // transversal — programa de puntos
  | 'campaigns'   // transversal — campañas WhatsApp por segmento
  | 'riders'      // gastro/comercio — repartidores de delivery
  | 'notes'       // transversal — cuaderno de notas del usuario

export type KPIKey =
  | 'revenue' | 'orders' | 'customers' | 'products'
  | 'pending_orders' | 'conversion' | 'leads' | 'properties'
  | 'appointments' | 'avg_ticket' | 'stock_alerts'

// ── Interfaces ───────────────────────────────────────────────────

export interface SubVerticalConfig {
  key: SubVertical
  label: string
  emoji: string
  examples: string[]
  productLabel?: string   // override del grupo
  orderLabel?: string     // override del grupo
}

export interface ModuleConfig {
  key: ModuleKey
  label: string
  icon: string
  href: string
  description: string
  required: boolean
}

export interface VerticalConfig {
  key: VerticalGroup
  label: string
  emoji: string
  description: string
  color: string
  accentColor: string
  subs: SubVerticalConfig[]
  modules: ModuleKey[]
  requiredModules: ModuleKey[]
  dashboardWidgets: KPIKey[]
  storeType: 'catalog' | 'menu' | 'properties' | 'services' | 'appointments'
  checkoutType: 'whatsapp' | 'booking' | 'lead' | 'contact'
  productLabel: string
  orderLabel: string
  categoryLabel: string
  features: {
    hasDelivery: boolean
    hasPickup: boolean
    hasBooking: boolean
    hasVariants: boolean
    hasStock: boolean
    hasSchedule: boolean
    hasMap: boolean
    hasCRM: boolean
  }
}

// ── Definición de grupos ──────────────────────────────────────────

export const VERTICALS: Record<VerticalGroup, VerticalConfig> = {

  // ── GASTRONOMÍA ───────────────────────────────────────────────
  gastro: {
    key: 'gastro',
    label: 'Gastronomía',
    emoji: '🍔',
    description: 'Restaurantes, bares, cafés, panaderías, delivery y dark kitchens',
    color: '#EA580C',
    accentColor: '#FFF7ED',
    subs: [
      { key: 'restaurante',  label: 'Restaurante',    emoji: '🍽️', examples: ['Restaurant familiar', 'Parrilla', 'Comida étnica'] },
      { key: 'bar',          label: 'Bar',             emoji: '🍺', examples: ['Bar de tragos', 'Pub', 'Cervecería'], productLabel: 'Bebida' },
      { key: 'cafe',         label: 'Café',            emoji: '☕', examples: ['Cafetería', 'Coffee shop', 'Café bar'] },
      { key: 'panaderia',    label: 'Panadería',       emoji: '🥐', examples: ['Panadería', 'Pastelería', 'Confitería'] },
      { key: 'comida_rapida',label: 'Comida rápida',   emoji: '🍔', examples: ['Hamburguesería', 'Pizzería', 'Sushi', 'Rotisería'] },
      { key: 'licoreria',    label: 'Licorería',       emoji: '🍷', examples: ['Vinoteca', 'Licorería', 'Bodega'] },
    ],
    modules: ['orders', 'riders', 'kitchen', 'tables', 'products', 'categories', 'inventory', 'caja', 'costs', 'suppliers', 'customers', 'analytics', 'promos', 'loyalty', 'campaigns', 'ai', 'notes', 'settings'],
    requiredModules: ['orders', 'products', 'settings'],
    dashboardWidgets: ['pending_orders', 'revenue', 'orders', 'customers', 'avg_ticket', 'conversion'],
    storeType: 'menu',
    checkoutType: 'whatsapp',
    productLabel: 'Plato',
    orderLabel: 'Pedido',
    categoryLabel: 'Sección',
    features: {
      hasDelivery: true,  hasPickup: true,  hasBooking: false,
      hasVariants: false, hasStock: true,   hasSchedule: true,
      hasMap: false,      hasCRM: false,
    },
  },

  // ── COMERCIO ─────────────────────────────────────────────────
  comercio: {
    key: 'comercio',
    label: 'Comercio',
    emoji: '🏪',
    description: 'Tiendas, ferreterías, indumentaria, regalos y cualquier comercio con productos físicos',
    color: '#6366F1',
    accentColor: '#EEF2FF',
    subs: [
      { key: 'ferreteria', label: 'Ferretería',      emoji: '🔧', examples: ['Ferretería', 'Corralon', 'Pinturería'],         productLabel: 'Artículo' },
      { key: 'ropa',       label: 'Indumentaria',    emoji: '👕', examples: ['Tienda de ropa', 'Streetwear', 'Boutique'] },
      { key: 'calzado',    label: 'Calzado',         emoji: '👟', examples: ['Zapatería', 'Calzados', 'Deportivos'],          productLabel: 'Par' },
      { key: 'regalos',    label: 'Regalos',         emoji: '🎁', examples: ['Casa de regalos', 'Souvenirs', 'Decoración'] },
      { key: 'floreria',   label: 'Florerías',       emoji: '🌸', examples: ['Florería', 'Jardinería', 'Plantas'],           productLabel: 'Arreglo' },
      { key: 'minimarket', label: 'Minimarket',      emoji: '🏬', examples: ['Minimarket', 'Almacén', 'Despensa'] },
      { key: 'kiosco',     label: 'Kiosco',          emoji: '🗞️', examples: ['Kiosco', 'Pañalera', 'Bazar'] },
      { key: 'barrio',     label: 'Tienda de barrio',emoji: '🏘️', examples: ['Almacén barrio', 'Mercadito', 'Abasto'] },
      { key: 'jardineria',          label: 'Jardinería',     emoji: '🌿', examples: ['Vivero', 'Centro de jardinería', 'Plantas'] },
      { key: 'hogar',               label: 'Hogar & Deco',   emoji: '🛋️', examples: ['Mueblería', 'Bazar hogar', 'Decoración'] },
      { key: 'herreria',            label: 'Herrería',        emoji: '🔧', examples: ['Herrería', 'Metalúrgica', 'Soldadura'],           productLabel: 'Artículo' },
      { key: 'carpinteria',         label: 'Carpintería',     emoji: '🪚', examples: ['Carpintería', 'Mueblería artesanal', 'Madera'],   productLabel: 'Artículo' },
      { key: 'jardineria_paisajismo', label: 'Paisajismo',   emoji: '🌿', examples: ['Paisajismo', 'Diseño de jardines', 'Vivero premium'] },
    ],
    modules: ['orders', 'products', 'categories', 'inventory', 'caja', 'costs', 'suppliers', 'customers', 'analytics', 'promos', 'loyalty', 'campaigns', 'ai', 'notes', 'settings'],
    requiredModules: ['products', 'orders', 'settings'],
    dashboardWidgets: ['revenue', 'orders', 'customers', 'products', 'stock_alerts', 'conversion'],
    storeType: 'catalog',
    checkoutType: 'whatsapp',
    productLabel: 'Producto',
    orderLabel: 'Pedido',
    categoryLabel: 'Categoría',
    features: {
      hasDelivery: true,  hasPickup: true,  hasBooking: false,
      hasVariants: true,  hasStock: true,   hasSchedule: false,
      hasMap: false,      hasCRM: false,
    },
  },

  // ── SERVICIOS ────────────────────────────────────────────────
  servicios: {
    key: 'servicios',
    label: 'Servicios',
    emoji: '✂️',
    description: 'Barberías, peluquerías, salud, veterinarias, talleres y profesionales',
    color: '#0EA5E9',
    accentColor: '#F0F9FF',
    subs: [
      { key: 'barberia',    label: 'Barbería',         emoji: '💈', examples: ['Barbería', 'Grooming', 'Peluquería masculina'],    orderLabel: 'Turno' },
      { key: 'peluqueria',  label: 'Peluquería',       emoji: '✂️', examples: ['Peluquería', 'Salón de belleza'],                  orderLabel: 'Turno' },
      { key: 'estetica',    label: 'Estética',         emoji: '💅', examples: ['Centro estético', 'Spa', 'Uñas'],                  orderLabel: 'Turno' },
      { key: 'veterinaria', label: 'Veterinaria',      emoji: '🐾', examples: ['Veterinaria', 'Pet shop', 'Peluquería canina'],    orderLabel: 'Consulta' },
      { key: 'taller',      label: 'Taller',           emoji: '🔩', examples: ['Taller mecánico', 'Electricista', 'Plomero'],      orderLabel: 'Orden de trabajo', productLabel: 'Servicio' },
      { key: 'limpieza',    label: 'Limpieza',         emoji: '🧹', examples: ['Servicio de limpieza', 'Lavandería', 'Dry clean'], orderLabel: 'Servicio' },
      { key: 'salud',       label: 'Salud',            emoji: '🏥', examples: ['Consultorio', 'Odontología', 'Fisioterapia'],      orderLabel: 'Consulta' },
      { key: 'profesional', label: 'Profesional',      emoji: '💼', examples: ['Contador', 'Diseñador', 'Fotógrafo', 'Coach'],    orderLabel: 'Consulta' },
    ],
    modules: ['agenda', 'products', 'customers', 'analytics', 'costs', 'caja', 'ai', 'notes', 'settings'],
    requiredModules: ['agenda', 'settings'],
    dashboardWidgets: ['appointments', 'revenue', 'customers', 'conversion'],
    storeType: 'appointments',
    checkoutType: 'booking',
    productLabel: 'Servicio',
    orderLabel: 'Turno',
    categoryLabel: 'Tipo de servicio',
    features: {
      hasDelivery: false, hasPickup: false, hasBooking: true,
      hasVariants: false, hasStock: false,  hasSchedule: true,
      hasMap: false,      hasCRM: true,
    },
  },

  // ── MERCADOS ─────────────────────────────────────────────────
  mercados: {
    key: 'mercados',
    label: 'Mercados',
    emoji: '🛒',
    description: 'Supermercados, mayoristas, fruterías, charcuterías y autoservicios',
    color: '#16A34A',
    accentColor: '#F0FDF4',
    subs: [
      { key: 'supermercado', label: 'Supermercado',    emoji: '🏪', examples: ['Autoservicio', 'Super barrio'] },
      { key: 'mayorista',    label: 'Mayorista',        emoji: '📦', examples: ['Mayorista', 'Cash & Carry', 'Distribuidora'], orderLabel: 'Pedido' },
      { key: 'verduleria',   label: 'Frutería / Verdulería', emoji: '🥦', examples: ['Verdulería', 'Frutería', 'Almacén'] },
      { key: 'charcuteria',  label: 'Charcutería',     emoji: '🥩', examples: ['Carnicería', 'Charcutería', 'Fiambrería'] },
      { key: 'minimercado',  label: 'Minimercado',     emoji: '🏬', examples: ['Minimercado', 'Abasto', 'Tienda express'] },
      { key: 'productor',    label: 'Productor',        emoji: '🌾', examples: ['Productor', 'Distribuidor mayorista', 'Proveedor agrícola'], orderLabel: 'Venta' },
      { key: 'agropecuario', label: 'Agropecuario',     emoji: '🐄', examples: ['Agropecuario', 'Granja', 'Tambo'], orderLabel: 'Venta' },
    ],
    modules: ['pos', 'products', 'inventory', 'caja', 'costs', 'suppliers', 'customers', 'analytics', 'notes', 'settings'],
    requiredModules: ['products', 'settings'],
    dashboardWidgets: ['revenue', 'orders', 'customers', 'stock_alerts'],
    storeType: 'catalog',
    checkoutType: 'whatsapp',
    productLabel: 'Artículo',
    orderLabel: 'Venta',
    categoryLabel: 'Departamento',
    features: {
      hasDelivery: false, hasPickup: true,  hasBooking: false,
      hasVariants: false, hasStock: true,   hasSchedule: false,
      hasMap: false,      hasCRM: false,
    },
  },
}

// ── Mapeo legacy → grupo ──────────────────────────────────────────
// Los valores viejos de la DB (food, barbershop, etc.) se mapean al grupo nuevo
const LEGACY_TO_GROUP: Record<string, VerticalGroup> = {
  food:        'gastro',
  barbershop:  'servicios',
  beauty:      'servicios',
  services:    'servicios',
  fashion:     'comercio',
  general:     'comercio',
  real_estate: 'comercio',
}

// ── Nav items estáticos por módulo ───────────────────────────────
const MODULE_NAV: Record<ModuleKey, { icon: string; href: string }> = {
  orders:     { icon: 'ShoppingBag',  href: '/admin/orders' },
  kitchen:    { icon: 'ChefHat',      href: '/admin/gastro' },
  tables:     { icon: 'LayoutGrid',   href: '/admin/tables' },
  agenda:     { icon: 'CalendarDays', href: '/admin/servicios' },
  pos:        { icon: 'Scan',         href: '/admin/mercados' },
  products:   { icon: 'Package',      href: '/admin/products' },
  inventory:  { icon: 'Layers',       href: '/admin/inventory' },
  costs:      { icon: 'TrendingDown', href: '/admin/costs' },
  suppliers:  { icon: 'Truck',        href: '/admin/products/suppliers' },
  categories: { icon: 'Tag',          href: '/admin/categories' },
  customers:  { icon: 'Users',        href: '/admin/customers' },
  analytics:  { icon: 'BarChart2',    href: '/admin/analytics' },
  leads:      { icon: 'Target',       href: '/admin/leads' },
  visits:     { icon: 'CalendarCheck',href: '/admin/visits' },
  caja:       { icon: 'Wallet',       href: '/admin/caja' },
  promos:     { icon: 'Tag',          href: '/admin/promos' },
  loyalty:    { icon: 'Gift',         href: '/admin/loyalty' },
  campaigns:  { icon: 'Send',         href: '/admin/campaigns' },
  riders:     { icon: 'Bike',         href: '/admin/riders' },
  ai:         { icon: 'Sparkles',     href: '/admin/ai' },
  notes:      { icon: 'BookOpen',     href: '/admin/notes' },
  settings:   { icon: 'Settings',     href: '/admin/settings' },
}

// ── Módulo overrides por subrubro ────────────────────────────────
// Módulos a QUITAR del grupo base según vertical_sub
const SUB_REMOVE_MODULES: Partial<Record<string, ModuleKey[]>> = {
  panaderia:   ['kitchen', 'tables', 'riders'],
  licoreria:   ['kitchen', 'tables', 'riders'],
  bar:         ['riders'],
  cafe:        ['riders'],
  kiosco:      ['campaigns', 'loyalty'],
  verduleria:  ['customers'],
  charcuteria: ['customers'],
  herreria:            ['loyalty', 'campaigns', 'promos'],
  carpinteria:         ['loyalty', 'campaigns', 'promos'],
  jardineria_paisajismo: ['loyalty', 'campaigns'],
  // real_estate legacy — comercio base tiene demasiados módulos no relevantes
  real_estate: ['orders', 'categories', 'inventory', 'caja', 'costs', 'suppliers', 'promos', 'loyalty', 'campaigns'],
}

// Módulos a AGREGAR al grupo base según vertical_sub
const SUB_ADD_MODULES: Partial<Record<string, ModuleKey[]>> = {
  taller:       ['inventory', 'suppliers'],
  veterinaria:  ['inventory', 'suppliers'],
  limpieza:     ['inventory'],
  estetica:     ['inventory'],
  kiosco:       ['pos'],
  minimarket:   ['pos'],
  barrio:       ['pos'],
  supermercado: ['ai', 'promos', 'loyalty'],
  mayorista:    ['ai'],
  verduleria:   ['promos'],
  charcuteria:  ['promos'],
  minimercado:  ['ai', 'promos'],
  productor:    ['ai'],
  agropecuario: ['ai'],
  // real_estate legacy — agrega leads y visitas
  real_estate:  ['leads', 'visits'],
}

// Para subrubros con un orden de módulos completamente distinto al grupo base
const SUB_MODULE_ORDER: Partial<Record<string, ModuleKey[]>> = {
  real_estate: ['leads', 'visits', 'products', 'customers', 'analytics', 'ai', 'notes', 'settings'],
}

// ── Terminología de booking por subrubro ─────────────────────────
export function getBookingLabel(sub: string): { singular: string; plural: string } {
  const map: Record<string, { singular: string; plural: string }> = {
    barberia:    { singular: 'turno',            plural: 'turnos' },
    peluqueria:  { singular: 'turno',            plural: 'turnos' },
    estetica:    { singular: 'turno',            plural: 'turnos' },
    limpieza:    { singular: 'turno',            plural: 'turnos' },
    veterinaria: { singular: 'consulta',         plural: 'consultas' },
    salud:       { singular: 'consulta',         plural: 'consultas' },
    taller:      { singular: 'orden de trabajo', plural: 'órdenes de trabajo' },
    profesional: { singular: 'reunión',          plural: 'reuniones' },
    // legacy vertical_types
    barbershop:  { singular: 'turno',            plural: 'turnos' },
    beauty:      { singular: 'turno',            plural: 'turnos' },
    services:    { singular: 'turno',            plural: 'turnos' },
    servicios:   { singular: 'turno',            plural: 'turnos' },
  }
  return map[sub] ?? { singular: 'turno', plural: 'turnos' }
}

// ── Helpers ───────────────────────────────────────────────────────

// Obtener config del grupo (con fallback a comercio)
// Acepta tanto nuevos valores ('gastro') como legacy ('food')
export function getVertical(type?: string | null): VerticalConfig {
  if (!type) return VERTICALS.comercio
  if (type in VERTICALS)       return VERTICALS[type as VerticalGroup]
  if (type in LEGACY_TO_GROUP) return VERTICALS[LEGACY_TO_GROUP[type]]
  return VERTICALS.comercio
}

// Devuelve el grupo normalizado (siempre uno de los 4)
export function getVerticalGroup(type?: string | null): VerticalGroup {
  return getVertical(type).key
}

export interface NavItem {
  key: ModuleKey
  label: string
  icon: string
  href: string
  exact: boolean
}

// Convierte una lista de ModuleKey a nav items con labels y rutas
function modulesToNavItems(modules: ModuleKey[], config: VerticalConfig): NavItem[] {
  return modules.map(key => {
    const nav = MODULE_NAV[key]
    if (!nav) return null

    let label: string
    switch (key) {
      case 'products':
        label = config.key === 'gastro'    ? 'Menú'      :
                config.key === 'servicios' ? 'Servicios' :
                config.key === 'mercados'  ? 'Artículos' : 'Productos'
        break
      case 'orders':
        label = config.orderLabel + 's'
        break
      case 'categories':
        label = config.categoryLabel + 's'
        break
      default:
        label = ({
          orders:     config.orderLabel + 's',
          kitchen:    'Cocina',
          tables:     'Mesas',
          agenda:     'Agenda',
          pos:        'POS',
          inventory:  'Inventario',
          costs:      'Costos',
          suppliers:  'Proveedores',
          customers:  'Clientes',
          analytics:  'Reportes',
          leads:      'Consultas',
          visits:     'Visitas',
          caja:       'Caja',
          promos:     'Promociones',
          loyalty:    'Fidelización',
          campaigns:  'Campañas',
          riders:     'Repartidores',
          ai:         'IA',
          notes:      'Notas',
          settings:   'Configuración',
        } as Record<string, string>)[key] ?? key
    }

    return { key, label, icon: nav.icon, href: nav.href, exact: false }
  }).filter((item): item is NavItem => item !== null)
}

// Nav items por grupo (sin ajustes de subrubro) — retrocompatible
export function getNavItems(vertical?: string | null): NavItem[] {
  return modulesToNavItems(getVertical(vertical).modules, getVertical(vertical))
}

// Nav items con ajustes por subrubro — usar en AdminShell
export function getNavItemsBySub(vertical?: string | null, sub?: string | null): NavItem[] {
  if (!sub) return getNavItems(vertical)

  const config = getVertical(vertical)

  // Subrubros con orden de módulos completamente propio
  if (SUB_MODULE_ORDER[sub]) {
    return modulesToNavItems(SUB_MODULE_ORDER[sub], config)
  }

  // Ajuste incremental: partir del módulo base, quitar y agregar
  const base    = [...config.modules]
  const toRemove = SUB_REMOVE_MODULES[sub] ?? []
  const toAdd    = SUB_ADD_MODULES[sub] ?? []

  const adjusted = [
    ...base.filter(m => !toRemove.includes(m)),
    ...toAdd.filter(m => !base.includes(m)),  // solo agregar si no estaba ya
  ]

  return modulesToNavItems(adjusted, config)
}

// Subcategoría de un grupo
export function getSubVertical(group: VerticalGroup, sub: string): SubVerticalConfig | undefined {
  return VERTICALS[group]?.subs.find(s => s.key === sub)
}

// Verificar si un módulo está habilitado para un vertical
export function isModuleEnabled(vertical: string, module: ModuleKey): boolean {
  return getVertical(vertical).modules.includes(module)
}

// VERTICAL_LIST — lista de los 4 grupos (para onboarding, selector, etc.)
export const VERTICAL_LIST = Object.values(VERTICALS)
