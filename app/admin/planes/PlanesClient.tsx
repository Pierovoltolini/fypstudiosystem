'use client'
// PlanesClient — UI de billing: planes, toggle anual/mensual, historial de pagos
// Soporta dos modos: MercadoPago activo o contacto manual (feature flag)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, X, Zap, Loader2, AlertTriangle, Calendar, CreditCard,
  MessageCircle, Mail, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLAN_PRICES, ANNUAL_DISCOUNT } from '@/lib/plan-limits'
import type { Plan } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

// ── Tipos ────────────────────────────────────────────────────
interface Subscription {
  plan:                 string
  status:               string
  billing_cycle:        string
  current_period_start: string | null
  current_period_end:   string | null
}

interface BillingEvent {
  event_type:     string
  mercadopago_id: string | null
  created_at:     string
  payload:        Record<string, unknown> | null
}

interface Props {
  currentPlan:        Plan
  isOwner:            boolean
  subscription:       Subscription | null
  billingEvents:      BillingEvent[]
  mercadopagoEnabled: boolean
  contactWhatsapp:    string
  contactEmail:       string
}

// ── Features por plan ────────────────────────────────────────
const FEATURES = [
  { label: 'Pedidos por mes',            basic: '50',         pro: 'Ilimitados',  premium: 'Ilimitados'  },
  { label: 'Productos',                  basic: '20',         pro: 'Ilimitados',  premium: 'Ilimitados'  },
  { label: 'Clientes en CRM',            basic: '50',         pro: 'Ilimitados',  premium: 'Ilimitados'  },
  { label: 'Consultas IA por mes',       basic: '15',         pro: '75',          premium: 'Ilimitadas'  },
  { label: 'Módulos personalizados',     basic: '1',          pro: '1',           premium: 'Ilimitados'  },
  { label: 'Staff',                      basic: 'Solo dueño', pro: 'Hasta 3',     premium: 'Ilimitado'   },
  { label: 'Reportes completos',         basic: false,        pro: true,          premium: true          },
  { label: 'Fidelización y promociones', basic: false,        pro: true,          premium: true          },
  { label: 'Exportación CSV',            basic: false,        pro: true,          premium: true          },
  { label: 'Exportación PDF / Excel',    basic: false,        pro: false,         premium: true          },
  { label: 'Múltiples sucursales',       basic: false,        pro: false,         premium: true          },
  { label: 'Marca propia en tienda',     basic: false,        pro: false,         premium: true          },
  { label: 'Reportes automáticos email', basic: false,        pro: false,         premium: true          },
  { label: 'Soporte prioritario',        basic: false,        pro: false,         premium: true          },
]

type FeatureValue = string | boolean

function FeatureCell({ value }: { value: FeatureValue }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check size={15} className="text-green-500 mx-auto" />
      : <X     size={15} className="text-gray-200 mx-auto" />
  }
  return <span className="text-xs font-medium text-gray-700">{value}</span>
}

// ── Helpers ───────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-UY', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function eventLabel(type: string): string {
  const MAP: Record<string, string> = {
    'mp.authorized':       'Pago aprobado',
    'mp.cancelled':        'Suscripción cancelada',
    'mp.paused':           'Pago pausado',
    'mp.ended':            'Suscripción finalizada',
    'cancelled_by_user':   'Cancelado por el usuario',
    'manual_plan_change':  'Cambio manual de plan',
  }
  return MAP[type] ?? type
}

