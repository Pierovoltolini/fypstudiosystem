// app/admin/campaigns/CampaignsClient.tsx
'use client'
import { useState, useMemo, useCallback } from 'react'
import {
  Send, Users, Star, Zap, AlertCircle, Clock,
  MessageCircle, Copy, Check, ChevronDown, ChevronUp,
  Phone, Download, Search, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Customer } from '@/types'

type Segment = 'all' | 'vip' | 'frequent' | 'new' | 'atrisk' | 'tag'

const SEGMENTS: { key: Segment; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { key: 'all',      label: 'Todos',         icon: Users,        color: '#6B7280', desc: 'Toda tu base de clientes' },
  { key: 'vip',      label: 'VIP',           icon: Star,         color: '#D97706', desc: 'Los que más gastan (top 20%)' },
  { key: 'frequent', label: 'Frecuentes',    icon: Zap,          color: '#2563EB', desc: '5 o más pedidos' },
  { key: 'new',      label: 'Nuevos',        icon: Clock,        color: '#059669', desc: 'Alta en los últimos 30 días' },
  { key: 'atrisk',   label: 'En riesgo',     icon: AlertCircle,  color: '#DC2626', desc: 'Sin actividad en 60 días' },
]

const TEMPLATES = [
  { label: 'Promo especial',
    text: 'Hola {nombre}! 🎉 Tenemos una promo especial para vos. Pasá a vernos o pedí por acá. ¡Te esperamos!' },
  { label: 'Te extrañamos',
    text: 'Hola {nombre}, hace tiempo que no te vemos 😊 Te tenemos algo especial. ¡Volvé a visitarnos!' },
  { label: 'Nuevo producto',
    text: 'Hola {nombre}! 🆕 Tenemos novedades en {negocio} que te van a encantar. ¡Mirá lo nuevo!' },
  { label: 'Descuento exclusivo',
    text: 'Hola {nombre}! Por ser cliente especial de {negocio} tenés un descuento exclusivo esperándote 🎁' },
  { label: 'Puntos de fidelización',
    text: 'Hola {nombre}! Recordá que tenés puntos acumulados en {negocio}. ¡Usálos en tu próxima compra! ⭐' },
]

const DAY_MS = 86_400_000

