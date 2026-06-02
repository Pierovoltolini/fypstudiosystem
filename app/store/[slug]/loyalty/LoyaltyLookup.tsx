// app/store/[slug]/loyalty/LoyaltyLookup.tsx
'use client'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { Gift, Phone, Loader2, Star, ArrowLeft, TrendingUp, TrendingDown, Award } from 'lucide-react'
import Link from 'next/link'
import type { Business } from '@/types'

interface LoyaltyResult {
  customer_id: string
  customer_name: string
  points: number
  redeem_value: number
  min_redeem: number
}

interface HistoryRow {
  id: string
  points: number
  reason: string
  note?: string | null
  created_at: string
}

const REASON_CONF: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  earned:   { label: 'Compra',       icon: TrendingUp,   color: '#16a34a' },
  redeemed: { label: 'Canje',        icon: TrendingDown, color: '#dc2626' },
  welcome:  { label: 'Bienvenida',   icon: Gift,         color: '#7c3aed' },
  manual:   { label: 'Ajuste',       icon: Award,        color: '#d97706' },
}

interface Props {
  business: Business
  settings: { points_per_unit: number; redeem_ratio: number; min_redeem: number }
}

export default function LoyaltyLookup({ business, settings }: Props) {
  const color    = business.primary_color
  const currency = business.currency ?? 'UYU'

  const [phone,    setPhone]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<LoyaltyResult | null>(null)
  const [history,  setHistory]  = useState<HistoryRow[]>([])
  const [error,    setError]    = useState<string | null>(null)

  async function lookup() {
    if (!phone.trim()) return
    setLoading(true); setError(null); setResult(null); setHistory([])
    try {
      const res  = await fetch('/api/loyalty-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, phone: phone.trim() }),
      })
      const data = await res.json()

      if (!data.enabled) { setError('Este comercio no tiene programa de puntos activo.'); return }
      if (!data.customer_id) { setError('No encontramos una cuenta asociada a ese teléfono.'); return }

      setResult(data as LoyaltyResult)

      // Fetch history
      const hRes  = await fetch('/api/loyalty-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, customer_id: data.customer_id }),
      })
      const hData = await hRes.json()
      setHistory(hData.rows ?? [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/store/${business.slug}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                style={{ background: color, color: business.secondary_color }}>
                {business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm text-gray-900">{business.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl shadow-lg"
              style={{ background: color }}>
              <Gift size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mis puntos</h1>
          <p className="text-sm text-gray-500">Ingresá tu teléfono para ver tu saldo</p>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">¿Cómo funciona?</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1">
              <div className="text-2xl">🛍️</div>
              <p className="text-xs font-semibold text-gray-800">Comprá</p>
              <p className="text-[11px] text-gray-400">
                {settings.points_per_unit} pt por cada {currency} 1
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl">⭐</div>
              <p className="text-xs font-semibold text-gray-800">Acumulá</p>
              <p className="text-[11px] text-gray-400">desde {settings.min_redeem} pts</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl">🎁</div>
              <p className="text-xs font-semibold text-gray-800">Canjéalos</p>
              <p className="text-[11px] text-gray-400">
                {settings.redeem_ratio} pts = {formatPrice(1, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Lookup form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Phone size={14} className="text-gray-400" /> Tu número de teléfono
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
              placeholder="099 123 456"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none
                         focus:ring-2 focus:border-transparent transition-all"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={lookup}
              disabled={loading || !phone.trim()}
              className="rounded-xl px-5 py-3 text-sm font-bold text-white transition-all
                         disabled:opacity-50 hover:opacity-90"
              style={{ background: color }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ver'}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Balance card */}
            <div className="rounded-2xl p-6 text-white text-center space-y-3 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              <p className="text-sm font-medium opacity-80">Hola, {result.customer_name}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Star size={20} className="fill-white text-white" />
                  <span className="text-5xl font-bold">{result.points}</span>
                </div>
                <p className="text-sm opacity-80">puntos acumulados</p>
              </div>
              {result.redeem_value > 0 ? (
                <div className="bg-white/20 rounded-xl px-4 py-2.5">
                  <p className="text-sm font-bold">
                    = {formatPrice(result.redeem_value, currency)} en descuentos disponibles
                  </p>
                </div>
              ) : (
                <div className="bg-white/20 rounded-xl px-4 py-2.5">
                  <p className="text-sm opacity-80">
                    Necesitás {result.min_redeem - result.points} pts más para canjear
                  </p>
                </div>
              )}
            </div>

            {/* CTA */}
            <Link href={`/store/${business.slug}`}
              className="flex items-center justify-center gap-2 w-full rounded-2xl py-4
                         text-sm font-bold border-2 transition-all hover:opacity-90"
              style={{ borderColor: color, color }}>
              <Gift size={16} /> Ir a la tienda a acumular más puntos
            </Link>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-sm font-semibold text-gray-800">Movimientos recientes</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {history.map(row => {
                    const conf = REASON_CONF[row.reason] ?? REASON_CONF.manual
                    const Icon = conf.icon
                    return (
                      <div key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                          style={{ background: conf.color + '18' }}>
                          <Icon size={14} style={{ color: conf.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{conf.label}</p>
                          {row.note && (
                            <p className="text-xs text-gray-400 truncate">{row.note}</p>
                          )}
                          <p className="text-[11px] text-gray-400">
                            {new Date(row.created_at).toLocaleDateString('es-UY', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span className="text-sm font-bold shrink-0"
                          style={{ color: row.points >= 0 ? '#16a34a' : '#dc2626' }}>
                          {row.points >= 0 ? '+' : ''}{row.points}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
