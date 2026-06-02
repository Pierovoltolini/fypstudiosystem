// app/admin/billing/BillingClient.tsx
'use client'
import { Check, Crown, Zap, Star, AlertTriangle, Clock, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Plan, SubscriptionStatus } from '@/types'

// ── Configuración de planes ───────────────────────────────────

interface PlanDef {
  key: Plan
  label: string
  price: string
  period: string
  description: string
  color: string
  icon: React.ReactNode
  features: string[]
  highlight?: boolean
}

const PLANS: PlanDef[] = [
  {
    key: 'basic',
    label: 'Basic',
    price: 'Gratis',
    period: '14 días de prueba',
    description: 'Para empezar a vender online',
    color: '#6B7280',
    icon: <Star size={16} />,
    features: [
      'Tienda online pública',
      'Hasta 20 productos',
      'Pedidos por WhatsApp',
      'Categorías básicas',
      'Configuración de negocio',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price: '$990',
    period: 'por mes',
    description: 'Para negocios que quieren crecer',
    color: '#6366F1',
    icon: <Zap size={16} />,
    highlight: true,
    features: [
      'Todo en Basic',
      'Productos ilimitados',
      'Analytics y reportes',
      'IA Assistant',
      'CRM & segmentación',
      'Inventario y costos',
      'Variantes de productos',
      'Notificaciones en tiempo real',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    price: '$1990',
    period: 'por mes',
    description: 'Para operaciones avanzadas',
    color: '#D97706',
    icon: <Crown size={16} />,
    features: [
      'Todo en Pro',
      'Multi-sucursal',
      'Gestión de staff con roles',
      'Cocina y mesas (gastro)',
      'Agenda avanzada',
      'Soporte prioritario',
      'API access',
    ],
  },
]

// ── Alertas de estado ─────────────────────────────────────────

const STATUS_ALERT: Partial<Record<SubscriptionStatus, {
  bg: string; border: string; icon: React.ReactNode; text: string
}>> = {
  trial: {
    bg: '#EFF6FF', border: '#BFDBFE',
    icon: <Clock size={15} className="text-blue-500" />,
    text: 'Estás en período de prueba. Activá un plan para no perder el acceso.',
  },
  past_due: {
    bg: '#FEF2F2', border: '#FECACA',
    icon: <AlertTriangle size={15} className="text-red-500" />,
    text: 'Tu pago está vencido. Actualizá tu suscripción para mantener el acceso.',
  },
  canceled: {
    bg: '#FFF7ED', border: '#FED7AA',
    icon: <AlertTriangle size={15} className="text-amber-500" />,
    text: 'Tu suscripción fue cancelada. Podés reactivarla cuando quieras.',
  },
  suspended: {
    bg: '#FEF2F2', border: '#FECACA',
    icon: <AlertTriangle size={15} className="text-red-500" />,
    text: 'Tu cuenta está suspendida. Contactá soporte para resolver el problema.',
  },
}

// ── Helpers ───────────────────────────────────────────────────

function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

const PLAN_ORDER: Plan[] = ['basic', 'pro', 'premium']

function isCurrentOrAbove(plan: Plan, current: Plan) {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(plan)
}

const WA_NUMBER = '59899000000' // Reemplazar con número real de soporte

function upgradeHref(plan: Plan, businessName: string) {
  const msg = encodeURIComponent(
    `Hola! Quiero actualizar *${businessName}* al plan ${plan === 'pro' ? 'Pro' : 'Premium'} de FYP Studio.`
  )
  return `https://wa.me/${WA_NUMBER}?text=${msg}`
}

// ── Componente principal ──────────────────────────────────────

export default function BillingClient({
  plan,
  status,
  expiresAt,
  businessName,
}: {
  plan: Plan
  status: SubscriptionStatus
  expiresAt: string | null
  businessName: string
}) {
  const alert      = STATUS_ALERT[status]
  const days       = daysRemaining(expiresAt)
  const planLabel  = PLANS.find(p => p.key === plan)?.label ?? plan

  return (
    <div className="space-y-6">

      {/* Estado actual */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Plan actual
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{planLabel}</span>
              <StatusBadge status={status} days={days} />
            </div>
          </div>

          {days !== null && status === 'trial' && (
            <div className="text-right">
              <p className="text-3xl font-black text-gray-900">{days}</p>
              <p className="text-xs text-gray-400">días de prueba restantes</p>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de estado */}
      {alert && (
        <div
          className="rounded-2xl border p-4 flex items-start gap-3"
          style={{ background: alert.bg, borderColor: alert.border }}
        >
          <div className="mt-0.5 shrink-0">{alert.icon}</div>
          <p className="text-sm text-gray-700">{alert.text}</p>
        </div>
      )}

      {/* Comparación de planes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(p => {
          const isCurrent  = p.key === plan
          const isUpgrade  = !isCurrentOrAbove(p.key, plan)
          const isDowngrade = PLAN_ORDER.indexOf(p.key) < PLAN_ORDER.indexOf(plan)

          return (
            <div
              key={p.key}
              className={cn(
                'relative rounded-2xl border flex flex-col overflow-hidden transition-all',
                p.highlight && !isCurrent
                  ? 'border-indigo-300 shadow-lg shadow-indigo-100'
                  : 'border-gray-100',
                isCurrent && 'ring-2'
              )}
              style={isCurrent ? { outline: `2px solid ${p.color}66`, outlineOffset: '0px' } : {}}
            >
              {/* Popular badge */}
              {p.highlight && (
                <div
                  className="absolute top-0 inset-x-0 h-0.5"
                  style={{ background: p.color }}
                />
              )}
              {isCurrent && (
                <div
                  className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: p.color }}
                >
                  Actual
                </div>
              )}
              {p.highlight && !isCurrent && (
                <div
                  className="text-center text-[10px] font-bold uppercase tracking-widest py-1.5 text-white"
                  style={{ background: p.color }}
                >
                  Más popular
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                    style={{ background: p.color }}
                  >
                    {p.icon}
                  </span>
                  <span className="font-bold text-gray-900">{p.label}</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">{p.description}</p>

                {/* Precio */}
                <div className="mb-5">
                  <span className="text-3xl font-black text-gray-900">{p.price}</span>
                  {p.period && (
                    <span className="text-xs text-gray-400 ml-1">{p.period}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="mt-0.5 shrink-0" style={{ color: p.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div
                    className="w-full rounded-xl py-2.5 text-center text-sm font-semibold"
                    style={{ background: p.color + '18', color: p.color }}
                  >
                    Plan activo
                  </div>
                ) : isDowngrade ? (
                  <div className="w-full rounded-xl py-2.5 text-center text-sm text-gray-400 bg-gray-50 border border-gray-200">
                    Plan inferior
                  </div>
                ) : (
                  <a
                    href={upgradeHref(p.key, businessName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5
                               text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: p.color }}
                  >
                    <MessageCircle size={14} />
                    Actualizar a {p.label}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer info */}
      <p className="text-xs text-gray-400 text-center">
        Los precios están en pesos uruguayos (UYU) e incluyen IVA.
        Para consultas sobre facturación escribinos por WhatsApp.
      </p>
    </div>
  )
}

// ── Badge de estado ───────────────────────────────────────────

function StatusBadge({ status, days }: { status: SubscriptionStatus; days: number | null }) {
  const conf: Record<SubscriptionStatus, { label: string; bg: string; text: string }> = {
    trial:    { label: 'Prueba',    bg: '#EFF6FF', text: '#1D4ED8' },
    active:   { label: 'Activo',   bg: '#F0FDF4', text: '#166534' },
    past_due: { label: 'Vencido',  bg: '#FEF2F2', text: '#991B1B' },
    canceled: { label: 'Cancelado',bg: '#FFF7ED', text: '#92400E' },
    suspended:{ label: 'Suspendido',bg:'#FEF2F2', text: '#991B1B' },
  }
  const c = conf[status]
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}
