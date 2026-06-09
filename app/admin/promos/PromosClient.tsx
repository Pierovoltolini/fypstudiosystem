// app/admin/promos/PromosClient.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import {
  Tag, Plus, Trash2, Loader2, X, ToggleLeft, ToggleRight,
  Percent, DollarSign, Calendar, ShoppingBag, RefreshCw,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DiscountCode } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

interface Props { codes: DiscountCode[] }

const EMPTY = {
  code: '', type: 'percent' as 'percent' | 'fixed', value: 10, min_order: 0,
  max_uses: null as number | null, active: true, expires_at: null as string | null,
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function PromosClient({ codes: initialCodes }: Props) {
  const { businessId, currency, color } = useVertical()
  const supabase  = createClient()
  const [codes,    setCodes]   = useState<DiscountCode[]>(initialCodes)
  const [form,     setForm]    = useState({ ...EMPTY })
  const [saving,   setSaving]  = useState(false)
  const [deleting, setDeleting]= useState<string | null>(null)
  const [error,    setError]   = useState<string | null>(null)

  function setF<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(prev => ({ ...prev, [k]: v })); setError(null)
  }

  async function save() {
    if (!form.code.trim()) { setError('El código es requerido'); return }
    if (!form.value || form.value <= 0) { setError('El valor debe ser mayor a 0'); return }
    if (form.type === 'percent' && form.value > 100) { setError('El porcentaje no puede superar 100'); return }
    setSaving(true); setError(null)
    const { data, error: err } = await supabase
      .from('discount_codes')
      .insert({
        business_id: businessId,
        code:       form.code.trim().toUpperCase(),
        type:       form.type,
        value:      form.value,
        min_order:  form.min_order ?? 0,
        max_uses:   form.max_uses || null,
        active:     form.active,
        expires_at: form.expires_at || null,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.code === '23505' ? 'Ese código ya existe' : err.message)
    } else {
      setCodes(prev => [data as DiscountCode, ...prev])
      setForm({ ...EMPTY })
    }
    setSaving(false)
  }

  async function toggleActive(dc: DiscountCode) {
    const next = !dc.active
    await supabase.from('discount_codes').update({ active: next }).eq('id', dc.id)
    setCodes(prev => prev.map(c => c.id === dc.id ? { ...c, active: next } : c))
  }

  async function remove(id: string) {
    setDeleting(id)
    await supabase.from('discount_codes').delete().eq('id', id)
    setCodes(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  function isExpired(dc: DiscountCode) {
    return !!dc.expires_at && new Date(dc.expires_at) < new Date()
  }
  function isExhausted(dc: DiscountCode) {
    return dc.max_uses != null && dc.uses_count >= dc.max_uses
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <SectionTour section="promos" />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `linear-gradient(135deg,${color},${color}99)` }}>
          <Tag size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promociones</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cupones de descuento para tu tienda</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700">Nuevo cupón</p>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 font-medium mb-1 block">Código</label>
            <input
              value={form.code}
              onChange={e => setF('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="PROMO10"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono
                         uppercase tracking-widest outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
          </div>
          <div className="flex items-end">
            <button onClick={() => setF('code', randomCode())} title="Generar código"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200
                         text-gray-400 hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Tipo</label>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-200 p-1">
              {(['percent', 'fixed'] as const).map(val => (
                <button key={val} type="button" onClick={() => setF('type', val)}
                  className={cn(
                    'rounded-lg py-2 text-xs font-semibold transition-all',
                    form.type === val ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                  style={form.type === val ? { background: color } : {}}>
                  {val === 'percent' ? '% Porcentaje' : '$ Fijo'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">
              Valor {form.type === 'percent' ? '(%)' : `(${currency})`}
            </label>
            <div className="relative">
              {form.type === 'percent'
                ? <Percent size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                : <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              }
              <input type="number" min="0" step="any" value={form.value}
                onChange={e => setF('value', parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2.5 text-sm
                           outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
              <ShoppingBag size={11} /> Pedido mínimo
            </label>
            <input type="number" min="0" step="any" value={form.min_order}
              onChange={e => setF('min_order', parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
              <RefreshCw size={11} /> Usos máximos
            </label>
            <input type="number" min="1" step="1"
              value={form.max_uses ?? ''}
              onChange={e => setF('max_uses', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Sin límite"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                         focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
            <Calendar size={11} /> Vence el <span className="text-gray-400 ml-1">(opcional)</span>
          </label>
          <input type="datetime-local"
            value={form.expires_at ? form.expires_at.slice(0, 16) : ''}
            onChange={e => setF('expires_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                       focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1"><X size={11} /> {error}</p>
        )}

        <button onClick={save} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold
                     text-white transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: color }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Crear cupón
        </button>
      </div>

      {/* Lista */}
      {codes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <Tag size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Sin cupones todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(dc => {
            const expired   = isExpired(dc)
            const exhausted = isExhausted(dc)
            const inactive  = !dc.active || expired || exhausted
            return (
              <div key={dc.id}
                className={cn(
                  'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm',
                  inactive && 'opacity-60'
                )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                      inactive ? 'bg-gray-100' : 'bg-violet-50'
                    )}>
                      <Tag size={16} className={inactive ? 'text-gray-400' : 'text-violet-600'} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 font-mono tracking-wide">{dc.code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dc.type === 'percent'
                          ? `${dc.value}% de descuento`
                          : `${formatPrice(dc.value, currency)} de descuento`}
                        {dc.min_order > 0 && ` · Mín. ${formatPrice(dc.min_order, currency)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {expired ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Expirado</span>
                    ) : exhausted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Agotado</span>
                    ) : (
                      <button onClick={() => toggleActive(dc)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        {dc.active
                          ? <ToggleRight size={22} style={{ color }} />
                          : <ToggleLeft size={22} className="text-gray-300" />}
                      </button>
                    )}
                    <button onClick={() => remove(dc.id)} disabled={deleting === dc.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                      {deleting === dc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] text-gray-400">
                    Usos: <strong className="text-gray-700">{dc.uses_count}</strong>
                    {dc.max_uses != null && `/${dc.max_uses}`}
                  </span>
                  {dc.expires_at && (
                    <span className="text-[11px] text-gray-400">
                      Vence: <strong className={cn(expired ? 'text-red-500' : 'text-gray-700')}>
                        {new Date(dc.expires_at).toLocaleDateString('es-UY', { day:'numeric', month:'short', year:'numeric' })}
                      </strong>
                    </span>
                  )}
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    dc.active && !expired && !exhausted ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}>
                    {dc.active && !expired && !exhausted ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
