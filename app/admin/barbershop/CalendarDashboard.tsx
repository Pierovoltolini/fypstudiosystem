// app/admin/barbershop/CalendarDashboard.tsx
// Calendario de turnos en el admin + gestión de días bloqueados
'use client'
import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Loader2,
  Lock, Unlock, Clock, User, Scissors, DollarSign,
  AlertTriangle, Calendar,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Booking, Staff, BlockedSlot, BookingStatus } from '@/types'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_HEADER = ['L','M','X','J','V','S','D']

const STATUS_CFG: Record<BookingStatus,{label:string;bg:string;text:string}> = {
  pending:   {label:'Pendiente',  bg:'bg-amber-100', text:'text-amber-800'},
  confirmed: {label:'Confirmado', bg:'bg-blue-100',  text:'text-blue-800'},
  done:      {label:'Realizado',  bg:'bg-green-100', text:'text-green-800'},
  cancelled: {label:'Cancelado',  bg:'bg-red-100',   text:'text-red-700'},
  noshow:    {label:'No asistió', bg:'bg-gray-100',  text:'text-gray-600'},
}

interface Props {
  businessId: string
  currency: string
  primaryColor: string
  staff: Staff[]
  initialBookings: Booking[]
  initialBlocked: BlockedSlot[]
}

function buildCalendar(year:number,month:number){
  const firstDay = new Date(year,month,1).getDay()
  const startOffset = firstDay===0?6:firstDay-1
  const daysInMonth = new Date(year,month+1,0).getDate()
  return {startOffset,daysInMonth}
}

