// app/admin/ai/AIAssistant.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import {
  Sparkles, Loader2, Check, ChevronDown, ChevronUp,
  Package, Megaphone, BarChart2, Copy, Save, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import type { AIProductOutput } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

type Tab = 'product' | 'promo' | 'insights'

export default function AIAssistant() {
  const { businessId, business } = useVertical()
  const businessName = business.name
  const [tab, setTab] = useState<Tab>('product')

  return (
    <div className="space-y-5">
      <SectionTour section="ai_assistant" />
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {([
          { key: 'product', label: 'Crear producto', icon: Package },
          { key: 'promo',   label: 'Generar promo',  icon: Megaphone },
          { key: 'insights',label: 'Insights',        icon: BarChart2 },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shrink-0 transition-all',
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'product' && (
        <ProductGenerator businessId={businessId} businessName={businessName} />
      )}
      {tab === 'promo' && (
        <PromoGenerator businessName={businessName} />
      )}
      {tab === 'insights' && (
        <InsightsGenerator businessId={businessId} businessName={businessName} />
      )}
    </div>
  )
}

// ── Generador de productos ─────────────────────────────────────────────────

function ProductGenerator({
  businessId,
  businessName,
}: {
  businessId: string
  businessName: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [input, setInput] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIProductOutput | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCopy, setShowCopy] = useState<string | null>(null)

  // Campos editables del resultado
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPrice, setEditPrice] = useState('')

  async function generate() {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)

    try {
      const res = await fetch('/api/ai/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: input.trim(), businessType: businessType.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error de IA')
      setResult(data as AIProductOutput)
      setEditName(data.name)
      setEditDesc(data.description)
      setEditPrice('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function saveProduct() {
    if (!result || !editPrice) return
    setSaving(true)
    const slug = slugify(editName) + '-' + Math.random().toString(36).slice(2, 5)
    const { error } = await supabase.from('products').insert({
      business_id: businessId,
      name: editName,
      slug,
      description: editDesc,
      price: parseFloat(editPrice),
      tags: result.tags,
      seo_title: result.seo_title,
      seo_desc: result.seo_description,
      active: true,
      featured: false,
      images: [],
    })
    if (!error) {
      setSaved(true)
      router.push('/admin/products')
      router.refresh()
    }
    setSaving(false)
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setShowCopy(key)
    setTimeout(() => setShowCopy(null), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="field-label">
            Describí tu producto en lenguaje natural
          </label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'Ej: "Hamburguesa doble cheddar con panceta crocante $390"\n"Remera oversize negra premium talle M/L/XL $1200"\n"Café con leche grande con un croissant $280"'}
            rows={4}
            className="input-base resize-none"
          />
        </div>
        <div>
          <label className="field-label">
            Tipo de negocio <span className="text-gray-400 font-normal text-xs">(opcional)</span>
          </label>
          <input
            type="text"
            value={businessType}
            onChange={e => setBusinessType(e.target.value)}
            placeholder="Ej: hamburguesería, cafetería, streetwear, ferretería..."
            className="input-base"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={generate}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600
                     px-5 py-2.5 text-sm font-medium text-white hover:opacity-90
                     transition-opacity disabled:opacity-40 active:scale-[0.98]"
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <Sparkles size={14} />
          }
          {loading ? 'Generando...' : 'Generar con IA'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden animate-slide-up">
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-3.5 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-purple-600" />
              <p className="text-sm font-medium text-purple-800">Resultado generado</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Nombre + descripción editables */}
            <div className="space-y-3">
              <div>
                <label className="field-label">Nombre del producto</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="input-base font-medium" />
              </div>
              <div>
                <label className="field-label">Descripción</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  rows={3} className="input-base resize-none" />
              </div>
              <div>
                <label className="field-label">
                  Precio <span className="text-red-400">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-1">(requerido para guardar)</span>
                </label>
                <input type="number" min="0" step="0.01" value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  placeholder="Ingresá el precio" className="input-base" />
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {result.tags.map(tag => (
                  <span key={tag} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Copy sections */}
            {[
              { key: 'ig', label: '📸 Instagram', text: result.instagram_copy },
              { key: 'wa', label: '💬 WhatsApp', text: result.whatsapp_copy },
              { key: 'hash', label: '#️⃣ Hashtags', text: result.hashtags.join(' ') },
              { key: 'seo_t', label: '🔍 SEO Title', text: result.seo_title },
              { key: 'seo_d', label: '🔍 SEO Description', text: result.seo_description },
            ].map(({ key, label, text }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <button onClick={() => copy(text, key)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400
                               hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    {showCopy === key ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                    {showCopy === key ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
                  {text}
                </div>
              </div>
            ))}

            {/* Acciones */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={saveProduct}
                disabled={saving || !editPrice || saved}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium
                           text-white hover:bg-gray-800 disabled:opacity-40 transition-colors active:scale-[0.98]"
              >
                {saving
                  ? <Loader2 size={14} className="animate-spin" />
                  : saved
                    ? <Check size={14} />
                    : <Save size={14} />
                }
                {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar producto'}
              </button>
              <button
                onClick={() => { setResult(null); setInput('') }}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5
                           text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={13} /> Nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generador de promos ────────────────────────────────────────────────────

function PromoGenerator({ businessName }: { businessName: string }) {
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    title: string
    body: string
    instagram_story: string
    whatsapp_message: string
    cta: string
  } | null>(null)
  const [showCopy, setShowCopy] = useState<string | null>(null)

  async function generate() {
    if (!context.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context.trim(), businessName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error de IA')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setShowCopy(key)
    setTimeout(() => setShowCopy(null), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="field-label">¿Qué querés promocionar?</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder={'Ej: "2x1 en hamburguesas los martes"\n"Liquidación de temporada ropa de verano"\n"Promo del día: café + medialunas por $150"'}
            rows={4}
            className="input-base resize-none"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <button
          onClick={generate}
          disabled={loading || !context.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500
                     px-5 py-2.5 text-sm font-medium text-white hover:opacity-90
                     transition-opacity disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
          {loading ? 'Generando...' : 'Crear promo'}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden animate-slide-up">
          <div className="bg-gradient-to-r from-orange-50 to-pink-50 px-5 py-3.5 border-b border-orange-100">
            <p className="text-sm font-semibold text-orange-800">{result.title}</p>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">{result.body}</p>
            {[
              { key: 'ig', label: '📸 Historia de Instagram', text: result.instagram_story },
              { key: 'wa', label: '💬 Mensaje WhatsApp', text: result.whatsapp_message },
              { key: 'cta', label: '🎯 CTA', text: result.cta },
            ].map(({ key, label, text }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <button onClick={() => copy(text, key)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400
                               hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    {showCopy === key ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                    {showCopy === key ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
                  {text}
                </div>
              </div>
            ))}
            <button onClick={() => setResult(null)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
              <RefreshCw size={13} /> Generar otra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Insights ───────────────────────────────────────────────────────────────

function InsightsGenerator({
  businessId,
  businessName,
}: {
  businessId: string
  businessName: string
}) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setInsights(null)
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error de IA')
      setInsights(data.insights)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm text-gray-600 mb-4">
          La IA analiza tus pedidos, productos y clientes para darte recomendaciones
          prácticas sobre cómo mejorar tu negocio hoy.
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-green-500
                     px-5 py-2.5 text-sm font-medium text-white hover:opacity-90
                     transition-opacity disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
          {loading ? 'Analizando...' : 'Analizar mi negocio'}
        </button>
        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </div>

      {insights && (
        <div className="space-y-3 animate-slide-up">
          {insights.map((insight, i) => (
            <div key={i}
              className="flex items-start gap-3 bg-white rounded-2xl border border-teal-100 px-5 py-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                              bg-teal-100 text-xs font-bold text-teal-700 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
            </div>
          ))}
          <button onClick={() => setInsights(null)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
            <RefreshCw size={13} /> Volver a analizar
          </button>
        </div>
      )}
    </div>
  )
}
