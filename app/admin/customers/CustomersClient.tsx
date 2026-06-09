// app/admin/customers/CustomersClient.tsx
'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Phone, TrendingUp, Calendar, Search, X,
  ShoppingBag, Star, Zap, AlertCircle, Clock, ChevronRight,
  MessageCircle, MapPin, Mail, StickyNote, Tag, Plus, Check, Download, Gift,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Customer, Order, Plan } from '@/types'
import { useVertical } from '@/lib/vertical-context'
import SectionTour from '@/components/admin/SectionTour'
import UpgradePrompt from '@/components/admin/UpgradePrompt'

// ── Segmentos ─────────────────────────────────────────────────
type Segment = 'all' | 'vip' | 'frequent' | 'new' | 'atrisk'

const SEGMENTS: { key: Segment; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all',      label: 'Todos',       icon: Users,        color: '#6B7280' },
  { key: 'vip',      label: 'VIP',         icon: Star,         color: '#D97706' },
  { key: 'frequent', label: 'Frecuentes',  icon: Zap,          color: '#2563EB' },
  { key: 'new',      label: 'Nuevos',      icon: Clock,        color: '#059669' },
  { key: 'atrisk',   label: 'En riesgo',   icon: AlertCircle,  color: '#DC2626' },
]

const DAY_MS = 86_400_000

function classify(c: Customer, vipThreshold: number): Segment[] {
  const segs: Segment[] = []
  const now     = Date.now()
  const created = new Date(c.created_at).getTime()
  const updated = new Date(c.updated_at).getTime()

  if (c.total_spent >= vipThreshold && c.total_orders >= 2) segs.push('vip')
  if (c.total_orders >= 5)                                   segs.push('frequent')
  if (now - created < 30 * DAY_MS)                           segs.push('new')
  if (c.total_orders > 0 && now - updated > 60 * DAY_MS)    segs.push('atrisk')
  return segs
}

const SEG_BADGE: Partial<Record<Segment, { bg: string; text: string; label: string }>> = {
  vip:      { bg: '#FEF3C7', text: '#92400E', label: 'VIP' },
  frequent: { bg: '#DBEAFE', text: '#1E40AF', label: 'Frecuente' },
  new:      { bg: '#D1FAE5', text: '#065F46', label: 'Nuevo' },
  atrisk:   { bg: '#FEE2E2', text: '#991B1B', label: 'En riesgo' },
}
function segmentBadge(seg: Segment) { return SEG_BADGE[seg] }

type EnrichedCustomer = Customer & { segments: Segment[] }

// ── Props ─────────────────────────────────────────────────────
interface Props {
  customers:     Customer[]
  plan:          Plan
  customerLimit: number
}

