// app/admin/loyalty/LoyaltyClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import {
  Gift, Save, Loader2, ToggleLeft, ToggleRight,
  Star, TrendingUp, Award, Users, Plus, Minus, Check,
} from 'lucide-react'
import type { LoyaltySettings } from '@/types'
import PlanGate from '@/components/admin/PlanGate'
import SectionTour from '@/components/admin/SectionTour'

interface RawPoint {
  customer_id: string
  customers: { name: string } | null
}

interface Props {
  businessId: string
  currency: string
  initialSettings: LoyaltySettings | null
  rawPoints: RawPoint[]
}

const DEFAULT_SETTINGS: Omit<LoyaltySettings, 'business_id' | 'created_at' | 'updated_at'> = {
  enabled: false,
  points_per_unit: 1,
  redeem_ratio: 100,
  min_redeem: 100,
  welcome_points: 0,
}

export default function LoyaltyClient({ businessId, currency, initialSettings, rawPoints }: Props) {
  const supabase = createClient()

  const [settings, setSettings] = useState<typeof DEFAULT_SETTINGS>(
    initialSettings
      ? {
          enabled:        initialSettings.enabled,
          points_per_unit: initialSettings.points_per_unit,
          redeem_ratio:   initialSettings.redeem_ratio,
          min_redeem:     initialSettings.min_redeem,
          welcome_points: initialSettings.welcome_points,
        }
      : { ...DEFAULT_SETTINGS }
  )
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // Manual points adjustment
  const [manualCustomerId, setManualCustomerId] = useState('')
  const [manualPoints,     setManualPoints]     = useState(0)
  const [manualNote,       setManualNote]       = useState('')
  const [manualSaving,     setManualSaving]     = useState(false)
  const [manualDone,       setManualDone]       = useState(false)

  // Aggregate points per customer
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>()
    for (const row of rawPoints) {
      // rawPoints rows don't have points value — we need a different query
      // This is computed server-side via get_customer_points; here we just list unique customers
      if (!map.has(row.customer_id)) {
        map.set(row.customer_id, { name: row.customers?.name ?? 'Cliente', total: 0 })
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).slice(0, 20)
  }, [rawPoints])

  function setF<K extends keyof typeof DEFAULT_SETTINGS>(k: K, v: (typeof DEFAULT_SETTINGS)[K]) {
    setSettings(prev => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  async function saveSettings() {
    setSaving(true); setSaved(false)
    await supabase
      .from('loyalty_settings')
      .upsert({ business_id: businessId, ...settings })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function applyManual() {
    if (!manualCustomerId || manualPoints === 0) return
    setManualSaving(true)
    await supabase.from('loyalty_points').insert({
      business_id: businessId,
      customer_id: manualCustomerId,
      points:  manualPoints,
      reason:  'manual',
      note:    manualNote.trim() || null,
    })
    setManualPoints(0); setManualNote(''); setManualSaving(false); setManualDone(true)
    setTimeout(() => setManualDone(false), 2000)
  }

  const redeemLabel = `${settings.redeem_ratio} pts = ${formatPrice(1, currency)}`
  const earnLabel   = `1 ${currency} = ${settings.points_per_unit} pt${settings.points_per_unit !== 1 ? 's' : ''}`

  return (
    <PlanGate required="pro" feature="Fidelización" description="El programa de puntos y fidelización está disponible en el plan Pro o Premium.">
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <SectionTour section="loyalty" />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
          <Gift size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Programa de puntos</h1>
          <p className="text-sm text-gray-500">Recompensá a tus clientes frecuentes</p>
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" /> Configuración
          </p>
          {/* Enable toggle */}
          <button
            onClick={() => setF('enabled', !settings.enabled)}
            className="flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: settings.enabled ? '#16a34a' : '#6b7280' }}
          >
            {settings.enabled
              ? <ToggleRight size={26} className="text-green-500" />
              : <ToggleLeft  size={26} className="text-gray-300" />}
            {settings.enabled ? 'Activo' : 'Inactivo'}
          </button>
        </div>

        <div className={`p-5 space-y-5 transition-opacity ${settings.enabled ? 'opacity-100' : 'opacity-60'}`}>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 font-medium">
              {earnLabel}
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium">
              Canje: {redeemLabel}
            </span>
            {settings.welcome_points > 0 && (
              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 font-medium">
                {settings.welcome_points} pts de bienvenida
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Puntos por {currency} gastado</label>
              <input
                type="number" min="0.1" step="0.1" value={settings.points_per_unit}
                onChange={e => setF('points_per_unit', parseFloat(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Por cada {currency} 1 gastado el cliente gana {settings.points_per_unit} punto{settings.points_per_unit !== 1 ? 's' : ''}
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Puntos para canjear {currency} 1</label>
              <input
                type="number" min="1" value={settings.redeem_ratio}
                onChange={e => setF('redeem_ratio', parseInt(e.target.value) || 100)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {settings.redeem_ratio} puntos = {formatPrice(1, currency)} de descuento
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Puntos mínimos para canjear</label>
              <input
                type="number" min="0" value={settings.min_redeem}
                onChange={e => setF('min_redeem', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Puntos de bienvenida (primer pedido)</label>
              <input
                type="number" min="0" value={settings.welcome_points}
                onChange={e => setF('welcome_points', parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400 mt-1">0 = sin puntos de bienvenida</p>
            </div>
          </div>

          <button
            onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                       bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Guardado' : 'Guardar configuración'}
          </button>
        </div>
      </div>

      {/* Manual points adjustment */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Award size={15} className="text-gray-400" /> Ajuste manual de puntos
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ID del cliente</label>
              <input
                value={manualCustomerId}
                onChange={e => setManualCustomerId(e.target.value)}
                placeholder="UUID del cliente"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Puntos (+/-)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setManualPoints(p => p - 10)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                             text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                  <Minus size={14} />
                </button>
                <input
                  type="number" value={manualPoints}
                  onChange={e => setManualPoints(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center
                             outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button onClick={() => setManualPoints(p => p + 10)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                             text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Motivo (opcional)</label>
              <input
                value={manualNote}
                onChange={e => setManualNote(e.target.value)}
                placeholder="Compensación, corrección..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={applyManual}
            disabled={manualSaving || !manualCustomerId || manualPoints === 0}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                       bg-gray-800 hover:bg-gray-900 disabled:opacity-40 transition-all"
          >
            {manualSaving ? <Loader2 size={14} className="animate-spin" /> : manualDone ? <Check size={14} /> : <Gift size={14} />}
            {manualDone ? 'Aplicado' : `Aplicar ${manualPoints > 0 ? '+' : ''}${manualPoints} pts`}
          </button>
        </div>
      </div>

      {/* Top customers */}
      {topCustomers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Users size={15} className="text-gray-400" /> Clientes en el programa
              <span className="ml-auto text-xs font-normal text-gray-400">{topCustomers.length} clientes</span>
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{c.id}</p>
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                  <Star size={13} className="fill-amber-400 text-amber-400" />
                  —
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PlanGate>
  )
}
