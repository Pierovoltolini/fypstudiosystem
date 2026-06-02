// components/store/StoreFront.tsx
// Componente principal cliente — maneja toda la UI de la tienda
'use client'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { formatPrice, productImageUrl, truncate } from '@/lib/utils'
import { ShoppingBag, Search, X, Plus, Minus, Star, ChevronRight, MessageCircle, CheckCircle2, UtensilsCrossed, Bell, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Business, Category, Product, ProductVariant, Combo } from '@/types'
import CartDrawer from './CartDrawer'

interface Props {
  business: Business
  categories: Category[]
  products: Product[]
  combos?: Combo[]
  showFeatured?: boolean
  showCategories?: boolean
  isOpen?: boolean | null
  tables?: { id: string; name: string; qr_token: string }[]
}

export default function StoreFront({ business, categories, products, combos = [], showFeatured = true, showCategories = true, isOpen, tables = [] }: Props) {
  const { addItem, itemCount } = useCart()
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [orderBannerVisible, setOrderBannerVisible] = useState(true)
  const searchParams = useSearchParams()
  const orderSent   = searchParams.get('pedido') === 'enviado'
  const mesaToken   = searchParams.get('mesa')
  // Match by qr_token (URL uses the regenerable token, not the internal id)
  const mesa        = mesaToken ? tables.find(t => t.qr_token === mesaToken) : null
  const mesaId      = mesa?.id ?? null

  // Filtrar productos
  const filtered = useMemo(() => {
    let list = products
    if (activeCat) list = list.filter(p => p.category_id === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [products, activeCat, search])

  const featured = products.filter(p => p.featured)
  const currency = business.currency ?? 'UYU'

  function handleAdd(product: Product, variant?: ProductVariant) {
    const cartProduct = variant
      ? {
          ...product,
          id:    `${product.id}__${variant.id}`,
          name:  `${product.name} — ${variant.name}`,
          price: product.price + variant.price_modifier,
        }
      : product
    addItem(cartProduct, business.slug)
    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1200)
  }

  const [alertSent, setAlertSent] = useState<'waiter' | 'bill' | null>(null)
  const [alertLoading, setAlertLoading] = useState<'waiter' | 'bill' | null>(null)

  async function sendTableAlert(action: 'waiter' | 'bill') {
    if (!mesaToken || alertSent) return
    setAlertLoading(action)
    try {
      await fetch('/api/table-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: mesaToken, action }),
      })
      setAlertSent(action)
    } catch { /* silent */ } finally {
      setAlertLoading(null)
    }
  }

  // Abrir carrito automáticamente si hay items al cargar
  const count = itemCount()

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Header fijo */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo / nombre */}
          <div className="flex items-center gap-2.5 shrink-0">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name}
                className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: business.primary_color, color: business.secondary_color }}>
                {business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-gray-900 truncate max-w-[110px]">
                {business.name}
              </span>
              {isOpen != null && (
                <span className={cn(
                  'flex items-center gap-1 text-[10px] font-medium leading-none mt-0.5',
                  isOpen ? 'text-emerald-600' : 'text-gray-400'
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isOpen ? 'bg-emerald-500' : 'bg-gray-400'
                  )} />
                  {isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              )}
            </div>
          </div>

          {/* Buscador */}
          <div className="flex-1 max-w-xs">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-xl bg-gray-100 pl-8 pr-3 py-2 text-sm
                           placeholder:text-gray-400 focus:outline-none focus:bg-gray-200
                           transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl
                       transition-colors hover:bg-gray-100 shrink-0"
          >
            <ShoppingBag size={18} className="text-gray-700" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center
                               rounded-full text-[10px] font-bold text-white"
                style={{ background: business.primary_color }}>
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mesa banner */}
      {mesa && (
        <div className="sticky top-14 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <UtensilsCrossed size={14} className="shrink-0" style={{ color: business.primary_color }} />
              <span className="font-semibold text-gray-800 truncate">{mesa.name}</span>
              <span className="text-gray-400 text-xs hidden sm:inline">— Pedido en mesa</span>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {alertSent ? (
                <span className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: business.primary_color }}>
                  <CheckCircle2 size={12} />
                  {alertSent === 'waiter' ? '¡Mozo en camino!' : '¡Cuenta solicitada!'}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => sendTableAlert('waiter')}
                    disabled={!!alertLoading}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all active:scale-95 disabled:opacity-60"
                    style={{ borderColor: business.primary_color + '66', color: business.primary_color, background: business.primary_color + '10' }}>
                    {alertLoading === 'waiter'
                      ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : <Bell size={12} />}
                    Llamar mozo
                  </button>
                  <button
                    onClick={() => sendTableAlert('bill')}
                    disabled={!!alertLoading}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 bg-white transition-all active:scale-95 disabled:opacity-60">
                    {alertLoading === 'bill'
                      ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : <Receipt size={12} />}
                    La cuenta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order success banner */}
      {orderSent && orderBannerVisible && (
        <div className="sticky top-14 z-20 bg-emerald-600 text-white px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <p className="text-sm font-medium">
                ¡Pedido enviado! Te contactaremos por WhatsApp para confirmar.
              </p>
            </div>
            <button
              onClick={() => setOrderBannerVisible(false)}
              className="shrink-0 rounded-lg p-1 hover:bg-emerald-700 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 pb-24">

        {/* Combos */}
        {combos.length > 0 && !activeCat && !search && (
          <section className="pt-6 pb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Combos y ofertas
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {combos.map(combo => (
                <ComboCard key={combo.id} combo={combo} currency={currency} primary={business.primary_color} />
              ))}
            </div>
          </section>
        )}

        {/* Destacados */}
        {featured.length > 0 && showFeatured && !activeCat && !search && (
          <section className="pt-6 pb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Destacados
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {featured.map(product => (
                <FeaturedCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  added={addedId === product.id}
                  onAdd={() => handleAdd(product)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Filtro de categorías */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 pt-5 pb-1 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <CategoryPill
              label="Todo"
              active={activeCat === null}
              onClick={() => setActiveCat(null)}
              primary={business.primary_color}
            />
            {categories.map(cat => (
              <CategoryPill
                key={cat.id}
                label={cat.name}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
                primary={business.primary_color}
              />
            ))}
          </div>
        )}

        {/* Grid de productos */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm">
              {search ? `Sin resultados para "${search}"` : 'Sin productos en esta categoría'}
            </p>
          </div>
        ) : (
          <div className="pt-4 space-y-0">
            {/* Agrupar por categoría si no hay filtro activo */}
            {!activeCat && !search && categories.length > 0
              ? categories.map(cat => {
                  const catProducts = filtered.filter(p => p.category_id === cat.id)
                  const uncategorized = filtered.filter(p => !p.category_id)
                  if (catProducts.length === 0) return null
                  return (
                    <CategorySection
                      key={cat.id}
                      title={cat.name}
                      products={catProducts}
                      currency={currency}
                      addedId={addedId}
                      onAdd={handleAdd}
                    />
                  )
                })
              : (
                <CategorySection
                  title={search ? `Resultados para "${search}"` : undefined}
                  products={filtered}
                  currency={currency}
                  addedId={addedId}
                  onAdd={handleAdd}
                />
              )
            }

            {/* Sin categoría */}
            {!activeCat && !search && (() => {
              const uncategorized = filtered.filter(p => !p.category_id)
              if (uncategorized.length === 0) return null
              return (
                <CategorySection
                  key="uncategorized"
                  title={categories.length > 0 ? 'Otros' : undefined}
                  products={uncategorized}
                  currency={currency}
                  addedId={addedId}
                  onAdd={handleAdd}
                />
              )
            })()}
          </div>
        )}
      </main>

      {/* Botón flotante carrito */}
      {count > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20 px-4">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 rounded-2xl px-6 py-3.5 text-sm font-semibold
                       shadow-xl transition-all active:scale-[0.97]"
            style={{ background: business.primary_color, color: business.secondary_color }}
          >
            <ShoppingBag size={16} />
            Ver pedido ({count} {count === 1 ? 'item' : 'items'})
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        business={business}
        tableId={mesaId}
      />
    </div>
  )
}

// ── Card de combo ──────────────────────────────────────────────────────────
function ComboCard({ combo, currency, primary }: { combo: Combo; currency: string; primary: string }) {
  return (
    <div className="shrink-0 w-52 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {combo.image_url ? (
        <div className="h-28 overflow-hidden bg-gray-100">
          <img src={combo.image_url} alt={combo.name} className="h-full w-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      ) : (
        <div className="h-12 flex items-center justify-center text-xl"
          style={{ background: primary + '18' }}>
          🍱
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{combo.name}</p>
          {combo.featured && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">★</span>
          )}
        </div>
        {combo.description && (
          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{combo.description}</p>
        )}
        {(combo.items ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(combo.items ?? []).slice(0, 3).map((item, idx) => (
              <span key={idx} className="rounded-md bg-gray-50 border border-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.product_name}
              </span>
            ))}
            {(combo.items ?? []).length > 3 && (
              <span className="text-[10px] text-gray-400">+{(combo.items ?? []).length - 3} más</span>
            )}
          </div>
        )}
        <p className="text-sm font-bold pt-0.5" style={{ color: primary }}>
          {formatPrice(combo.price, currency)}
        </p>
      </div>
    </div>
  )
}

// ── Pill de categoría ──────────────────────────────────────────────────────
function CategoryPill({
  label, active, onClick, primary,
}: {
  label: string
  active: boolean
  onClick: () => void
  primary: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all',
        active ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
      )}
      style={active ? { background: primary } : {}}
    >
      {label}
    </button>
  )
}

// ── Sección por categoría ──────────────────────────────────────────────────
function CategorySection({
  title, products, currency, addedId, onAdd,
}: {
  title?: string
  products: Product[]
  currency: string
  addedId: string | null
  onAdd: (p: Product, v?: ProductVariant) => void
}) {
  return (
    <section className="pt-6">
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}
      <div className="space-y-2">
        {products.map(product => (
          <ProductRow
            key={product.id}
            product={product}
            currency={currency}
            added={addedId === product.id}
            onAdd={(v) => onAdd(product, v)}
          />
        ))}
      </div>
    </section>
  )
}

