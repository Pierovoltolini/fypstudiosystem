// app/admin/settings/VerticalSelector.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VERTICALS, VERTICAL_LIST, type VerticalGroup } from '@/lib/verticals'
import { Check, Loader2, ChevronRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function VerticalSelector({
  businessId,
  currentVertical,
  currentSub,
}: {
  businessId: string
  currentVertical: string
  currentSub?: string | null
}) {
  void businessId

  const router   = useRouter()
  const [step,   setStep]   = useState<'group' | 'sub'>('group')
  const [group,  setGroup]  = useState<VerticalGroup>(
    (currentVertical in VERTICALS ? currentVertical : 'comercio') as VerticalGroup
  )
  const [sub,    setSub]    = useState<string>(currentSub ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const groupConfig = VERTICALS[group]
  const unchanged   = group === currentVertical && sub === (currentSub ?? '')

  async function handleSave() {
    if (unchanged) return
    setSaving(true)
    const res = await fetch('/api/business/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vertical_type: group, vertical_sub: sub }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">

      {/* ── STEP: GRUPO ─────────────────────────────────────── */}
      {step === 'group' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VERTICAL_LIST.map(v => {
              const active = group === v.key
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => { setGroup(v.key); setSub(''); setStep('sub') }}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all text-left',
                    active
                      ? 'shadow-md'
                      : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-white'
                  )}
                  style={active ? { borderColor: v.color, background: v.accentColor } : {}}
                >
                  {active && (
                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                      style={{ background: v.color }}>
                      <Check size={9} className="text-white" />
                    </div>
                  )}
                  <span className="text-2xl">{v.emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900 leading-tight">{v.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-2 hidden sm:block">
                      {v.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Pill de subcategoría actual */}
          {sub && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: groupConfig.accentColor, color: groupConfig.color, border: `1px solid ${groupConfig.color}33` }}>
                <span>{groupConfig.subs.find(s => s.key === sub)?.emoji}</span>
                <span>{groupConfig.subs.find(s => s.key === sub)?.label ?? sub}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('sub')}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Cambiar subcategoría
              </button>
            </div>
          )}
        </>
      )}

      {/* ── STEP: SUBCATEGORÍA ──────────────────────────────── */}
      {step === 'sub' && (
        <>
          <div className="flex items-center gap-3 mb-1">
            <button type="button" onClick={() => setStep('group')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft size={13} />
              <span className="font-medium">Cambiar rubro</span>
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: groupConfig.accentColor, color: groupConfig.color }}>
              <span>{groupConfig.emoji}</span>
              <span>{groupConfig.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {groupConfig.subs.map(s => {
              const active = sub === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setSub(s.key); setStep('group') }}
                  className={cn(
                    'relative flex flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-3 transition-all text-left',
                    active
                      ? 'shadow-sm'
                      : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-white'
                  )}
                  style={active ? { borderColor: groupConfig.color, background: groupConfig.accentColor } : {}}
                >
                  {active && (
                    <div className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                      style={{ background: groupConfig.color }}>
                      <Check size={8} className="text-white" />
                    </div>
                  )}
                  <span className="text-xl">{s.emoji}</span>
                  <p className="text-[11px] font-semibold text-gray-900 leading-tight">{s.label}</p>
                  <p className="text-[10px] text-gray-400 leading-snug line-clamp-2 hidden sm:block">
                    {s.examples.slice(0, 2).join(', ')}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setStep('group')}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={12} className="rotate-180" /> Volver
            </button>
          </div>
        </>
      )}

      {/* ── BOTÓN GUARDAR ───────────────────────────────────── */}
      {step === 'group' && !unchanged && sub && (
        <div className="flex items-center gap-3 pt-1 animate-fade-up">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold
                       text-white disabled:opacity-40 transition-all shadow-md active:scale-[0.98]"
            style={{ background: groupConfig.color }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : `Cambiar a ${groupConfig.label}`}
          </button>
          <p className="text-xs text-gray-400">
            ⚠️ Cambia el menú y los módulos del panel
          </p>
        </div>
      )}
    </div>
  )
}
