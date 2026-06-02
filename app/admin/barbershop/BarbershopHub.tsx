// app/admin/barbershop/BarbershopHub.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Users, Clock, MapPin, Plus, ChevronLeft, ChevronRight,
  Check, X, Phone, MessageCircle, Edit2, Trash2, Loader2,
  AlertCircle, MoreHorizontal, Building2, Sparkles, Scissors, TrendingUp, Wrench,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import type { Booking, Staff, Branch, Product, BookingStatus } from '@/types'

interface Props {
  bookings: Booking[]; staff: Staff[]; branches: Branch[]; services: Product[]
}

function getStaffRoles(sub: string | null | undefined): { value: string; label: string }[] {
  switch (sub) {
    case 'barberia':    return [{ value: 'barber',       label: 'Barbero'       }, { value: 'stylist',      label: 'Estilista'     }, { value: 'recepcionista', label: 'Recepcionista' }]
    case 'peluqueria':  return [{ value: 'estilista',    label: 'Estilista'     }, { value: 'colorista',    label: 'Colorista'     }, { value: 'recepcionista', label: 'Recepcionista' }]
    case 'estetica':    return [{ value: 'esteticista',  label: 'Esteticista'   }, { value: 'manicurista',  label: 'Manicurista'   }, { value: 'masajista',     label: 'Masajista'     }, { value: 'recepcionista', label: 'Recepcionista' }]
    case 'veterinaria': return [{ value: 'veterinario',  label: 'Veterinario/a' }, { value: 'asistente',    label: 'Asistente'     }, { value: 'recepcionista', label: 'Recepcionista' }]
    case 'taller':      return [{ value: 'mecanico',     label: 'Mecánico'      }, { value: 'tecnico',      label: 'Técnico'       }, { value: 'asistente',     label: 'Asistente'     }]
    case 'salud':       return [{ value: 'profesional',  label: 'Profesional'   }, { value: 'asistente',    label: 'Asistente'     }, { value: 'recepcionista', label: 'Recepcionista' }]
    default:            return [{ value: 'profesional',  label: 'Profesional'   }, { value: 'asistente',    label: 'Asistente'     }, { value: 'recepcionista', label: 'Recepcionista' }]
  }
}

type Tab = 'agenda' | 'staff' | 'branches'

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_CFG: Record<BookingStatus, { label:string; bg:string; text:string; dot:string }> = {
  pending:   { label:'Pendiente',   bg:'bg-amber-50',  text:'text-amber-700',  dot:'bg-amber-400'  },
  confirmed: { label:'Confirmado',  bg:'bg-blue-50',   text:'text-blue-700',   dot:'bg-blue-500'   },
  done:      { label:'Realizado',   bg:'bg-green-50',  text:'text-green-700',  dot:'bg-green-500'  },
  cancelled: { label:'Cancelado',   bg:'bg-red-50',    text:'text-red-600',    dot:'bg-red-400'    },
  noshow:    { label:'No asistió',  bg:'bg-gray-100',  text:'text-gray-500',   dot:'bg-gray-400'   },
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}/>
      {cfg.label}
    </span>
  )
}

// Generar slots de tiempo cada N minutos
function generateSlots(start: string, end: string, step = 30): string[] {
  const slots: string[] = []
  const [sh,sm] = start.split(':').map(Number)
  const [eh,em] = end.split(':').map(Number)
  let cur = sh*60+sm
  const endMin = eh*60+em
  while (cur < endMin) {
    const h = Math.floor(cur/60).toString().padStart(2,'0')
    const m = (cur%60).toString().padStart(2,'0')
    slots.push(`${h}:${m}`)
    cur += step
  }
  return slots
}

