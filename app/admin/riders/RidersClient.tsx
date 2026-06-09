// app/admin/riders/RidersClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bike, Plus, Phone, Check, Loader2, Trash2,
  ShoppingBag, Clock, TrendingUp, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import type { DeliveryRider } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

interface RecentOrder {
  id: string; rider_id: string; status: string; total: number; created_at: string
}

interface Props {
  riders:       DeliveryRider[]
  recentOrders: RecentOrder[]
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'shipped']

export default function RidersClient({ riders: initialRiders, recentOrders }: Props) {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()

  const [riders,  setRiders]  = useState<DeliveryRider[]>(initialRiders)
  const [saving,  setSaving]  = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [newName,  setNewName]  = useState('')
  const [newPhone, setNewPhone] = useState('')

  // ── Stats per rider ───────────────────────────────────────
  const riderStats = useMemo(() => {
    const map: Record<string, { total30: number; active: number; revenue30: number }> = {}
    recentOrders.forEach(o => {
      if (!o.rider_id) return
      if (!map[o.rider_id]) map[o.rider_id] = { total30: 0, active: 0, revenue30: 0 }
      map[o.rider_id].total30++
      map[o.rider_id].revenue30 += o.total
      if (ACTIVE_STATUSES.includes(o.status)) map[o.rider_id].active++
    })
    return map
  }, [recentOrders])

  const activeCount = riders.filter(r => r.active).length

  // ── Add rider ─────────────────────────────────────────────
  async function addRider() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const { data, error } = await supabase
      .from('delivery_riders')
      .insert({
        business_id: businessId,
        name,
        phone: newPhone.trim() || null,
        active: true,
      })
      .select('id, name, phone, active, created_at, updated_at')
      .single()

    if (!error && data) {
      setRiders(prev => [...prev, data as DeliveryRider].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewPhone('')
    }
    setSaving(false)
  }

  // ── Toggle active ─────────────────────────────────────────
  async function toggleActive(rider: DeliveryRider) {
    setToggling(rider.id)
    const newVal = !rider.active
    await supabase.from('delivery_riders').update({ active: newVal }).eq('id', rider.id)
    setRiders(prev => prev.map(r => r.id === rider.id ? { ...r, active: newVal } : r))
    setToggling(null)
  }

  // ── Delete rider ──────────────────────────────────────────
  async function deleteRider(id: string) {
    setDeleting(id)
    await supabase.from('delivery_riders').delete().eq('id', id)
    setRiders(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionTour section="riders" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Repartidores</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {riders.length} registrado{riders.length !== 1 ? 's' : ''} · {activeCount} activo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Activos',       value: activeCount,                                    icon: Bike      },
          { label: 'Pedidos (30d)', value: recentOrders.length,                            icon: ShoppingBag },
          { label: 'En curso',      value: recentOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).length, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <Icon size={14} className="mx-auto mb-1 text-gray-400" />
            <p className="text-base font-bold text-gray-900">{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Riders list */}
      {riders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <Bike size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">No hay repartidores registrados</p>
          <p className="text-xs text-gray-300 mt-1">Agregá tu primer repartidor abajo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {riders.map(rider => {
            const stats = riderStats[rider.id] ?? { total30: 0, active: 0, revenue30: 0 }
            return (
              <div key={rider.id}
                className={cn(
                  'bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5',
                  'flex items-center gap-3 transition-all',
                  !rider.active && 'opacity-50'
                )}>

                {/* Avatar */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-sm font-black"
                  style={{ background: rider.active ? color : '#9CA3AF' }}
                >
                  {rider.name.slice(0, 1).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{rider.name}</p>
                  {rider.phone && (
                    <a href={`tel:${rider.phone}`}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-0.5 w-fit">
                      <Phone size={10} /> {rider.phone}
                    </a>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 shrink-0 mr-2">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{stats.total30}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">30d</p>
                  </div>
                  {stats.active > 0 && (
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color }}>{stats.active}</p>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">En curso</p>
                    </div>
                  )}
                  {stats.revenue30 > 0 && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-700">{formatPrice(stats.revenue30, currency)}</p>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">Factura</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(rider)}
                    disabled={toggling === rider.id}
                    title={rider.active ? 'Desactivar' : 'Activar'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                               hover:bg-gray-100 transition-all disabled:opacity-40">
                    {toggling === rider.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : rider.active
                        ? <ToggleRight size={18} style={{ color }} />
                        : <ToggleLeft size={18} className="text-gray-300" />
                    }
                  </button>
                  <button
                    onClick={() => deleteRider(rider.id)}
                    disabled={deleting === rider.id}
                    title="Eliminar"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300
                               hover:bg-red-50 hover:text-red-400 transition-all disabled:opacity-40">
                    {deleting === rider.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add rider form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={14} style={{ color }} />
          Agregar repartidor
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRider()}
            placeholder="Nombre del repartidor *"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900
                       outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
          />
          <input
            type="tel"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRider()}
            placeholder="Teléfono (opcional)"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900
                       outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
          />
          <button
            onClick={addRider}
            disabled={saving || !newName.trim()}
            className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold
                       text-white disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: color }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Guardando...' : 'Agregar repartidor'}
          </button>
        </div>
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-400 text-center pb-4">
        Asignás repartidores desde el detalle de cada pedido de delivery.
      </p>
    </div>
  )
}
