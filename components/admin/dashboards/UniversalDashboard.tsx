'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useVertical } from '@/lib/vertical-context'
import { useDashboardPrefs } from '@/hooks/useDashboardPrefs'
import DashboardWidgetWrapper from '@/components/admin/DashboardWidgetWrapper'
import WidgetPicker from '@/components/admin/WidgetPicker'
import { renderWidget } from '@/components/admin/DashboardWidgets'
import { getAvailableSizes } from '@/lib/dashboard-widgets'
import type { WidgetEntry, WidgetSize } from '@/lib/dashboard-widgets'
import DashboardOnboarding from '@/components/admin/DashboardOnboarding'

export default function UniversalDashboard({ showTour = false }: { showTour?: boolean }) {
  const { businessId, userId, group, verticalSub, business } = useVertical()

  const { widgets, loaded, addWidget, removeWidget, resizeWidget, reorderWidgets } =
    useDashboardPrefs(businessId, userId, group, verticalSub)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeId,   setActiveId]   = useState<string | null>(null)

  // Orden "en vivo" durante el drag — se actualiza en cada onDragOver para que el
  // DOM refleje el orden proyectado en tiempo real y CSS Grid no deje huecos fantasma.
  const [liveWidgets, setLiveWidgets] = useState<WidgetEntry[]>([])
  const liveRef      = useRef<WidgetEntry[]>([])   // ref para acceso sin stale closure
  const widgetsRef   = useRef<WidgetEntry[]>(widgets)
  useEffect(() => { widgetsRef.current = widgets }, [widgets])

  // Durante el drag mostramos el orden en vivo; fuera del drag, el orden persistido.
  const displayWidgets = activeId ? liveWidgets : widgets

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    const snapshot = widgetsRef.current
    setLiveWidgets(snapshot)
    liveRef.current = snapshot
  }, [])

  // Reordena el DOM en tiempo real: el grid refleja el orden proyectado sin huecos.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLiveWidgets(prev => {
      const oldIndex = prev.findIndex(w => w.id === active.id)
      const newIndex = prev.findIndex(w => w.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      liveRef.current = next
      return next
    })
  }, [])

  // Al soltar: persiste el último orden en vivo.
  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    setActiveId(null)
    const final = liveRef.current
    setLiveWidgets([])
    liveRef.current = []
    if (final.length > 0) reorderWidgets(final)
  }, [reorderWidgets])

  // Si el drag se cancela (ESC, touch cancel): descarta el orden en vivo.
  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLiveWidgets([])
    liveRef.current = []
  }, [])

  const handleResize = useCallback((id: string, size: WidgetSize) => {
    resizeWidget(id, size)
  }, [resizeWidget])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
    <DashboardOnboarding alreadySeen={!showTour} />
    <div className="space-y-4 animate-fade-in pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900 tracking-tight">
            ¡{greeting}! 👋
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{business.name}</p>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          data-tooltip-id="add-widget-btn"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2
                     text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shrink-0"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Agregar widget</span>
          <span className="sm:hidden">Widget</span>
        </button>
      </div>

      {/* Widgets */}
      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="col-span-1 md:col-span-2 lg:col-span-3
                                    bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16
                        border-2 border-dashed border-gray-200 rounded-2xl text-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Tu dashboard está vacío</p>
          <p className="text-xs text-gray-400 mb-5">Agregá widgets para ver la información de tu negocio</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5
                       text-sm font-semibold text-white hover:bg-gray-700 transition-all"
          >
            <Plus size={14} /> Agregar primer widget
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={displayWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [grid-auto-flow:dense]">
              {displayWidgets.map((entry: WidgetEntry, index: number) => (
                <DashboardWidgetWrapper
                  key={entry.id}
                  id={entry.id}
                  data-tooltip-id={index === 0 ? 'first-widget' : undefined}
                  currentSize={entry.size}
                  availableSizes={getAvailableSizes(entry.id)}
                  onResize={(size) => handleResize(entry.id, size)}
                  onRemove={() => removeWidget(entry.id)}
                >
                  {renderWidget(entry.id)}
                </DashboardWidgetWrapper>
              ))}
            </div>
          </SortableContext>

          {/* Tarjeta flotante — única representación visual del widget siendo arrastrado */}
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeId ? (
              <div
                className="w-[340px] h-[260px] rounded-2xl overflow-hidden
                           shadow-2xl ring-1 ring-black/10 opacity-[0.97]"
                style={{ transform: 'scale(1.03)', transformOrigin: 'center', cursor: 'grabbing' }}
              >
                {renderWidget(activeId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {loaded && widgets.length > 1 && (
        <p className="text-center text-[10px] text-gray-300 pb-2">
          Arrastrá los widgets para reordenarlos
        </p>
      )}

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        activeWidgets={widgets.map(w => w.id)}
        onAdd={id => { addWidget(id); setPickerOpen(false) }}
      />
    </div>
    </>
  )
}
