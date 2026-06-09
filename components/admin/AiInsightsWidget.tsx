'use client'
import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { useVertical } from '@/lib/vertical-context'

const ICONS   = ['💡', '📈', '⚠️']
const COLORS  = [
  'bg-blue-50 border-blue-100',
  'bg-emerald-50 border-emerald-100',
  'bg-amber-50 border-amber-100',
]

export default function AiInsightsWidget() {
  const { businessId } = useVertical()
  const cacheKey = `fyp_insights_${businessId}`

  const [insights, setInsights] = useState<string[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [cached,   setCached]   = useState(false)

  const fetchInsights = useCallback(async (force = false) => {
    // Check cache unless forced
    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey)
        if (raw) {
          const { date, data } = JSON.parse(raw)
          const today = new Date().toISOString().split('T')[0]
          if (date === today && Array.isArray(data) && data.length > 0) {
            setInsights(data)
            setCached(true)
            return
          }
        }
      } catch { /* ignore parse errors */ }
    }

    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/ai/insights', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar sugerencias')

      const newInsights: string[] = json.insights ?? []
      const today = new Date().toISOString().split('T')[0]
      try { localStorage.setItem(cacheKey, JSON.stringify({ date: today, data: newInsights })) } catch { /* storage full */ }
      setInsights(newInsights)
      setCached(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [cacheKey])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-blue-50 flex items-center justify-center">
            <Sparkles size={13} className="text-blue-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Sugerencias IA</p>
        </div>
        <button
          onClick={() => fetchInsights(true)}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500
                     transition-colors disabled:opacity-40"
          title="Regenerar sugerencias"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && insights.length === 0 ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
            <p className="text-xs text-red-500 text-center">{error}</p>
            <button
              onClick={() => fetchInsights(true)}
              className="text-xs text-blue-500 hover:underline"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : insights.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-400">Sin sugerencias disponibles</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <div key={i}
                className={`flex items-start gap-2.5 rounded-xl border p-3 ${COLORS[i % COLORS.length]}`}>
                <span className="text-base leading-none mt-0.5 shrink-0">{ICONS[i % ICONS.length]}</span>
                <p className="text-xs text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {cached && !loading && (
        <p className="text-[10px] text-gray-300 mt-3 text-right shrink-0">
          Actualizado hoy
        </p>
      )}
    </div>
  )
}
