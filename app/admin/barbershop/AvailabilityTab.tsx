// app/admin/barbershop/AvailabilityTab.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, Calendar, Plus, X, Check, Loader2, Lock,
  ChevronDown, User, AlertTriangle, Unlock, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Staff, StaffScheduleFull, BlockedRange, ClosedDay } from '@/types'

const DAYS      = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DAYS_S    = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const REASONS   = ['Feriado','Vacaciones','Cerrado','Agenda llena','Personal','Otro']

interface Props {
  businessId: string
  staff: Staff[]
  primaryColor: string
}

export default function AvailabilityTab({ businessId, staff, primaryColor }: Props) {
  const supabase = createClient()
  const color = primaryColor

  // Sub-tab
  const [subTab, setSubTab] = useState<'schedules'|'blocks'>('schedules')

  // ── SCHEDULES ──
  const [selectedStaff, setSelectedStaff] = useState<Staff|null>(staff[0]??null)
  const [schedules, setSchedules] = useState<StaffScheduleFull[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [savingDay, setSavingDay] = useState<number|null>(null)

  useEffect(() => {
    if (!selectedStaff) return
    setLoadingSchedules(true)
    supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', selectedStaff.id)
      .then(({ data }) => {
        // Completar con todos los días si faltan
        const existing = data ?? []
        const full = Array.from({ length: 7 }, (_, i) => {
          const found = existing.find((s: StaffScheduleFull) => s.day_of_week === i)
          return found ?? {
            staff_id:    selectedStaff.id,
            business_id: businessId,
            day_of_week: i,
            is_working:  i >= 1 && i <= 6, // Lun-Sáb por defecto
            start_time:  '09:00',
            end_time:    '19:00',
            break_start: null,
            break_end:   null,
          } as StaffScheduleFull
        })
        setSchedules(full)
        setLoadingSchedules(false)
      })
  }, [selectedStaff])

  function updateSchedule(dayOfWeek: number, field: keyof StaffScheduleFull, value: unknown) {
    setSchedules(prev => prev.map(s =>
      s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
    ))
  }

  async function saveSchedule(s: StaffScheduleFull) {
    setSavingDay(s.day_of_week)
    if (s.id) {
      await supabase.from('staff_schedules').update({
        is_working: s.is_working,
        start_time: s.start_time,
        end_time:   s.end_time,
        break_start:s.break_start || null,
        break_end:  s.break_end   || null,
      }).eq('id', s.id)
    } else {
      const { data } = await supabase.from('staff_schedules').insert({
        staff_id:    s.staff_id,
        business_id: businessId,
        day_of_week: s.day_of_week,
        is_working:  s.is_working,
        start_time:  s.start_time,
        end_time:    s.end_time,
        break_start: s.break_start || null,
        break_end:   s.break_end   || null,
      }).select('*').single()
      if (data) {
        setSchedules(prev => prev.map(sc =>
          sc.day_of_week === s.day_of_week ? { ...sc, id: (data as StaffScheduleFull).id } : sc
        ))
      }
    }
    setSavingDay(null)
  }

  async function saveAllSchedules() {
    for (const s of schedules) {
      await saveSchedule(s)
    }
  }

  // ── BLOCKS ──
  const [blocks,     setBlocks]     = useState<BlockedRange[]>([])
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)

  // Modal bloqueo
  const [showModal,   setShowModal]   = useState(false)
  const [blockType,   setBlockType]   = useState<'day'|'range'|'time'>('day')
  const [blockTarget, setBlockTarget] = useState<'business'|'staff'>('business')
  const [blockStaffId, setBlockStaffId] = useState(staff[0]?.id ?? '')
  const [blockDate,   setBlockDate]   = useState('')
  const [blockFrom,   setBlockFrom]   = useState('')
  const [blockTo,     setBlockTo]     = useState('')
  const [blockTimeFrom, setBlockTimeFrom] = useState('')
  const [blockTimeTo,   setBlockTimeTo]   = useState('')
  const [blockReason, setBlockReason] = useState('Feriado')
  const [blockSaving, setBlockSaving] = useState(false)

  useEffect(() => {
    setLoadingBlocks(true)
    const future = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('blocked_slots')
        .select('*').eq('business_id', businessId)
        .or(`date.gte.${future},date_from.gte.${future}`)
        .order('date', { nullsFirst: false })
        .order('date_from', { nullsFirst: false }),
      supabase.from('business_closed_days')
        .select('*').eq('business_id', businessId)
        .order('date', { nullsFirst: false }),
    ]).then(([b, c]) => {
      setBlocks((b.data ?? []) as BlockedRange[])
      setClosedDays((c.data ?? []) as ClosedDay[])
      setLoadingBlocks(false)
    })
  }, [])

  async function addBlock() {
    setBlockSaving(true)
    try {
      if (blockTarget === 'business') {
        // Cerrar todo el negocio
        const { data } = await supabase.from('business_closed_days').insert({
          business_id: businessId,
          date:      blockType === 'day'   ? blockDate : null,
          date_from: blockType === 'range' ? blockFrom : null,
          date_to:   blockType === 'range' ? blockTo   : null,
          reason:    blockReason,
        }).select('*').single()
        if (data) setClosedDays(prev => [...prev, data as ClosedDay])
      } else {
        // Bloquear para barbero específico
        const { data } = await supabase.from('blocked_slots').insert({
          business_id: businessId,
          staff_id:    blockStaffId || null,
          date:        blockType === 'day'  ? blockDate : null,
          date_from:   blockType === 'range'? blockFrom : null,
          date_to:     blockType === 'range'? blockTo   : null,
          time_slot:   blockType === 'time' && blockTimeFrom && !blockTimeTo ? blockTimeFrom : null,
          time_from:   blockType === 'time' ? blockTimeFrom : null,
          time_to:     blockType === 'time' ? blockTimeTo   : null,
          reason:      blockReason,
        }).select('*').single()
        if (data) setBlocks(prev => [...prev, data as BlockedRange])
      }
      setShowModal(false)
      resetModal()
    } catch(e) { console.error(e) }
    setBlockSaving(false)
  }

  function resetModal() {
    setBlockDate(''); setBlockFrom(''); setBlockTo('')
    setBlockTimeFrom(''); setBlockTimeTo(''); setBlockReason('Feriado')
    setBlockType('day'); setBlockTarget('business')
  }

  async function removeBlock(id: string, table: 'blocked_slots'|'business_closed_days') {
    await supabase.from(table).delete().eq('id', id)
    if (table === 'blocked_slots')
      setBlocks(prev => prev.filter(b => b.id !== id))
    else
      setClosedDays(prev => prev.filter(c => c.id !== id))
  }

  function formatBlockDate(b: BlockedRange | ClosedDay) {
    if ('date' in b && b.date) return b.date
    if ('date_from' in b && b.date_from) return `${b.date_from} → ${b.date_to}`
    if ('time_from' in (b as BlockedRange) && (b as BlockedRange).time_from)
      return `${(b as BlockedRange).time_from} — ${(b as BlockedRange).time_to}`
    return '—'
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-4">

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'schedules', label: 'Horarios por barbero', icon: Clock    },
          { key: 'blocks',    label: 'Bloqueos',             icon: Lock     },
        ] as { key:'schedules'|'blocks'; label:string; icon:React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
              subTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── HORARIOS POR BARBERO ── */}
      {subTab === 'schedules' && (
        <div className="space-y-4">
          {/* Selector de barbero */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-600 mb-2">Seleccioná el barbero</p>
              <div className="flex flex-wrap gap-2">
                {staff.map(s => (
                  <button key={s.id} onClick={() => setSelectedStaff(s)}
                    className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all',
                      selectedStaff?.id === s.id ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
                    style={selectedStaff?.id === s.id ? { background: s.color || color } : {}}>
                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0"
                      style={{ background: s.color || color }}>
                      {s.name.slice(0,1)}
                    </div>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Horarios del barbero */}
            {selectedStaff && !loadingSchedules && (
              <div className="divide-y divide-gray-50">
                {schedules.map(s => (
                  <div key={s.day_of_week} className="px-4 py-3">
                    {/* Fila principal */}
                    <div className="flex items-center gap-3">
                      {/* Toggle trabaja */}
                      <button onClick={() => updateSchedule(s.day_of_week, 'is_working', !s.is_working)}
                        className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0',
                          s.is_working ? 'bg-green-500' : 'bg-gray-200')}>
                        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                          s.is_working ? 'left-4' : 'left-0.5')}/>
                      </button>

                      {/* Día */}
                      <p className={cn('text-sm font-bold w-9 shrink-0',
                        s.is_working ? 'text-gray-900' : 'text-gray-400')}>
                        {DAYS_S[s.day_of_week]}
                      </p>

                      {s.is_working ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <input type="time" value={s.start_time}
                              onChange={e => updateSchedule(s.day_of_week, 'start_time', e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs w-24"/>
                            <span className="text-xs text-gray-400">a</span>
                            <input type="time" value={s.end_time}
                              onChange={e => updateSchedule(s.day_of_week, 'end_time', e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs w-24"/>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 flex-1">No trabaja</p>
                      )}

                      {/* Guardar día */}
                      <button onClick={() => saveSchedule(s)}
                        disabled={savingDay === s.day_of_week}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0 disabled:opacity-40"
                        style={{ background: color }}>
                        {savingDay === s.day_of_week
                          ? <Loader2 size={11} className="animate-spin"/>
                          : <Check size={11}/>}
                      </button>
                    </div>

                    {/* Descanso — expandible */}
                    {s.is_working && (
                      <div className="ml-[52px] mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-gray-400 shrink-0">Descanso:</span>
                        <input type="time" value={s.break_start ?? ''}
                          onChange={e => updateSchedule(s.day_of_week, 'break_start', e.target.value)}
                          placeholder="--:--"
                          className="rounded-xl border border-gray-200 px-2 py-1 text-xs w-20"/>
                        <span className="text-[10px] text-gray-400">a</span>
                        <input type="time" value={s.break_end ?? ''}
                          onChange={e => updateSchedule(s.day_of_week, 'break_end', e.target.value)}
                          placeholder="--:--"
                          className="rounded-xl border border-gray-200 px-2 py-1 text-xs w-20"/>
                        {s.break_start && (
                          <button onClick={() => {
                            updateSchedule(s.day_of_week, 'break_start', null)
                            updateSchedule(s.day_of_week, 'break_end', null)
                          }} className="text-[10px] text-gray-400 hover:text-red-500">
                            <X size={11}/>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {loadingSchedules && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-300"/>
              </div>
            )}

            {/* Guardar todos */}
            {selectedStaff && !loadingSchedules && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <button onClick={saveAllSchedules}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: color }}>
                  <Check size={14}/> Guardar todos los horarios
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Los días marcados como "No trabaja" no aparecerán disponibles en la tienda
                </p>
              </div>
            )}
          </div>

          {/* Preview rápido */}
          {selectedStaff && schedules.some(s => s.is_working) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                Resumen — {selectedStaff.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {schedules.map(s => (
                  <div key={s.day_of_week}
                    className={cn('rounded-xl px-3 py-2 text-center',
                      s.is_working ? 'text-white' : 'bg-gray-100 text-gray-400')}
                    style={s.is_working ? { background: color } : {}}>
                    <p className="text-[10px] font-bold">{DAYS_S[s.day_of_week]}</p>
                    {s.is_working && (
                      <p className="text-[9px] opacity-80 mt-0.5">
                        {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                      </p>
                    )}
                    {!s.is_working && <p className="text-[9px]">—</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BLOQUEOS ── */}
      {subTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {blocks.length + closedDays.length} bloqueos activos
            </p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
              style={{ background: '#DC2626' }}>
              <Plus size={13}/> Nuevo bloqueo
            </button>
          </div>

          {/* Lista bloqueos negocio */}
          {closedDays.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-red-50/50">
                <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <Lock size={12}/> Todo el negocio cerrado
                </p>
              </div>
              {closedDays.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{formatBlockDate(c)}</p>
                    {c.reason && <p className="text-xs text-gray-500">{c.reason}</p>}
                  </div>
                  <button onClick={() => removeBlock(c.id, 'business_closed_days')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Lista bloqueos por barbero */}
          {blocks.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-amber-50/50">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <User size={12}/> Bloqueos por barbero / horario
                </p>
              </div>
              {blocks.map(b => {
                const staffName = staff.find(s => s.id === b.staff_id)?.name
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{formatBlockDate(b)}</p>
                        {staffName && (
                          <span className="badge bg-gray-100 text-gray-600 text-[10px]">
                            ✂️ {staffName}
                          </span>
                        )}
                        {!staffName && (
                          <span className="badge bg-blue-50 text-blue-600 text-[10px]">Todos</span>
                        )}
                      </div>
                      {b.reason && <p className="text-xs text-gray-500">{b.reason}</p>}
                    </div>
                    <button onClick={() => removeBlock(b.id, 'blocked_slots')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {blocks.length === 0 && closedDays.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
              <Unlock size={24} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-sm text-gray-400">Sin bloqueos activos</p>
              <p className="text-xs text-gray-300 mt-1">
                Todo está disponible para reservas
              </p>
            </div>
          )}

          {/* Tip */}
          <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3.5">
            <p className="text-xs font-semibold text-blue-800 mb-1">💡 Cómo funciona</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>Negocio cerrado</strong> → todos los barberos aparecen en rojo ese día</li>
              <li>• <strong>Barbero específico</strong> → solo ese barbero aparece no disponible</li>
              <li>• <strong>Rango de fechas</strong> → ejemplo: vacaciones del 15 al 30 de junio</li>
              <li>• <strong>Los cambios se reflejan inmediatamente</strong> en la tienda pública</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO BLOQUEO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>{setShowModal(false);resetModal()}}/>
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200"/>
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <Lock size={15} className="text-red-500"/> Nuevo bloqueo
              </p>
              <button onClick={()=>{setShowModal(false);resetModal()}}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
                <X size={15}/>
              </button>
            </div>
            <div className="p-5 space-y-4">

              {/* Quién */}
              <div>
                <label className="field-label text-xs">¿A quién afecta?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val:'business', label:'🏪 Todo el negocio' },
                    { val:'staff',    label:'✂️ Un barbero' },
                  ].map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setBlockTarget(val as 'business'|'staff')}
                      className={cn('rounded-xl border-2 p-3 text-xs font-semibold transition-all',
                        blockTarget===val?'border-red-500 bg-red-50 text-red-700':'border-gray-100 text-gray-600 hover:border-gray-300')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barbero específico */}
              {blockTarget==='staff' && staff.length>0 && (
                <div>
                  <label className="field-label text-xs">Barbero</label>
                  <div className="flex flex-wrap gap-2">
                    {staff.map(s=>(
                      <button key={s.id} type="button" onClick={()=>setBlockStaffId(s.id)}
                        className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                          blockStaffId===s.id?'text-white':'bg-gray-100 text-gray-700')}
                        style={blockStaffId===s.id?{background:s.color||color}:{}}>
                        {s.name}
                      </button>
                    ))}
                    <button type="button" onClick={()=>setBlockStaffId('')}
                      className={cn('rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                        blockStaffId===''?'bg-gray-800 text-white':'bg-gray-100 text-gray-700')}>
                      Todos
                    </button>
                  </div>
                </div>
              )}

              {/* Tipo de bloqueo */}
              <div>
                <label className="field-label text-xs">Tipo de bloqueo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val:'day',   label:'📅 Un día' },
                    { val:'range', label:'📆 Rango de días' },
                    { val:'time',  label:'🕐 Horario' },
                  ].map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setBlockType(val as 'day'|'range'|'time')}
                      className={cn('rounded-xl border-2 p-2.5 text-xs font-semibold transition-all text-center',
                        blockType===val?'border-gray-900 bg-gray-900 text-white':'border-gray-100 text-gray-600 hover:border-gray-300')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha(s) */}
              {blockType==='day' && (
                <div>
                  <label className="field-label text-xs">Fecha</label>
                  <input type="date" value={blockDate} onChange={e=>setBlockDate(e.target.value)}
                    className="input-base" min={today}/>
                </div>
              )}
              {blockType==='range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label text-xs">Desde</label>
                    <input type="date" value={blockFrom} onChange={e=>setBlockFrom(e.target.value)}
                      className="input-base" min={today}/>
                  </div>
                  <div>
                    <label className="field-label text-xs">Hasta</label>
                    <input type="date" value={blockTo} onChange={e=>setBlockTo(e.target.value)}
                      className="input-base" min={blockFrom||today}/>
                  </div>
                </div>
              )}
              {blockType==='time' && (
                <>
                  <div>
                    <label className="field-label text-xs">Fecha</label>
                    <input type="date" value={blockDate} onChange={e=>setBlockDate(e.target.value)}
                      className="input-base" min={today}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label text-xs">Hora desde</label>
                      <input type="time" value={blockTimeFrom} onChange={e=>setBlockTimeFrom(e.target.value)}
                        className="input-base"/>
                    </div>
                    <div>
                      <label className="field-label text-xs">Hora hasta</label>
                      <input type="time" value={blockTimeTo} onChange={e=>setBlockTimeTo(e.target.value)}
                        className="input-base"/>
                    </div>
                  </div>
                </>
              )}

              {/* Motivo */}
              <div>
                <label className="field-label text-xs">Motivo</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {REASONS.map(r=>(
                    <button key={r} type="button" onClick={()=>setBlockReason(r)}
                      className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                        blockReason===r?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                      {r}
                    </button>
                  ))}
                </div>
                <input type="text" value={blockReason} onChange={e=>setBlockReason(e.target.value)}
                  placeholder="Motivo personalizado" className="input-base text-sm"/>
              </div>

              {/* Warning */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-2">
                <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5"/>
                <p className="text-xs text-amber-700">
                  Los días bloqueados aparecerán en <strong>rojo</strong> en la tienda pública y no se podrán reservar. Los turnos existentes no se cancelan automáticamente.
                </p>
              </div>

              <div className="flex gap-3 pb-2">
                <button onClick={addBlock}
                  disabled={blockSaving || (blockType==='day'&&!blockDate) || (blockType==='range'&&(!blockFrom||!blockTo))}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3
                             text-sm font-bold text-white disabled:opacity-40 bg-red-600">
                  {blockSaving?<Loader2 size={14} className="animate-spin"/>:<Lock size={14}/>}
                  {blockSaving?'Guardando...':'Confirmar bloqueo'}
                </button>
                <button onClick={()=>{setShowModal(false);resetModal()}}
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
