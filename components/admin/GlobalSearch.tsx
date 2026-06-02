'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import {
  Search, Package, Users, Layers, Wallet, TrendingDown,
  X, ChevronRight, Loader2,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────
type ResultType = 'product' | 'customer' | 'inventory' | 'cash' | 'cost'

interface SearchResult {
  id:       string
  type:     ResultType
  title:    string
  subtitle: string
  href:     string
}

const TYPE_CONFIG: Record<ResultType, {
  label: string
  icon:  React.ElementType
  color: string
  bg:    string
}> = {
  product:   { label: 'Productos',  icon: Package,      color: '#6366F1', bg: '#EEF2FF' },
  customer:  { label: 'Clientes',   icon: Users,        color: '#0EA5E9', bg: '#F0F9FF' },
  inventory: { label: 'Inventario', icon: Layers,       color: '#16A34A', bg: '#F0FDF4' },
  cash:      { label: 'Caja',       icon: Wallet,       color: '#F59E0B', bg: '#FEF3C7' },
  cost:      { label: 'Costos',     icon: TrendingDown, color: '#EF4444', bg: '#FEE2E2' },
}

const MAX_PER_TYPE = 4
const RESULT_ORDER: ResultType[] = ['product', 'customer', 'inventory', 'cash', 'cost']

// ── Component ─────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

