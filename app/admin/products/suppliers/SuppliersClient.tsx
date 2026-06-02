// app/admin/suppliers/SuppliersClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Truck, Phone, Mail, MapPin,
  ChevronDown, ChevronRight, Edit2, Trash2, Loader2,
  Package, MessageCircle, ExternalLink, Tag, AlertCircle,
  CheckCircle2, Zap, ClipboardList,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Supplier, SupplierProduct, InventoryItem, PurchaseOrder } from '@/types'
import PurchaseOrdersTab from './PurchaseOrdersTab'

interface Props {
  businessId: string
  currency: string
  initialSuppliers: Supplier[]
  inventoryItems: InventoryItem[]
  autoImportNames: string[]
  initialOrders: PurchaseOrder[]
}

const BLUE  = '#1565FF'
const UNITS = ['unidad','kg','gramo','litro','ml','caja','pack','bolsa','metro','rollo','par']

export default function SuppliersClient({
  businessId, currency, initialSuppliers, inventoryItems, autoImportNames, initialOrders,
}: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')

  const [suppliers,    setSuppliers]    = useState<Supplier[]>(initialSuppliers)
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<string|null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier|null>(null)
  const [showProductForm, setShowProductForm] = useState<string|null>(null) // supplier_id
  const [importLoading,   setImportLoading]   = useState(false)
  const [importDone,      setImportDone]      = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.contact_name?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    )
  }, [suppliers, search])

  // Auto-importar proveedores desde inventory
  async function importFromInventory() {
    if (autoImportNames.length === 0 || importDone) return
    setImportLoading(true)
    const toInsert = autoImportNames.map(name => ({
      business_id: businessId,
      name,
      active: true,
    }))
    const { data, error } = await supabase
      .from('suppliers')
      .insert(toInsert)
      .select('*, products:supplier_products(*)')
    if (!error && data) {
      setSuppliers(prev => [...prev, ...(data as Supplier[])])
      setImportDone(true)
    }
    setImportLoading(false)
  }

  async function deleteSupplier(id: string) {
    if (!confirm('¿Eliminar este proveedor y todos sus artículos?')) return
    await supabase.from('suppliers').update({ active: false }).eq('id', id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  const totalProducts = suppliers.reduce((a, s) => a + (s.products?.length ?? 0), 0)

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Proveedores</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {suppliers.length} proveedores · {totalProducts} artículos registrados
          </p>
        </div>
        {activeTab === 'suppliers' && (
          <button
            onClick={() => { setEditingSupplier(null); setShowForm(true) }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                       text-white transition-all active:scale-[0.98]"
            style={{ background: BLUE }}
          >
            <Plus size={15} /> Nuevo proveedor
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {([
          { key: 'suppliers', label: 'Proveedores', icon: Truck },
          { key: 'orders',    label: 'Órdenes de compra', icon: ClipboardList },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <PurchaseOrdersTab
          businessId={businessId}
          currency={currency}
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          initialOrders={initialOrders}
        />
      )}

      {activeTab === 'suppliers' && (
        <>
      {/* Banner auto-import */}
      {autoImportNames.length > 0 && !importDone && (
        <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
          <Zap size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">
              Detectamos {autoImportNames.length} proveedor{autoImportNames.length > 1 ? 'es' : ''} en tu inventario
            </p>
            <p className="text-xs text-blue-600 mt-0.5 mb-3">
              {autoImportNames.join(', ')}
            </p>
            <button
              onClick={importFromInventory}
              disabled={importLoading}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold
                         text-white disabled:opacity-50"
              style={{ background: BLUE }}
            >
              {importLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              {importLoading ? 'Importando...' : 'Importar automáticamente'}
            </button>
          </div>
        </div>
      )}

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Proveedores activos', value: suppliers.length,  icon: '🏭' },
          { label: 'Artículos cargados',  value: totalProducts,     icon: '📦' },
          { label: 'Ciudades',            value: new Set(suppliers.map(s=>s.city).filter(Boolean)).size, icon: '📍' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{icon}</span>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: BLUE }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proveedor, ciudad..."
          className="input-base pl-9 py-2 text-sm"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Lista de proveedores */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Truck size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">Sin proveedores todavía</p>
          <p className="text-xs text-gray-300 mt-1 mb-5">
            Agregá tus proveedores para gestionar precios y contactos
          </p>
          <button onClick={() => { setEditingSupplier(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: BLUE }}>
            <Plus size={14} /> Agregar proveedor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(supplier => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              expanded={expanded === supplier.id}
              inventoryItems={inventoryItems}
              onToggle={() => setExpanded(expanded === supplier.id ? null : supplier.id)}
              onEdit={() => { setEditingSupplier(supplier); setShowForm(true) }}
              onDelete={() => deleteSupplier(supplier.id)}
              onAddProduct={() => setShowProductForm(supplier.id)}
              onProductAdded={(prod) => {
                setSuppliers(prev => prev.map(s =>
                  s.id === supplier.id
                    ? { ...s, products: [...(s.products ?? []), prod] }
                    : s
                ))
              }}
              onProductDeleted={(prodId) => {
                setSuppliers(prev => prev.map(s =>
                  s.id === supplier.id
                    ? { ...s, products: (s.products ?? []).filter(p => p.id !== prodId) }
                    : s
                ))
              }}
            />
          ))}
        </div>
      )}

      {/* Modal proveedor */}
      {showForm && (
        <SupplierFormModal
          businessId={businessId}
          supplier={editingSupplier}
          onClose={() => { setShowForm(false); setEditingSupplier(null) }}
          onSave={(saved) => {
            setSuppliers(prev =>
              editingSupplier
                ? prev.map(s => s.id === saved.id ? { ...s, ...saved } : s)
                : [{ ...saved, products: [] }, ...prev]
            )
            setShowForm(false)
            setEditingSupplier(null)
          }}
        />
      )}
        </>
      )}
    </div>
  )
}

// ── Supplier Card ─────────────────────────────────────────────
function SupplierCard({
  supplier, expanded, inventoryItems,
  onToggle, onEdit, onDelete, onAddProduct,
  onProductAdded, onProductDeleted,
}: {
  supplier: Supplier
  expanded: boolean
  inventoryItems: InventoryItem[]
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddProduct: () => void
  onProductAdded: (p: SupplierProduct) => void
  onProductDeleted: (id: string) => void
}) {
  const supabase = createClient()
  const products = supplier.products ?? []
  const waLink = supplier.phone
    ? `https://wa.me/${supplier.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${supplier.contact_name??supplier.name}!`)}`
    : null

  const [showProdForm, setShowProdForm] = useState(false)

  async function deleteProd(id: string) {
    await supabase.from('supplier_products').delete().eq('id', id)
    onProductDeleted(id)
  }

  const initials = supplier.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header del card */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Avatar */}
        <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold
                        text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #1565FF, #0B3EAB)' }}>
          {initials}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0" onClick={onToggle} role="button">
          <p className="text-sm font-bold text-gray-900">{supplier.name}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {supplier.contact_name && (
              <span className="text-xs text-gray-500">👤 {supplier.contact_name}</span>
            )}
            {supplier.city && (
              <span className="text-xs text-gray-500">📍 {supplier.city}</span>
            )}
            <span className="text-xs text-gray-400">
              {products.length} artículo{products.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-1 shrink-0">
          {waLink && (
            <a href={waLink} target="_blank"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                         hover:bg-green-50 hover:text-green-600 transition-colors"
              title="WhatsApp">
              <MessageCircle size={15} />
            </a>
          )}
          {supplier.email && (
            <a href={`mailto:${supplier.email}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                         hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Email">
              <Mail size={15} />
            </a>
          )}
          <button onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                       hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                       hover:bg-red-50 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                       hover:bg-gray-100 transition-colors ml-1">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
      </div>

      {/* Contenido expandido */}
      {expanded && (
        <div className="border-t border-gray-100 animate-fade-in">
          {/* Datos de contacto */}
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/40">
            {[
              { icon: Phone,  label: 'Teléfono',  value: supplier.phone,
                link: supplier.phone ? `tel:${supplier.phone}` : null },
              { icon: Mail,   label: 'Email',     value: supplier.email,
                link: supplier.email ? `mailto:${supplier.email}` : null },
              { icon: MapPin, label: 'Dirección', value: [supplier.address, supplier.city].filter(Boolean).join(', ') || null,
                link: null },
            ].map(({ icon: Icon, label, value, link }) => (
              <div key={label}>
                <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                  <Icon size={11} /> {label}
                </p>
                {value ? (
                  link
                    ? <a href={link} className="text-sm text-blue-600 hover:underline">{value}</a>
                    : <p className="text-sm text-gray-700">{value}</p>
                ) : (
                  <p className="text-sm text-gray-300">—</p>
                )}
              </div>
            ))}
            {supplier.notes && (
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-600">{supplier.notes}</p>
              </div>
            )}
          </div>

          {/* Artículos del proveedor */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Package size={14} className="text-gray-400" />
                Artículos de este proveedor
              </p>
              <button
                onClick={() => setShowProdForm(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: BLUE }}
              >
                <Plus size={12} /> Agregar artículo
              </button>
            </div>

            {products.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 py-6 text-center">
                <p className="text-xs text-gray-400">Sin artículos cargados todavía</p>
                <button onClick={() => setShowProdForm(true)}
                  className="mt-2 text-xs font-semibold hover:underline" style={{ color: BLUE }}>
                  + Agregar primero
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Artículo','SKU prov.','Precio','Pedido mín.','Entrega',''].map(h=>(
                        <th key={h} className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => (
                      <tr key={prod.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-gray-900">{prod.product_name}</p>
                          {prod.notes && <p className="text-xs text-gray-400">{prod.notes}</p>}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                          {prod.sku_supplier ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 font-bold text-gray-900">
                          {prod.price != null
                            ? formatPrice(prod.price, 'UYU')
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {prod.min_order != null
                            ? `${prod.min_order} ${prod.unit}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {prod.lead_days != null
                            ? `${prod.lead_days}d`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => deleteProd(prod.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300
                                       hover:bg-red-50 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: agregar artículo */}
      {showProdForm && (
        <ProductFormModal
          supplierId={supplier.id}
          businessId={supplier.business_id}
          inventoryItems={inventoryItems}
          onClose={() => setShowProdForm(false)}
          onSave={(prod) => { onProductAdded(prod); setShowProdForm(false) }}
        />
      )}
    </div>
  )
}

// ── Modal Proveedor (crear/editar) ────────────────────────────
function SupplierFormModal({ businessId, supplier, onClose, onSave }: {
  businessId: string
  supplier: Supplier | null
  onClose: () => void
  onSave: (s: Supplier) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string|null>(null)

  const [name,        setName]        = useState(supplier?.name ?? '')
  const [contactName, setContactName] = useState(supplier?.contact_name ?? '')
  const [phone,       setPhone]       = useState(supplier?.phone ?? '')
  const [email,       setEmail]       = useState(supplier?.email ?? '')
  const [address,     setAddress]     = useState(supplier?.address ?? '')
  const [city,        setCity]        = useState(supplier?.city ?? '')
  const [notes,       setNotes]       = useState(supplier?.notes ?? '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const payload = {
        business_id:  businessId,
        name:         name.trim(),
        contact_name: contactName.trim() || null,
        phone:        phone.replace(/\s/g,'') || null,
        email:        email.trim() || null,
        address:      address.trim() || null,
        city:         city.trim() || null,
        notes:        notes.trim() || null,
      }
      if (supplier) {
        const { data, error: e } = await supabase
          .from('suppliers').update(payload).eq('id', supplier.id).select('*').single()
        if (e) throw e; onSave(data as Supplier)
      } else {
        const { data, error: e } = await supabase
          .from('suppliers').insert(payload).select('*').single()
        if (e) throw e; onSave(data as Supplier)
      }
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">

          <div className="col-span-2">
            <label className="field-label">Nombre del proveedor <span className="text-red-400">*</span></label>
            <input type="text" required value={name} onChange={e=>setName(e.target.value)}
              placeholder="Ej: Distribuidora Norte, Juan Pérez Carnes..." className="input-base"/>
          </div>

          <div>
            <label className="field-label">Contacto (persona)</label>
            <input type="text" value={contactName} onChange={e=>setContactName(e.target.value)}
              placeholder="Nombre del contacto" className="input-base"/>
          </div>

          <div>
            <label className="field-label">Teléfono / WhatsApp</label>
            <input type="text" value={phone} onChange={e=>setPhone(e.target.value)}
              placeholder="099123456" className="input-base" inputMode="numeric"/>
          </div>

          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="proveedor@mail.com" className="input-base"/>
          </div>

          <div>
            <label className="field-label">Ciudad</label>
            <input type="text" value={city} onChange={e=>setCity(e.target.value)}
              placeholder="Montevideo, Buenos Aires..." className="input-base"/>
          </div>

          <div className="col-span-2">
            <label className="field-label">Dirección</label>
            <input type="text" value={address} onChange={e=>setAddress(e.target.value)}
              placeholder="Calle, número, local..." className="input-base"/>
          </div>

          <div className="col-span-2">
            <label className="field-label">Notas</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Condiciones, días de entrega, observaciones..."
              className="input-base resize-none"/>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold
                       text-white disabled:opacity-40 active:scale-[0.98]"
            style={{ background: BLUE }}>
            {loading && <Loader2 size={14} className="animate-spin"/>}
            {loading ? 'Guardando...' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium
                       text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal Artículo del proveedor ──────────────────────────────
function ProductFormModal({ supplierId, businessId, inventoryItems, onClose, onSave }: {
  supplierId: string
  businessId: string
  inventoryItems: InventoryItem[]
  onClose: () => void
  onSave: (p: SupplierProduct) => void
}) {
  const supabase = createClient()
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string|null>(null)
  const [productName, setProductName] = useState('')
  const [invItemId,  setInvItemId]  = useState('')
  const [skuSupp,    setSkuSupp]    = useState('')
  const [unit,       setUnit]       = useState('unidad')
  const [price,      setPrice]      = useState('')
  const [minOrder,   setMinOrder]   = useState('')
  const [leadDays,   setLeadDays]   = useState('')
  const [notes,      setNotes]      = useState('')

  // Al seleccionar item de inventario, pre-llenar nombre y unidad
  function handleInvSelect(id: string) {
    setInvItemId(id)
    if (id) {
      const item = inventoryItems.find(i => i.id === id)
      if (item) { setProductName(item.name); setUnit(item.unit) }
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!productName.trim()) return
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id:       supplierId,
          business_id:       businessId,
          inventory_item_id: invItemId || null,
          product_name:      productName.trim(),
          sku_supplier:      skuSupp.trim() || null,
          unit,
          price:             price ? parseFloat(price) : null,
          min_order:         minOrder ? parseFloat(minOrder) : null,
          lead_days:         leadDays ? parseInt(leadDays) : null,
          notes:             notes.trim() || null,
        })
        .select('*')
        .single()
      if (err) throw err
      onSave(data as SupplierProduct)
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Agregar artículo al proveedor" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">

        {/* Vincular a item de inventario */}
        <div>
          <label className="field-label">
            Vincular a item de inventario
            <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>
          </label>
          <select value={invItemId} onChange={e => handleInvSelect(e.target.value)}
            className="input-base">
            <option value="">Sin vincular</option>
            {inventoryItems.map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Al vincular, el nombre y la unidad se completan solos
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="field-label">Nombre del artículo <span className="text-red-400">*</span></label>
            <input type="text" required value={productName} onChange={e=>setProductName(e.target.value)}
              placeholder="Ej: Harina 000, Cerveza Heineken 330ml..." className="input-base"/>
          </div>

          <div>
            <label className="field-label">SKU del proveedor</label>
            <input type="text" value={skuSupp} onChange={e=>setSkuSupp(e.target.value)}
              placeholder="Código del proveedor" className="input-base"/>
          </div>

          <div>
            <label className="field-label">Unidad</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} className="input-base">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Precio del proveedor</label>
            <input type="number" min="0" step="0.01" value={price}
              onChange={e=>setPrice(e.target.value)}
              placeholder="0.00" className="input-base"/>
          </div>

          <div>
            <label className="field-label">Pedido mínimo</label>
            <input type="number" min="0" step="0.01" value={minOrder}
              onChange={e=>setMinOrder(e.target.value)}
              placeholder={`Mín en ${unit}s`} className="input-base"/>
          </div>

          <div>
            <label className="field-label">Días de entrega</label>
            <input type="number" min="0" value={leadDays}
              onChange={e=>setLeadDays(e.target.value)}
              placeholder="Ej: 2" className="input-base"/>
          </div>

          <div>
            <label className="field-label">Notas</label>
            <input type="text" value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Condición, temporada..." className="input-base"/>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold
                       text-white disabled:opacity-40 active:scale-[0.98]"
            style={{ background: BLUE }}>
            {loading && <Loader2 size={14} className="animate-spin"/>}
            {loading ? 'Guardando...' : 'Agregar artículo'}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium
                       text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal base ────────────────────────────────────────────────
function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg
                      max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <p className="font-semibold text-gray-900">{title}</p>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl
                       text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={16}/>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
