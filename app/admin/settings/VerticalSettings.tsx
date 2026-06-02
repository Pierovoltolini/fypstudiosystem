// app/admin/settings/VerticalSettings.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getVertical, getVerticalGroup, type VerticalType } from '@/lib/verticals'
import {
  Clock, Truck, Store, Check, Loader2,
  Building2, MapPin, Scissors, Sparkles, ChevronDown,
  Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeliveryZone } from '@/types'

const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const F = 'bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300 transition-all w-full'
const L = 'block text-[10px] tracking-[0.15em] uppercase font-bold text-blue-600 mb-2'

interface Props {
  businessId: string
  verticalType: VerticalType
  business: Record<string, unknown>
  hours: { day_of_week: number; is_open: boolean; open_time: string; close_time: string }[]
  branches: { id: string; name: string; address?: string; phone?: string; is_main: boolean }[]
  staff: { id: string; name: string; role: string }[]
}

export default function VerticalSettings({ businessId, verticalType, business, hours: initHours, branches: initBranches, staff: initStaff }: Props) {
  const vertical = getVertical(verticalType)
  const group    = getVerticalGroup(verticalType)

  return (
    <div className="mb-12 bg-gradient-to-br from-blue-50/70 to-sky-50/50 rounded-2xl p-6 border border-blue-100/80 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-sky-400 shrink-0" />
        <span className="text-[11px] tracking-[0.2em] uppercase font-black text-blue-700 shrink-0">
          Configuración {vertical.label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
        <span className="text-xl shrink-0">{vertical.emoji}</span>
      </div>

      <div className="divide-y divide-blue-100/60 mt-2">
        {/* Gastronomía — delivery, horarios */}
        {(group === 'gastro') && (
          <FoodConfig businessId={businessId} business={business} hours={initHours} />
        )}
        {/* Servicios — horarios, staff, sucursales */}
        {(group === 'servicios') && (
          <BarberConfig businessId={businessId} business={business} hours={initHours}
            branches={initBranches} staff={initStaff} verticalType={verticalType} />
        )}
        {/* Comercio y Mercados — delivery, horarios */}
        {(group === 'comercio' || group === 'mercados') && verticalType !== 'real_estate' && (
          <FoodConfig businessId={businessId} business={business} hours={initHours} />
        )}
        {/* Real estate / servicios generales — solo contacto */}
        {(verticalType === 'real_estate' || verticalType === 'services') && (
          <GeneralConfig businessId={businessId} business={business} />
        )}
      </div>
    </div>
  )
}

/* ── Sección colapsable ── */
function Section({ title, icon: Icon, children, open: initOpen = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; open?: boolean
}) {
  const [open, setOpen] = useState(initOpen)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left hover:opacity-80 transition-opacity group">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center transition-all',
            open ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'bg-blue-50 text-blue-400'
          )}>
            <Icon size={13} />
          </div>
          <span className={cn(
            'text-[10px] tracking-[0.15em] uppercase font-black transition-colors',
            open ? 'text-blue-700' : 'text-gray-600'
          )}>
            {title}
          </span>
        </div>
        <ChevronDown size={13} className={cn(
          'transition-transform duration-200',
          open ? 'rotate-180 text-blue-500' : 'text-gray-300'
        )} />
      </button>
      {open && <div className="pb-7 space-y-5 animate-fade-up">{children}</div>}
    </div>
  )
}

/* ── Botón guardar ── */
function SaveBtn({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-500
                 text-white px-6 py-2.5 rounded-xl
                 text-[10px] font-black tracking-[0.15em] uppercase
                 shadow-md shadow-blue-200/70 hover:shadow-lg hover:shadow-blue-300/60
                 hover:from-blue-700 hover:to-sky-600
                 transition-all disabled:opacity-40 active:scale-[0.97]">
      {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
      {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar'}
    </button>
  )
}

/* ── Toggle ── */
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-4 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!value)}
        className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0',
          value ? 'bg-blue-500' : 'bg-gray-200')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          value ? 'left-4' : 'left-0.5')} />
      </button>
      <span className="text-sm text-gray-700 font-light">{label}</span>
    </label>
  )
}