// ── Card producto destacado (scroll horizontal) ───────────────────────────
function FeaturedCard({
  product, currency, added, onAdd,
}: {
  product: Product
  currency: string
  added: boolean
  onAdd: () => void
}) {
  return (
    <div className="shrink-0 w-44 bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="h-32 bg-gray-100 overflow-hidden">
        <img
          src={productImageUrl(product.images)}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
        />
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">
          {product.name}
        </p>
        <p className="text-xs font-bold text-gray-900 mb-2">
          {formatPrice(product.price, currency)}
        </p>
        <button
          onClick={onAdd}
          className={cn(
            'w-full rounded-xl py-1.5 text-xs font-semibold transition-all',
            added ? 'bg-green-500 text-white' : 'text-white'
          )}
          style={!added ? { background: 'var(--brand-primary)', color: 'var(--brand-secondary)' } : {}}
        >
          {added ? '✓ Agregado' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

// ── Fila de producto (lista principal) ────────────────────────────────────
function ProductRow({
  product, currency, added, onAdd,
}: {
  product: Product
  currency: string
  added: boolean
  onAdd: (variant?: ProductVariant) => void
}) {
  const [showVariants, setShowVariants] = useState(false)
  const hasVariants = (product.variants?.length ?? 0) > 0
  const outOfStock  = product.stock === 0

  function handleAddDirect() {
    if (hasVariants) { setShowVariants(v => !v); return }
    onAdd(undefined)
  }

  function handlePickVariant(v: ProductVariant) {
    onAdd(v)
    setShowVariants(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-colors">
      <div className="flex items-center gap-4 p-4">
        {/* Imagen */}
        <div className="h-16 w-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
          <img
            src={productImageUrl(product.images)}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {product.name}
            {product.featured && (
              <Star size={11} className="inline ml-1 text-amber-400 fill-amber-400" />
            )}
          </p>
          {product.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          {hasVariants && (
            <p className="text-xs text-gray-400 mt-0.5">{product.variants!.length} opciones disponibles</p>
          )}
          {!hasVariants && outOfStock && (
            <p className="text-xs text-orange-500 font-medium mt-0.5">Sin stock</p>
          )}
          {!hasVariants && !outOfStock && product.stock !== null && product.stock !== undefined && product.stock <= 5 && (
            <p className="text-xs text-orange-500 font-medium mt-0.5">Últimas {product.stock} unidades</p>
          )}
        </div>

        {/* Precio + botón */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="text-sm font-bold text-gray-900">
            {hasVariants
              ? `Desde ${formatPrice(product.price + Math.min(...product.variants!.map(v => v.price_modifier)), currency)}`
              : formatPrice(product.price, currency)
            }
          </p>
          <button
            onClick={handleAddDirect}
            disabled={!hasVariants && outOfStock}
            className={cn(
              'flex h-8 items-center justify-center rounded-xl text-white transition-all',
              'active:scale-90 disabled:opacity-30',
              added && !hasVariants ? 'bg-green-500 scale-90 w-8' : hasVariants ? 'px-3 gap-1 text-xs font-bold' : 'w-8'
            )}
            style={!(added && !hasVariants) ? { background: 'var(--brand-primary)', color: 'var(--brand-secondary)' } : {}}
          >
            {added && !hasVariants
              ? <span className="text-xs">✓</span>
              : hasVariants
                ? <><ChevronRight size={12} /> Elegir</>
                : <Plus size={16} />
            }
          </button>
        </div>
      </div>

      {/* Variant picker */}
      {showVariants && hasVariants && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Elegí una opción:</p>
          <div className="flex flex-wrap gap-2">
            {product.variants!.map(v => {
              const finalPrice = product.price + v.price_modifier
              const vOut = v.stock === 0
              return (
                <button
                  key={v.id}
                  onClick={() => !vOut && handlePickVariant(v)}
                  disabled={vOut}
                  className={cn(
                    'flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all',
                    'text-xs disabled:opacity-40 disabled:cursor-not-allowed',
                    'hover:border-gray-400 active:scale-[0.97]',
                    vOut ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  )}>
                  <span className="font-semibold text-gray-900">{v.name}</span>
                  <span className="text-gray-500 mt-0.5">
                    {formatPrice(finalPrice, currency)}
                    {vOut && ' · Sin stock'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
