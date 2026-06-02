// app/admin/inventory/InventoryClient.tsx
'use client'
import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, X, Package, AlertTriangle, TrendingDown,
  CheckCircle, Layers, Sparkles, Loader2, ChevronDown, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, Tag,
  BarChart2, Edit2, Trash2, ShoppingCart, Truck, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatPrice } from '@/lib/utils'
import type { InventoryItem, InventoryCategory, MovementType, SupplierProduct } from '@/types'
import { getStockStatus } from '@/types'
import { useVertical } from '@/lib/vertical-context'

interface Props {
  initialItems: InventoryItem[]
  initialCategories: InventoryCategory[]
  supplierProducts: (SupplierProduct & { supplier: { id: string; name: string; phone: string | null } | null })[]
}

const BLUE  = '#1565FF'
const UNITS = ['unidad','kg','gramo','litro','ml','caja','pack','bolsa','metro','rollo','par']

const STATUS_CONFIG = {
  ok:       { label:'En stock',   bg:'bg-green-50',  text:'text-green-700',  dot:'bg-green-400',  icon: CheckCircle   },
  low:      { label:'Stock bajo', bg:'bg-amber-50',  text:'text-amber-700',  dot:'bg-amber-400',  icon: AlertTriangle },
  critical: { label:'Crítico',    bg:'bg-red-50',    text:'text-red-700',    dot:'bg-red-500',    icon: TrendingDown  },
  out:      { label:'Sin stock',  bg:'bg-gray-100',  text:'text-gray-500',   dot:'bg-gray-400',   icon: X             },
}