function classifyCustomer(c: Customer, vipThreshold: number): Segment[] {
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

interface Props {
  customers:    Customer[]
  businessName: string
}

export default function CampaignsClient({ customers, businessName }: Props) {
  const [segment,      setSegment]      = useState<Segment>('all')
  const [tagFilter,    setTagFilter]    = useState('')
  const [message,      setMessage]      = useState(TEMPLATES[0].text)
  const [search,       setSearch]       = useState('')
  const [copiedAll,    setCopiedAll]    = useState(false)
  const [copiedMsg,    setCopiedMsg]    = useState(false)
  const [sentIds,      setSentIds]      = useState<Set<string>>(new Set())
  const [showPreview,  setShowPreview]  = useState(true)
  const [showTemplate, setShowTemplate] = useState(false)

  const vipThreshold = useMemo(() => {
    if (customers.length < 3) return Infinity
    const sorted = [...customers].sort((a, b) => a.total_spent - b.total_spent)
    return sorted[Math.floor(sorted.length * 0.8)]?.total_spent ?? 0
  }, [customers])

  const enriched = useMemo(() =>
    customers.map(c => ({ ...c, segs: classifyCustomer(c, vipThreshold) })),
    [customers, vipThreshold]
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    customers.forEach(c => (c.tags ?? []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [customers])

  const segCounts = useMemo(() => {
    const counts: Record<Segment, number> = { all: 0, vip: 0, frequent: 0, new: 0, atrisk: 0, tag: 0 }
    counts.all = customers.filter(c => c.phone).length
    enriched.forEach(c => {
      c.segs.forEach(s => { if (c.phone) counts[s]++ })
    })
    if (tagFilter) {
      counts.tag = customers.filter(c => c.phone && (c.tags ?? []).includes(tagFilter)).length
    }
    return counts
  }, [enriched, customers, tagFilter])

  const filtered = useMemo(() => {
    let base = enriched.filter(c => !!c.phone)
    if (segment === 'tag')      base = base.filter(c => tagFilter && (c.tags ?? []).includes(tagFilter))
    else if (segment !== 'all') base = base.filter(c => c.segs.includes(segment))
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
    }
    return base
  }, [enriched, segment, tagFilter, search])

  function personalize(name: string): string {
    return message
      .replace(/\{nombre\}/g, name)
      .replace(/\{negocio\}/g, businessName)
  }

  function waUrl(phone: string, name: string): string {
    const clean = phone.replace(/[^\d+]/g, '')
    return `https://wa.me/${clean}?text=${encodeURIComponent(personalize(name))}`
  }

  const copyAllPhones = useCallback(() => {
    const phones = filtered.map(c => c.phone).filter(Boolean).join('\n')
    navigator.clipboard.writeText(phones)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [filtered])

  const copyMessage = useCallback(() => {
    navigator.clipboard.writeText(message)
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 2000)
  }, [message])

  const exportCSV = useCallback(() => {
    const rows = [
      ['Nombre', 'Teléfono', 'Mensaje personalizado'],
      ...filtered.map(c => [c.name, c.phone ?? '', personalize(c.name)]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `campaña_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }, [filtered, message])

  function markSent(id: string) {
    setSentIds(prev => { const next = new Set(Array.from(prev)); next.add(id); return next })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
            Campañas WhatsApp
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Enviá mensajes personalizados a segmentos de clientes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: Segment + Message ── */}
        <div className="space-y-4">

          {/* Segment selector */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Users size={14} className="text-gray-400" /> Destinatarios
              </p>
            </div>
            <div className="p-4 space-y-2">
              {SEGMENTS.map(({ key, label, icon: Icon, color, desc }) => (
                <button key={key} onClick={() => setSegment(key)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border',
                    segment === key
                      ? 'border-2 bg-white shadow-sm'
                      : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200'
                  )}
                  style={segment === key ? { borderColor: color } : {}}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                    style={{ background: color + '18' }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={segment === key
                      ? { background: color + '18', color }
                      : { background: '#F3F4F6', color: '#6B7280' }}>
                    {segCounts[key]}
                  </span>
                </button>
              ))}

              {/* Tag filter */}
              {allTags.length > 0 && (
                <button onClick={() => setSegment('tag')}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border',
                    segment === 'tag'
                      ? 'border-2 border-gray-700 bg-white shadow-sm'
                      : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200'
                  )}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 bg-gray-100">
                    <Search size={14} className="text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Por etiqueta</p>
                    {segment === 'tag' ? (
                      <select
                        value={tagFilter}
                        onChange={e => { e.stopPropagation(); setTagFilter(e.target.value) }}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none">
                        <option value="">Elegir etiqueta…</option>
                        {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400">Filtrá por etiqueta personalizada</p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                    {segCounts.tag}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Message composer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MessageCircle size={14} className="text-gray-400" /> Mensaje
              </p>
              <button onClick={() => setShowTemplate(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                Plantillas {showTemplate ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {showTemplate && (
              <div className="px-4 pt-3 pb-1 space-y-1.5 border-b border-gray-100">
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => { setMessage(t.text); setShowTemplate(false) }}
                    className="w-full text-left rounded-xl border border-gray-100 bg-gray-50
                               hover:bg-blue-50 hover:border-blue-200 px-3 py-2.5 transition-all">
                    <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{t.text}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="p-4 space-y-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Escribí tu mensaje... usá {nombre} y {negocio} como variables"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                           text-gray-800 placeholder-gray-300 resize-none outline-none
                           focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {['{nombre}', '{negocio}'].map(v => (
                  <button key={v}
                    onClick={() => setMessage(prev => prev + v)}
                    className="rounded-full border border-dashed border-gray-300 px-3 py-1
                               text-xs font-mono text-gray-600 hover:bg-gray-50 transition-colors">
                    {v}
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-gray-400">{message.length} caracteres</span>
              </div>
            </div>

            <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
              <button onClick={copyMessage}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                {copiedMsg ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copiedMsg ? 'Copiado' : 'Copiar mensaje'}
              </button>
              <button onClick={copyAllPhones}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                {copiedAll ? <Check size={12} className="text-green-500" /> : <Phone size={12} />}
                {copiedAll ? 'Copiados' : `Copiar ${filtered.length} teléfonos`}
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                <Download size={12} /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Customer list ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
            <p className="text-sm font-semibold text-gray-800">
              {filtered.length} destinatario{filtered.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setShowPreview(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              {showPreview ? 'Ocultar preview' : 'Ver preview'}
              {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-1 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar en la lista…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-8 py-2
                           text-xs outline-none focus:ring-2 focus:ring-blue-200 focus:border-transparent"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16 text-center px-5">
              <div>
                <Users size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">
                  {customers.filter(c => c.phone).length === 0
                    ? 'Ningún cliente tiene teléfono registrado'
                    : 'No hay clientes en este segmento'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {filtered.map(c => {
                const sent = sentIds.has(c.id)
                return (
                  <div key={c.id} className={cn(
                    'flex items-start gap-3 px-4 py-3 transition-colors',
                    sent ? 'bg-green-50' : 'hover:bg-gray-50'
                  )}>
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
                                    flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
                      {c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        {sent && <Check size={12} className="text-green-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                      {showPreview && (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 bg-gray-50 rounded-lg px-2 py-1">
                          {personalize(c.name)}
                        </p>
                      )}
                    </div>

                    <a
                      href={waUrl(c.phone!, c.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(c.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0',
                        'transition-all text-white',
                        sent ? 'bg-green-500' : 'bg-[#25D366] hover:bg-[#1ebe5d]'
                      )}
                    >
                      {sent
                        ? <><Check size={12} /> Enviado</>
                        : <><Send size={12} /> Enviar</>}
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <p className="text-xs text-gray-400 text-center">
                {sentIds.size} de {filtered.length} enviados en esta sesión
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
