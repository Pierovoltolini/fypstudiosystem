// components/barbershop/BookingFlow.tsx — Calendario visual verde/rojo
'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Mail, User, Phone, MapPin, Scissors, Calendar,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Business, Staff, Product, Branch } from '@/types'

interface Props {
  business: Business
  staff: (Staff & { schedules?: unknown[] })[]
  services: Product[]
  branches: Branch[]
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_HEADER = ['L','M','X','J','V','S','D']
const DAYS_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getSlots(open='09:00', close='19:00', step=30) {
  const slots: string[] = []
  const [sh,sm] = open.split(':').map(Number)
  const [eh,em] = close.split(':').map(Number)
  let cur = sh*60+sm
  while (cur < eh*60+em) {
    slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`)
    cur += step
  }
  return slots
}

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  // Semana empieza lunes: 0=Dom→6, 1=Lun→0 ...
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month+1, 0).getDate()
  return { startOffset, daysInMonth }
}

export default function BookingFlow({ business, staff, services, branches }: Props) {
  const router = useRouter()
  const color    = business.primary_color ?? '#1565FF'
  const currency = business.currency ?? 'UYU'

  const [selectedBranch,  setSelectedBranch]  = useState<Branch|null>(branches[0]??null)
  const [selectedService, setSelectedService] = useState<Product|null>(services[0]??null)
  const [selectedStaff,   setSelectedStaff]   = useState<Staff|null>(staff[0]??null)
  const [selectedDate,    setSelectedDate]    = useState<Date|null>(null)
  const [selectedTime,    setSelectedTime]    = useState<string|null>(null)

  const today = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d }, [])
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Disponibilidad del mes cargada desde la API
  const [booked,  setBooked]  = useState<Record<string,string[]>>({})
  const [blocked, setBlocked] = useState<Record<string,{allDay:boolean;slots:string[];reason?:string}>>({})
  const [loading, setLoading] = useState(false)

  const ALL_SLOTS = useMemo(() => getSlots('09:00','19:00',30), [])

  useEffect(() => {
    setLoading(true)
    const from = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`
    const lastDay = new Date(viewYear, viewMonth+1, 0).getDate()
    const to = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${lastDay}`
    const params = new URLSearchParams({ from, to })
    if (selectedStaff)   params.set('staffId',    selectedStaff.id)
    if (business.id)     params.set('businessId', business.id)

    fetch(`/api/bookings/availability?${params}`)
      .then(r=>r.json())
      .then(d=>{ setBooked(d.booked??{}); setBlocked(d.blocked??{}); setLoading(false) })
      .catch(()=>setLoading(false))
  }, [viewYear, viewMonth, selectedStaff, business.id])

  function dateKey(year:number, month:number, day:number) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  function isDayAvailable(day:number) {
    const d = new Date(viewYear, viewMonth, day)
    if (d < today) return false
    const dk = dateKey(viewYear,viewMonth,day)
    if (blocked[dk]?.allDay) return false
    const bookedCount  = booked[dk]?.length ?? 0
    const blockedCount = blocked[dk]?.slots?.length ?? 0
    return (bookedCount + blockedCount) < ALL_SLOTS.length
  }

  function isDayPast(day:number) {
    return new Date(viewYear,viewMonth,day) < today
  }

  function isToday(day:number) {
    return today.getDate()===day && today.getMonth()===viewMonth && today.getFullYear()===viewYear
  }

  function isSelected(day:number) {
    return selectedDate?.getDate()===day && selectedDate?.getMonth()===viewMonth && selectedDate?.getFullYear()===viewYear
  }

  const { startOffset, daysInMonth } = buildCalendar(viewYear, viewMonth)

  // Slots del día seleccionado
  const selectedDayKey = selectedDate ? dateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) : null
  const bookedToday   = selectedDayKey ? (booked[selectedDayKey]  ?? []) : []
  const blockedToday  = selectedDayKey ? (blocked[selectedDayKey]?.slots ?? []) : []
  const blockedAllDay = selectedDayKey ? (blocked[selectedDayKey]?.allDay ?? false) : false

  function isSlotAvailable(slot:string) {
    if (bookedToday.includes(slot))  return false
    if (blockedToday.includes(slot)) return false
    // Si el día es hoy, no mostrar slots pasados
    if (selectedDate && isToday(selectedDate.getDate())) {
      const now = new Date().toTimeString().slice(0,5)
      if (slot <= now) return false
    }
    return true
  }

  // Pasos
  const [step, setStep] = useState<'calendar'|'confirm'>('calendar')
  const [customerName,  setCustomerName]  = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes,         setNotes]         = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [done,          setDone]          = useState(false)
  const [error,         setError]         = useState<string|null>(null)

  const duration = 30
  const endTime = selectedTime ? (() => {
    const [h,m] = selectedTime.split(':').map(Number)
    const e = h*60+m+duration
    return `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`
  })() : ''

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime || !customerName.trim() || !customerPhone.trim()) return
    if (!customerEmail.trim()) { setError('El email es obligatorio para confirmar el turno'); return }
    setSubmitting(true); setError(null)
    try {
      const dk = dateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId:    business.id,
          branchId:      selectedBranch?.id  ?? null,
          staffId:       selectedStaff?.id   ?? null,
          productId:     selectedService?.id ?? null,
          customerName:  customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          date:          dk,
          startTime:     selectedTime,
          endTime,
          durationMin:   duration,
          price:         selectedService?.price ?? null,
          notes:         notes.trim() || null,
          source:        'store',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')

      // Enviar emails de confirmación
      await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: data.bookingId }),
      })

      setDone(true)
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setSubmitting(false)
    }
  }

  // ── PANTALLA ÉXITO ──
  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F9FC]">
      <div className="text-center max-w-sm w-full animate-fade-in">
        <div className="h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: `${color}15` }}>
          <Check size={44} style={{ color }} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">¡Turno confirmado!</h1>
        <p className="text-gray-500 mb-2">
          {selectedDate?.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})} a las {selectedTime}hs
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-left space-y-2 mb-6 shadow-sm">
          {selectedService && <p className="text-sm"><span className="text-gray-400">Servicio:</span> <strong>{selectedService.name}</strong></p>}
          {selectedStaff   && <p className="text-sm"><span className="text-gray-400">Peluquero:</span> <strong>{selectedStaff.name}</strong></p>}
          {selectedBranch  && <p className="text-sm"><span className="text-gray-400">Sucursal:</span> <strong>{selectedBranch.name}</strong></p>}
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 mb-5">
          <p className="text-sm text-blue-800 font-semibold flex items-center gap-2 justify-center">
            <Mail size={15}/> Email de confirmación enviado
          </p>
          <p className="text-xs text-blue-600 mt-0.5">Revisá tu bandeja de entrada</p>
        </div>
        <button onClick={() => router.push(`/store/${business.slug}`)}
          className="w-full rounded-2xl py-3.5 text-sm font-bold text-white"
          style={{ background: color }}>
          Volver a la tienda
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => step==='confirm' ? setStep('calendar') : router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
            <ChevronLeft size={20}/>
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            {business.logo_url
              ? <img src={business.logo_url} alt="" className="h-8 w-8 rounded-xl object-cover"/>
              : <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{background:color}}>{business.name.slice(0,2).toUpperCase()}</div>
            }
            <div>
              <p className="font-bold text-gray-900 text-sm">{business.name}</p>
              <p className="text-[10px] text-gray-400">
                {step==='calendar' ? 'Elegí fecha y hora' : 'Confirmá tu reserva'}
              </p>
            </div>
          </div>
        </div>
        {/* Progreso */}
        <div className="h-1 bg-gray-100">
          <div className="h-full transition-all duration-500"
            style={{width:step==='calendar'?'50%':'100%', background:color}}/>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">

        {/* ── PASO CALENDAR ── */}
        {step === 'calendar' && (
          <div className="space-y-5 animate-fade-in">

            {/* Selectores */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {branches.length > 1 && (
                <StoreSelect label="Lugar" icon={MapPin}
                  value={selectedBranch?.name ?? ''}
                  options={branches.map(b=>({id:b.id,label:b.name}))}
                  onSelect={id=>setSelectedBranch(branches.find(b=>b.id===id)??null)}/>
              )}
              {services.length > 0 && (
                <StoreSelect label="Servicio" icon={Scissors}
                  value={selectedService?.name ?? ''}
                  options={services.map(s=>({id:s.id,label:`${s.name}${s.price?` · ${formatPrice(s.price,currency)}`:''}`}))}
                  onSelect={id=>setSelectedService(services.find(s=>s.id===id)??null)}
                  hasBorder={branches.length > 1}/>
              )}
              {staff.length > 0 && (
                <StoreSelect label="Peluquero" icon={User}
                  value={selectedStaff?.name ?? ''}
                  options={staff.map(s=>({id:s.id,label:s.name}))}
                  onSelect={id=>setSelectedStaff(staff.find(s=>s.id===id)??null)}
                  hasBorder={services.length > 0 || branches.length > 1}/>
              )}
            </div>

            {/* Calendario */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header del mes */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button onClick={() => {
                  if (viewMonth===0) { setViewYear(y=>y-1); setViewMonth(11) }
                  else setViewMonth(m=>m-1)
                  setSelectedDate(null); setSelectedTime(null)
                }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400
                             hover:bg-gray-100 transition-colors disabled:opacity-30"
                  disabled={viewYear===today.getFullYear()&&viewMonth===today.getMonth()}>
                  <ChevronLeft size={18}/>
                </button>

                <p className="font-bold text-gray-900 text-base">
                  {MONTHS_ES[viewMonth]} {viewYear}
                </p>

                <button onClick={() => {
                  if (viewMonth===11) { setViewYear(y=>y+1); setViewMonth(0) }
                  else setViewMonth(m=>m+1)
                  setSelectedDate(null); setSelectedTime(null)
                }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-colors"
                  style={{background:color}}>
                  <ChevronRight size={18}/>
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 px-4 py-2">
                {DAYS_HEADER.map(d=>(
                  <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Grid de días */}
              <div className="grid grid-cols-7 gap-1.5 px-4 pb-4">
                {/* Offset */}
                {Array.from({length:startOffset}).map((_,i)=><div key={`e${i}`}/>)}

                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const past      = isDayPast(day)
                  const todayDay  = isToday(day)
                  const sel       = isSelected(day)
                  const available = !past && isDayAvailable(day)
                  const blockedD  = !past && (blocked[dateKey(viewYear,viewMonth,day)]?.allDay ?? false)

                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (!available) return
                        setSelectedDate(new Date(viewYear,viewMonth,day))
                        setSelectedTime(null)
                      }}
                      disabled={!available}
                      className={cn(
                        'aspect-square rounded-xl text-sm font-bold transition-all flex items-center justify-center',
                        'active:scale-95',
                        past || blockedD
                          ? 'text-gray-300 cursor-not-allowed'
                          : sel
                            ? 'text-white shadow-md ring-2 ring-offset-1'
                            : available
                              ? 'text-white hover:opacity-85 cursor-pointer'
                              : 'text-gray-400 cursor-not-allowed'
                      )}
                      style={
                        sel         ? { background:color } :
                        available   ? { background:'#16a34a' } :
                        blockedD    ? { background:'#fee2e2', color:'#dc2626' } :
                        past        ? {} :
                        { background:'#fca5a5', color:'#991b1b' }
                      }
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-5 px-5 pb-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded bg-green-600"/>
                  <span className="text-xs text-gray-500">Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded bg-red-400"/>
                  <span className="text-xs text-gray-500">Ocupado / Cerrado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded ring-2 ring-offset-1" style={{background:color, '--tw-ring-color':color} as React.CSSProperties}/>
                  <span className="text-xs text-gray-500">Seleccionado</span>
                </div>
              </div>

              {/* Slots del día seleccionado */}
              {selectedDate && !blockedAllDay && (
                <div className="border-t border-gray-100 px-4 pb-5 pt-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Horarios disponibles —{' '}
                    {selectedDate.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {ALL_SLOTS.map(slot=>{
                      const avail = isSlotAvailable(slot)
                      const sel   = selectedTime === slot
                      return (
                        <button key={slot} onClick={()=>avail&&setSelectedTime(slot)}
                          disabled={!avail}
                          className={cn(
                            'py-2.5 rounded-xl text-xs font-bold transition-all border-2',
                            avail
                              ? sel
                                ? 'text-white border-transparent shadow-md'
                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through'
                          )}
                          style={sel?{background:color,borderColor:color}:{}}>
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedDate && blockedAllDay && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-red-700">
                      🚫 {blocked[selectedDayKey!]?.reason ?? 'Cerrado este día'}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">Elegí otro día</p>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen selección */}
            {selectedDate && selectedTime && (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {selectedDate.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {selectedTime}hs — {endTime}hs
                      {selectedService && ` · ${selectedService.name}`}
                    </p>
                  </div>
                  {selectedService?.price && (
                    <p className="font-black text-lg" style={{color}}>
                      {formatPrice(selectedService.price,currency)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PASO CONFIRMAR ── */}
        {step === 'confirm' && (
          <div className="space-y-4 animate-fade-in">
            {/* Resumen */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Resumen</p>
              <div className="space-y-2.5">
                {[
                  ['📅 Fecha', selectedDate?.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})],
                  ['🕐 Hora',  `${selectedTime}hs — ${endTime}hs`],
                  selectedService && ['✂️ Servicio', selectedService.name],
                  selectedStaff   && ['👤 Peluquero', selectedStaff.name],
                  selectedBranch  && ['📍 Sucursal', selectedBranch.name],
                  selectedService?.price && ['💰 Precio', formatPrice(selectedService.price,currency)],
                ].filter((r): r is (string | undefined)[] => !!r).map(([k,v])=>(
                  <div key={k as string} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k as string}</span>
                    <span className="font-semibold text-gray-900">{v as string}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Tus datos</p>
              <form onSubmit={handleConfirm} className="space-y-3" id="confirm-form">
                <div>
                  <label className="field-label text-xs">Nombre <span className="text-red-400">*</span></label>
                  <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)}
                    placeholder="Tu nombre completo" className="input-base"/>
                </div>
                <div>
                  <label className="field-label text-xs">Teléfono <span className="text-red-400">*</span></label>
                  <input type="tel" required value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                    placeholder="099 123 456" className="input-base" inputMode="numeric"/>
                </div>
                <div>
                  <label className="field-label text-xs">
                    Email <span className="text-red-400">*</span>
                    <span className="text-gray-400 font-normal ml-1">— Recibirás la confirmación aquí</span>
                  </label>
                  <input type="email" required value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}
                    placeholder="tu@email.com" className="input-base"/>
                </div>
                <div>
                  <label className="field-label text-xs">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
                    placeholder="Preferencias, aclaraciones..." className="input-base resize-none"/>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Info email */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
                  <Mail size={14} className="text-blue-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Confirmación por email</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">
                      Recibirás un email con los detalles del turno. La barbería también recibirá una notificación.
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Botón sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 p-4 z-10">
        <div className="max-w-2xl mx-auto">
          {step === 'calendar' ? (
            <button
              onClick={() => setStep('confirm')}
              disabled={!selectedDate || !selectedTime}
              className="w-full flex items-center justify-between rounded-2xl px-6 py-4
                         text-sm font-bold text-white disabled:opacity-30 transition-all active:scale-[0.98]"
              style={{background:color}}>
              <span>Continuar</span>
              <div className="flex items-center gap-2">
                {selectedTime && <span className="opacity-80">{selectedTime}hs</span>}
                <ChevronRight size={16}/>
              </div>
            </button>
          ) : (
            <button
              type="submit"
              form="confirm-form"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 rounded-2xl py-4
                         text-sm font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{background:color}}>
              {submitting ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18}/>}
              {submitting ? 'Confirmando...' : 'Confirmar y recibir por email'}
            </button>
          )}
          {step === 'confirm' && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Recibirás un email de confirmación al instante
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Select row ────────────────────────────────────────────────
function StoreSelect({ label, icon: Icon, value, options, onSelect, hasBorder=false }: {
  label:string; icon:React.ElementType; value:string
  options:{id:string;label:string}[]; onSelect:(id:string)=>void; hasBorder?:boolean
}) {
  return (
    <div className={cn('flex items-center gap-4 px-5 py-3.5', hasBorder && 'border-t border-gray-100')}>
      <div className="flex items-center gap-2.5 shrink-0 w-24">
        <Icon size={14} className="text-gray-400 shrink-0"/>
        <p className="text-sm font-bold text-gray-700">{label}</p>
      </div>
      <select onChange={e=>onSelect(e.target.value)}
        className="flex-1 bg-transparent text-gray-800 text-sm focus:outline-none cursor-pointer
                   appearance-none font-medium">
        {options.map(o=>(
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <ChevronRight size={14} className="text-gray-400 shrink-0"/>
    </div>
  )
}