export default function InventoryClient({ initialItems, initialCategories, supplierProducts }: Props) {
  const { businessId, business, userEmail, currency } = useVertical()
  const supabase = createClient()
  const router   = useRouter()
  const hasPro   = business.plan === 'pro' || business.plan === 'premium'

  const [items,      setItems]      = useState<InventoryItem[]>(initialItems)
  const [categories, setCategories] = useState<InventoryCategory[]>(initialCategories)
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState<string|null>(null)
  const [filterStatus, setFilterStatus] = useState<string|null>(null)
  const [activeTab,  setActiveTab]  = useState<'items'|'categories'|'movements'|'restock'|'purchase-orders'>('items')

  // Modales
  const [showItemModal,    setShowItemModal]    = useState(false)
  const [showCatModal,     setShowCatModal]     = useState(false)
  const [showMoveModal,    setShowMoveModal]    = useState(false)
  const [showAIModal,      setShowAIModal]      = useState(false)
  const [editingItem,      setEditingItem]      = useState<InventoryItem|null>(null)
  const [movingItem,       setMovingItem]       = useState<InventoryItem|null>(null)

  // Stats
  const lowStockItems  = items.filter(i => getStockStatus(i) === 'low' || getStockStatus(i) === 'critical')
  const outStockItems  = items.filter(i => getStockStatus(i) === 'out')
  const restockItems   = items.filter(i => getStockStatus(i) !== 'ok')
  const totalValue     = items.reduce((a,i) => a + i.stock_current * (i.cost_price ?? 0), 0)

  // Filtrado
  const filtered = useMemo(() => {
    let list = items
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q) ||
        i.talle?.toLowerCase().includes(q) ||
        i.modelo?.toLowerCase().includes(q) ||
        i.color_attr?.toLowerCase().includes(q)
      )
    }
    if (filterCat)    list = list.filter(i => i.category_id === filterCat)
    if (filterStatus) list = list.filter(i => getStockStatus(i) === filterStatus)
    return list
  }, [items, search, filterCat, filterStatus])

  function openEdit(item: InventoryItem) { setEditingItem(item); setShowItemModal(true) }
  function openMove(item: InventoryItem) { setMovingItem(item);  setShowMoveModal(true) }

  async function deleteItem(id: string) {
    if (!confirm('¿Desactivar este item del inventario?')) return
    await supabase.from('inventory_items').update({ active: false }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-5 animate-fade-in pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Inventario</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Controlá tu stock, movimientos y alertas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPro && (
            <button onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white
                         transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
              <Sparkles size={14} /> IA
            </button>
          )}
          <button onClick={() => { setEditingItem(null); setShowItemModal(true) }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                       text-white transition-all active:scale-[0.98]"
            style={{ background: BLUE }}>
            <Plus size={15} /> Nuevo item
          </button>
        </div>
      </div>

      {/* Alertas de stock bajo */}
      {(lowStockItems.length > 0 || outStockItems.length > 0) && (
        <div className="space-y-2">
          {outStockItems.length > 0 && (
            <AlertBanner
              type="error"
              message={`${outStockItems.length} item${outStockItems.length>1?'s':''} sin stock: ${outStockItems.map(i=>i.name).join(', ')}`}
            />
          )}
          {lowStockItems.length > 0 && (
            <AlertBanner
              type="warning"
              message={`Stock bajo en: ${lowStockItems.map(i=>`${i.name} (${i.stock_current} ${i.unit})`).join(', ')}`}
            />
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total items',    value: items.length,         icon:'📦', color:'#EFF6FF', tcolor: BLUE    },
          { label:'Stock bajo',     value: lowStockItems.length, icon:'⚠️', color:'#FFFBEB', tcolor:'#D97706' },
          { label:'Sin stock',      value: outStockItems.length, icon:'🚫', color:'#FEF2F2', tcolor:'#DC2626' },
          { label:'Valor inventario', value: formatPrice(totalValue,'UYU'), icon:'💰', color:'#F0FDF4', tcolor:'#16A34A' },
        ].map(({ label, value, icon, color, tcolor }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{icon}</span>
              <span className="text-xs text-gray-400 text-right leading-tight max-w-[80px] truncate">{label}</span>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: tcolor }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs — overflow-x-auto con fade derecho para indicar más contenido */}
      <div className="relative">
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">

        {([
          { key:'items',           label:'Items',             icon: Package     },
          { key:'categories',      label:'Categorías',        icon: Tag         },
          { key:'movements',       label:'Movimientos',       icon: BarChart2   },
          { key:'restock',         label:'Reabastecimiento',  icon: ShoppingCart },
          { key:'purchase-orders', label:'Órdenes de compra', icon: Truck       },
        ] as { key: 'items'|'categories'|'movements'|'restock'|'purchase-orders'; label:string; icon:React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shrink-0 transition-all',
              activeTab===key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={14} />{label}
            {key === 'restock' && restockItems.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 leading-none">
                {restockItems.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Fade derecho — indica que hay más tabs */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 rounded-r-xl
                      bg-gradient-to-l from-gray-100 to-transparent sm:hidden" />
      </div>

      {/* ── TAB: ITEMS ── */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU..."
                className="input-base pl-9 py-2 text-sm"/>
              {search && <button onClick={()=>setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13}/></button>}
            </div>
            {/* Filtro categoría */}
            <select value={filterCat??''} onChange={e=>setFilterCat(e.target.value||null)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
              <option value="">Todas las categorías</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            {/* Filtro estado */}
            <select value={filterStatus??''} onChange={e=>setFilterStatus(e.target.value||null)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
              <option value="">Todos los estados</option>
              <option value="ok">En stock</option>
              <option value="low">Stock bajo</option>
              <option value="critical">Crítico</option>
              <option value="out">Sin stock</option>
            </select>
          </div>

          {/* Tabla */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={32} className="text-gray-200"/>}
              title="Sin items en el inventario"
              sub="Creá tu primer item para empezar a controlar el stock"
              action={<button onClick={()=>{setEditingItem(null);setShowItemModal(true)}}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{background:BLUE}}><Plus size={14}/>Agregar item</button>}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Item','Talle','Modelo','Color','Categoría','Stock','Mínimo','Estado','Proveedor',''].map(h=>(
                        <th key={h} className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const status = getStockStatus(item)
                      const cfg    = STATUS_CONFIG[status]
                      const Icon   = cfg.icon
                      return (
                        <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            {item.sku && <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {item.talle
                              ? <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{item.talle}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {item.modelo
                              ? <span className="text-sm text-gray-800">{item.modelo}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {item.color_attr
                              ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-700">
                                  🎨 {item.color_attr}
                                </span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            {item.category ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{ background: item.category.color+'18', color: item.category.color }}>
                                {item.category.icon} {item.category.name}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-gray-900">
                              {item.stock_current} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-500">
                            {item.stock_min} {item.unit}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}/>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-500 max-w-[120px] truncate">
                            {item.supplier ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={()=>openMove(item)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                                           hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="Registrar movimiento">
                                <RefreshCw size={14}/>
                              </button>
                              <button onClick={()=>openEdit(item)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                                           hover:bg-gray-100 hover:text-gray-700 transition-colors">
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={()=>deleteItem(item.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                                           hover:bg-red-50 hover:text-red-500 transition-colors">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y divide-gray-50">
                {filtered.map(item=>{
                  const status=getStockStatus(item); const cfg=STATUS_CONFIG[status]
                  return (
                    <div key={item.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                          {item.sku&&<p className="text-xs text-gray-400 font-mono">SKU: {item.sku}</p>}
                          {(item.talle||item.modelo||item.color_attr) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.talle&&<span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">T: {item.talle}</span>}
                              {item.modelo&&<span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{item.modelo}</span>}
                              {item.color_attr&&<span className="rounded-md bg-pink-50 px-2 py-0.5 text-xs font-bold text-pink-700">🎨 {item.color_attr}</span>}
                            </div>
                          )}
                        </div>
                        <span className={`badge ${cfg.bg} ${cfg.text} shrink-0`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">
                          {item.stock_current} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                          <span className="text-xs text-gray-300 ml-1">/ mín {item.stock_min}</span>
                        </p>
                        <div className="flex gap-1">
                          <button onClick={()=>openMove(item)}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <RefreshCw size={14}/>
                          </button>
                          <button onClick={()=>openEdit(item)}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                            <Edit2 size={14}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CATEGORÍAS ── */}
      {activeTab === 'categories' && (
        <CategoriesTab
          businessId={businessId}
          categories={categories}
          setCategories={setCategories}
        />
      )}

      {/* ── TAB: MOVIMIENTOS ── */}
      {activeTab === 'movements' && (
        <MovementsTab businessId={businessId} items={items} />
      )}

      {/* ── TAB: REABASTECIMIENTO ── */}
      {activeTab === 'restock' && (
        <RestockTab
          items={restockItems}
          supplierProducts={supplierProducts}
          currency={currency}
        />
      )}

      {/* ── TAB: ÓRDENES DE COMPRA ── */}
      {activeTab === 'purchase-orders' && (
        <PurchaseOrdersTab
          businessId={businessId}
          inventoryItems={items}
          currency={currency}
        />
      )}

      {/* ── MODALES ── */}
      {showItemModal && (
        <ItemModal
          businessId={businessId}
          categories={categories}
          item={editingItem}
          onClose={()=>{setShowItemModal(false);setEditingItem(null)}}
          onSave={(saved)=>{
            setItems(prev => editingItem
              ? prev.map(i=>i.id===saved.id?saved:i)
              : [saved,...prev]
            )
            setShowItemModal(false); setEditingItem(null)
          }}
        />
      )}

      {showMoveModal && movingItem && (
        <MovementModal
          businessId={businessId}
          item={movingItem}
          userEmail={userEmail}
          onClose={()=>{setShowMoveModal(false);setMovingItem(null)}}
          onSave={(updatedItem)=>{
            setItems(prev=>prev.map(i=>i.id===updatedItem.id?updatedItem:i))
            setShowMoveModal(false); setMovingItem(null)
          }}
        />
      )}

      {showAIModal && hasPro && (
        <AIInventoryModal
          businessId={businessId}
          businessName={business.name}
          items={items}
          onClose={()=>setShowAIModal(false)}
        />
      )}
    </div>
  )
}

// ── Restock Tab ───────────────────────────────────────────────
function RestockTab({ items, supplierProducts, currency }: {
  items: InventoryItem[]
  supplierProducts: (SupplierProduct & { supplier: { id: string; name: string; phone: string | null } | null })[]
  currency: string
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
        <CheckCircle size={32} className="mx-auto text-green-300 mb-3" />
        <p className="text-sm font-semibold text-gray-400">Todo el stock está en orden</p>
        <p className="text-xs text-gray-300 mt-1">No hay items que necesiten reabastecimiento</p>
      </div>
    )
  }

  // Build a map: inventory_item_id → supplier product info
  const supProdMap = new Map<string, (typeof supplierProducts)[number]>()
  for (const sp of supplierProducts) {
    if (sp.inventory_item_id) supProdMap.set(sp.inventory_item_id, sp)
  }

  // Group items by supplier (id or null for no supplier)
  type Group = {
    supplierId: string | null
    supplierName: string
    supplierPhone: string | null
    rows: { item: InventoryItem; sp: (typeof supplierProducts)[number] | undefined; suggestedQty: number }[]
  }
  const groupMap = new Map<string, Group>()
  for (const item of items) {
    const sp     = supProdMap.get(item.id)
    const key    = sp?.supplier_id ?? '__none__'
    const name   = sp?.supplier?.name ?? 'Sin proveedor asignado'
    const phone  = sp?.supplier?.phone ?? null
    const suggestedQty = item.stock_max != null && item.stock_max > 0
      ? Math.max(0, item.stock_max - item.stock_current)
      : item.stock_min * 2

    if (!groupMap.has(key)) {
      groupMap.set(key, { supplierId: sp?.supplier_id ?? null, supplierName: name, supplierPhone: phone, rows: [] })
    }
    groupMap.get(key)!.rows.push({ item, sp, suggestedQty })
  }

  const groups = Array.from(groupMap.values())
  // Sort: groups with a supplier first
  groups.sort((a, b) => (a.supplierId ? 0 : 1) - (b.supplierId ? 0 : 1))

  const STATUS_CONFIG_LOCAL = {
    low:      { label:'Stock bajo', bg:'bg-amber-50',  text:'text-amber-700',  dot:'bg-amber-400'  },
    critical: { label:'Crítico',    bg:'bg-red-50',    text:'text-red-700',    dot:'bg-red-500'    },
    out:      { label:'Sin stock',  bg:'bg-gray-100',  text:'text-gray-500',   dot:'bg-gray-400'   },
    ok:       { label:'OK',         bg:'bg-green-50',  text:'text-green-700',  dot:'bg-green-400'  },
  }

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-700 font-medium">
          <AlertTriangle size={15} className="text-amber-500" />
          {items.length} item{items.length !== 1 ? 's' : ''} requieren reabastecimiento
        </div>
        <Link
          href="/admin/products/suppliers"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold
                     text-white transition-all active:scale-[0.98]"
          style={{ background: '#1565FF' }}
        >
          <ShoppingCart size={13} /> Ir a Órdenes de compra
          <ExternalLink size={11} className="opacity-60" />
        </Link>
      </div>

      {/* Groups */}
      {groups.map(group => (
        <div key={group.supplierId ?? '__none__'} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Group header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/60 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl text-white text-xs font-bold',
                group.supplierId ? '' : 'bg-gray-300'
              )}
                style={group.supplierId ? { background: 'linear-gradient(135deg,#1565FF,#0B3EAB)' } : undefined}>
                <Truck size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{group.supplierName}</p>
                {group.supplierPhone && (
                  <p className="text-xs text-gray-400">{group.supplierPhone}</p>
                )}
              </div>
            </div>
            {group.supplierId && (
              <Link
                href="/admin/products/suppliers"
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold
                           border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <ShoppingCart size={11} /> Crear OC
              </Link>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Item','Estado','Stock actual','Mínimo','Pedir (sugerido)','Precio prov.'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map(({ item, sp, suggestedQty }) => {
                  const st  = getStockStatus(item)
                  const cfg = STATUS_CONFIG_LOCAL[st] ?? STATUS_CONFIG_LOCAL.ok
                  return (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.sku && <p className="text-xs font-mono text-gray-400">SKU: {item.sku}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.bg, cfg.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-gray-900">
                        {item.stock_current}
                        <span className="text-xs font-normal text-gray-400 ml-1">{item.unit}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{item.stock_min} {item.unit}</td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-blue-700">
                          {suggestedQty} {item.unit}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {sp?.price != null
                          ? <span className="font-semibold text-gray-900">{formatPrice(sp.price, currency)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Alert Banner ──────────────────────────────────────────────
function AlertBanner({ type, message }: { type:'error'|'warning'; message:string }) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium',
      type==='error'   ? 'bg-red-50 border border-red-100 text-red-800'
                       : 'bg-amber-50 border border-amber-100 text-amber-800'
    )}>
      <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
      {message}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
function EmptyState({ icon, title, sub, action }: {
  icon:React.ReactNode; title:string; sub:string; action?:React.ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-400">{title}</p>
      <p className="text-xs text-gray-300 mt-1 mb-5">{sub}</p>
      {action}
    </div>
  )
}

// ── Modal base ────────────────────────────────────────────────
function Modal({ title, onClose, children }: {
  title:string; onClose:()=>void; children:React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl
            text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={16}/>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Item Modal (crear/editar) ─────────────────────────────────
function ItemModal({ businessId, categories, item, onClose, onSave }: {
  businessId:string; categories:InventoryCategory[]
  item:InventoryItem|null; onClose:()=>void; onSave:(i:InventoryItem)=>void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string|null>(null)

  const [name,       setName]       = useState(item?.name??'')
  const [sku,        setSku]        = useState(item?.sku??'')
  const [unit,       setUnit]       = useState(item?.unit??'unidad')
  const [catId,      setCatId]      = useState(item?.category_id??'')
  const [stockMin,   setStockMin]   = useState(item?.stock_min?.toString()??'0')
  const [stockMax,   setStockMax]   = useState(item?.stock_max?.toString()??'')
  const [stockCurrent, setStockCurrent] = useState(item?.stock_current?.toString()??'0')
  const [costPrice,  setCostPrice]  = useState(item?.cost_price?.toString()??'')
  const [supplier,   setSupplier]   = useState(item?.supplier??'')
  const [notes,      setNotes]      = useState(item?.notes??'')
  const [talle,      setTalle]      = useState(item?.talle??'')
  const [modelo,     setModelo]     = useState(item?.modelo??'')
  const [colorAttr,  setColorAttr]  = useState(item?.color_attr??'')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const payload = {
        business_id:   businessId,
        name:          name.trim(),
        sku:           sku.trim()||null,
        unit,
        category_id:   catId||null,
        stock_min:     parseFloat(stockMin)||0,
        stock_max:     stockMax?parseFloat(stockMax):null,
        stock_current: item ? undefined : parseFloat(stockCurrent)||0,
        cost_price:    costPrice?parseFloat(costPrice):null,
        supplier:      supplier.trim()||null,
        notes:         notes.trim()||null,
        talle:         talle.trim()||null,
        modelo:        modelo.trim()||null,
        color_attr:    colorAttr.trim()||null,
      }
      if (item) {
        const { data,error:e } = await supabase.from('inventory_items')
          .update(payload).eq('id',item.id).select('*').single()
        if (e) throw e; onSave(data as InventoryItem)
      } else {
        const { data,error:e } = await supabase.from('inventory_items')
          .insert(payload).select('*').single()
        if (e) throw e; onSave(data as InventoryItem)
      }
    } catch(e:unknown) {
      setError(e instanceof Error?e.message:'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={item?'Editar item':'Nuevo item de inventario'} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="field-label">Nombre <span className="text-red-400">*</span></label>
            <input type="text" required value={name} onChange={e=>setName(e.target.value)}
              placeholder="Ej: Harina 000, Cerveza, Remera talle M" className="input-base"/>
          </div>
          <div>
            <label className="field-label">SKU / Código</label>
            <input type="text" value={sku} onChange={e=>setSku(e.target.value)}
              placeholder="HAR-001" className="input-base"/>
          </div>
          <div>
            <label className="field-label">Unidad</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} className="input-base">
              {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="field-label">Categoría</label>
            <select value={catId} onChange={e=>setCatId(e.target.value)} className="input-base">
              <option value="">Sin categoría</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          {!item && (
            <div className="col-span-2">
              <label className="field-label">Stock inicial</label>
              <input type="number" min="0" step="0.01" value={stockCurrent}
                onChange={e=>setStockCurrent(e.target.value)} className="input-base"/>
            </div>
          )}
          <div>
            <label className="field-label">Stock mínimo ⚠️</label>
            <input type="number" min="0" step="0.01" value={stockMin}
              onChange={e=>setStockMin(e.target.value)} className="input-base"/>
            <p className="text-xs text-gray-400 mt-1">Alerta si baja de aquí</p>
          </div>
          <div>
            <label className="field-label">Stock máximo</label>
            <input type="number" min="0" step="0.01" value={stockMax}
              onChange={e=>setStockMax(e.target.value)} placeholder="Opcional" className="input-base"/>
          </div>
          <div>
            <label className="field-label">Precio de costo</label>
            <input type="number" min="0" step="0.01" value={costPrice}
              onChange={e=>setCostPrice(e.target.value)} placeholder="0" className="input-base"/>
          </div>
          <div>
            <label className="field-label">Proveedor</label>
            <input type="text" value={supplier} onChange={e=>setSupplier(e.target.value)}
              placeholder="Nombre del proveedor" className="input-base"/>
          </div>
          <div className="col-span-2">
            <label className="field-label">Notas</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Observaciones..." className="input-base resize-none"/>
          </div>

          {/* Atributos de indumentaria / calzado */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3 mt-1">
              <div className="h-px flex-1 bg-gray-100"/>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                👕 Indumentaria / Calzado (opcional)
              </span>
              <div className="h-px flex-1 bg-gray-100"/>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Talle</label>
                <input type="text" value={talle} onChange={e=>setTalle(e.target.value)}
                  placeholder="Ej: S, M, L, 42" className="input-base"/>
              </div>
              <div>
                <label className="field-label">Modelo</label>
                <input type="text" value={modelo} onChange={e=>setModelo(e.target.value)}
                  placeholder="Ej: Oxford, V-neck" className="input-base"/>
              </div>
              <div>
                <label className="field-label">Color</label>
                <input type="text" value={colorAttr} onChange={e=>setColorAttr(e.target.value)}
                  placeholder="Ej: Azul marino" className="input-base"/>
              </div>
            </div>
          </div>
        </div>
        {error&&<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white
                       disabled:opacity-40 active:scale-[0.98]"
            style={{background:'#1565FF'}}>
            {loading&&<Loader2 size={14} className="animate-spin"/>}
            {loading?'Guardando...':item?'Guardar cambios':'Crear item'}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600
                       hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Movement Modal ────────────────────────────────────────────
function MovementModal({ businessId, item, userEmail, onClose, onSave }: {
  businessId:string; item:InventoryItem; userEmail:string
  onClose:()=>void; onSave:(updated:InventoryItem)=>void
}) {
  const supabase = createClient()
  const [type,     setType]     = useState<MovementType>('entrada')
  const [qty,      setQty]      = useState('')
  const [reason,   setReason]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string|null>(null)

  const MOVE_TYPES: {key:MovementType;label:string;icon:React.ElementType;color:string}[] = [
    { key:'entrada',    label:'Entrada',    icon:ArrowUpCircle,   color:'text-green-600' },
    { key:'salida',     label:'Salida',     icon:ArrowDownCircle, color:'text-red-500'   },
    { key:'ajuste',     label:'Ajuste',     icon:RefreshCw,       color:'text-blue-600'  },
    { key:'devolucion', label:'Devolución', icon:ArrowUpCircle,   color:'text-purple-600'},
  ]

  // Calcular stock resultante
  const qtyNum = parseFloat(qty)||0
  const sign   = type==='salida' ? -1 : 1
  const result = item.stock_current + sign * qtyNum

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault()
    if (!qty||qtyNum<=0) { setError('Ingresá una cantidad válida'); return }
    if (type==='salida'&&qtyNum>item.stock_current) {
      setError('No hay suficiente stock para esta salida'); return
    }
    setLoading(true); setError(null)
    try {
      const { error:e } = await supabase.from('inventory_movements').insert({
        business_id: businessId,
        item_id:     item.id,
        type,
        quantity:    sign*qtyNum,
        stock_before: item.stock_current,
        stock_after:  result,
        reason:      reason.trim()||null,
        created_by:  userEmail,
      })
      if (e) throw e
      // El trigger ya actualizó stock_current en la DB
      onSave({ ...item, stock_current: result })
    } catch(e:unknown) {
      setError(e instanceof Error?e.message:'Error al registrar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`Movimiento — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo */}
        <div>
          <label className="field-label">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2">
            {MOVE_TYPES.map(({key,label,icon:Icon,color})=>(
              <button key={key} type="button" onClick={()=>setType(key)}
                className={cn('flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all',
                  type===key?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-100 hover:border-gray-200 text-gray-600')}>
                <Icon size={15} className={type===key?'text-blue-600':color}/>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Stock actual */}
        <div className="rounded-xl bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Stock actual</p>
            <p className="text-lg font-bold text-gray-900">{item.stock_current} {item.unit}</p>
          </div>
          {qty && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Resultado</p>
              <p className={cn('text-lg font-bold', result<0?'text-red-500':result<=item.stock_min?'text-amber-600':'text-green-600')}>
                {result} {item.unit}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="field-label">
            Cantidad <span className="text-red-400">*</span>
          </label>
          <input type="number" required min="0.01" step="0.01" value={qty}
            onChange={e=>setQty(e.target.value)}
            placeholder={`Cantidad en ${item.unit}s`} className="input-base"/>
        </div>

        <div>
          <label className="field-label">Motivo</label>
          <input type="text" value={reason} onChange={e=>setReason(e.target.value)}
            placeholder="Ej: Compra a proveedor, venta manual, pérdida..."
            className="input-base"/>
        </div>

        {error&&<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white
                       disabled:opacity-40" style={{background:'#1565FF'}}>
            {loading&&<Loader2 size={14} className="animate-spin"/>}
            {loading?'Registrando...':'Registrar movimiento'}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Categories Tab ────────────────────────────────────────────
function CategoriesTab({ businessId, categories, setCategories }: {
  businessId:string; categories:InventoryCategory[]
  setCategories: React.Dispatch<React.SetStateAction<InventoryCategory[]>>
}) {
  const supabase = createClient()
  const [name,    setName]    = useState('')
  const [color,   setColor]   = useState('#1565FF')
  const [icon,    setIcon]    = useState('📦')
  const [loading, setLoading] = useState(false)

  const ICONS = ['📦','🍔','🥤','👕','🔧','💊','🍕','🧴','🥩','🧃','🔩','📱','🛒','🎮','🧁']

  async function createCategory(e:React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { data, error } = await supabase.from('inventory_categories')
      .insert({ business_id:businessId, name:name.trim(), color, icon })
      .select('*').single()
    if (!error&&data) {
      setCategories(prev=>[...prev,data as InventoryCategory])
      setName(''); setColor('#1565FF'); setIcon('📦')
    }
    setLoading(false)
  }

  async function deleteCategory(id:string) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('inventory_categories').delete().eq('id',id)
    setCategories(prev=>prev.filter(c=>c.id!==id))
  }

  return (
    <div className="space-y-5">
      {/* Crear */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-4">Nueva categoría</p>
        <form onSubmit={createCategory} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="field-label">Nombre</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)}
                placeholder="Ej: Bebidas, Ingredientes, Ropa..." className="input-base"/>
            </div>
            <div>
              <label className="field-label">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                  className="h-10 w-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
                <input type="text" value={color} onChange={e=>setColor(e.target.value)}
                  className="input-base font-mono text-xs flex-1"/>
              </div>
            </div>
          </div>
          <div>
            <label className="field-label">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic=>(
                <button key={ic} type="button" onClick={()=>setIcon(ic)}
                  className={cn('h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all',
                    icon===ic?'ring-2 ring-blue-500 bg-blue-50':'bg-gray-50 hover:bg-gray-100')}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          {/* Preview */}
          {name&&(
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">Preview:</p>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{background:color+'18',color}}>
                {icon} {name}
              </span>
            </div>
          )}
          <button type="submit" disabled={loading||!name.trim()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white
                       disabled:opacity-40" style={{background:'#1565FF'}}>
            {loading?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}
            Crear categoría
          </button>
        </form>
      </div>

      {/* Lista */}
      {categories.length===0 ? (
        <EmptyState icon={<Tag size={28} className="text-gray-200"/>}
          title="Sin categorías todavía"
          sub="Creá categorías para organizar tu inventario"/>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {categories.map((cat,i)=>(
            <div key={cat.id} className={cn('flex items-center gap-4 px-5 py-3.5',
              i<categories.length-1&&'border-b border-gray-50')}>
              <span className="text-2xl">{cat.icon}</span>
              <div className="flex-1">
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold"
                  style={{background:cat.color+'18',color:cat.color}}>
                  {cat.name}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-400">{cat.color}</p>
              <button onClick={()=>deleteCategory(cat.id)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300
                           hover:bg-red-50 hover:text-red-500 transition-colors">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Movements Tab ─────────────────────────────────────────────
function MovementsTab({ businessId, items }: { businessId:string; items:InventoryItem[] }) {
  const supabase = createClient()
  const [movements, setMovements] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  useState(()=>{
    supabase.from('inventory_movements')
      .select('*, item:inventory_items(name,unit)')
      .eq('business_id',businessId)
      .order('created_at',{ascending:false})
      .limit(50)
      .then(({data})=>{ setMovements(data??[]); setLoading(false) })
  })

  const TYPE_CONFIG = {
    entrada:    { label:'Entrada',    color:'text-green-600',  bg:'bg-green-50'  },
    salida:     { label:'Salida',     color:'text-red-600',    bg:'bg-red-50'    },
    ajuste:     { label:'Ajuste',     color:'text-blue-600',   bg:'bg-blue-50'   },
    devolucion: { label:'Devolución', color:'text-purple-600', bg:'bg-purple-50' },
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={24} className="animate-spin text-gray-300"/>
    </div>
  )

  if (movements.length===0) return (
    <EmptyState icon={<BarChart2 size={28} className="text-gray-200"/>}
      title="Sin movimientos todavía"
      sub="Los movimientos aparecen acá cuando registrás entradas o salidas"/>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            {['Item','Tipo','Cantidad','Stock después','Motivo','Fecha'].map(h=>(
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-5 py-3.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.map(m=>{
            const cfg = TYPE_CONFIG[m.type as MovementType]??TYPE_CONFIG.ajuste
            return (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                  {m.item?.name??'—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </td>
                <td className="px-5 py-3.5 text-sm font-bold">
                  <span className={m.quantity>=0?'text-green-600':'text-red-500'}>
                    {m.quantity>=0?'+':''}{m.quantity} {m.item?.unit}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-700">
                  {m.stock_after} {m.item?.unit}
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-500 max-w-[160px] truncate">
                  {m.reason??<span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleDateString('es-UY',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Purchase Orders Types ─────────────────────────────────────
type POItem = {
  id: string
  inventory_item_id: string | null
  item_name: string
  unit: string
  quantity_ordered: number
  quantity_received: number | null
  unit_cost: number | null
}

type PO = {
  id: string
  supplier_name: string
  supplier_id: string | null
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'
  notes: string | null
  expected_date: string | null
  received_at: string | null
  created_at: string
  items?: POItem[]
}

const PO_STATUS_CONFIG = {
  draft:     { label: 'Borrador',   bg: 'bg-gray-100',  text: 'text-gray-600'  },
  sent:      { label: 'Enviada',    bg: 'bg-blue-50',   text: 'text-blue-700'  },
  confirmed: { label: 'Confirmada', bg: 'bg-amber-50',  text: 'text-amber-700' },
  received:  { label: 'Recibida',   bg: 'bg-green-50',  text: 'text-green-700' },
  cancelled: { label: 'Cancelada',  bg: 'bg-red-50',    text: 'text-red-600'   },
}

// ── Purchase Orders Tab ───────────────────────────────────────
function PurchaseOrdersTab({ businessId, inventoryItems, currency }: {
  businessId: string
  inventoryItems: InventoryItem[]
  currency: string
}) {
  const supabase = createClient()
  const [pos,        setPOs]       = useState<PO[]>([])
  const [loading,    setLoading]   = useState(true)
  const [showCreate, setShowCreate]= useState(false)
  const [receivingPO, setReceivingPO] = useState<PO | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setPOs((data ?? []) as PO[]); setLoading(false) })
  }, [businessId])

  async function updateStatus(id: string, status: PO['status']) {
    const patch: Record<string, unknown> = { status }
    if (status === 'received') patch.received_at = new Date().toISOString()
    await supabase.from('purchase_orders').update(patch).eq('id', id)
    setPOs(prev => prev.map(p => p.id === id ? { ...p, ...patch } as PO : p))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={24} className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{pos.length} orden{pos.length !== 1 ? 'es' : ''} de compra</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: BLUE }}>
          <Plus size={14} /> Nueva orden
        </button>
      </div>

      {pos.length === 0 ? (
        <EmptyState
          icon={<Truck size={32} className="text-gray-200" />}
          title="Sin órdenes de compra"
          sub="Creá tu primera orden para gestionar compras a proveedores"
          action={
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: BLUE }}>
              <Plus size={14} /> Nueva orden
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {pos.map(po => {
            const cfg      = PO_STATUS_CONFIG[po.status]
            const expanded = expandedId === po.id
            const total    = (po.items ?? []).reduce((s, i) => s + i.quantity_ordered * (i.unit_cost ?? 0), 0)
            return (
              <div key={po.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : po.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/40 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1565FF,#0B3EAB)' }}>
                    <Truck size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{po.supplier_name}</p>
                      <span className={`badge ${cfg.bg} ${cfg.text} shrink-0`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(po.created_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {po.expected_date && ` · Entrega: ${new Date(po.expected_date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}`}
                      {total > 0 && ` · ${formatPrice(total, currency)}`}
                    </p>
                  </div>
                  <ChevronRight size={16} className={cn('text-gray-300 shrink-0 transition-transform', expanded && 'rotate-90')} />
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {(po.items ?? []).length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {['Ítem', 'Cant. pedida', 'Recibida', 'Precio unit.', 'Subtotal'].map(h => (
                                <th key={h} className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(po.items ?? []).map(item => (
                              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2.5 font-medium text-gray-900">{item.item_name}</td>
                                <td className="px-4 py-2.5 text-gray-600">{item.quantity_ordered} {item.unit}</td>
                                <td className="px-4 py-2.5 text-gray-600">
                                  {item.quantity_received != null
                                    ? <span className="text-green-600 font-medium">{item.quantity_received} {item.unit}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-gray-600">
                                  {item.unit_cost != null ? formatPrice(item.unit_cost, currency) : '—'}
                                </td>
                                <td className="px-4 py-2.5 font-semibold text-gray-900">
                                  {item.unit_cost != null ? formatPrice(item.quantity_ordered * item.unit_cost, currency) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {po.notes && (
                      <p className="text-xs text-gray-500 italic">📝 {po.notes}</p>
                    )}

                    {po.status !== 'received' && po.status !== 'cancelled' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {po.status === 'draft' && (
                          <button onClick={() => updateStatus(po.id, 'sent')}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                            Marcar como enviada
                          </button>
                        )}
                        {po.status === 'sent' && (
                          <button onClick={() => updateStatus(po.id, 'confirmed')}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                            Confirmar orden
                          </button>
                        )}
                        {(po.status === 'confirmed' || po.status === 'sent') && (
                          <button onClick={() => setReceivingPO(po)}
                            className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
                            Registrar recepción
                          </button>
                        )}
                        <button onClick={() => updateStatus(po.id, 'cancelled')}
                          className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    )}

                    {po.status === 'received' && po.received_at && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ Recibida el {new Date(po.received_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreatePOModal
          businessId={businessId}
          inventoryItems={inventoryItems}
          currency={currency}
          onClose={() => setShowCreate(false)}
          onCreated={(po) => { setPOs(prev => [po, ...prev]); setShowCreate(false) }}
        />
      )}

      {receivingPO && (
        <ReceivePOModal
          businessId={businessId}
          po={receivingPO}
          currency={currency}
          onClose={() => setReceivingPO(null)}
          onReceived={(updated) => {
            setPOs(prev => prev.map(p => p.id === updated.id ? updated : p))
            setReceivingPO(null)
          }}
        />
      )}
    </div>
  )
}

// ── Create PO Modal ───────────────────────────────────────────
type NewPOItem = { inventoryItemId: string | null; itemName: string; unit: string; quantityOrdered: string; unitCost: string }

function CreatePOModal({ businessId, inventoryItems, currency, onClose, onCreated }: {
  businessId: string
  inventoryItems: InventoryItem[]
  currency: string
  onClose: () => void
  onCreated: (po: PO) => void
}) {
  const supabase = createClient()
  const [supplierName, setSupplierName] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes,        setNotes]        = useState('')
  const [poItems,      setPOItems]      = useState<NewPOItem[]>([
    { inventoryItemId: null, itemName: '', unit: 'unidad', quantityOrdered: '', unitCost: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function addItem() {
    setPOItems(prev => [...prev, { inventoryItemId: null, itemName: '', unit: 'unidad', quantityOrdered: '', unitCost: '' }])
  }

  function removeItem(idx: number) {
    setPOItems(prev => prev.filter((_, i) => i !== idx))
  }

  function pickInventoryItem(idx: number, itemId: string) {
    const inv = inventoryItems.find(i => i.id === itemId)
    if (!inv) return
    setPOItems(prev => prev.map((p, i) => i === idx ? {
      ...p,
      inventoryItemId: inv.id,
      itemName: inv.name,
      unit: inv.unit,
      unitCost: inv.cost_price?.toString() ?? '',
    } : p))
  }

  function updateItem(idx: number, patch: Partial<NewPOItem>) {
    setPOItems(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierName.trim()) { setError('Ingresá el nombre del proveedor'); return }
    if (poItems.some(i => !i.itemName.trim() || !i.quantityOrdered)) {
      setError('Completá nombre y cantidad en todos los ítems'); return
    }
    setLoading(true); setError(null)
    try {
      const { data: po, error: e1 } = await supabase
        .from('purchase_orders')
        .insert({
          business_id:   businessId,
          supplier_name: supplierName.trim(),
          status:        'draft',
          expected_date: expectedDate || null,
          notes:         notes.trim() || null,
        })
        .select('*')
        .single()
      if (e1 || !po) throw e1 ?? new Error('Error al crear')

      const { data: createdItems, error: e2 } = await supabase
        .from('purchase_order_items')
        .insert(poItems.map(i => ({
          order_id:           po.id,
          business_id:        businessId,
          inventory_item_id:  i.inventoryItemId || null,
          item_name:          i.itemName.trim(),
          unit:               i.unit,
          quantity_ordered:   parseFloat(i.quantityOrdered) || 0,
          unit_cost:          i.unitCost ? parseFloat(i.unitCost) : null,
        })))
        .select('*')
      if (e2) throw e2

      onCreated({ ...(po as PO), items: (createdItems ?? []) as POItem[] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Nueva orden de compra" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="field-label">Proveedor <span className="text-red-400">*</span></label>
          <input type="text" required value={supplierName} onChange={e => setSupplierName(e.target.value)}
            placeholder="Nombre del proveedor" className="input-base" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Fecha de entrega</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
              className="input-base" />
          </div>
          <div>
            <label className="field-label">Notas</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Opcional" className="input-base" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="field-label mb-0">Ítems</label>
            <button type="button" onClick={addItem}
              className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-700">
              <Plus size={12} /> Agregar ítem
            </button>
          </div>
          <div className="space-y-3">
            {poItems.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={item.inventoryItemId ?? ''}
                    onChange={e => e.target.value ? pickInventoryItem(idx, e.target.value) : updateItem(idx, { inventoryItemId: null })}
                    className="input-base flex-1 text-sm">
                    <option value="">— Seleccionar del inventario —</option>
                    {inventoryItems.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>
                    ))}
                  </select>
                  {poItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X size={13} />
                    </button>
                  )}
                </div>
                {!item.inventoryItemId && (
                  <input type="text" value={item.itemName}
                    onChange={e => updateItem(idx, { itemName: e.target.value })}
                    placeholder="Nombre del ítem" className="input-base text-sm" />
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Cantidad</label>
                    <input type="number" min="0.01" step="0.01" value={item.quantityOrdered}
                      onChange={e => updateItem(idx, { quantityOrdered: e.target.value })}
                      placeholder="0" className="input-base text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Unidad</label>
                    <select value={item.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                      className="input-base text-sm">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Precio unit.</label>
                    <input type="number" min="0" step="0.01" value={item.unitCost}
                      onChange={e => updateItem(idx, { unitCost: e.target.value })}
                      placeholder="0" className="input-base text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: BLUE }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Creando...' : 'Crear orden'}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Receive PO Modal ──────────────────────────────────────────
function ReceivePOModal({ businessId, po, currency, onClose, onReceived }: {
  businessId: string
  po: PO
  currency: string
  onClose: () => void
  onReceived: (updated: PO) => void
}) {
  const supabase = createClient()
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries((po.items ?? []).map(i => [i.id, i.quantity_ordered.toString()]))
  )
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleReceive() {
    setLoading(true); setError(null)
    try {
      for (const item of po.items ?? []) {
        const qty = parseFloat(quantities[item.id] ?? '0') || 0
        await supabase.from('purchase_order_items')
          .update({ quantity_received: qty })
          .eq('id', item.id)

        if (item.inventory_item_id && qty > 0) {
          const { data: inv } = await supabase
            .from('inventory_items')
            .select('stock_current')
            .eq('id', item.inventory_item_id)
            .single()
          if (inv) {
            const newStock = inv.stock_current + qty
            await supabase.from('inventory_items')
              .update({ stock_current: newStock })
              .eq('id', item.inventory_item_id)
            await supabase.from('inventory_movements').insert({
              business_id:  businessId,
              item_id:      item.inventory_item_id,
              type:         'entrada',
              quantity:     qty,
              stock_before: inv.stock_current,
              stock_after:  newStock,
              reason:       `OC recibida: ${po.supplier_name}`,
              created_by:   'sistema',
            })
          }
        }
      }

      const receivedAt = new Date().toISOString()
      await supabase.from('purchase_orders')
        .update({ status: 'received', received_at: receivedAt })
        .eq('id', po.id)

      onReceived({
        ...po,
        status:      'received',
        received_at: receivedAt,
        items: (po.items ?? []).map(i => ({
          ...i,
          quantity_received: parseFloat(quantities[i.id] ?? '0') || 0,
        })),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Registrar recepción" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-gray-600">
          Confirmá las cantidades recibidas de <strong>{po.supplier_name}</strong>.
          Los ítems vinculados al inventario actualizarán su stock automáticamente.
        </p>

        <div className="space-y-2.5">
          {(po.items ?? []).map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                <p className="text-xs text-gray-400">Pedido: {item.quantity_ordered} {item.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.01"
                  value={quantities[item.id] ?? ''}
                  onChange={e => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="input-base text-sm w-24" />
                <span className="text-xs text-gray-400 shrink-0">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <button onClick={handleReceive} disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#16A34A' }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Procesando...' : 'Confirmar recepción'}
          </button>
          <button onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── AI Inventory Modal ────────────────────────────────────────
function AIInventoryModal({ businessId, businessName, items, onClose }: {
  businessId:string; businessName:string; items:InventoryItem[]; onClose:()=>void
}) {
  const [loading,   setLoading]   = useState(false)
  const [insights,  setInsights]  = useState<string[]|null>(null)
  const [error,     setError]     = useState<string|null>(null)

  async function analyze() {
    setLoading(true); setError(null)
    try {
      const lowItems  = items.filter(i=>getStockStatus(i)==='low'||getStockStatus(i)==='critical')
      const outItems  = items.filter(i=>getStockStatus(i)==='out')
      const totalVal  = items.reduce((a,i)=>a+i.stock_current*(i.cost_price??0),0)

      const res = await fetch('/api/ai/inventory', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          businessName,
          totalItems:    items.length,
          lowStockItems: lowItems.map(i=>({name:i.name,current:i.stock_current,min:i.stock_min,unit:i.unit})),
          outOfStock:    outItems.map(i=>i.name),
          totalValue:    totalVal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error??'Error de IA')
      setInsights(data.insights)
    } catch(e:unknown) {
      setError(e instanceof Error?e.message:'Error desconocido')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="IA — Análisis de inventario" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl p-4 text-sm text-purple-800"
          style={{background:'linear-gradient(135deg,#F5F3FF,#EDE9FE)',border:'1px solid #DDD6FE'}}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-purple-600"/>
            <p className="font-semibold">Análisis inteligente de stock</p>
          </div>
          <p className="text-xs text-purple-700 leading-relaxed">
            La IA analiza tu inventario actual y te da recomendaciones: qué reabastecer,
            qué tiene exceso, qué podés optimizar y alertas de quiebre de stock.
          </p>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label:'Items', value: items.length,                         color:'text-blue-600'  },
            { label:'Stock bajo', value: items.filter(i=>getStockStatus(i)!=='ok').length, color:'text-amber-600'},
            { label:'Sin stock', value: items.filter(i=>i.stock_current<=0).length,         color:'text-red-600'   },
          ].map(({label,value,color})=>(
            <div key={label} className="rounded-xl bg-gray-50 py-3">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <button onClick={analyze} disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold
                     text-white disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{background:'linear-gradient(135deg,#7C3AED,#4F46E5)'}}>
          {loading?<Loader2 size={15} className="animate-spin"/>:<Sparkles size={15}/>}
          {loading?'Analizando inventario...':'Analizar con IA'}
        </button>

        {error&&<div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {insights&&(
          <div className="space-y-3 animate-slide-up">
            <p className="text-sm font-semibold text-gray-700">Recomendaciones:</p>
            {insights.map((ins,i)=>(
              <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3.5"
                style={{background:'#F5F3FF',border:'1px solid #DDD6FE'}}>
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                                bg-purple-200 text-[10px] font-bold text-purple-700 mt-0.5">
                  {i+1}
                </div>
                <p className="text-sm text-purple-900 leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
