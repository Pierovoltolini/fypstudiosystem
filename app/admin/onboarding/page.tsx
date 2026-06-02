// app/admin/onboarding/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import { VERTICAL_LIST, VERTICALS, type VerticalGroup, type SubVertical } from '@/lib/verticals'
import { Check, ArrowLeft, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import FypLogo from '@/components/ui/FypLogo'

type Step = 'group' | 'sub' | 'info'

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,     setStep]     = useState<Step>('group')
  const [group,    setGroup]    = useState<VerticalGroup | null>(null)
  const [sub,      setSub]      = useState<SubVertical | null>(null)
  const [name,     setName]     = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [currency, setCurrency] = useState('UYU')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const groupConfig = group ? VERTICALS[group] : null
  const subConfig   = groupConfig?.subs.find(s => s.key === sub) ?? null

  async function createBusiness(useDemo = false) {
    if (!group) return
    setLoading(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      if (!user.email_confirmed_at) {
        setError('Confirmá tu email antes de continuar. Revisá tu bandeja de entrada.')
        setLoading(false)
        return
      }

      const bizName = useDemo ? `Mi ${groupConfig!.label} Demo` : name.trim()
      let slug = slugify(bizName)
      const { data: existing } = await supabase
        .from('businesses').select('id').eq('slug', slug).maybeSingle()
      if (existing) slug = slug + '-' + Math.random().toString(36).slice(2, 5)

      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .insert({
          name:             bizName,
          slug,
          whatsapp:         whatsapp.replace(/\D/g, '') || null,
          currency,
          plan:             'pro',
          active:           true,
          subscription_status: 'trial',
          vertical_type:    group,
          vertical_sub:     sub ?? groupConfig!.subs[0].key,
          primary_color:    groupConfig!.color,
        })
        .select('id').single()

      if (bizErr) throw bizErr

      await supabase.from('profiles')
        .upsert({ user_id: user.id, business_id: biz.id, role: 'owner' }, { onConflict: 'user_id,business_id' })

      // Email de bienvenida — fire and forget, no bloquea el redirect
      fetch('/api/welcome-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ businessName: bizName }),
      }).catch(() => { /* silenciar error — no crítico */ })

      router.push('/admin')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setLoading(false) }
  }

  // ── Paso 1: elegir grupo ─────────────────────────────────────
  if (step === 'group') {
    return (
      <OnboardingShell
        step={1}
        title="Elegí tu rubro"
        subtitle="El sistema se adapta completamente a tu tipo de negocio"
      >
        <div className="grid grid-cols-2 gap-3">
          {VERTICAL_LIST.map(v => {
            const active = group === v.key
            return (
              <button
                key={v.key}
                onClick={() => { setGroup(v.key); setStep('sub') }}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 transition-all',
                  'active:scale-[0.97] text-left',
                  active ? 'shadow-lg' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                )}
                style={active ? { background: v.accentColor, borderColor: v.color } : {}}
              >
                {active && (
                  <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ background: v.color }}>
                    <Check size={11} className="text-white" />
                  </div>
                )}
                <span className="text-4xl">{v.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{v.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug hidden sm:block">
                    {v.subs.slice(0, 3).map(s => s.label).join(', ')}
                  </p>
                </div>
                <div className="w-8 h-0.5 rounded-full" style={{ background: v.color }} />
              </button>
            )
          })}
        </div>
      </OnboardingShell>
    )
  }

  // ── Paso 2: elegir subcategoría ──────────────────────────────
  if (step === 'sub' && groupConfig) {
    return (
      <OnboardingShell
        step={2}
        title={`¿Qué tipo de ${groupConfig.label.toLowerCase()}?`}
        subtitle={`Adaptamos el vocabulario y los módulos a tu negocio exacto`}
      >
        <button
          onClick={() => setStep('group')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Cambiar rubro</span>
        </button>

        {/* Badge del grupo */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
          style={{ background: groupConfig.accentColor, color: groupConfig.color, border: `1px solid ${groupConfig.color}33` }}>
          <span>{groupConfig.emoji}</span>
          <span>{groupConfig.label}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {groupConfig.subs.map(s => {
            const active = sub === s.key
            return (
              <button
                key={s.key}
                onClick={() => { setSub(s.key as SubVertical); setStep('info') }}
                className={cn(
                  'relative flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 transition-all',
                  'active:scale-[0.97] text-left',
                  active ? 'shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                )}
                style={active ? { background: groupConfig.accentColor, borderColor: groupConfig.color } : {}}
              >
                {active && (
                  <div className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                    style={{ background: groupConfig.color }}>
                    <Check size={9} className="text-white" />
                  </div>
                )}
                <span className="text-2xl">{s.emoji}</span>
                <p className="text-xs font-bold text-gray-900 leading-tight">{s.label}</p>
                <p className="text-[10px] text-gray-400 leading-snug hidden sm:block">
                  {s.examples.slice(0, 2).join(', ')}
                </p>
              </button>
            )
          })}
        </div>
      </OnboardingShell>
    )
  }

  // ── Paso 3: datos del negocio ────────────────────────────────
  if (step === 'info' && groupConfig) {
    return (
      <OnboardingShell
        step={3}
        title="Datos de tu negocio"
        subtitle={`Configurando para ${subConfig?.label ?? groupConfig.label}`}
      >
        {/* Breadcrumb visual */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => setStep('group')}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={12} /> Cambiar rubro
          </button>
          <span className="text-gray-200">·</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: groupConfig.accentColor, color: groupConfig.color, border: `1px solid ${groupConfig.color}33` }}>
            {subConfig?.emoji ?? groupConfig.emoji}
            <span>{subConfig?.label ?? groupConfig.label}</span>
          </div>
          <button onClick={() => setStep('sub')}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">
            cambiar
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Nombre de tu comercio <span className="text-red-400">*</span>
            </label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder={`Ej: ${subConfig?.examples[0] ?? groupConfig.subs[0].examples[0]}`}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900
                         outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                         placeholder:text-gray-300 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">WhatsApp</label>
              <input
                type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="59899123456" inputMode="numeric"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900
                           outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                           placeholder:text-gray-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Moneda</label>
              <select
                value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900
                           outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {['UYU','ARS','CLP','COP','MXN','USD','BRL'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-1">
          <button
            onClick={() => createBusiness(false)}
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4
                       text-sm font-bold text-white disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: groupConfig.color }}
          >
            {loading ? 'Creando tu panel...' : `Crear mi ${subConfig?.label.toLowerCase() ?? groupConfig.label.toLowerCase()} →`}
          </button>

          <button
            onClick={() => { createBusiness(true) }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3
                       text-sm font-medium text-gray-600 border border-gray-200 bg-white
                       hover:bg-gray-50 disabled:opacity-40 transition-all"
          >
            <Zap size={14} /> Empezar con demo rápido
          </button>
        </div>
      </OnboardingShell>
    )
  }

  return null
}

// ── Shell del onboarding ─────────────────────────────────────────
function OnboardingShell({
  children, step, title, subtitle,
}: {
  children: React.ReactNode; step: number; title: string; subtitle: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F7F9FC' }}>
      <div className="w-full max-w-lg">

        {/* Logo + step indicator */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <FypLogo size={36} />
            <span className="font-bold text-xl text-gray-900">FyP Studio</span>
          </div>

          {/* Pasos */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all',
                  n < step  ? 'bg-blue-600 text-white' :
                  n === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                               'bg-gray-200 text-gray-400'
                )}>
                  {n < step ? <Check size={10} /> : n}
                </div>
                {n < 3 && (
                  <div className={cn('h-px w-8 transition-all', n < step ? 'bg-blue-600' : 'bg-gray-200')} />
                )}
              </div>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  )
}

