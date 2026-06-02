// app/admin/food/CombosTab.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Package2, X, Check, Tag, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Combo, ComboItem, Product } from '@/types'

interface Props {
  businessId: string
  currency: string
  color: string
  initialCombos: Combo[]
  products: Product[]
}

interface ComboForm {
  name: string
  description: string
  price: string
  image_url: string
  active: boolean
  featured: boolean
  valid_from: string
  valid_until: string
  items: { product_id: string | null; product_name: string; quantity: number }[]
}

const EMPTY_FORM: ComboForm = {
  name: '', description: '', price: '', image_url: '',
  active: true, featured: false, valid_from: '', valid_until: '',
  items: [],
}

export default function CombosTab({ businessId, currency, color, initialCombos, products }: Props) {
  const supabase = createClient()
  const [combos, setCombos] = useState<Combo[]>(initialCombos)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ComboForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newItem, setNewItem] = useState<{ product_id: string; product_name: string; quantity: number }>({
    product_id: '', product_name: '', quantity: 1,
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setNewItem({ product_id: '', product_name: '', quantity: 1 })
    setModalOpen(true)
  }

  function openEdit(c: Combo) {
    setEditingId(c.id)
    setForm({
      name:        c.name,
      description: c.description ?? '',
      price:       String(c.price),
      image_url:   c.image_url ?? '',
      active:      c.active,
      featured:    c.featured,
      valid_from:  c.valid_from?.slice(0, 10) ?? '',
      valid_until: c.valid_until?.slice(0, 10) ?? '',
      items:       (c.items ?? []).map(i => ({
        product_id:   i.product_id ?? null,
        product_name: i.product_name,
        quantity:     i.quantity,
      })),
    })
    setNewItem({ product_id: '', product_name: '', quantity: 1 })
    setModalOpen(true)
  }

  function addItem() {
    if (!newItem.product_name.trim() && !newItem.product_id) return
    const product = products.find(p => p.id === newItem.product_id)
    const name = product?.name ?? newItem.product_name.trim()
    if (!name) return
    setForm(f => ({
      ...f,
      items: [...f.items, { product_id: newItem.product_id || null, product_name: name, quantity: newItem.quantity }],
    }))
    setNewItem({ product_id: '', product_name: '', quantity: 1 })
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  async function save() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const payload = {
      business_id:  businessId,
      name:         form.name.trim(),
      description:  form.description.trim() || null,
      price:        parseFloat(form.price),
      image_url:    form.image_url.trim() || null,
      active:       form.active,
      featured:     form.featured,
      valid_from:   form.valid_from || null,
      valid_until:  form.valid_until || null,
    }

    if (editingId) {
      await supabase.from('combos').update(payload).eq('id', editingId)
      // Replace items: delete old, insert new
      await supabase.from('combo_items').delete().eq('combo_id', editingId)
      if (form.items.length > 0) {
        await supabase.from('combo_items').insert(
          form.items.map(i => ({ combo_id: editingId, business_id: businessId, ...i }))
        )
      }
      setCombos(prev => prev.map(c =>
        c.id === editingId
          ? { ...c, ...payload, items: form.items.map((i, idx) => ({ id: `tmp-${idx}`, combo_id: editingId, ...i })) }
          : c
      ))
    } else {
      const { data: created } = await supabase
        .from('combos').insert(payload).select().single()
      if (created) {
        const itemRows = form.items.map(i => ({ combo_id: created.id, business_id: businessId, ...i }))
        if (itemRows.length > 0) await supabase.from('combo_items').insert(itemRows)
        setCombos(prev => [{ ...created, items: form.items.map((i, idx) => ({ id: `tmp-${idx}`, combo_id: created.id, ...i })) as ComboItem[] }, ...prev])
      }
    }
    setSaving(false)
    setModalOpen(false)
  }

  async function deleteCombo(id: string) {
    setDeleting(id)
    await supabase.from('combos').delete().eq('id', id)
    setCombos(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function toggleActive(c: Combo) {
    await supabase.from('combos').update({ active: !c.active }).eq('id', c.id)
    setCombos(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))
  }

  const activeCombos   = combos.filter(c => c.active)
  const inactiveCombos = combos.filter(c => !c.active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Combos y ofertas</p>
          <p className="text-xs text-gray-400 mt-0.5">Creá paquetes especiales para tu menú</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-95"
          style={{ background: color }}
        >
          <Plus size={15} />
          Nuevo combo
        </button>
      </div>

      {/* Active combos */}
      {combos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Package2 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">Sin combos todavía</p>
          <p className="text-xs text-gray-300 mt-1">Creá tu primer combo para aumentar el ticket promedio</p>
        </div>
      )}

      {activeCombos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {activeCombos.map(c => (
            <ComboCard
              key={c.id}
              combo={c}
              currency={currency}
              color={color}
              deleting={deleting === c.id}
              onEdit={() => openEdit(c)}
              onDelete={() => deleteCombo(c.id)}
              onToggle={() => toggleActive(c)}
            />
          ))}
        </div>
      )}

      {inactiveCombos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Inactivos</p>
          <div className="grid gap-3 sm:grid-cols-2 opacity-60">
            {inactiveCombos.map(c => (
              <ComboCard
                key={c.id}
                combo={c}
                currency={currency}
                color={color}
                deleting={deleting === c.id}
                onEdit={() => openEdit(c)}
                onDelete={() => deleteCombo(c.id)}
                onToggle={() => toggleActive(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">{editingId ? 'Editar combo' : 'Nuevo combo'}</p>
              <button onClick={() => setModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Combo 1 · Hamburguesa + papas + bebida"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="¿Qué incluye este combo?"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 resize-none"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Precio *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">{currency}</span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 pl-12 pr-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Válido desde</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Válido hasta</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className="transition-colors"
                    style={{ color: form.active ? color : '#9CA3AF' }}
                  >
                    {form.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                    className="transition-colors"
                    style={{ color: form.featured ? color : '#9CA3AF' }}
                  >
                    {form.featured ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                  <span className="text-sm text-gray-700">Destacado</span>
                </label>
              </div>

              {/* Items */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Productos incluidos</label>

                {/* Existing items */}
                {form.items.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                        <span className="text-sm text-gray-800">
                          <span className="font-medium text-gray-500 mr-1.5">{item.quantity}×</span>
                          {item.product_name}
                        </span>
                        <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 transition-colors ml-2">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item row */}
                <div className="flex gap-2">
                  <select
                    value={newItem.product_id}
                    onChange={e => {
                      const prod = products.find(p => p.id === e.target.value)
                      setNewItem(n => ({ ...n, product_id: e.target.value, product_name: prod?.name ?? '' }))
                    }}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                  >
                    <option value="">Elegir producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={e => setNewItem(n => ({ ...n, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-sm text-center focus:outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={addItem}
                    disabled={!newItem.product_id}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-30"
                    style={{ background: color }}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.price}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: color }}
              >
                {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check size={15} />}
                {editingId ? 'Guardar' : 'Crear combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ComboCard({
  combo, currency, color, deleting, onEdit, onDelete, onToggle,
}: {
  combo: Combo
  currency: string
  color: string
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const now = new Date().toISOString().slice(0, 10)
  const expired = combo.valid_until && combo.valid_until < now
  const notYet   = combo.valid_from  && combo.valid_from  > now

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 hover:border-gray-200 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{combo.name}</p>
            {combo.featured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">Destacado</span>
            )}
            {expired && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-500">Expirado</span>
            )}
            {notYet && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-500">Programado</span>
            )}
          </div>
          {combo.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{combo.description}</p>
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 shrink-0">{formatPrice(combo.price, currency)}</p>
      </div>

      {/* Items */}
      {(combo.items ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(combo.items ?? []).map((item, idx) => (
            <span key={idx}
              className="flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2 py-1 text-xs text-gray-600">
              <span className="font-medium">{item.quantity}×</span>
              {item.product_name}
            </span>
          ))}
        </div>
      )}

      {/* Validity */}
      {(combo.valid_from || combo.valid_until) && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={11} />
          {combo.valid_from && <span>Desde {combo.valid_from}</span>}
          {combo.valid_from && combo.valid_until && <span>·</span>}
          {combo.valid_until && <span>Hasta {combo.valid_until}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            combo.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          {combo.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {combo.active ? 'Activo' : 'Inactivo'}
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <Pencil size={11} />
          Editar
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {deleting
            ? <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
            : <Trash2 size={13} />
          }
        </button>
      </div>
    </div>
  )
}