export default function GlobalSearch({ open, onClose }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const { businessId, currency } = useVertical()

  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<SearchResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setActiveIndex(0); setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  // Core search — runs after debounce
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setLoading(false); return }
    const t = q.trim()

    const [prodRes, custRes, invRes, cashRes, costRes] = await Promise.all([
      supabase.from('products')
        .select('id, name, price')
        .eq('business_id', businessId).eq('active', true)
        .ilike('name', `%${t}%`)
        .limit(MAX_PER_TYPE),

      supabase.from('customers')
        .select('id, name, phone, total_orders')
        .eq('business_id', businessId)
        .or(`name.ilike.%${t}%,phone.ilike.%${t}%`)
        .limit(MAX_PER_TYPE),

      supabase.from('inventory_items')
        .select('id, name, sku, stock_current, unit')
        .eq('business_id', businessId).eq('active', true)
        .or(`name.ilike.%${t}%,sku.ilike.%${t}%`)
        .limit(MAX_PER_TYPE),

      supabase.from('cash_movements')
        .select('id, reason, amount, type')
        .eq('business_id', businessId)
        .not('reason', 'is', null)
        .ilike('reason', `%${t}%`)
        .order('created_at', { ascending: false })
        .limit(MAX_PER_TYPE),

      supabase.from('business_costs')
        .select('id, name, amount, type')
        .eq('business_id', businessId)
        .ilike('name', `%${t}%`)
        .order('date', { ascending: false })
        .limit(MAX_PER_TYPE),
    ])

    const all: SearchResult[] = [
      ...(prodRes.data ?? []).map(p => ({
        id: p.id, type: 'product' as ResultType,
        title:    p.name,
        subtitle: formatPrice(p.price, currency),
        href:     '/admin/products',
      })),
      ...(custRes.data ?? []).map(c => ({
        id: c.id, type: 'customer' as ResultType,
        title:    c.name,
        subtitle: c.phone ? `📞 ${c.phone}` : `${c.total_orders} pedido${c.total_orders !== 1 ? 's' : ''}`,
        href:     '/admin/customers',
      })),
      ...(invRes.data ?? []).map(i => ({
        id: i.id, type: 'inventory' as ResultType,
        title:    i.name,
        subtitle: `${i.stock_current} ${i.unit}${i.sku ? ` · ${i.sku}` : ''}`,
        href:     '/admin/inventory',
      })),
      ...(cashRes.data ?? []).map(m => ({
        id: m.id, type: 'cash' as ResultType,
        title:    m.reason ?? 'Sin descripción',
        subtitle: `${m.type === 'ingreso' ? '+' : '-'} ${formatPrice(m.amount, currency)}`,
        href:     '/admin/caja',
      })),
      ...(costRes.data ?? []).map(c => ({
        id: c.id, type: 'cost' as ResultType,
        title:    c.name,
        subtitle: `${c.type} · ${formatPrice(c.amount, currency)}`,
        href:     '/admin/costs',
      })),
    ]

    setResults(all)
    setActiveIndex(0)
    setLoading(false)
  }, [businessId, currency])

  // Debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(() => runSearch(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, runSearch])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        router.push(results[activeIndex].href)
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, activeIndex, onClose, router])

  // Scroll active into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  // Group by type preserving RESULT_ORDER
  const grouped = RESULT_ORDER
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0)

  const empty   = !loading && query.trim().length >= 2 && results.length === 0
  const initial = !query.trim()
  const short   = query.trim().length === 1

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[10vh] z-50 w-full max-w-2xl -translate-x-1/2 px-4 animate-slide-up">
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
            {loading
              ? <Loader2 size={18} className="text-gray-400 shrink-0 animate-spin" />
              : <Search  size={18} className="text-gray-400 shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar productos, clientes, inventario, caja..."
              className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]) }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                <X size={15} />
              </button>
            )}
            <kbd className="hidden sm:flex h-5 items-center rounded border border-gray-200
                           px-1.5 text-[10px] font-medium text-gray-400 bg-gray-50 font-mono shrink-0">
              Esc
            </kbd>
          </div>

          {/* Results area */}
          <div ref={listRef} className="max-h-[58vh] overflow-y-auto overscroll-contain">

            {initial && (
              <div className="py-10 text-center select-none">
                <Search size={22} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Escribí para buscar en todo el sistema</p>
                <p className="text-xs text-gray-300 mt-1">Productos · Clientes · Inventario · Caja · Costos</p>
              </div>
            )}

            {short && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Seguí escribiendo...</p>
              </div>
            )}

            {empty && (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-500">Sin resultados para <strong>"{query}"</strong></p>
                <p className="text-xs text-gray-400 mt-1">Probá con otro término</p>
              </div>
            )}

            {grouped.length > 0 && (
              <div className="py-1">
                {grouped.map(({ type, items }) => {
                  const cfg      = TYPE_CONFIG[type]
                  const Icon     = cfg.icon
                  const startIdx = results.findIndex(r => r.type === type)
                  return (
                    <div key={type} className="mb-1">
                      {/* Group label */}
                      <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                        <div className="h-4 w-4 rounded flex items-center justify-center"
                          style={{ background: cfg.bg }}>
                          <Icon size={9} style={{ color: cfg.color }} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {cfg.label}
                        </span>
                      </div>
                      {/* Items */}
                      {items.map((result, i) => {
                        const flatIdx = startIdx + i
                        const active  = flatIdx === activeIndex
                        return (
                          <button
                            key={result.id}
                            data-idx={flatIdx}
                            onClick={() => { router.push(result.href); onClose() }}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              active ? 'bg-gray-50' : 'hover:bg-gray-50/80'
                            )}
                          >
                            <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center"
                              style={{ background: cfg.bg }}>
                              <Icon size={13} style={{ color: cfg.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                {result.title}
                              </p>
                              <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                                {result.subtitle}
                              </p>
                            </div>
                            <ChevronRight size={13} className={cn('shrink-0 transition-colors',
                              active ? 'text-gray-400' : 'text-gray-200')} />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer hints */}
          <div className="px-4 py-2 border-t border-gray-50 flex items-center gap-3 select-none">
            <span className="text-[10px] text-gray-300 flex items-center gap-1">
              <kbd className="rounded border border-gray-100 px-1 py-px text-[9px] bg-gray-50 font-mono">↑↓</kbd>
              navegar
            </span>
            <span className="text-[10px] text-gray-300 flex items-center gap-1">
              <kbd className="rounded border border-gray-100 px-1 py-px text-[9px] bg-gray-50 font-mono">↵</kbd>
              ir
            </span>
            {results.length > 0 && (
              <span className="ml-auto text-[10px] text-gray-300">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