export default function CustomersClient({ customers, plan, customerLimit }: Props) {
  const { businessId, business, currency, color: primaryColor, vertical, group } = useVertical()
  const orderLabel  = vertical.orderLabel
  const isBooking   = group === 'servicios'
  const clientLabel = (business.vertical_sub === 'salud' || business.vertical_sub === 'veterinaria')
    ? 'Pacientes' : 'Clientes'
  const supabase = createClient()
  const [search,   setSearch]   = useState('')
  const [segment,  setSegment]  = useState<Segment>('all')
  const [selected, setSelected] = useState<EnrichedCustomer | null>(null)
  const [orders,   setOrders]   = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Customer>>>({})

  function handleCustomerUpdate(id: string, patch: Partial<Customer>) {
    setLocalOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }

  function exportCSV() {
    const rows = [
      ['Nombre', 'Teléfono', 'Email', 'Dirección', 'Pedidos', 'Total gastado', 'Etiquetas', 'Alta'],
      ...filtered.map(c => [
        c.name,
        c.phone ?? '',
        c.email ?? '',
        c.address ?? '',
        c.total_orders,
        c.total_spent,
        (c.tags ?? []).join('|'),
        new Date(c.created_at).toLocaleDateString('es-UY'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── VIP threshold: percentile 80 de total_spent ───────────
  const vipThreshold = useMemo(() => {
    if (customers.length < 3) return Infinity
    const sorted = [...customers].sort((a, b) => a.total_spent - b.total_spent)
    return sorted[Math.floor(sorted.length * 0.8)]?.total_spent ?? 0
  }, [customers])

  // ── Clasificar todos ──────────────────────────────────────
  const enriched = useMemo(() =>
    customers.map(c => {
      const merged = { ...c, ...localOverrides[c.id] }
      return { ...merged, segments: classify(merged, vipThreshold) }
    }),
    [customers, vipThreshold, localOverrides]
  )

  // ── Conteos por segmento ──────────────────────────────────
  const segCounts = useMemo(() => {
    const counts: Record<Segment, number> = { all: enriched.length, vip: 0, frequent: 0, new: 0, atrisk: 0 }
    enriched.forEach(c => c.segments.forEach(s => { counts[s]++ }))
    return counts
  }, [enriched])

  // ── Filtrado ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(c => {
      const matchSeg = segment === 'all' || c.segments.includes(segment)
      const matchQ   = !q || c.name.toLowerCase().includes(q) ||
                       (c.phone ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q)
      return matchSeg && matchQ
    })
  }, [enriched, segment, search])

  // ── Stats globales ────────────────────────────────────────
  const totalRevenue = customers.reduce((a, c) => a + (c.total_spent ?? 0), 0)
  const totalOrders  = customers.reduce((a, c) => a + (c.total_orders ?? 0), 0)
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // ── Cargar pedidos del cliente seleccionado ───────────────
  useEffect(() => {
    if (!selected) { setOrders([]); return }
    setLoadingOrders(true)
    supabase.from('orders')
      .select('id, order_number, status, total, created_at, delivery_type, items:order_items(product_name, quantity)')
      .eq('business_id', businessId)
      .or(`customer_id.eq.${selected.id},customer_name.eq.${selected.name}`)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setOrders((data ?? []) as unknown as Order[])
        setLoadingOrders(false)
      })
  }, [selected?.id])

  // ── Cerrar drawer con Escape ──────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionTour section="customers" />

      {/* Plan limit banner */}
      {customerLimit !== Infinity && (
        <UpgradePrompt
          resource="clientes"
          current={customers.length}
          limit={customerLimit}
          variant="inline"
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
            {clientLabel}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{customers.length} registrados</p>
        </div>
        {customers.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                       px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all shrink-0 min-h-[44px]">
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      {customers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: clientLabel,       value: customers.length,               icon: Users      },
            { label: orderLabel + 's',  value: totalOrders,                    icon: isBooking ? Calendar : ShoppingBag },
            { label: 'Facturación',     value: formatPrice(totalRevenue, currency), icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
              <Icon size={16} className="mx-auto mb-2" style={{ color: primaryColor }} />
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${clientLabel.toLowerCase()} por nombre o teléfono…`}
          className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-10 py-3
                     text-sm text-gray-900 placeholder-gray-400 focus:outline-none
                     focus:ring-2 focus:border-transparent transition-all"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Segment pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
        {SEGMENTS.map(({ key, label, icon: Icon, color }) => {
          const count  = segCounts[key]
          const active = segment === key
          return (
            <button key={key} onClick={() => setSegment(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-semibold',
                'shrink-0 transition-all border min-h-[44px]',
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              )}
              style={active ? { background: color, borderColor: color } : {}}>
              <Icon size={11} />
              {label}
              <span className={cn(
                'ml-0.5 rounded-full h-4 min-w-4 px-1 flex items-center justify-center text-xs font-bold',
                active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Lista ── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Users size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">
            {customers.length === 0
              ? `Sin ${clientLabel.toLowerCase()} todavía`
              : 'No hay resultados para este filtro'}
          </p>
          {customers.length === 0 && (
            <p className="text-xs text-gray-300 mt-1">
              Se registran automáticamente al hacer pedidos
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              currency={currency}
              primaryColor={primaryColor}
              orderLabel={orderLabel}
              isSelected={selected?.id === customer.id}
              onClick={() => setSelected(selected?.id === customer.id ? null : customer as EnrichedCustomer)}
            />
          ))}
        </div>
      )}

      {/* ── Drawer overlay (mobile click-off) ── */}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
          onClick={() => setSelected(null)}
        />
      )}

      {/* ── Detail Drawer ── */}
      <div className={cn(
        'fixed z-50 bg-white shadow-2xl transition-transform duration-300 ease-out',
        // Mobile: bottom sheet
        'bottom-0 left-0 right-0 rounded-t-3xl max-h-[80vh] overflow-y-auto lg:rounded-none',
        // Desktop: right panel
        'lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:w-[420px] lg:max-h-none lg:rounded-tl-3xl lg:rounded-bl-3xl',
        selected ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
      )}>
        {selected && (
          <CustomerDetail
            customer={selected}
            orders={orders}
            loading={loadingOrders}
            currency={currency}
            primaryColor={primaryColor}
            orderLabel={orderLabel}
            businessId={businessId}
            onClose={() => setSelected(null)}
            onUpdate={handleCustomerUpdate}
          />
        )}
      </div>
    </div>
  )
}

// ── Customer Card ─────────────────────────────────────────────
function CustomerCard({ customer, currency, primaryColor, orderLabel, isSelected, onClick }: {
  customer: Customer & { segments: Segment[] }
  currency: string; primaryColor: string; orderLabel: string
  isSelected: boolean; onClick: () => void
}) {
  const initials = customer.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const avgTicket = customer.total_orders > 0
    ? customer.total_spent / customer.total_orders : 0

  return (
    <button onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 bg-white rounded-2xl border px-4 py-3.5 text-left',
        'transition-all active:scale-[0.99]',
        isSelected ? 'border-2 shadow-sm' : 'border-gray-100 hover:border-gray-200 shadow-sm'
      )}
      style={isSelected ? { borderColor: primaryColor } : {}}>

      {/* Avatar */}
      <div className="h-11 w-11 rounded-full flex items-center justify-center text-white
                      text-sm font-bold shrink-0"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
          {customer.segments.map(seg => {
            const conf = segmentBadge(seg)
            if (!conf) return null
            return (
              <span key={seg} className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: conf.bg, color: conf.text }}>
                {conf.label}
              </span>
            )
          })}
        </div>
        {customer.phone ? (
          <p className="text-xs text-gray-400 mt-0.5">{customer.phone}</p>
        ) : customer.email ? (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{customer.email}</p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{formatPrice(customer.total_spent, currency)}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {customer.total_orders} {orderLabel.toLowerCase()}{customer.total_orders !== 1 ? 's' : ''}
        </p>
      </div>

      <ChevronRight size={14} className="text-gray-300 shrink-0" style={isSelected ? { color: primaryColor } : {}} />
    </button>
  )
}

// ── Customer Detail ───────────────────────────────────────────
function CustomerDetail({ customer, orders, loading, currency, primaryColor, orderLabel, businessId, onClose, onUpdate }: {
  customer: Customer & { segments: Segment[] }
  orders: Order[]; loading: boolean
  currency: string; primaryColor: string; orderLabel: string; businessId: string
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Customer>) => void
}) {
  const supabase    = createClient()
  const initials    = customer.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const avgTicket   = customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0
  const lastActivity = customer.updated_at
    ? new Date(customer.updated_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Notes editing
  const [notes,       setNotes]       = useState(customer.notes ?? '')
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesSaving,  setNotesSaving]  = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Tags
  const [tags,       setTags]      = useState<string[]>(customer.tags ?? [])
  const [tagInput,   setTagInput]  = useState('')
  const [tagSaving,  setTagSaving] = useState(false)

  // Loyalty
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)
  const [loyaltySettings, setLoyaltySettings] = useState<{ redeem_ratio: number } | null>(null)

  // Keep local state in sync when customer changes
  useEffect(() => { setNotes(customer.notes ?? ''); setTags(customer.tags ?? []) }, [customer.id])

  useEffect(() => {
    setLoyaltyPoints(null)
    Promise.all([
      supabase.rpc('get_customer_points', { p_business_id: businessId, p_customer_id: customer.id }),
      supabase.from('loyalty_settings').select('enabled, redeem_ratio').eq('business_id', businessId).single(),
    ]).then(([pointsRes, settingsRes]) => {
      if (settingsRes.data?.enabled) {
        setLoyaltyPoints((pointsRes.data as number) ?? 0)
        setLoyaltySettings({ redeem_ratio: settingsRes.data.redeem_ratio })
      }
    })
  }, [customer.id])

  async function saveNotes() {
    setNotesSaving(true)
    await supabase.from('customers').update({ notes }).eq('id', customer.id)
    onUpdate(customer.id, { notes })
    setNotesSaving(false)
    setNotesEditing(false)
  }

  async function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    const next = [...tags, t]
    setTagSaving(true)
    await supabase.from('customers').update({ tags: next }).eq('id', customer.id)
    setTags(next)
    onUpdate(customer.id, { tags: next })
    setTagInput('')
    setTagSaving(false)
  }

  async function removeTag(t: string) {
    const next = tags.filter(x => x !== t)
    await supabase.from('customers').update({ tags: next }).eq('id', customer.id)
    setTags(next)
    onUpdate(customer.id, { tags: next })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Handle bar (mobile) */}
      <div className="lg:hidden flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-gray-200" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
            {initials}
          </div>
          <div>
            <p className="font-bold text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Cliente desde {new Date(customer.created_at).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                     hover:bg-gray-100 hover:text-gray-700 transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Segment badges */}
        {customer.segments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customer.segments.map(seg => {
              const conf = segmentBadge(seg)
              if (!conf) return null
              return (
                <span key={seg} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: conf.bg, color: conf.text }}>
                  {conf.label}
                </span>
              )
            })}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Gastado',        value: formatPrice(customer.total_spent, currency) },
            { label: orderLabel + 's', value: customer.total_orders },
            { label: 'Ticket avg',     value: formatPrice(avgTicket, currency) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-gray-50 p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Loyalty points */}
        {loyaltyPoints !== null && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 shrink-0">
              <Gift size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">
                {loyaltyPoints} punto{loyaltyPoints !== 1 ? 's' : ''} acumulados
              </p>
              {loyaltySettings && loyaltyPoints > 0 && (
                <p className="text-xs text-amber-700 mt-0.5">
                  = {formatPrice(loyaltyPoints / loyaltySettings.redeem_ratio, currency)} en descuentos
                </p>
              )}
              {loyaltyPoints === 0 && (
                <p className="text-xs text-amber-600 mt-0.5">Sin puntos aún</p>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(Math.min(5, Math.ceil(loyaltyPoints / 100)))].map((_, i) => (
                <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contacto</p>
          {customer.phone && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone size={14} className="text-gray-400" /> {customer.phone}
              </div>
              <a href={`https://wa.me/${customer.phone.replace(/\D/g,'')}`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white bg-green-500">
                <MessageCircle size={11} /> WhatsApp
              </a>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={14} className="text-gray-400" />
              <a href={`mailto:${customer.email}`} className="hover:underline truncate">{customer.email}</a>
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin size={14} className="text-gray-400 shrink-0" />
              <span className="truncate">{customer.address}</span>
            </div>
          )}
          {lastActivity && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock size={13} className="shrink-0" />
              <span>Última actividad: {lastActivity}</span>
            </div>
          )}
          {!customer.phone && !customer.email && !customer.address && !lastActivity && (
            <p className="text-xs text-gray-400">Sin datos de contacto</p>
          )}
        </div>

        {/* Tags */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-gray-400" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Etiquetas</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1
                                       text-xs font-medium bg-gray-100 text-gray-700">
                {t}
                <button onClick={() => removeTag(t)}
                  className="ml-0.5 text-gray-400 hover:text-red-400 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="+ etiqueta"
                className="rounded-full border border-dashed border-gray-300 px-2.5 py-1
                           text-xs text-gray-700 placeholder-gray-400 outline-none
                           focus:border-gray-400 w-24"
              />
              {tagInput.trim() && (
                <button onClick={addTag} disabled={tagSaving}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white transition-opacity"
                  style={{ background: primaryColor, opacity: tagSaving ? 0.5 : 1 }}>
                  {tagSaving ? <div className="h-3 w-3 rounded-full border border-white/50 animate-spin border-t-white" /> : <Plus size={10} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote size={13} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notas</p>
            </div>
            {!notesEditing && (
              <button onClick={() => { setNotesEditing(true); setTimeout(() => notesRef.current?.focus(), 50) }}
                className="text-xs font-semibold transition-colors"
                style={{ color: primaryColor }}>
                {notes ? 'Editar' : 'Agregar'}
              </button>
            )}
          </div>
          {notesEditing ? (
            <div className="space-y-2">
              <textarea
                ref={notesRef}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Preferencias, alergias, notas importantes…"
                className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800
                           placeholder-gray-400 resize-none outline-none focus:ring-2
                           focus:border-transparent transition-all"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
              <div className="flex gap-2">
                <button onClick={saveNotes} disabled={notesSaving}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold
                             text-white transition-opacity"
                  style={{ background: primaryColor, opacity: notesSaving ? 0.6 : 1 }}>
                  {notesSaving
                    ? <div className="h-3 w-3 rounded-full border border-white/50 animate-spin border-t-white" />
                    : <Check size={11} />}
                  Guardar
                </button>
                <button onClick={() => { setNotes(customer.notes ?? ''); setNotesEditing(false) }}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-500
                             bg-gray-100 hover:bg-gray-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          ) : notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">Sin notas</p>
          )}
        </div>

        {/* Historial */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Últimos {orderLabel.toLowerCase()}s
            </p>
            {!loading && (
              <p className="text-xs text-gray-400">{orders.length} registrado{orders.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 rounded-full border-2 border-gray-200 animate-spin"
                style={{ borderTopColor: primaryColor }} />
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-8 text-center">
              <p className="text-xs text-gray-400">Sin historial disponible</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-400">
                      #{String(order.order_number).padStart(4, '0')}
                    </p>
                    {order.items && order.items.length > 0 && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">
                        {order.items.slice(0, 2).map(i =>
                          `${(i as { quantity: number }).quantity}× ${(i as { product_name: string }).product_name}`
                        ).join(', ')}
                        {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('es-UY', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatPrice(order.total, currency)}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Order status badge ────────────────────────────────────────
const STATUS_CONF: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pendiente', bg: '#FEF3C7', text: '#92400E' },
  confirmed: { label: 'Confirmado',bg: '#DBEAFE', text: '#1E40AF' },
  preparing: { label: 'En proceso',bg: '#EDE9FE', text: '#5B21B6' },
  ready:     { label: 'Listo',     bg: '#D1FAE5', text: '#065F46' },
  delivered: { label: 'Entregado', bg: '#F3F4F6', text: '#374151' },
  done:      { label: 'Realizado', bg: '#F3F4F6', text: '#374151' },
  cancelled: { label: 'Cancelado', bg: '#FEE2E2', text: '#991B1B' },
}

function OrderStatusBadge({ status }: { status: string }) {
  const conf = STATUS_CONF[status] ?? { label: status, bg: '#F3F4F6', text: '#374151' }
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: conf.bg, color: conf.text }}>
      {conf.label}
    </span>
  )
}