// ════════════ FOOD CONFIG ════════════
function FoodConfig({ businessId, business, hours: initHours }: {
  businessId: string; business: Record<string, unknown>
  hours: { day_of_week: number; is_open: boolean; open_time: string; close_time: string }[]
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [deliveryEnabled, setDeliveryEnabled] = useState((business.delivery_enabled as boolean) ?? true)
  const [pickupEnabled,   setPickupEnabled]   = useState((business.pickup_enabled as boolean) ?? true)
  const [deliveryFee,     setDeliveryFee]     = useState(String(business.delivery_fee ?? '0'))
  const [minOrder,        setMinOrder]        = useState(String(business.min_order ?? '0'))
  const [estimatedTime,   setEstimatedTime]   = useState((business.estimated_time as string) ?? '30-45 min')
  const [zones,           setZones]           = useState<DeliveryZone[]>(
    (business.delivery_zones as DeliveryZone[] | null) ?? []
  )
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneFee,  setNewZoneFee]  = useState('0')

  const [hours, setHours] = useState(
    DAYS_SHORT.map((_, i) => initHours.find(h => h.day_of_week === i) ?? {
      day_of_week: i, is_open: i > 0 && i < 6, open_time: '11:00', close_time: '23:00'
    })
  )
  const [savingDay, setSavingDay] = useState<number | null>(null)

  function addZone() {
    const name = newZoneName.trim()
    if (!name) return
    const zone: DeliveryZone = {
      id: `zone_${Date.now()}`,
      name,
      fee: parseFloat(newZoneFee) || 0,
    }
    setZones(prev => [...prev, zone])
    setNewZoneName('')
    setNewZoneFee('0')
  }

  function removeZone(id: string) {
    setZones(prev => prev.filter(z => z.id !== id))
  }

  async function saveDelivery() {
    setSaving(true)
    await fetch('/api/business/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_enabled: deliveryEnabled,
        pickup_enabled:   pickupEnabled,
        delivery_fee:     parseFloat(deliveryFee) || 0,
        min_order:        parseFloat(minOrder) || 0,
        estimated_time:   estimatedTime,
        delivery_zones:   zones,
      }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  async function saveDay(h: typeof hours[0]) {
    setSavingDay(h.day_of_week)
    await supabase.from('business_hours').upsert({
      business_id: businessId, day_of_week: h.day_of_week,
      is_open: h.is_open, open_time: h.open_time, close_time: h.close_time,
    }, { onConflict: 'business_id,day_of_week' })
    setSavingDay(null)
  }

  function updateHour(day: number, field: string, value: unknown) {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h))
  }

  return (
    <>
      <Section title="Delivery & Retiro" icon={Truck} open>
        <div className="space-y-5">
          <Toggle value={deliveryEnabled} onChange={setDeliveryEnabled} label="Delivery activado" />
          <Toggle value={pickupEnabled}   onChange={setPickupEnabled}   label="Retiro en local" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={L}>Costo delivery</label>
              <input type="number" min="0" step="10" value={deliveryFee}
                onChange={e => setDeliveryFee(e.target.value)}
                placeholder="0 = gratis" className={F} />
            </div>
            <div>
              <label className={L}>Pedido mínimo</label>
              <input type="number" min="0" step="10" value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                placeholder="Sin mínimo" className={F} />
            </div>
          </div>

          <div>
            <label className={L}>Tiempo estimado</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['15-25 min','20-35 min','30-45 min','45-60 min','1 hora'].map(t => (
                <button key={t} type="button" onClick={() => setEstimatedTime(t)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-black tracking-[0.08em] uppercase transition-all rounded-lg',
                    estimatedTime === t
                      ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-200'
                      : 'border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-500'
                  )}>
                  {t}
                </button>
              ))}
              <input type="text" value={estimatedTime}
                onChange={e => setEstimatedTime(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-28 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white" />
            </div>
          </div>

          {/* Delivery zones */}
          <div>
            <label className={L}>Zonas de delivery</label>
            <p className="text-[11px] text-gray-400 mb-3 -mt-1">
              Definí zonas con tarifas distintas. El cliente elegirá su zona al hacer el pedido.
            </p>

            {zones.length > 0 && (
              <div className="space-y-2 mb-3">
                {zones.map(z => (
                  <div key={z.id}
                    className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{z.name}</p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 shrink-0">
                      {z.fee === 0 ? 'Gratis' : `$${z.fee}`}
                    </span>
                    <button type="button" onClick={() => removeZone(z.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-300
                                 hover:bg-red-50 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="text" value={newZoneName}
                onChange={e => setNewZoneName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addZone()}
                placeholder="Nombre de la zona"
                className={F + ' flex-1'} />
              <input type="number" min="0" step="10" value={newZoneFee}
                onChange={e => setNewZoneFee(e.target.value)}
                placeholder="Tarifa"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none
                           focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white w-24" />
              <button type="button" onClick={addZone} disabled={!newZoneName.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500
                           text-white disabled:opacity-40 shadow-md shadow-blue-200 hover:shadow-lg transition-all shrink-0">
                <Plus size={16} />
              </button>
            </div>
            {zones.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-2">
                Si hay zonas, el campo "Costo delivery" global queda como respaldo.
              </p>
            )}
          </div>

          <SaveBtn onClick={saveDelivery} saving={saving} saved={saved} />
        </div>
      </Section>

      <Section title="Horarios de atención" icon={Clock}>
        <div className="space-y-2.5">
          {hours.map(h => (
            <div key={h.day_of_week} className="flex items-center gap-3">
              <button onClick={() => updateHour(h.day_of_week, 'is_open', !h.is_open)}
                className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0',
                  h.is_open ? 'bg-blue-500' : 'bg-gray-200')}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  h.is_open ? 'left-4' : 'left-0.5')} />
              </button>
              <p className={cn('text-xs font-black w-8 shrink-0 tracking-wide',
                h.is_open ? 'text-blue-700' : 'text-gray-400')}>
                {DAYS_SHORT[h.day_of_week]}
              </p>
              {h.is_open ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={h.open_time}
                    onChange={e => updateHour(h.day_of_week, 'open_time', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white" />
                  <span className="text-xs text-gray-300 shrink-0">—</span>
                  <input type="time" value={h.close_time}
                    onChange={e => updateHour(h.day_of_week, 'close_time', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white" />
                </div>
              ) : (
                <p className="text-xs text-gray-300 flex-1 tracking-wide">Cerrado</p>
              )}
              <button onClick={() => saveDay(h)} disabled={savingDay === h.day_of_week}
                className="flex h-7 w-7 items-center justify-center bg-blue-500 text-white rounded-lg shrink-0 disabled:opacity-40 hover:bg-blue-600 transition-colors shadow-sm">
                {savingDay === h.day_of_week
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Check size={11} />}
              </button>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

// ════════════ BARBER CONFIG ════════════
function BarberConfig({ businessId, business, hours: initHours, branches: initBranches, staff: initStaff, verticalType }: {
  businessId: string; business: Record<string, unknown>
  hours: { day_of_week: number; is_open: boolean; open_time: string; close_time: string }[]
  branches: { id: string; name: string; address?: string; phone?: string; is_main: boolean }[]
  staff: { id: string; name: string; role: string }[]
  verticalType: string
}) {
  const supabase = createClient()
  const [hours,    setHours]    = useState(DAYS_SHORT.map((_, i) =>
    initHours.find(h => h.day_of_week === i) ?? { day_of_week: i, is_open: i>0&&i<6, open_time:'09:00', close_time:'19:00' }
  ))
  const [branches, setBranches] = useState(initBranches)
  const [staff,    setStaff]    = useState(initStaff)
  const [savingDay, setSavingDay] = useState<number|null>(null)
  const [saving,    setSaving]   = useState(false)

  const [newStaffName,  setNewStaffName]  = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchAddr, setNewBranchAddr] = useState('')

  const isBarber = verticalType === 'barbershop'

  async function saveDay(h: typeof hours[0]) {
    setSavingDay(h.day_of_week)
    await supabase.from('business_hours').upsert({
      business_id: businessId, day_of_week: h.day_of_week,
      is_open: h.is_open, open_time: h.open_time, close_time: h.close_time,
    }, { onConflict: 'business_id,day_of_week' })
    setSavingDay(null)
  }

  function updateHour(day: number, field: string, value: unknown) {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h))
  }

  async function addStaff() {
    if (!newStaffName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('staff').insert({
      business_id: businessId, name: newStaffName.trim(),
      role: isBarber ? 'barber' : 'esteticista',
      color: '#1565FF', active: true,
    }).select('id,name,role').single()
    if (data) { setStaff(prev => [...prev, data]); setNewStaffName('') }
    setSaving(false)
  }

  async function addBranch() {
    if (!newBranchName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('branches').insert({
      business_id: businessId, name: newBranchName.trim(),
      address: newBranchAddr.trim() || null, is_main: false, active: true,
    }).select('id,name,address,phone,is_main').single()
    if (data) { setBranches(prev => [...prev, data]); setNewBranchName(''); setNewBranchAddr('') }
    setSaving(false)
  }

  return (
    <>
      {/* Horarios */}
      <Section title="Horarios de atención" icon={Clock} open>
        <div className="space-y-2.5">
          {hours.map(h => (
            <div key={h.day_of_week} className="flex items-center gap-3">
              <button onClick={() => updateHour(h.day_of_week, 'is_open', !h.is_open)}
                className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0',
                  h.is_open ? 'bg-blue-500' : 'bg-gray-200')}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  h.is_open ? 'left-4' : 'left-0.5')} />
              </button>
              <p className={cn('text-xs font-black w-8 shrink-0 tracking-wide',
                h.is_open ? 'text-blue-700' : 'text-gray-400')}>
                {DAYS_SHORT[h.day_of_week]}
              </p>
              {h.is_open ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={h.open_time}
                    onChange={e => updateHour(h.day_of_week,'open_time',e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white" />
                  <span className="text-xs text-gray-300 shrink-0">—</span>
                  <input type="time" value={h.close_time}
                    onChange={e => updateHour(h.day_of_week,'close_time',e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white" />
                </div>
              ) : (
                <p className="text-xs text-gray-300 flex-1 tracking-wide">Cerrado</p>
              )}
              <button onClick={() => saveDay(h)} disabled={savingDay===h.day_of_week}
                className="flex h-7 w-7 items-center justify-center bg-blue-500 text-white rounded-lg shrink-0 disabled:opacity-40 hover:bg-blue-600 transition-colors shadow-sm">
                {savingDay===h.day_of_week ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Staff */}
      <Section title={isBarber ? 'Barberos' : 'Profesionales'} icon={isBarber ? Scissors : Sparkles}>
        <div className="space-y-3">
          {staff.length === 0 && (
            <p className="text-xs text-gray-400 tracking-wide">
              Sin {isBarber ? 'barberos' : 'profesionales'} registrados
            </p>
          )}
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-md shadow-blue-200">
                {s.name.slice(0,1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-[10px] tracking-[0.08em] uppercase text-blue-400 capitalize mt-0.5 font-bold">{s.role}</p>
              </div>
            </div>
          ))}

          {/* Agregar */}
          <div className="flex items-center gap-2 pt-1">
            <input type="text" value={newStaffName}
              onChange={e => setNewStaffName(e.target.value)}
              placeholder={`Nombre del ${isBarber ? 'barbero' : 'profesional'}`}
              className={F + ' flex-1'}
              onKeyDown={e => e.key==='Enter' && addStaff()} />
            <button onClick={addStaff} disabled={saving || !newStaffName.trim()}
              className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-blue-600 to-sky-500
                         text-white rounded-xl disabled:opacity-40 shadow-md shadow-blue-200 hover:shadow-lg transition-all shrink-0">
              {saving ? <Loader2 size={13} className="animate-spin"/> : <span className="text-lg leading-none font-black">+</span>}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Gestión completa en{' '}
            <a href="/admin/barbershop" className="text-blue-500 font-semibold hover:text-blue-700 transition-colors underline underline-offset-2">
              Agenda → {isBarber ? 'Barberos' : 'Equipo'}
            </a>
          </p>
        </div>
      </Section>

      {/* Sucursales */}
      <Section title="Sucursales" icon={Building2}>
        <div className="space-y-3">
          {branches.map(b => (
            <div key={b.id} className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                {b.is_main && (
                  <span className="text-[9px] tracking-[0.15em] uppercase font-black text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
                    Principal
                  </span>
                )}
              </div>
              {b.address && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin size={10} /> {b.address}
                </p>
              )}
            </div>
          ))}

          <div className="space-y-3 pt-1">
            <input type="text" value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="Nombre de la sucursal" className={F} />
            <input type="text" value={newBranchAddr}
              onChange={e => setNewBranchAddr(e.target.value)}
              placeholder="Dirección (opcional)" className={F} />
            <button onClick={addBranch} disabled={saving || !newBranchName.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-500 text-white px-6 py-2.5
                         text-[10px] font-black tracking-[0.12em] uppercase rounded-xl disabled:opacity-40
                         shadow-md shadow-blue-200 hover:shadow-lg transition-all">
              {saving && <Loader2 size={11} className="animate-spin" />}
              Agregar sucursal
            </button>
          </div>
        </div>
      </Section>

      {/* Duración turnos */}
      <Section title="Duración de turnos" icon={Clock}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[15,20,30,45,60,90].map(m => (
              <button key={m} type="button"
                className="border border-blue-200 rounded-lg px-4 py-2 text-xs font-bold text-blue-500
                           hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all">
                {m} min
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Ajustá la duración por servicio en{' '}
            <a href="/admin/products" className="text-blue-500 font-semibold hover:text-blue-700 transition-colors underline underline-offset-2">
              Servicios
            </a>
          </p>
        </div>
      </Section>
    </>
  )
}

// ════════════ FASHION CONFIG ════════════
function FashionConfig({ businessId, business }: { businessId: string; business: Record<string, unknown> }) {
  void businessId
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [allowPickup,   setAllowPickup]   = useState((business.pickup_enabled as boolean) ?? true)
  const [allowDelivery, setAllowDelivery] = useState((business.delivery_enabled as boolean) ?? true)

  async function save() {
    setSaving(true)
    await fetch('/api/business/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup_enabled: allowPickup, delivery_enabled: allowDelivery }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  return (
    <Section title="Envíos y retiro" icon={Truck} open>
      <div className="space-y-5">
        <Toggle value={allowDelivery} onChange={setAllowDelivery} label="Envíos a domicilio" />
        <Toggle value={allowPickup}   onChange={setAllowPickup}   label="Retiro en local / showroom" />
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Gestioná talles y variantes en cada producto desde{' '}
          <a href="/admin/products" className="text-blue-500 font-semibold hover:text-blue-700 underline underline-offset-2">Productos</a>
        </p>
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </div>
    </Section>
  )
}

// ════════════ GENERAL / SERVICES / REAL_ESTATE ════════════
function GeneralConfig({ businessId, business }: { businessId: string; business: Record<string, unknown> }) {
  void businessId
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [deliveryEnabled, setDeliveryEnabled] = useState((business.delivery_enabled as boolean) ?? true)
  const [pickupEnabled,   setPickupEnabled]   = useState((business.pickup_enabled as boolean) ?? true)

  async function save() {
    setSaving(true)
    await fetch('/api/business/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_enabled: deliveryEnabled, pickup_enabled: pickupEnabled }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false)
  }

  return (
    <Section title="Opciones de contacto" icon={Store} open>
      <div className="space-y-5">
        <Toggle value={deliveryEnabled} onChange={setDeliveryEnabled} label="Delivery / visita a domicilio" />
        <Toggle value={pickupEnabled}   onChange={setPickupEnabled}   label="Atención en local / showroom" />
        <p className="text-[11px] text-gray-400">
          Cambiá el rubro para activar módulos específicos.
        </p>
        <SaveBtn onClick={save} saving={saving} saved={saved} />
      </div>
    </Section>
  )
}
