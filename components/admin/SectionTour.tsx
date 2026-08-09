'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'

// ── Tour content ───────────────────────────────────────────────

interface TourStep {
  title:       string
  description: string
  icon:        string
}

const TOURS: Record<string, TourStep[]> = {
  orders: [
    { icon: '🛍️', title: 'Bienvenido a Pedidos',  description: 'Acá ves todos los pedidos de tu negocio en tiempo real, ordenados del más reciente al más antiguo.' },
    { icon: '🔄', title: 'Estados del pedido',     description: 'Movés cada pedido por los estados: Pendiente → En preparación → Listo → Entregado. Actualizá con un clic.' },
    { icon: '➕', title: 'Nuevo pedido',           description: 'Podés crear pedidos manualmente con el botón + o recibirlos automáticamente desde tu tienda pública y el QR de mesa.' },
  ],
  tables: [
    { icon: '🪑', title: 'Tus mesas',   description: 'Visualizá el estado de cada mesa en tiempo real: libre, ocupada, con cuenta pendiente o reservada.' },
    { icon: '🗺️', title: 'Vista mapa',  description: 'Cambiá a la vista mapa para ver el plano de tu local y acomodar las mesas como quieras.' },
    { icon: '📱', title: 'QR por mesa', description: 'Generá el QR de cada mesa para que tus clientes pidan directamente desde su celular, sin llamar al mozo.' },
  ],
  inventory: [
    { icon: '📦', title: 'Control de stock',    description: 'Registrá todos tus insumos o productos con su stock actual. El sistema lleva el historial de movimientos.' },
    { icon: '🔔', title: 'Alertas automáticas', description: 'Configurá un stock mínimo y el sistema te avisa automáticamente cuando necesitás reponer.' },
    { icon: '📊', title: 'Movimientos',          description: 'Registrá entradas de mercadería y el sistema descuenta automáticamente las salidas al confirmar ventas.' },
  ],
  servicios: [
    { icon: '📅', title: 'Tu agenda',                 description: 'Visualizá todos los turnos organizados por día y profesional. Filtrá por sucursal o personal.' },
    { icon: '✏️', title: 'Nuevo turno',               description: 'Creá turnos manualmente o dejá que tus clientes reserven online directamente desde tu tienda pública.' },
    { icon: '✉️', title: 'Recordatorios automáticos', description: 'El sistema manda emails de confirmación y recordatorio a tus clientes sin que tengas que hacer nada.' },
  ],
  customers: [
    { icon: '👥', title: 'Tu base de clientes', description: 'Toda la información de tus clientes en un solo lugar: contacto, visitas, gasto total y más.' },
    { icon: '📋', title: 'Historial',            description: 'Ves el historial completo de compras o turnos de cada cliente, con fechas y montos.' },
    { icon: '🏷️', title: 'Notas y tags',         description: 'Agregá notas personales y etiquetas para segmentar tus clientes y armar campañas dirigidas.' },
  ],
  analytics: [
    { icon: '📈', title: 'Tus reportes', description: 'Ves las métricas más importantes de tu negocio: ingresos, pedidos, ticket promedio y más.' },
    { icon: '🔁', title: 'Comparativas', description: 'Cada métrica se compara automáticamente con el período anterior para que veas tu evolución.' },
    { icon: '⬇️', title: 'Exportar',     description: 'Descargá tus reportes en Excel o PDF (disponible en plan Pro y Premium).' },
  ],
  costs: [
    { icon: '💸', title: 'Control de gastos', description: 'Registrá todos los gastos de tu negocio por categoría: insumos, alquiler, sueldos, servicios, etc.' },
    { icon: '📉', title: 'Margen real',        description: 'Con los costos cargados podés ver tu ganancia real en Analytics y saber exactamente cuánto ganás.' },
    { icon: '⬇️', title: 'Exportar',           description: 'Descargá el detalle de costos en Excel o PDF para llevar tu contabilidad al día.' },
  ],
  notes: [
    { icon: '📓', title: 'Tu cuaderno digital', description: 'Guardá notas, ideas y recordatorios de tu negocio. Todo en un solo lugar, siempre disponible.' },
    { icon: '🏷️', title: 'Tags',                description: 'Organizá las notas con etiquetas como importante, pendiente o idea para encontrarlas rápido.' },
    { icon: '🔍', title: 'Búsqueda',             description: 'Buscá cualquier nota por texto en tiempo real. Sin importar cuántas tengas.' },
  ],
  caja: [
    { icon: '🏧', title: 'Tu caja diaria',    description: 'Abrí la caja al empezar el día con el monto inicial en efectivo. El sistema registra todo desde ahí.' },
    { icon: '💰', title: 'Movimientos',        description: 'Registrá ingresos y egresos durante el día. Cada movimiento queda en el historial con hora y descripción.' },
    { icon: '🔐', title: 'Cierre y arqueo',   description: 'Al cerrar el día comparás el efectivo real con el que registró el sistema y detectás diferencias al instante.' },
  ],
  products: [
    { icon: '🛒', title: 'Tu catálogo',  description: 'Creá y gestioná todos tus productos con foto, precio y descripción. Aparecen automáticamente en tu tienda pública.' },
    { icon: '🎨', title: 'Variantes',    description: 'Agregá variantes como tallas, colores o tamaños. Cada variante puede tener su propio precio y stock.' },
    { icon: '📥', title: 'Importar',     description: 'Importá todos tus productos de una vez desde un archivo CSV. Ideal para arrancar rápido.' },
  ],
  categories: [
    { icon: '🗂️', title: 'Organizá tu menú', description: 'Las categorías agrupan tus productos para que sea más fácil navegar tanto en el admin como en tu tienda pública.' },
    { icon: '↕️', title: 'Orden',             description: 'Podés ordenar las categorías como quieras que aparezcan en tu tienda. Arrastrá y soltá para reorganizar.' },
  ],
  loyalty: [
    { icon: '⭐', title: 'Programa de puntos',  description: 'Tus clientes acumulan puntos con cada compra. Más compras, más puntos, más fidelidad.' },
    { icon: '⚙️', title: 'Configuración',       description: 'Elegís cuántos puntos da cada peso gastado y cómo se canjean por descuentos o premios.' },
    { icon: '🎁', title: 'Bono de bienvenida',  description: 'Podés dar puntos a los clientes nuevos automáticamente para que empiecen con ventaja.' },
  ],
  promos: [
    { icon: '🎟️', title: 'Cupones de descuento', description: 'Creá códigos de descuento para tus clientes. Perfectos para campañas, fechas especiales o clientes VIP.' },
    { icon: '⚙️', title: 'Configuración',         description: 'Elegís el porcentaje o monto fijo, la fecha de vencimiento y el límite de usos por cupón.' },
  ],
  suppliers: [
    { icon: '🏭', title: 'Tus proveedores',    description: 'Registrá todos tus proveedores con sus datos de contacto para tener todo en un solo lugar.' },
    { icon: '📋', title: 'Órdenes de compra',  description: 'Generá órdenes de compra cuando necesitás reponer stock. El proveedor las recibe por email.' },
    { icon: '📅', title: 'Historial',           description: 'Ves el historial completo de compras a cada proveedor con fechas y montos.' },
  ],
  staff: [
    { icon: '👤', title: 'Tu equipo',     description: 'Invitá colaboradores a tu negocio. Cada uno entra con su propio usuario y contraseña.' },
    { icon: '🔑', title: 'Permisos',      description: 'Controlás exactamente a qué secciones puede acceder cada persona. El dueño mantiene el control total.' },
    { icon: '✉️', title: 'Invitaciones',  description: 'Mandás el invite por email y ellos se unen con su propia cuenta. Simple y seguro.' },
  ],
  custom_modules: [
    { icon: '🧩', title: 'Tu módulo propio',   description: 'Creá una sección completamente personalizada para trackear lo que necesite tu negocio.' },
    { icon: '🤖', title: 'Con ayuda de la IA', description: 'Describís qué querés registrar y la IA te sugiere los campos. Sin programar nada.' },
    { icon: '🆓', title: 'Gratis',              description: 'El primer módulo es gratis. Los adicionales se solicitan a nuestro equipo.' },
  ],
  planes: [
    { icon: '📦', title: 'Tu plan actual',    description: 'Acá ves qué incluye tu plan actual y podés compararlo con los otros para ver qué funciones te estás perdiendo.' },
    { icon: '🚀', title: 'Upgrade',            description: 'Contactanos para cambiar de plan, lo activamos al instante sin interrupciones.' },
    { icon: '💸', title: 'Descuento anual',   description: 'Pagando anualmente tenés un 20% de descuento sobre el precio mensual.' },
  ],
  riders: [
    { icon: '🛵', title: 'Tus repartidores', description: 'Registrá los repartidores de tu negocio con su nombre y datos de contacto.' },
    { icon: '📦', title: 'Asignación',        description: 'Asignás cada pedido de delivery a un repartidor específico para llevar el control de entregas.' },
  ],
  leads: [
    { icon: '📬', title: 'Tus consultas',  description: 'Registrá todas las consultas de clientes interesados en propiedades. Nunca pierdas un lead.' },
    { icon: '🔖', title: 'Estados',        description: 'Seguí el estado de cada lead: nuevo, contactado, visitado, oferta, cerrado.' },
    { icon: '💬', title: 'WhatsApp',       description: 'Contactá directamente al cliente desde el panel con un clic, sin copiar el número.' },
  ],
  visits: [
    { icon: '🏠', title: 'Visitas programadas', description: 'Ves todas las visitas a propiedades del día y la semana en un solo lugar.' },
    { icon: '📅', title: 'Agendar',              description: 'Coordinás visitas con fecha, hora, propiedad y cliente. El sistema te manda un recordatorio.' },
  ],
  barbershop: [
    { icon: '✂️', title: 'Tu centro de control', description: 'Vista rápida de todo lo que pasa en tu barbería hoy: turnos, ingresos y disponibilidad del equipo.' },
    { icon: '📋', title: 'Turnos del día',         description: 'Ves todos los turnos organizados por barbero. Confirmá, reagendá o cancelá con un toque.' },
  ],
  food: [
    { icon: '🍽️', title: 'Panel de cocina', description: 'Los pedidos aparecen aquí en tiempo real cuando llegan desde las mesas o la tienda online.' },
    { icon: '🔄', title: 'Estados',           description: 'Marcás cada pedido como "en preparación" y "listo" para que el mozo sepa cuándo salir.' },
  ],
  ai_assistant: [
    { icon: '🤖', title: 'Tu asistente inteligente', description: 'Preguntale cualquier cosa sobre tu negocio en lenguaje natural y te responde al instante.' },
    { icon: '💡', title: 'Ejemplos',                  description: '¿Cuánto vendí hoy? ¿Qué producto se vende más? ¿Tengo stock bajo? Todo sin buscar en pantallas.' },
    { icon: '📊', title: 'Límites',                   description: 'Cada plan tiene una cantidad de consultas mensuales incluidas. Podés ver tu uso en tiempo real.' },
  ],
}