export default function BarbershopHub({
  bookings: initialBookings, staff, branches, services,
}: Props) {
  const { businessId, business, currency, color: primaryColor } = useVertical()
  const businessName = business.name
  const whatsapp     = (business.whatsapp as string | undefined) ?? ''
  const vertical     = business.vertical_type ?? 'servicios'
  const verticalSub  = business.vertical_sub ?? null

  const isBarberia    = vertical === 'barbershop' || (vertical === 'servicios' && verticalSub === 'barberia')
  const isBeauty      = vertical === 'beauty'     || (vertical === 'servicios' && ['estetica', 'peluqueria'].includes(verticalSub ?? ''))
  const isTaller      = vertical === 'servicios'  && verticalSub === 'taller'
  const staffLabel    = isBarberia ? 'Barberos'   : isTaller ? 'Técnicos' : 'Equipo'
  const staffSingular = isBarberia ? 'barbero'    : isTaller ? 'técnico'  : 'profesional'
  const StaffIcon     = isBarberia ? Scissors     : isTaller ? Wrench     : Sparkles
  const supabase = createClient()
  const [tab,          setTab]          = useState<Tab>('agenda')
  const [bookings,     setBookings]     = useState<Booking[]>(initialBookings)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filterStaff,  setFilterStaff]  = useState<string|null>(null)
  const [filterBranch, setFilterBranch] = useState<string|null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [editingBooking,  setEditingBooking]  = useState<Booking|null>(null)

  const dateStr = selectedDate.toISOString().split('T')[0]

  // Turnos del día seleccionado
  const todayBookings = useMemo(() => {
    let list = bookings.filter(b => b.date === dateStr)
    if (filterStaff)  list = list.filter(b => b.staff_id === filterStaff)
    if (filterBranch) list = list.filter(b => b.branch_id === filterBranch)
    return list.sort((a,b) => a.start_time.localeCompare(b.start_time))
  }, [bookings, dateStr, filterStaff, filterBranch])

  // Stats del día
  const confirmed = todayBookings.filter(b=>b.status==='confirmed'||b.status==='done').length
  const pending   = todayBookings.filter(b=>b.status==='pending').length
  const revenue   = todayBookings.filter(b=>b.status==='done').reduce((a,b)=>a+(b.price??0),0)

  // Navegar fecha
  function prevDay() { const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d) }
  function nextDay() { const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d) }
  function goToday() { setSelectedDate(new Date()) }

  const isToday = dateStr === new Date().toISOString().split('T')[0]

  async function updateStatus(id: string, status: BookingStatus) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => b.id===id ? {...b,status} : b))
  }

  async function deleteBooking(id: string) {
    if (!confirm('¿Eliminar este turno?')) return
    await supabase.from('bookings').delete().eq('id', id)
    setBookings(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Agenda</h1>
          <p className="text-xs text-gray-400 mt-0.5">{businessName}</p>
        </div>
        <button onClick={() => setShowNewBooking(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                     text-white active:scale-[0.98] transition-all"
          style={{ background: primaryColor }}>
          <Plus size={15} />
          <span className="hidden sm:inline">Nuevo turno</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
        {([
          { key:'agenda',   label:'Agenda',      icon: Calendar   },
          { key:'staff',    label: staffLabel,   icon: StaffIcon  },
          { key:'branches', label:'Sucursales',  icon: Building2  },
        ] as { key:Tab; label:string; icon:React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shrink-0 transition-all',
              tab===key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── TAB AGENDA ── */}
      {tab === 'agenda' && (
        <div className="space-y-4">
          {/* Navegación fecha */}
          <div className="flex items-center gap-3">
            <button onClick={prevDay}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                         bg-white text-gray-500 hover:bg-gray-50 transition-all">
              <ChevronLeft size={16}/>
            </button>

            <div className="flex-1 text-center">
              <p className="text-sm font-bold text-gray-900">
                {DAYS_FULL[selectedDate.getDay()]}{' '}
                {selectedDate.getDate()} de{' '}
                {MONTHS_ES[selectedDate.getMonth()]}
              </p>
              {!isToday && (
                <button onClick={goToday} className="text-xs mt-0.5 hover:underline"
                  style={{ color: primaryColor }}>
                  Ir a hoy
                </button>
              )}
            </div>

            <button onClick={nextDay}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                         bg-white text-gray-500 hover:bg-gray-50 transition-all">
              <ChevronRight size={16}/>
            </button>
          </div>

          {/* Filtros */}
          {(staff.length > 1 || branches.length > 1) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <select value={filterStaff??''} onChange={e=>setFilterStaff(e.target.value||null)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shrink-0">
                <option value="">Todo el {staffLabel.toLowerCase()}</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {branches.length > 1 && (
                <select value={filterBranch??''} onChange={e=>setFilterBranch(e.target.value||null)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shrink-0">
                  <option value="">Todas las sucursales</option>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Stats del día */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:'Turnos', value:todayBookings.length, color:'text-gray-900' },
              { label:'Confirmados', value:confirmed, color:'text-blue-600' },
              { label:'Pendientes', value:pending, color: pending>0?'text-amber-600':'text-gray-400' },
            ].map(({label,value,color})=>(
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Facturado del día — solo si hay ingresos */}
          {revenue > 0 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-green-500" />
                <span className="text-sm text-gray-600 font-medium">Facturado hoy</span>
              </div>
              <span className="text-sm font-bold text-green-600">
                {currency} {revenue.toLocaleString('es-AR')}
              </span>
            </div>
          )}

          {/* Lista de turnos */}
          {todayBookings.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
              <Calendar size={28} className="mx-auto text-gray-200 mb-3"/>
              <p className="text-sm font-medium text-gray-400">Sin turnos para este día</p>
              <button onClick={() => setShowNewBooking(true)}
                className="mt-3 text-xs font-semibold hover:underline"
                style={{ color: primaryColor }}>
                + Agregar turno
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayBookings.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  currency={currency}
                  whatsapp={whatsapp}
                  onStatusChange={updateStatus}
                  onEdit={() => setEditingBooking(booking)}
                  onDelete={() => deleteBooking(booking.id)}
                  primaryColor={primaryColor}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB STAFF ── */}
      {tab === 'staff' && (
        <StaffTab
          businessId={businessId}
          staff={staff}
          branches={branches}
          primaryColor={primaryColor}
          isBeauty={isBeauty}
          isBarberia={isBarberia}
          verticalSub={verticalSub}
        />
      )}

      {/* ── TAB BRANCHES ── */}
      {tab === 'branches' && (
        <BranchesTab
          businessId={businessId}
          branches={branches}
          primaryColor={primaryColor}
        />
      )}

      {/* Modal nuevo/editar turno */}
      {(showNewBooking || editingBooking) && (
        <BookingModal
          businessId={businessId}
          staff={staff}
          branches={branches}
          services={services}
          booking={editingBooking}
          selectedDate={dateStr}
          existingBookings={bookings}
          isBeauty={isBeauty}
          onClose={() => { setShowNewBooking(false); setEditingBooking(null) }}
          onSave={(saved) => {
            setBookings(prev =>
              editingBooking
                ? prev.map(b => b.id===saved.id ? saved : b)
                : [...prev, saved]
            )
            setShowNewBooking(false)
            setEditingBooking(null)
          }}
          primaryColor={primaryColor}
        />
      )}
    </div>
  )
}

// ── Booking Card ──────────────────────────────────────────────
function BookingCard({ booking, currency, whatsapp, onStatusChange, onEdit, onDelete, primaryColor }: {
  booking: Booking; currency: string; whatsapp: string
  onStatusChange: (id:string,s:BookingStatus)=>void
  onEdit: ()=>void; onDelete: ()=>void; primaryColor: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const waLink = booking.customer_phone
    ? `https://wa.me/${booking.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent(
        `Hola ${booking.customer_name}! Te confirmamos tu turno para el ${booking.date} a las ${booking.start_time}.`
      )}`
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-start gap-3 p-4">
        {/* Hora + color staff */}
        <div className="shrink-0 text-center min-w-[48px]">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{ background: booking.staff?.color ?? primaryColor }}>
            {booking.start_time.slice(0,5)}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{booking.end_time.slice(0,5)}</p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">{booking.customer_name}</p>
              {booking.product && (
                <p className="text-xs text-gray-500 mt-0.5">{booking.product.name}</p>
              )}
              {booking.staff && (
                <p className="text-xs text-gray-400">{booking.staff.name}</p>
              )}
              {booking.branch && (
                <p className="text-xs text-gray-400">📍 {booking.branch.name}</p>
              )}
            </div>
            <StatusBadge status={booking.status}/>
          </div>

          {/* Precio */}
          {booking.price != null && (
            <p className="text-sm font-bold mt-1.5" style={{ color: primaryColor }}>
              {formatPrice(booking.price, currency)}
            </p>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {booking.status === 'pending' && (
              <button onClick={() => onStatusChange(booking.id,'confirmed')}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: primaryColor }}>
                <Check size={11}/> Confirmar
              </button>
            )}
            {(booking.status==='confirmed'||booking.status==='pending') && (
              <button onClick={() => onStatusChange(booking.id,'done')}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold
                           bg-green-500 text-white">
                <Check size={11}/> Realizado
              </button>
            )}
            {waLink && (
              <a href={waLink} target="_blank"
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold
                           bg-green-500 text-white">
                <MessageCircle size={11}/> WA
              </a>
            )}
            <div className="relative ml-auto">
              <button onClick={() => setMenuOpen(o=>!o)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400
                           hover:bg-gray-100 transition-colors">
                <MoreHorizontal size={14}/>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                  <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-gray-200
                                  bg-white py-1 shadow-lg">
                    <button onClick={()=>{onEdit();setMenuOpen(false)}}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                      <Edit2 size={12}/> Editar
                    </button>
                    <button onClick={()=>onStatusChange(booking.id,'cancelled')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                      <X size={12}/> Cancelar
                    </button>
                    <button onClick={()=>{onDelete();setMenuOpen(false)}}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                      <Trash2 size={12}/> Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal Booking ─────────────────────────────────────────────
function BookingModal({ businessId, staff, branches, services, booking, selectedDate,
  existingBookings, isBeauty, onClose, onSave, primaryColor }: {
  businessId:string; staff:Staff[]; branches:Branch[]; services:Product[]
  booking:Booking|null; selectedDate:string; existingBookings:Booking[]
  isBeauty:boolean; onClose:()=>void; onSave:(b:Booking)=>void; primaryColor:string
}) {
  const supabase = createClient()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string|null>(null)

  const [customerName,  setCustomerName]  = useState(booking?.customer_name ?? '')
  const [customerPhone, setCustomerPhone] = useState(booking?.customer_phone ?? '')
  const [staffId,       setStaffId]       = useState(booking?.staff_id ?? (staff[0]?.id ?? ''))
  const [branchId,      setBranchId]      = useState(booking?.branch_id ?? (branches[0]?.id ?? ''))
  const [serviceId,     setServiceId]     = useState(booking?.product_id ?? '')
  const [date,          setDate]          = useState(booking?.date ?? selectedDate)
  const [startTime,     setStartTime]     = useState(booking?.start_time ?? '09:00')
  const [duration,      setDuration]      = useState(booking?.duration_min ?? 30)
  const [price,         setPrice]         = useState(booking?.price?.toString() ?? '')
  const [notes,         setNotes]         = useState(booking?.notes ?? '')
  const [status,        setStatus]        = useState<BookingStatus>(booking?.status ?? 'confirmed')

  // Calcular end_time
  const [sh, sm] = startTime.split(':').map(Number)
  const endMin = sh*60 + sm + duration
  const endTime = `${Math.floor(endMin/60).toString().padStart(2,'0')}:${(endMin%60).toString().padStart(2,'0')}`

  // Verificar conflictos
  const hasConflict = existingBookings.some(b => {
    if (b.id === booking?.id) return false
    if (b.staff_id !== staffId || b.date !== date) return false
    if (b.status === 'cancelled' || b.status === 'noshow') return false
    const bStart = b.start_time.slice(0,5)
    const bEnd   = b.end_time.slice(0,5)
    return startTime < bEnd && endTime > bStart
  })

  // Auto-completar precio desde servicio
  function handleServiceChange(id: string) {
    setServiceId(id)
    const svc = services.find(s=>s.id===id)
    if (svc?.price) setPrice(svc.price.toString())
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (hasConflict) { setError('Hay un conflicto de horario con otro turno'); return }
    setLoading(true); setError(null)
    try {
      const payload = {
        business_id:    businessId,
        staff_id:       staffId || null,
        branch_id:      branchId || null,
        product_id:     serviceId || null,
        customer_name:  customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        date,
        start_time:     startTime,
        end_time:       endTime,
        duration_min:   duration,
        price:          price ? parseFloat(price) : null,
        notes:          notes.trim() || null,
        status,
        source:         'admin',
      }
      if (booking) {
        const { data,error:e } = await supabase.from('bookings')
          .update(payload).eq('id',booking.id)
          .select('*, staff:staff(name,color), branch:branches(name), product:products(name,price)')
          .single()
        if (e) throw e; onSave(data as Booking)
      } else {
        const { data,error:e } = await supabase.from('bookings')
          .insert(payload)
          .select('*, staff:staff(name,color), branch:branches(name), product:products(name,price)')
          .single()
        if (e) throw e; onSave(data as Booking)
      }
    } catch(e:unknown) {
      setError(e instanceof Error?e.message:'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl
                      shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up">
        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-200"/>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <p className="font-bold text-gray-900">{booking ? 'Editar turno' : 'Nuevo turno'}</p>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400
                       hover:bg-gray-100 transition-colors">
            <X size={16}/>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="field-label">Nombre del cliente <span className="text-red-400">*</span></label>
              <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)}
                placeholder="Nombre completo" className="input-base"/>
            </div>
            <div className="col-span-2">
              <label className="field-label">Teléfono / WhatsApp</label>
              <input type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                placeholder="099123456" className="input-base" inputMode="numeric"/>
            </div>
          </div>

          {/* Servicio */}
          {services.length > 0 && (
            <div>
              <label className="field-label">Servicio</label>
              <select value={serviceId} onChange={e=>handleServiceChange(e.target.value)} className="input-base">
                <option value="">Sin especificar</option>
                {services.map(s=><option key={s.id} value={s.id}>{s.name} — ${s.price}</option>)}
              </select>
            </div>
          )}

          {/* Profesional / Barbero + Sucursal */}
          <div className="grid grid-cols-2 gap-3">
            {staff.length > 0 && (
              <div>
                <label className="field-label">{isBeauty ? 'Profesional' : 'Barbero'}</label>
                <select value={staffId} onChange={e=>setStaffId(e.target.value)} className="input-base">
                  <option value="">Sin asignar</option>
                  {staff.map(s=>(
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {branches.length > 1 && (
              <div>
                <label className="field-label">Sucursal</label>
                <select value={branchId} onChange={e=>setBranchId(e.target.value)} className="input-base">
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Fecha</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input-base"/>
            </div>
            <div>
              <label className="field-label">Hora inicio</label>
              <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="input-base"/>
            </div>
          </div>

          {/* Duración */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Duración (min)</label>
              <select value={duration} onChange={e=>setDuration(parseInt(e.target.value))} className="input-base">
                {[15,20,30,45,60,90,120].map(d=>(
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Fin estimado</label>
              <input type="text" value={endTime} readOnly
                className="input-base bg-gray-50 text-gray-500 cursor-not-allowed"/>
            </div>
          </div>

          {/* Conflicto */}
          {hasConflict && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0"/>
              <p className="text-xs text-red-700 font-medium">
                Este profesional ya tiene un turno en ese horario
              </p>
            </div>
          )}

          {/* Precio + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Precio</label>
              <input type="number" min="0" step="0.01" value={price}
                onChange={e=>setPrice(e.target.value)} placeholder="0" className="input-base"/>
            </div>
            <div>
              <label className="field-label">Estado</label>
              <select value={status} onChange={e=>setStatus(e.target.value as BookingStatus)} className="input-base">
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmado</option>
                <option value="done">Realizado</option>
                <option value="cancelled">Cancelado</option>
                <option value="noshow">No asistió</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Notas</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Observaciones del turno..." className="input-base resize-none"/>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2 pb-2">
            <button type="submit" disabled={loading||hasConflict}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3
                         text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: primaryColor }}>
              {loading&&<Loader2 size={14} className="animate-spin"/>}
              {loading?'Guardando...':booking?'Guardar cambios':'Crear turno'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Staff Tab ─────────────────────────────────────────────────
function StaffTab({ businessId, staff, branches, primaryColor, isBeauty, isBarberia, verticalSub }: {
  businessId:string; staff:Staff[]; branches:Branch[]; primaryColor:string
  isBeauty:boolean; isBarberia:boolean; verticalSub?: string | null
}) {
  const supabase = createClient()
  const [list, setList] = useState<Staff[]>(staff)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Staff|null>(null)

  const COLORS = ['#1565FF','#0B3EAB','#EC4899','#7C3AED','#059669','#D97706','#DC2626','#374151']

  const staffRoles    = getStaffRoles(verticalSub ?? (isBarberia ? 'barberia' : isBeauty ? 'estetica' : undefined))
  const defaultRole   = staffRoles[0].value
  const staffSingular = isBarberia ? 'barbero' : 'profesional'

  const [name,     setName]     = useState('')
  const [role,     setRole]     = useState(defaultRole)
  const [bio,      setBio]      = useState('')
  const [color,    setColor]    = useState('#1565FF')
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [loading,  setLoading]  = useState(false)

  function openEdit(s: Staff) {
    setEditing(s); setName(s.name); setRole(s.role)
    setBio(s.bio??''); setColor(s.color); setBranchId(s.branch_id??'')
    setShowForm(true)
  }

  function resetForm() {
    setEditing(null); setName(''); setRole(defaultRole)
    setBio(''); setColor('#1565FF'); setBranchId(branches[0]?.id??'')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const payload = {
      business_id: businessId, name:name.trim(), role, bio:bio.trim()||null,
      color, branch_id:branchId||null, active:true,
    }
    if (editing) {
      const { data } = await supabase.from('staff').update(payload).eq('id',editing.id).select('*').single()
      if (data) setList(prev=>prev.map(s=>s.id===editing.id?data as Staff:s))
    } else {
      const { data } = await supabase.from('staff').insert(payload).select('*').single()
      if (data) setList(prev=>[...prev,data as Staff])
    }
    setLoading(false); setShowForm(false); resetForm()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('staff').update({ active: !active }).eq('id', id)
    setList(prev=>prev.map(s=>s.id===id?{...s,active:!active}:s))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{list.length} {isBeauty ? 'profesionales' : 'barberos'} registrados</p>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: primaryColor }}>
          <Plus size={14}/> Agregar
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Users size={24} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Sin {isBeauty ? 'profesionales' : 'barberos'} registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white
                              text-sm font-bold shrink-0"
                style={{ background: s.color }}>
                {s.name.slice(0,1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400 capitalize">{s.role} {s.branch?.name ? `· ${s.branch.name}` : ''}</p>
                {s.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{s.bio}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(s)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400
                             hover:bg-gray-100 transition-colors">
                  <Edit2 size={13}/>
                </button>
                <button onClick={() => toggleActive(s.id, s.active)}
                  className={cn('h-8 w-8 flex items-center justify-center rounded-lg transition-colors',
                    s.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100')}>
                  <Check size={13}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>{setShowForm(false);resetForm()}}/>
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl
                          shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200"/>
            </div>
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">
                {editing ? `Editar ${staffSingular}` : `Nuevo/a ${staffSingular}`}
              </p>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="field-label">Nombre <span className="text-red-400">*</span></label>
                <input type="text" required value={name} onChange={e=>setName(e.target.value)}
                  placeholder={`Nombre del ${staffSingular}`} className="input-base"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Rol</label>
                  <select value={role} onChange={e=>setRole(e.target.value)} className="input-base">
                    {staffRoles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {branches.length > 1 && (
                  <div>
                    <label className="field-label">Sucursal</label>
                    <select value={branchId} onChange={e=>setBranchId(e.target.value)} className="input-base">
                      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="field-label">Color en agenda</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLORS.map(c=>(
                    <button key={c} type="button" onClick={()=>setColor(c)}
                      className={cn('h-8 w-8 rounded-xl transition-all',
                        color===c?'ring-2 ring-offset-2 ring-gray-400 scale-110':'')}
                      style={{background:c}}/>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Bio</label>
                <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={2}
                  placeholder="Especialidad, años de experiencia..." className="input-base resize-none"/>
              </div>
              <div className="flex gap-3 pt-1 pb-2">
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3
                             text-sm font-semibold text-white disabled:opacity-40"
                  style={{background:primaryColor}}>
                  {loading&&<Loader2 size={13} className="animate-spin"/>}
                  {loading ? 'Guardando...' : editing ? 'Guardar' : `Agregar ${staffSingular}`}
                </button>
                <button type="button" onClick={()=>{setShowForm(false);resetForm()}}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Branches Tab ──────────────────────────────────────────────
function BranchesTab({ businessId, branches, primaryColor }: {
  businessId:string; branches:Branch[]; primaryColor:string
}) {
  const supabase = createClient()
  const [list,     setList]     = useState<Branch[]>(branches)
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [name,     setName]     = useState('')
  const [address,  setAddress]  = useState('')
  const [phone,    setPhone]    = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [city,     setCity]     = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { data } = await supabase.from('branches').insert({
      business_id:businessId, name:name.trim(),
      address:address.trim()||null, phone:phone.trim()||null,
      whatsapp:whatsapp.replace(/\D/g,'')||null, city:city.trim()||null,
      is_main:false, active:true,
    }).select('*').single()
    if (data) setList(prev=>[...prev,data as Branch])
    setLoading(false); setShowForm(false)
    setName('');setAddress('');setPhone('');setWhatsapp('');setCity('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{list.length} sucursales</p>
        <button onClick={()=>setShowForm(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{background:primaryColor}}>
          <Plus size={14}/> Nueva sucursal
        </button>
      </div>

      <div className="space-y-2">
        {list.map(b=>(
          <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs"
                style={{background:primaryColor}}>
                <Building2 size={14}/>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{b.name}</p>
                {b.is_main && <span className="text-[10px] text-blue-600 font-medium">Principal</span>}
              </div>
            </div>
            {b.address&&<p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={11}/>{b.address}{b.city?`, ${b.city}`:''}</p>}
            {b.phone&&<p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Phone size={11}/>{b.phone}</p>}
            {b.whatsapp&&(
              <a href={`https://wa.me/${b.whatsapp}`} target="_blank"
                className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                <MessageCircle size={11}/>{b.whatsapp}
              </a>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowForm(false)}/>
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200"/>
            </div>
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">Nueva sucursal</p>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="field-label">Nombre <span className="text-red-400">*</span></label>
                <input type="text" required value={name} onChange={e=>setName(e.target.value)}
                  placeholder="Ej: Sucursal Centro" className="input-base"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Ciudad</label>
                  <input type="text" value={city} onChange={e=>setCity(e.target.value)}
                    placeholder="Montevideo" className="input-base"/>
                </div>
                <div>
                  <label className="field-label">Teléfono</label>
                  <input type="text" value={phone} onChange={e=>setPhone(e.target.value)}
                    placeholder="2900 0000" className="input-base"/>
                </div>
              </div>
              <div>
                <label className="field-label">Dirección</label>
                <input type="text" value={address} onChange={e=>setAddress(e.target.value)}
                  placeholder="Av. 18 de Julio 1234" className="input-base"/>
              </div>
              <div>
                <label className="field-label">WhatsApp</label>
                <input type="text" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)}
                  placeholder="59899000000" className="input-base" inputMode="numeric"/>
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
                  style={{background:primaryColor}}>
                  {loading?'Guardando...':'Crear sucursal'}
                </button>
                <button type="button" onClick={()=>setShowForm(false)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
