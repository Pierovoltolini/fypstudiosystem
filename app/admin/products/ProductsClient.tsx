// app/admin/products/ProductsClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Plus, Search, Package, Scissors, Star, Zap,
  Eye, EyeOff, Pencil, DollarSign, Check, X as XIcon, Upload, Trash2, AlertTriangle,
} from 'lucide-react'
import ImportProductsModal from './ImportProductsModal'
import UpgradePrompt from '@/components/admin/UpgradePrompt'
import { cn, formatPrice } from '@/lib/utils'
import type { Product, Category, Plan } from '@/types'
import { useVertical } from '@/lib/vertical-context'
import SectionTour from '@/components/admin/SectionTour'

type ActiveFilter = 'all' | 'active' | 'inactive'

type EnrichedProduct = Product & { category?: { id: string; name: string } | null }

interface Props {
  products:     EnrichedProduct[]
  categories:   Category[]
  plan:         Plan
  productLimit: number
}

export default function ProductsClient({ products: initialProducts, categories, plan, productLimit }: Props) {
  const { businessId, currency, color: primaryColor, vertical, group } = useVertical()
  const productLabel = vertical.productLabel
  const hasStock     = vertical.features.hasStock
  const supabase     = createClient()

  const [products,   setProducts]   = useState<EnrichedProduct[]>(initialProducts)
  const [search,     setSearch]     = useState('')
  const [catId,      setCatId]      = useState<string>('all')
  const [activeF,    setActiveF]    = useState<ActiveFilter>('all')
  const [toggling,   setToggling]   = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnrichedProduct | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [costMode,   setCostMode]   = useState(false)
  const [costValues,   setCostValues]   = useState<Record<string, string>>({})
  const [costSaving,   setCostSaving]   = useState<string | null>(null)
  const [showImport,   setShowImport]   = useState(false)

  function enterCostMode() {
    const vals: Record<string, string> = {}
    products.forEach(p => { vals[p.id] = p.cost_price != null ? String(p.cost_price) : '' })
    setCostValues(vals)
    setCostMode(true)
  }

  async function saveCost(productId: string) {
    const raw = (costValues[productId] ?? '').trim()
    const val = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    if (raw !== '' && isNaN(val as number)) return
    setCostSaving(productId)
    await supabase.from('products').update({ cost_price: val }).eq('id', productId)
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, cost_price: val } : p))
    setCostSaving(null)
  }

  const labelLower  = productLabel.toLowerCase()
  const labelPlural = productLabel + 's'
  const isService   = group === 'servicios'

  // ── Filtrado ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) &&
              !(p.description ?? '').toLowerCase().includes(q)) return false
      if (catId !== 'all' && p.category_id !== catId) return false
      if (activeF === 'active'   && !p.active) return false
      if (activeF === 'inactive' &&  p.active) return false
      return true
    })
  }, [products, search, catId, activeF])

  const activeCount   = products.filter(p => p.active).length
  const inactiveCount = products.length - activeCount

  // ── Delete product ────────────────────────────────────────
  async function deleteProduct() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('products').delete().eq('id', deleteTarget.id)
    setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  // ── Toggle activo/inactivo (optimistic) ──────────────────
  async function toggle(productId: string, isActive: boolean) {
    setToggling(productId)
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, active: !isActive } : p)
    )
    await supabase.from('products').update({ active: !isActive }).eq('id', productId)
    setToggling(null)
  }

  // ── Icono del vertical ────────────────────────────────────
  function ItemIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    if (isService) return <Scissors size={size} className={className} />
    return <Package size={size} className={className} />
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionTour section="products" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{labelPlural}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeCount} activos · {inactiveCount} inactivos
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {costMode ? (
            <button onClick={() => setCostMode(false)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold
                         bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all min-h-[44px]">
              <XIcon size={14} /> Salir
            </button>
          ) : (
            <button onClick={enterCostMode}
              className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold
                         border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all min-h-[44px]">
              <DollarSign size={14} /> Costos
            </button>
          )}
          {!costMode && (
            <>
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold
                           border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all">
                <Upload size={14} />
                <span className="hidden sm:inline">Importar CSV</span>
              </button>
              {productLimit !== Infinity && products.length >= productLimit ? (
                <Link href="/admin/planes"
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold
                             text-white bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all min-h-[44px]">
                  <Zap size={15} />
                  <span className="hidden sm:inline">Límite alcanzado</span>
                  <span className="sm:hidden">Upgradear</span>
                </Link>
              ) : (
                <Link href="/admin/products/new"
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold
                             text-white active:scale-[0.98] transition-all min-h-[44px]"
                  style={{ background: primaryColor }}>
                  <Plus size={15} />
                  <span className="hidden sm:inline">Nuevo {labelLower}</span>
                  <span className="sm:hidden">Nuevo</span>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Plan limit banner — solo en plan basic/pro con límite */}
      {productLimit !== Infinity && (
        <UpgradePrompt
          resource="productos"
          current={products.length}
          limit={productLimit}
          variant="inline"
        />
      )}

      {/* Cost mode banner */}
      {costMode && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <DollarSign size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Modo edición de costos</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Ingresá el costo de cada producto para calcular márgenes en Reportes. Los cambios se guardan automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${labelLower}s…`}
          className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3
                     text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {/* Active filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
          {([
            { key: 'all',      label: `Todos (${products.length})`       },
            { key: 'active',   label: `Activos (${activeCount})`          },
            { key: 'inactive', label: `Inactivos (${inactiveCount})`      },
          ] as { key: ActiveFilter; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveF(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                activeF === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <>
            <div className="h-5 w-px bg-gray-200 shrink-0" />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <button onClick={() => setCatId('all')}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 border transition-all',
                  catId === 'all'
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                )}
                style={catId === 'all' ? { background: primaryColor } : {}}>
                Todas
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setCatId(catId === cat.id ? 'all' : cat.id)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 border transition-all',
                    catId === cat.id
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  )}
                  style={catId === cat.id ? { background: primaryColor } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <ItemIcon size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">
            {products.length === 0
              ? `Sin ${labelPlural.toLowerCase()} todavía`
              : 'Sin resultados para este filtro'}
          </p>
          {products.length === 0 && (
            <Link href="/admin/products/new"
              className="inline-flex items-center gap-2 mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: primaryColor }}>
              <Plus size={14} /> Crear {labelLower}
            </Link>
          )}
        </div>
      )}

      {/* Product list */}
      {filtered.length > 0 && (
        costMode ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_100px_120px_80px] gap-3 px-4 py-2.5 bg-gray-50
                            border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
              <span>Producto</span>
              <span className="text-right">Precio venta</span>
              <span className="text-center">Costo</span>
              <span className="text-right">Margen</span>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(product => (
                <CostRow
                  key={product.id}
                  product={product}
                  currency={currency}
                  primaryColor={primaryColor}
                  value={costValues[product.id] ?? ''}
                  saving={costSaving === product.id}
                  onChange={v => setCostValues(prev => ({ ...prev, [product.id]: v }))}
                  onSave={() => saveCost(product.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                currency={currency}
                primaryColor={primaryColor}
                hasStock={hasStock}
                toggling={toggling === product.id}
                onToggle={() => toggle(product.id, product.active)}
                onDelete={() => setDeleteTarget(product)}
              />
            ))}
          </div>
        )
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">¿Eliminar {labelLower}?</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-700">{deleteTarget.name}</span> se eliminará
                  permanentemente. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold
                           text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={deleteProduct}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white
                           bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-all"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <ImportProductsModal
          businessId={businessId}
          productLabel={productLabel}
          onClose={() => setShowImport(false)}
          onImported={count => {
            setShowImport(false)
            if (count > 0) window.location.reload()
          }}
        />
      )}
    </div>
  )
}

// ── Cost Row ─────────────────────────────────────────────────
function CostRow({ product, currency, primaryColor, value, saving, onChange, onSave }: {
  product: EnrichedProduct
  currency: string; primaryColor: string
  value: string; saving: boolean
  onChange: (v: string) => void
  onSave: () => void
}) {
  const cost    = parseFloat(value.replace(',', '.'))
  const hasCost = value.trim() !== '' && !isNaN(cost) && cost > 0
  const margin  = hasCost ? ((product.price - cost) / product.price) * 100 : null
  const marginColor = margin === null ? '' : margin < 0 ? '#EF4444' : margin < 20 ? '#F59E0B' : '#10B981'

  return (
    <div className="grid grid-cols-[1fr_100px_120px_80px] gap-3 items-center px-4 py-3">
      {/* Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package size={12} className="text-gray-300" />
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
      </div>

      {/* Sale price */}
      <p className="text-sm font-semibold text-gray-700 text-right">
        {formatPrice(product.price, currency)}
      </p>

      {/* Cost input */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {currency === 'USD' ? '$' : '$'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 pl-6 pr-2 py-1.5 text-sm
                       text-gray-900 outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          />
        </div>
        <div className="w-5 flex items-center justify-center shrink-0">
          {saving ? (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-200 animate-spin"
              style={{ borderTopColor: primaryColor }} />
          ) : hasCost ? (
            <Check size={13} className="text-green-500" />
          ) : null}
        </div>
      </div>

      {/* Margin */}
      <p className={cn(
        'text-sm font-bold text-right',
        margin === null ? 'text-gray-300' : ''
      )}
        style={margin !== null ? { color: marginColor } : {}}>
        {margin === null ? '—' : `${margin.toFixed(0)}%`}
      </p>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ product, currency, primaryColor, hasStock, toggling, onToggle, onDelete }: {
  product: EnrichedProduct
  currency: string; primaryColor: string; hasStock: boolean
  toggling: boolean; onToggle: () => void; onDelete: () => void
}) {
  const stockLow = hasStock && product.stock !== null && product.stock !== undefined && product.stock <= 5
  const stockOut = hasStock && product.stock !== null && product.stock !== undefined && product.stock <= 0

  const activeVariants = (product.variants ?? []).filter(v => v.active)
  const sizes  = Array.from(new Set(activeVariants.map(v => v.size).filter(Boolean))) as string[]
  const colors = Array.from(new Set(activeVariants.map(v => v.color).filter(Boolean))) as string[]
  const hasVariantInfo = sizes.length > 0 || colors.length > 0

  return (
    <div className={cn(
      'flex items-center gap-3 bg-white rounded-2xl border px-4 py-3.5 transition-all',
      product.active ? 'border-gray-100' : 'border-gray-100 opacity-60'
    )}>
      {/* Thumbnail */}
      <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package size={16} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={cn(
            'text-sm font-semibold truncate',
            product.active ? 'text-gray-900' : 'text-gray-500'
          )}>
            {product.name}
          </p>
          {product.featured && (
            <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
          )}
          {activeVariants.length > 0 && (
            <span className="text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600 px-1.5 py-0.5 shrink-0">
              {activeVariants.length}v
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-sm font-bold" style={{ color: product.active ? primaryColor : '#9CA3AF' }}>
            {formatPrice(product.price, currency)}
          </p>
          {product.category?.name && (
            <span className="text-xs text-gray-400 hidden sm:inline">· {product.category.name}</span>
          )}
          {hasStock && product.stock !== null && product.stock !== undefined && (
            <span className={cn(
              'text-xs font-medium',
              stockOut ? 'text-red-500' : stockLow ? 'text-amber-500' : 'text-gray-400'
            )}>
              {stockOut ? '⚠ Sin stock' : `Stock: ${product.stock}`}
            </span>
          )}
        </div>

        {/* Variant summary: sizes + colors */}
        {hasVariantInfo && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {sizes.map(s => (
              <span key={s} className="text-[10px] font-semibold rounded-md bg-gray-100 text-gray-600 px-1.5 py-0.5">
                {s}
              </span>
            ))}
            {colors.length > 0 && sizes.length > 0 && (
              <span className="text-[10px] text-gray-300">·</span>
            )}
            {colors.map(c => (
              <span key={c} className="text-[10px] font-semibold rounded-md bg-gray-100 text-gray-600 px-1.5 py-0.5">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Toggle active */}
        <button
          onClick={onToggle}
          disabled={toggling}
          title={product.active ? 'Desactivar' : 'Activar'}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
            'disabled:opacity-40',
            product.active
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          )}>
          {product.active ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>

        {/* Edit */}
        <Link href={`/admin/products/${product.id}/edit`}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100
                     text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-all">
          <Pencil size={13} />
        </Link>

        {/* Delete */}
        <button
          onClick={onDelete}
          title="Eliminar"
          className="flex h-8 w-8 items-center justify-center rounded-xl
                     text-red-300 hover:bg-red-50 hover:text-red-600 transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