export default function CalendarDashboard({
  businessId, currency, primaryColor, staff,
  initialBookings, initialBlocked,
}: Props) {
  const supabase = createClient()
  const color = primaryColor

  const today = useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[])
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number|null>(today.getDate())

  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [blocked,  setBlocked]  = useState<BlockedSlot[]>(initialBlocked)
  const [updating, setUpdating] = useState<string|null>(null)

  // Modal bloquear día
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockDate,      setBlockDate]      = useState('')
  const [blockSlot,      setBlockSlot]      = useState('') // '' = todo el día
  const [blockReason,    setBlockReason]    = useState('Feriado')
  const [blockStaff,     setBlockStaff]     = useState('')
  const [blockLoading,   setBlockLoading]   = useState(false)

  function dateKey(year:number,month:number,day:number){
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  // Cargar bookings del mes
  useEffect(()=>{
    const from = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`
    const lastDay = new Date(viewYear,viewMonth+1,0).getDate()
    const to   = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${lastDay}`

    Promise.all([
      supabase.from('bookings')
        .select('*, staff:staff(name,color), product:products(name,price)')
        .eq('business_id',businessId)
        .gte('date',from).lte('date',to)
        .not('status','in','(cancelled,noshow)')
        .order('start_time'),
      supabase.from('blocked_slots')
        .select('*').eq('business_id',businessId)
        .gte('date',from).lte('date',to),
    ]).then(([b,bl])=>{
      setBookings(b.data as Booking[] ?? [])
      setBlocked(bl.data as BlockedSlot[] ?? [])
    })
  },[viewYear,viewMonth])

  // Mapa de bookings por día
  const bookingsByDay = useMemo(()=>{
    const map: Record<string,Booking[]> = {}
    bookings.forEach(b=>{ if(!map[b.date])map[b.date]=[]; map[b.date].push(b) })
    return map
  },[bookings])

  // Mapa de blocked por día
  const blockedByDay = useMemo(()=>{
    const map: Record<string,BlockedSlot[]> = {}
    blocked.forEach(b=>{ if(!map[b.date])map[b.date]=[]; map[b.date].push(b) })
    return map
  },[blocked])

  const {startOffset,daysInMonth} = buildCalendar(viewYear,viewMonth)

  // Turnos del día seleccionado
  const selectedDayKey = selectedDay ? dateKey(viewYear,viewMonth,selectedDay) : null
  const dayBookings    = selectedDayKey ? (bookingsByDay[selectedDayKey]??[]).sort((a,b)=>a.start_time.localeCompare(b.start_time)) : []
  const dayBlocked     = selectedDayKey ? (blockedByDay[selectedDayKey]??[]) : []
  const dayRevenue     = dayBookings.filter(b=>b.status==='done').reduce((a,b)=>a+(b.price??0),0)

  async function updateStatus(id:string, status:BookingStatus){
    setUpdating(id)
    await supabase.from('bookings').update({status}).eq('id',id)
    setBookings(prev=>prev.map(b=>b.id===id?{...b,status}:b))
    setUpdating(null)
  }

  async function addBlock(){
    if(!blockDate) return
    setBlockLoading(true)
    const {data} = await supabase.from('blocked_slots').insert({
      business_id: businessId,
      staff_id:    blockStaff||null,
      date:        blockDate,
      time_slot:   blockSlot||null,
      reason:      blockReason||null,
    }).select('*').single()
    if(data) setBlocked(prev=>[...prev,data as BlockedSlot])
    setBlockLoading(false)
    setShowBlockModal(false)
    setBlockDate(''); setBlockSlot(''); setBlockReason('Feriado'); setBlockStaff('')
  }

  async function removeBlock(id:string){
    await supabase.from('blocked_slots').delete().eq('id',id)
    setBlocked(prev=>prev.filter(b=>b.id!==id))
  }

  const dayAllBlocked = dayBlocked.some(b=>!b.time_slot)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={18} style={{color}}/> Calendario de turnos
        </h2>
        <button onClick={()=>setShowBlockModal(true)}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{background:'#DC2626'}}>
          <Lock size={12}/> Bloquear día
        </button>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Cabecera mes */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <button onClick={()=>{ if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11)}else setViewMonth(m=>m-1); setSelectedDay(null) }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <ChevronLeft size={15}/>
          </button>
          <p className="font-bold text-gray-900 text-sm">
            {MONTHS_ES[viewMonth]} {viewYear}
          </p>
          <button onClick={()=>{ if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0)}else setViewMonth(m=>m+1); setSelectedDay(null) }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{background:color}}>
            <ChevronRight size={15}/>
          </button>
        </div>

        {/* Días semana */}
        <div className="grid grid-cols-7 px-3 py-1.5">
          {DAYS_HEADER.map(d=>(
            <div key={d} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
          {Array.from({length:startOffset}).map((_,i)=><div key={`e${i}`}/>)}

          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const dk      = dateKey(viewYear,viewMonth,day)
            const count   = bookingsByDay[dk]?.length ?? 0
            const blk     = blockedByDay[dk]?.some(b=>!b.time_slot) ?? false
            const past    = new Date(viewYear,viewMonth,day) < today
            const isSel   = selectedDay===day
            const isToday = today.getDate()===day&&today.getMonth()===viewMonth&&today.getFullYear()===viewYear

            return (
              <button key={day} onClick={()=>setSelectedDay(day)}
                className={cn(
                  'relative aspect-square rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5',
                  isSel   ? 'text-white ring-2 ring-offset-1' :
                  blk     ? 'bg-red-100 text-red-700' :
                  count>0 ? 'text-white' :
                  past    ? 'text-gray-300' :
                  isToday ? 'font-black' :
                  'text-gray-700 hover:bg-gray-50'
                )}
                style={
                  isSel   ? {background:color} :
                  count>0 && !blk ? {background:color+'22',color} :
                  {}
                }
              >
                <span>{day}</span>
                {count>0 && (
                  <span className="text-[8px] font-bold opacity-80">{count}</span>
                )}
                {blk && <Lock size={8} className="opacity-60"/>}
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 px-4 pb-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded" style={{background:color+'33'}}/> Con turnos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-red-200"/> Bloqueado
          </span>
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      {selectedDay && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">
              {new Date(viewYear,viewMonth,selectedDay).toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}
            </p>
            {dayRevenue > 0 && (
              <p className="text-sm font-black" style={{color}}>
                {formatPrice(dayRevenue,currency)}
              </p>
            )}
          </div>

          {/* Bloqueados del día */}
          {dayBlocked.length>0 && (
            <div className="space-y-2">
              {dayBlocked.map(bl=>(
                <div key={bl.id} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  <Lock size={13} className="text-red-500 shrink-0"/>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-700">
                      {bl.time_slot ? `${bl.time_slot} bloqueado` : 'Día completo bloqueado'}
                    </p>
                    {bl.reason && <p className="text-[10px] text-red-500">{bl.reason}</p>}
                  </div>
                  <button onClick={()=>removeBlock(bl.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-red-400 hover:bg-red-100">
                    <X size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Turnos del día */}
          {dayBookings.length===0 && !dayAllBlocked ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-8 text-center">
              <Clock size={20} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-xs text-gray-400">Sin turnos para este día</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayBookings.map(booking=>(
                <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Hora */}
                    <div className="flex items-center gap-3">
                      <div className="text-center shrink-0">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-[11px] font-black"
                          style={{background:(booking.staff as {color?:string}|null)?.color??color}}>
                          {booking.start_time.slice(0,5)}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">{booking.end_time.slice(0,5)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{booking.customer_name}</p>
                        {(booking.product as {name?:string}|null)?.name && (
                          <p className="text-xs text-gray-500">{(booking.product as {name:string}).name}</p>
                        )}
                        {(booking.staff as {name?:string}|null)?.name && (
                          <p className="text-xs text-gray-400">✂️ {(booking.staff as {name:string}).name}</p>
                        )}
                        {booking.customer_phone && (
                          <a href={`tel:${booking.customer_phone}`}
                            className="text-xs text-blue-500">{booking.customer_phone}</a>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('badge text-[10px]', STATUS_CFG[booking.status].bg, STATUS_CFG[booking.status].text)}>
                        {STATUS_CFG[booking.status].label}
                      </span>
                      {booking.price!=null && (
                        <p className="text-sm font-black mt-1" style={{color}}>
                          {formatPrice(booking.price,currency)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {booking.status==='pending' && (
                      <button onClick={()=>updateStatus(booking.id,'confirmed')}
                        disabled={updating===booking.id}
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                        style={{background:color}}>
                        {updating===booking.id?<Loader2 size={10} className="animate-spin"/>:<Check size={10}/>}
                        Confirmar
                      </button>
                    )}
                    {(booking.status==='confirmed'||booking.status==='pending') && (
                      <button onClick={()=>updateStatus(booking.id,'done')}
                        disabled={updating===booking.id}
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold bg-green-500 text-white">
                        <Check size={10}/> Realizado
                      </button>
                    )}
                    {!['cancelled','done','noshow'].includes(booking.status) && (
                      <button onClick={()=>updateStatus(booking.id,'cancelled')}
                        disabled={updating===booking.id}
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs text-red-600 bg-red-50">
                        <X size={10}/> Cancelar
                      </button>
                    )}
                    {booking.customer_phone && (
                      <a href={`https://wa.me/${booking.customer_phone.replace(/\D/g,'')}`} target="_blank"
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold bg-green-500 text-white">
                        WA
                      </a>
                    )}
                  </div>

                  {booking.notes && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                      💬 {booking.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal bloquear */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowBlockModal(false)}/>
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200"/>
            </div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <Lock size={15} className="text-red-500"/> Bloquear día / horario
              </p>
              <button onClick={()=>setShowBlockModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
                <X size={15}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="field-label text-xs">Fecha <span className="text-red-400">*</span></label>
                <input type="date" value={blockDate} onChange={e=>setBlockDate(e.target.value)}
                  className="input-base" min={new Date().toISOString().split('T')[0]}/>
              </div>
              <div>
                <label className="field-label text-xs">Horario específico <span className="text-gray-400 font-normal">(vacío = todo el día)</span></label>
                <input type="time" value={blockSlot} onChange={e=>setBlockSlot(e.target.value)}
                  className="input-base" placeholder="HH:MM"/>
              </div>
              {staff.length>0 && (
                <div>
                  <label className="field-label text-xs">Barbero <span className="text-gray-400 font-normal">(vacío = todos)</span></label>
                  <select value={blockStaff} onChange={e=>setBlockStaff(e.target.value)} className="input-base">
                    <option value="">Todos los barberos</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="field-label text-xs">Motivo</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Feriado','Vacaciones','Cerrado','Capacitación','Otro'].map(r=>(
                    <button key={r} type="button" onClick={()=>setBlockReason(r)}
                      className={cn('rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                        blockReason===r?'text-white':'bg-gray-100 text-gray-600')}>
                      {blockReason===r?r:r}
                    </button>
                  ))}
                </div>
                <input type="text" value={blockReason} onChange={e=>setBlockReason(e.target.value)}
                  placeholder="Motivo personalizado" className="input-base text-sm"/>
              </div>

              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5"/>
                <p className="text-xs text-red-700">
                  Al bloquear este horario, <strong>no se podrá hacer ninguna reserva</strong> desde la tienda pública. Los turnos existentes no se cancelan automáticamente.
                </p>
              </div>

              <div className="flex gap-3 pb-2">
                <button onClick={addBlock} disabled={blockLoading||!blockDate}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white
                             disabled:opacity-40 bg-red-600">
                  {blockLoading?<Loader2 size={14} className="animate-spin"/>:<Lock size={14}/>}
                  {blockLoading?'Bloqueando...':'Bloquear'}
                </button>
                <button onClick={()=>setShowBlockModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
