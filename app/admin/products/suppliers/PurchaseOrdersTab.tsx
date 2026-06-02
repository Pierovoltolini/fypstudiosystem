// app/admin/products/suppliers/PurchaseOrdersTab.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, Loader2, Check, ChevronDown, ChevronUp,
  Package, Truck, AlertTriangle, Clock, CheckCircle2,
  XCircle, Send, ClipboardList, ArrowDownCircle,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { PurchaseOrder, PurchaseOrderItem, Supplier, InventoryItem } from '@/types'

type POStatus = PurchaseOrder['status']

const STATUS_CFG: Record<POStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  draft:     { label: 'Borrador',    bg: 'bg-gray-100',   text: 'text-gray-600',   icon: ClipboardList  },
  sent:      { label: 'Enviada',     bg: 'bg-blue-50',    text: 'text-blue-700',   icon: Send           },
  confirmed: { label: 'Confirmada',  bg: 'bg-amber-50',   text: 'text-amber-700',  icon: Clock          },
  received:  { label: 'Recibida',    bg: 'bg-green-50',   text: 'text-green-700',  icon: CheckCircle2   },
  cancelled: { label: 'Cancelada',   bg: 'bg-red-50',     text: 'text-red-500',    icon: XCircle        },
}

const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  draft: 'sent', sent: 'confirmed',
}
const NEXT_LABEL: Partial<Record<POStatus, string>> = {
  draft: 'Marcar enviada', sent: 'Marcar confirmada',
}

const UNITS = ['unidad','kg','gramo','litro','ml','caja','pack','bolsa','metro','rollo','par']

interface Props {
  businessId:     string
  currency:       string
  suppliers:      Supplier[]
  inventoryItems: InventoryItem[]
  initialOrders:  PurchaseOrder[]
}

interface NewLine {
  inventory_item_id: string
  item_name:         string
  unit:              string
  quantity_ordered:  number
  unit_cost:         number
}