// ── Modal de contacto ─────────────────────────────────────────
function ContactModal({
  plan,
  cycle,
  contactWhatsapp,
  contactEmail,
  onClose,
}: {
  plan:            'pro' | 'premium'
  cycle:           'monthly' | 'annual'
  contactWhatsapp: string
  contactEmail:    string
  onClose:         () => void
}) {
  const prices    = PLAN_PRICES[plan]
  const amount    = cycle === 'annual' ? prices.annual : prices.monthly
  const planLabel = plan === 'pro' ? 'Pro' : 'Premium'
  const cycleLabel= cycle === 'annual' ? 'Anual' : 'Mensual'

  const waText    = encodeURIComponent(
    `Hola! Quiero upgradear mi cuenta de FYP Studio al plan ${planLabel} (${cycleLabel} - U$S ${amount.toFixed(2)}). ¿Me pueden ayudar?`
  )
  const waUrl     = contactWhatsapp
    ? `https://wa.me/${contactWhatsapp.replace(/\D/g, '')}?text=${waText}`
    : null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2
                      sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-500 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">
                  Plan {planLabel} · {cycleLabel}
                </p>
                <p className="text-2xl font-black text-white">
                  U$S {amount.toFixed(2)}
                  <span className="text-sm font-normal text-blue-200 ml-1">
                    / {cycle === 'annual' ? 'año' : 'mes'}
                  </span>
                </p>
              </div>
              <button onClick={onClose}
                className="text-blue-200 hover:text-white transition-colors p-1">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Podés pagar por <strong>transferencia bancaria</strong> o en <strong>efectivo</strong>.
              Contactanos y te explicamos cómo activar tu plan en minutos.
            </p>

            <div className="space-y-2">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full rounded-xl bg-green-500 px-4 py-3
                             text-sm font-bold text-white hover:bg-green-600 transition-all"
                >
                  <MessageCircle size={18} />
                  Contactar por WhatsApp
                </a>
              )}

              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}?subject=Quiero el plan ${planLabel}&body=Hola, quiero upgradear al plan ${planLabel} (${cycleLabel} - U$S ${amount.toFixed(2)}).`}
                  className="flex items-center gap-3 w-full rounded-xl border border-gray-200 px-4 py-3
                             text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                >
                  <Mail size={18} className="text-gray-400" />
                  Enviar email
                </a>
              )}

              {!waUrl && !contactEmail && (
                <p className="text-sm text-gray-400 text-center py-2">
                  Datos de contacto no configurados. Escribinos directamente.
                </p>
              )}
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              Una vez confirmado el pago activamos tu plan manualmente.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function PlanesClient({
  currentPlan, isOwner, subscription, billingEvents,
  mercadopagoEnabled, contactWhatsapp, contactEmail,
}: Props) {
  const router = useRouter()

  const [cycle,       setCycle]       = useState<'monthly' | 'annual'>('monthly')
  const [loadingMP,   setLoadingMP]   = useState<string | null>(null)
  const [canceling,   setCanceling]   = useState(false)
  const [showCancel,  setShowCancel]  = useState(false)
  const [contactPlan, setContactPlan] = useState<'pro' | 'premium' | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  const daysLeft       = daysUntil(subscription?.current_period_end ?? null)
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0

  async function handleUpgradeMp(plan: 'pro' | 'premium') {
    if (!isOwner) return
    setLoadingMP(plan)
    setError(null)
    try {
      const res = await fetch('/api/subscriptions/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, cycle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar')
      window.location.href = data.init_point
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pago')
    } finally {
      setLoadingMP(null)
    }
  }

  async function handleCancel() {
    setCanceling(true)
    setError(null)
    try {
      const res = await fetch('/api/subscriptions/cancel', { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar')
      setShowCancel(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar la suscripción')
    } finally {
      setCanceling(false)
    }
  }

  // ── Renderiza el botón de acción según contexto ───────────────
  function PlanButton({ plan }: { plan: 'pro' | 'premium' }) {
    const isCurrent  = currentPlan === plan
    const isPremium  = plan === 'premium'
    const isLoading  = loadingMP === plan

    if (!isOwner) {
      return (
        <p className="text-xs text-center text-gray-400 py-2">
          Solo el dueño puede cambiar el plan
        </p>
      )
    }

    if (isCurrent) {
      return (
        <button onClick={() => setShowCancel(true)}
          className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-2">
          Cancelar suscripción
        </button>
      )
    }

    if (mercadopagoEnabled) {
      // MP activo: botón de checkout
      return (
        <div className="space-y-2">
          <button
            onClick={() => handleUpgradeMp(plan)}
            disabled={!!loadingMP}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-3',
              'text-sm font-bold text-white transition-all active:scale-[0.98]',
              isLoading ? 'opacity-70' : '',
              isPremium ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {isLoading
              ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
              : <><Zap size={14} /> Upgradear a {isPremium ? 'Premium' : 'Pro'}</>
            }
          </button>
          <button onClick={() => setContactPlan(plan)}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
            Pagar por transferencia / efectivo
          </button>
        </div>
      )
    }

    // MP desactivado: botón de contacto
    return (
      <button
        onClick={() => setContactPlan(plan)}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3',
          'text-sm font-bold transition-all active:scale-[0.98]',
          isPremium
            ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
        )}
      >
        <Phone size={14} /> Quiero este plan
      </button>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <SectionTour section="planes" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Planes y facturación</h1>
        <p className="text-sm text-gray-400 mt-1">
          Plan actual: <span className="font-semibold text-gray-700 capitalize">{currentPlan}</span>
          {subscription?.status === 'past_due' && (
            <span className="ml-2 text-xs font-semibold text-red-500">· Pago pendiente</span>
          )}
        </p>
      </div>

      {/* Banner vencimiento */}
      {isExpiringSoon && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            Tu plan vence en <strong>{daysLeft} día{daysLeft !== 1 ? 's' : ''}</strong>.
            Renovalo para no perder el acceso.
          </p>
        </div>
      )}

      {/* Banner "próximamente" cuando MP está desactivado */}
      {!mercadopagoEnabled && (
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
          <Zap size={18} className="text-blue-500 shrink-0" />
          <p className="text-sm text-blue-800">
            Los pagos online están <strong>próximamente disponibles</strong>.
            Por ahora podés upgradear contactándonos directamente.
          </p>
        </div>
      )}

      {/* Error global */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Toggle mensual / anual */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn('text-sm font-medium', cycle === 'monthly' ? 'text-gray-900' : 'text-gray-400')}>
          Mensual
        </span>
        <button
          onClick={() => setCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors duration-200',
            cycle === 'annual' ? 'bg-blue-600' : 'bg-gray-200'
          )}
        >
          <span className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            cycle === 'annual' ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </button>
        <span className={cn('text-sm font-medium', cycle === 'annual' ? 'text-gray-900' : 'text-gray-400')}>
          Anual
          <span className="ml-1.5 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
            -{Math.round(ANNUAL_DISCOUNT * 100)}%
          </span>
        </span>
      </div>

      {/* Cards de planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* BASIC */}
        <div className={cn(
          'rounded-2xl border p-6 space-y-5',
          currentPlan === 'basic'
            ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
            : 'border-gray-100 bg-white'
        )}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Free</span>
              {currentPlan === 'basic' && (
                <span className="text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-full">
                  Tu plan
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-gray-900 mt-2">$0</p>
            <p className="text-xs text-gray-400 mt-0.5">Para siempre</p>
          </div>
          <div className="space-y-2">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 truncate">{f.label}</span>
                <div className="shrink-0"><FeatureCell value={f.basic} /></div>
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-gray-400 pt-2">Plan actual</div>
        </div>

        {/* PRO y PREMIUM */}
        {(['pro', 'premium'] as const).map(p => {
          const isPremium = p === 'premium'
          const price     = cycle === 'annual' ? PLAN_PRICES[p].annual : PLAN_PRICES[p].monthly
          const isCurrent = currentPlan === p
          const features  = isPremium ? FEATURES.map(f => f.premium) : FEATURES.map(f => f.pro)

          return (
            <div key={p} className={cn(
              'rounded-2xl border p-6 space-y-5 relative',
              isCurrent
                ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2 bg-white'
                : isPremium
                  ? 'border-purple-200 bg-gradient-to-b from-purple-50/50 to-white'
                  : 'border-blue-200 bg-gradient-to-b from-blue-50/50 to-white'
            )}>
              {isPremium && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold
                                bg-purple-600 text-white px-3 py-1 rounded-full whitespace-nowrap">
                  ✨ Más popular
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    isPremium ? 'text-purple-600' : 'text-blue-600'
                  )}>
                    {isPremium ? 'Premium' : 'Pro'}
                  </span>
                  {isCurrent && (
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full text-white',
                      isPremium ? 'bg-purple-600' : 'bg-blue-600'
                    )}>
                      Tu plan
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <p className="text-3xl font-black text-gray-900">
                    U$S {cycle === 'annual' ? (price / 12).toFixed(2) : price.toFixed(0)}
                  </p>
                  <span className="text-xs text-gray-400">/mes</span>
                </div>
                {cycle === 'annual' && (
                  <p className="text-[10px] text-green-600 font-semibold mt-0.5">
                    U$S {price.toFixed(2)} facturado anualmente
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {FEATURES.map((f, i) => (
                  <div key={f.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 truncate">{f.label}</span>
                    <div className="shrink-0"><FeatureCell value={features[i]} /></div>
                  </div>
                ))}
              </div>

              <PlanButton plan={p} />
            </div>
          )
        })}
      </div>

      {/* Tabla comparativa completa */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-500 min-w-[160px]">Característica</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Free</th>
              <th className="text-center px-4 py-3 font-semibold text-blue-700">Pro</th>
              <th className="text-center px-4 py-3 font-semibold text-purple-700">Premium</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FEATURES.map(f => (
              <tr key={f.label} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-2.5 text-gray-600">{f.label}</td>
                <td className="px-4 py-2.5 text-center"><FeatureCell value={f.basic} /></td>
                <td className="px-4 py-2.5 text-center"><FeatureCell value={f.pro} /></td>
                <td className="px-4 py-2.5 text-center"><FeatureCell value={f.premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historial de facturación */}
      {billingEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Historial de facturación</h2>
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            {billingEvents.map((ev, i) => (
              <div key={i} className={cn(
                'flex items-center justify-between px-4 py-3 gap-3',
                i !== 0 && 'border-t border-gray-50'
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                    ev.event_type.includes('authorized') ? 'bg-green-100' :
                    ev.event_type.includes('cancel')     ? 'bg-red-100'   : 'bg-gray-100'
                  )}>
                    <CreditCard size={12} className={
                      ev.event_type.includes('authorized') ? 'text-green-600' :
                      ev.event_type.includes('cancel')     ? 'text-red-500'   : 'text-gray-400'
                    } />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {eventLabel(ev.event_type)}
                    </p>
                    {ev.mercadopago_id && (
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        MP: {ev.mercadopago_id}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar size={11} className="text-gray-300" />
                  <span className="text-[10px] text-gray-400">{fmtDate(ev.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de cancelación */}
      {showCancel && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowCancel(false)} />
          <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2
                          sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4"
              style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">¿Cancelar tu suscripción?</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tu plan volverá a Free al finalizar el período actual.
                  </p>
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCancel(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 transition-all">
                  Mantener plan
                </button>
                <button onClick={handleCancel} disabled={canceling}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white
                             hover:bg-red-600 disabled:opacity-50 transition-all">
                  {canceling ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de contacto */}
      {contactPlan && (
        <ContactModal
          plan={contactPlan}
          cycle={cycle}
          contactWhatsapp={contactWhatsapp}
          contactEmail={contactEmail}
          onClose={() => setContactPlan(null)}
        />
      )}
    </div>
  )
}
