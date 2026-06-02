'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
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
import WelcomeTour from '@/components/admin/WelcomeTour'

export default function UniversalDashboard({ showTour = false }: { showTour?: boolean }) {
  const { businessId, userId, group, verticalSub, business } = useVertical()

  const { widgets, loaded, addWidget, removeWidget, resizeWidget, reorderWidgets } =
    useDashboardPrefs(businessId, userId, group, verticalSub)

  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [tourVisible, setTourVisible] = useState(showTour)

  // Ref para evitar stale closure en handleDragEnd
  const widgetsRef = useRef<WidgetEntry[]>(widgets)
  useEffect(() => { widgetsRef.current = widgets }, [widgets])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const current  = widgetsRef.current
    const oldIndex = current.findIndex(w => w.id === active.id)
    const newIndex = current.findIndex(w => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    reorderWidgets(arrayMove(current, oldIndex, newIndex))
  }, [reorderWidgets])

  const handleResize = useCallback((id: string, size: WidgetSize) => {
    resizeWidget(id, size)
  }, [resizeWidget])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
    {tourVisible && <WelcomeTour onFinish={() => setTourVisible(false)} />}
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
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [grid-auto-flow:dense]">
              {widgets.map((entry: WidgetEntry) => (
                <DashboardWidgetWrapper
                  key={entry.id}
                  id={entry.id}
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