// ── Componente ─────────────────────────────────────────────────

export default function SectionTour({ section }: { section: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  const steps = TOURS[section] ?? []

  useEffect(() => {
    if (!steps.length) return

    let cancelled = false

    async function checkIfSeen() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        setOpen(true)
        return
      }

      const { data } = await supabase
        .from('user_section_tours')
        .select('section')
        .eq('user_id', user.id)
        .eq('section', section)
        .maybeSingle()

      if (cancelled) return

      if (!data) setOpen(true)
    }
    checkIfSeen()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  async function markSeen() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_section_tours').upsert({ user_id: user.id, section })
  }

  async function handleDone() {
    setOpen(false)
    await markSeen()
  }

  function openTour() {
    setStep(0)
    setOpen(true)
  }

  if (!steps.length) return null

  const current = steps[step]
  const isLast  = step === steps.length - 1

  return (
    <>
      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop — decorativo, no cierra al tocar afuera (evita cierres accidentales en mobile) */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Card */}
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 animate-slide-up">
            {/* Close */}
            <button
              onClick={handleDone}
              className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
              aria-label="Cerrar"
            >
              <X size={15} />
            </button>

            {/* Icon */}
            <div className="text-5xl mb-4 leading-none">{current.icon}</div>

            {/* Step counter */}
            <p className="text-xs font-semibold text-blue-500 mb-1 uppercase tracking-wide">
              {step + 1} de {steps.length}
            </p>

            {/* Content */}
            <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
              {current.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              {current.description}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 my-5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="rounded-full transition-all"
                  style={{
                    height: 6,
                    width: i === step ? 20 : 6,
                    background: i === step ? '#1565FF' : '#E5E7EB',
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleDone}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Saltar
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700
                               px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                )}
                {isLast ? (
                  <button
                    onClick={handleDone}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                               text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    ¡Entendido!
                  </button>
                ) : (
                  <button
                    onClick={() => setStep(s => s + 1)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                               text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Botón ? — bottom-left, no choca con el botón IA (bottom-right) ── */}
      <button
        onClick={openTour}
        className="fixed bottom-20 left-4 lg:bottom-6 lg:left-[244px] z-30 h-9 w-9 rounded-full bg-white border border-gray-200
                   shadow-md flex items-center justify-center text-gray-400
                   hover:text-blue-500 hover:border-blue-300 hover:shadow-lg transition-all"
        title="Ver guía de esta sección"
      >
        <HelpCircle size={16} />
      </button>
    </>
  )
}