export default function PurchaseOrdersTab({
  businessId, currency, suppliers, inventoryItems, initialOrders,
}: Props) {
  const supabase = createClient()
  const [orders,     setOrders]     = useState<PurchaseOrder[]>(initialOrders)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [updating,   setUpdating]   = useState<string | null>(null)
  const [receiving,  setReceiving]  = useState<string | null>(null)

  // New order form
  const [supplierId,    setSupplierId]    = useState('')
  const [supplierName,  setSupplierName]  = useState('')
  const [notes,         setNotes]         = useState('')
  const [expectedDate,  setExpectedDate]  = useState('')
  const [lines,         setLines]         = useState<NewLine[]>([
    { inventory_item_id: '', item_name: '', unit: 'unidad', quantity_ordered: 1, unit_cost: 0 },
  ])

  // Receive modal state: orderId → { item_id, qty_received, unit_cost }[]
  const [receiveOrder,  setReceiveOrder]  = useState<PurchaseOrder | null>(null)
  const [receiveValues, setReceiveValues] = useState<Record<string, { qty: number; cost: number }>>({})
  const [receiveLoading, setReceiveLoading] = useState(false)

  function openReceiveModal(order: PurchaseOrder) {
    const init: Record<string, { qty: number; cost: number }> = {}
    ;(order.items ?? []).forEach(it => {
      init[it.id] = { qty: it.quantity_ordered, cost: it.unit_cost ?? 0 }
    })
    setReceiveValues(init)
    setReceiveOrder(order)
  }

  function addLine() {
    setLines(prev => [...prev, { inventory_item_id: '', item_name: '', unit: 'unidad', quantity_ordered: 1, unit_cost: 0 }])
  }
  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i))
  }
  function setLine<K extends keyof NewLine>(i: number, k: K, v: NewLine[K]) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }
  function pickItem(i: number, itemId: string) {
    const inv = inventoryItems.find(x => x.id === itemId)
    if (!inv) { setLine(i, 'inventory_item_id', ''); setLine(i, 'item_name', ''); return }
    setLine(i, 'inventory_item_id', itemId)
    setLine(i, 'item_name', inv.name)
    setLine(i, 'unit', inv.unit)
  }

  function pickSupplier(id: string) {
    const s = suppliers.find(x => x.id === id)
    setSupplierId(id)
    setSupplierName(s?.name ?? '')
  }

  async function createOrder() {
    const validLines = lines.filter(l => l.item_name.trim() && l.quantity_ordered > 0)
    if (!validLines.length) return
    if (!supplierName.trim() && !supplierId) return
    setSaving(true)
    const name = supplierId
      ? (suppliers.find(s => s.id === supplierId)?.name ?? supplierName)
      : supplierName

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert({
        business_id:   businessId,
        supplier_id:   supplierId || null,
        supplier_name: name,
        notes:         notes.trim() || null,
        expected_date: expectedDate || null,
      })
      .select('*')
      .single()

    if (error || !order) { setSaving(false); return }

    await supabase.from('purchase_order_items').insert(
      validLines.map(l => ({
        order_id:          order.id,
        business_id:       businessId,
        inventory_item_id: l.inventory_item_id || null,
        item_name:         l.item_name.trim(),
        unit:              l.unit,
        quantity_ordered:  l.quantity_ordered,
        unit_cost:         l.unit_cost > 0 ? l.unit_cost : null,
      }))
    )

    // Re-fetch with items
    const { data: full } = await supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('id', order.id)
      .single()

    setOrders(prev => [full as PurchaseOrder, ...prev])
    setShowForm(false); setSaving(false)
    setSupplierId(''); setSupplierName(''); setNotes(''); setExpectedDate('')
    setLines([{ inventory_item_id: '', item_name: '', unit: 'unidad', quantity_ordered: 1, unit_cost: 0 }])
    setExpanded(order.id)
  }

  async function advance(order: PurchaseOrder) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setUpdating(order.id)
    await supabase.from('purchase_orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
    setUpdating(null)
  }

  async function cancel(order: PurchaseOrder) {
    setUpdating(order.id)
    await supabase.from('purchase_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
    setUpdating(null)
  }

  async function doReceive() {
    if (!receiveOrder) return
    setReceiveLoading(true)
    const items = (receiveOrder.items ?? []).map(it => ({
      item_id:            it.id,
      inventory_item_id:  it.inventory_item_id ?? null,
      item_name:          it.item_name,
      unit:               it.unit,
      quantity_received:  receiveValues[it.id]?.qty ?? 0,
      unit_cost:          receiveValues[it.id]?.cost > 0 ? receiveValues[it.id].cost : null,
    }))
    const res = await fetch('/api/purchase-orders/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: receiveOrder.id, businessId, items }),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o =>
        o.id === receiveOrder.id
          ? { ...o, status: 'received', received_at: new Date().toISOString() }
          : o
      ))
    }
    setReceiveLoading(false); setReceiveOrder(null)
  }

  const activeOrders   = useMemo(() => orders.filter(o => o.status !== 'cancelled' && o.status !== 'received'), [orders])
  const closedOrders   = useMemo(() => orders.filter(o => o.status === 'received' || o.status === 'cancelled'), [orders])

  function OrderCard({ order }: { order: PurchaseOrder }) {
    const cfg    = STATUS_CFG[order.status]
    const Icon   = cfg.icon
    const isOpen = expanded === order.id
    const next   = NEXT_STATUS[order.status]
    const nlbl   = NEXT_LABEL[order.status]
    const total  = (order.items ?? []).reduce((a, it) =>
      a + it.quantity_ordered * (it.unit_cost ?? 0), 0)

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(isOpen ? null : order.id)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl shrink-0', cfg.bg)}>
            <Icon size={14} className={cfg.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">{order.supplier_name}</p>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(order.created_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })}
              {order.expected_date && ` · Esperada: ${new Date(order.expected_date + 'T12:00:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}`}
              {(order.items ?? []).length > 0 && ` · ${(order.items ?? []).length} artículo${(order.items ?? []).length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {total > 0 && (
            <p className="text-sm font-bold text-gray-700 shrink-0">{formatPrice(total, currency)}</p>
          )}
          {isOpen ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
        </button>

        {isOpen && (
          <div className="border-t border-gray-100 px-4 pb-4 space-y-3 pt-3">
            {/* Items table */}
            {(order.items ?? []).length > 0 && (
              <div className="rounded-xl overflow-hidden border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-[11px] font-bold text-gray-400 uppercase">Artículo</th>
                      <th className="text-right px-3 py-2 text-[11px] font-bold text-gray-400 uppercase">Cant.</th>
                      <th className="text-right px-3 py-2 text-[11px] font-bold text-gray-400 uppercase hidden sm:table-cell">Costo unit.</th>
                      {order.status === 'received' && (
                        <th className="text-right px-3 py-2 text-[11px] font-bold text-gray-400 uppercase">Recibido</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(order.items ?? []).map(it => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800 text-sm truncate max-w-[150px]">{it.item_name}</p>
                          <p className="text-[10px] text-gray-400">{it.unit}</p>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-gray-700">{it.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500 hidden sm:table-cell">
                          {it.unit_cost ? formatPrice(it.unit_cost, currency) : '—'}
                        </td>
                        {order.status === 'received' && (
                          <td className="px-3 py-2 text-right text-sm font-semibold text-green-700">
                            {it.quantity_received ?? '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {order.notes && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">📝 {order.notes}</p>
            )}

            {/* Actions */}
            {order.status !== 'received' && order.status !== 'cancelled' && (
              <div className="flex items-center gap-2 flex-wrap">
                {next && nlbl && (
                  <button onClick={() => advance(order)} disabled={updating === order.id}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold
                               text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all">
                    {updating === order.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {nlbl}
                  </button>
                )}
                {order.status === 'confirmed' && (
                  <button onClick={() => openReceiveModal(order)}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold
                               text-white bg-green-600 hover:bg-green-700 transition-all">
                    <ArrowDownCircle size={11} /> Recibir mercadería
                  </button>
                )}
                <button onClick={() => cancel(order)} disabled={updating === order.id}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium
                             text-red-500 bg-red-50 hover:bg-red-100 transition-colors ml-auto">
                  <X size={11} /> Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{activeOrders.length} orden{activeOrders.length !== 1 ? 'es' : ''} activa{activeOrders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shrink-0">
          <Plus size={14} /> Nueva orden
        </button>
      </div>

      {/* New order form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Nueva orden de compra</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Proveedor</label>
              {suppliers.length > 0 ? (
                <select value={supplierId}
                  onChange={e => pickSupplier(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">— Elegir proveedor —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__custom">Otro (escribir)</option>
                </select>
              ) : (
                <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              )}
              {supplierId === '__custom' && (
                <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha esperada (opcional)</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Artículos</p>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_90px_90px_32px] gap-2 items-end">
                <div>
                  {i === 0 && <label className="text-[10px] text-gray-400 mb-1 block">Artículo</label>}
                  {inventoryItems.length > 0 ? (
                    <select value={line.inventory_item_id}
                      onChange={e => pickItem(i, e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-2 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">— Elegir —</option>
                      {inventoryItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                      <option value="__custom">Otro</option>
                    </select>
                  ) : (
                    <input value={line.item_name} onChange={e => setLine(i, 'item_name', e.target.value)}
                      placeholder="Nombre"
                      className="w-full rounded-xl border border-gray-200 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-300" />
                  )}
                  {line.inventory_item_id === '__custom' && (
                    <input value={line.item_name} onChange={e => setLine(i, 'item_name', e.target.value)}
                      placeholder="Nombre del artículo"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 text-xs outline-none" />
                  )}
                </div>
                <div>
                  {i === 0 && <label className="text-[10px] text-gray-400 mb-1 block">Unidad</label>}
                  <select value={line.unit} onChange={e => setLine(i, 'unit', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-300">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  {i === 0 && <label className="text-[10px] text-gray-400 mb-1 block">Cantidad</label>}
                  <input type="number" min="0.01" step="0.01" value={line.quantity_ordered}
                    onChange={e => setLine(i, 'quantity_ordered', parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  {i === 0 && <label className="text-[10px] text-gray-400 mb-1 block">Costo unit.</label>}
                  <input type="number" min="0" step="0.01" value={line.unit_cost || ''}
                    onChange={e => setLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                             hover:bg-red-50 hover:text-red-400 disabled:opacity-30 transition-all">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button onClick={addLine}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
              <Plus size={12} /> Agregar artículo
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, condiciones…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={createOrder} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
            Crear orden
          </button>
        </div>
      )}

      {/* Active orders */}
      {activeOrders.length === 0 && !showForm ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <Package size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Sin órdenes activas</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700">
            Crear la primera orden
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}

      {/* Closed orders */}
      {closedOrders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-2">Historial</p>
          <div className="space-y-2 opacity-70">
            {closedOrders.slice(0, 5).map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {/* Receive modal */}
      {receiveOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">Recibir mercadería</p>
                <p className="text-xs text-gray-400">{receiveOrder.supplier_name}</p>
              </div>
              <button onClick={() => setReceiveOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500">Confirmá las cantidades recibidas. El stock se actualizará automáticamente.</p>
              {(receiveOrder.items ?? []).map(it => (
                <div key={it.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{it.item_name}</p>
                    <p className="text-xs text-gray-400">Pedido: {it.quantity_ordered} {it.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Recibido</label>
                      <input type="number" min="0" step="0.01"
                        value={receiveValues[it.id]?.qty ?? it.quantity_ordered}
                        onChange={e => setReceiveValues(prev => ({ ...prev, [it.id]: { ...prev[it.id], qty: parseFloat(e.target.value) || 0 } }))}
                        className="w-20 rounded-xl border border-gray-200 px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Costo unit.</label>
                      <input type="number" min="0" step="0.01"
                        value={receiveValues[it.id]?.cost ?? (it.unit_cost ?? 0)}
                        onChange={e => setReceiveValues(prev => ({ ...prev, [it.id]: { ...prev[it.id], cost: parseFloat(e.target.value) || 0 } }))}
                        placeholder="0"
                        className="w-24 rounded-xl border border-gray-200 px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setReceiveOrder(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={doReceive} disabled={receiveLoading}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all">
                {receiveLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
