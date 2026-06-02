// components/store/RealEstateStorefront.tsx
// Web pública para inmobiliaria — listado de propiedades con consulta directa por WhatsApp
'use client'
import { useState, useMemo } from 'react'
import { MessageCircle, MapPin, Search, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Business, Category, Product } from '@/types'

interface Props {
  business: Business
  categories: Category[]
  products: Product[]
}

function buildWhatsAppLink(phone: string, propertyName: string): string {
  const clean = phone.replace(/\D/g, '')
  const text = encodeURIComponent(
    `Hola! Me interesa la propiedad *${propertyName}* y quisiera recibir más información. 🏠`
  )
  return `https://wa.me/${clean}?text=${text}`
}

function PropertyCard({
  property,
  currency,
  primaryColor,
  whatsapp,
  zoneName,
}: {
  property: Product & { category?: { name: string } | null }
  currency: string
  primaryColor: string
  whatsapp: string
  zoneName?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const waLink = whatsapp ? buildWhatsAppLink(whatsapp, property.name) : null
  const hasLongDesc = (property.description?.length ?? 0) > 130

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-gray-100
                        shadow-sm hover:shadow-md transition-all flex flex-col">
      {/* Imagen */}
      <div className="relative h-52 bg-gray-100 shrink-0">
        {property.images?.[0] ? (
          <img
            src={property.images[0]}
            alt={property.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home size={40} className="text-gray-200" />
          </div>
        )}

        {/* Badge destacada */}
        {property.featured && (
          <span className="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1
                           rounded-full text-white shadow-sm"
            style={{ background: primaryColor }}>
            Destacada
          </span>
        )}

        {/* Badge zona */}
        {zoneName && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1
                           text-[11px] font-semibold bg-white/95 backdrop-blur-sm
                           rounded-full px-2.5 py-1 text-gray-700 shadow-sm">
            <MapPin size={10} />
            {zoneName}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-gray-900 leading-snug">{property.name}</h3>

        <p className="text-xl font-bold mt-1.5 mb-3" style={{ color: primaryColor }}>
          {formatPrice(property.price, currency)}
        </p>

        {/* Descripción expandible */}
        {property.description && (
          <div className="mb-3">
            <p className={cn(
              'text-xs text-gray-500 leading-relaxed',
              !expanded && 'line-clamp-3'
            )}>
              {property.description}
            </p>
            {hasLongDesc && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-0.5 text-xs mt-1.5 font-medium"
                style={{ color: primaryColor }}>
                {expanded
                  ? <><ChevronUp size={13} /> Ver menos</>
                  : <><ChevronDown size={13} /> Ver más</>
                }
              </button>
            )}
          </div>
        )}

        {/* Spacer para empujar el botón al fondo */}
        <div className="flex-1" />

        {/* CTA WhatsApp — botón principal */}
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 w-full rounded-xl
                       py-3 text-sm font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: '#25D366' }}>
            <MessageCircle size={17} />
            Consultar por WhatsApp
          </a>
        ) : (
          <div className="mt-2 rounded-xl py-2.5 text-xs text-center text-gray-400 border border-dashed border-gray-200">
            Contacto no configurado
          </div>
        )}
      </div>
    </article>
  )
}

export default function RealEstateStorefront({ business, categories, products }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const primaryColor = business.primary_color ?? '#1565FF'
  const whatsapp     = business.whatsapp ?? ''
  const currency     = business.currency ?? 'UYU'

  const filtered = useMemo(() => {
    let list = products
    if (activeCat) list = list.filter(p => p.category_id === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [products, activeCat, search])

  const featured    = products.filter(p => p.featured && !activeCat && !search)
  const zoneMap     = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const activeZone  = activeCat ? categories.find(c => c.id === activeCat) : null

  return (
    <div className="min-h-screen" style={{ background: '#F7F9FC' }}>

      {/* Barra de búsqueda + filtros de zona — sticky */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-2.5">

          {/* Buscador */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar propiedades..."
              className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm
                         focus:outline-none focus:border-blue-300 transition-colors"
            />
          </div>

          {/* Filtros de zona */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setActiveCat(null)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all',
                  !activeCat
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                style={!activeCat ? { background: primaryColor } : {}}>
                Todas las zonas
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all',
                    activeCat === cat.id
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  style={activeCat === cat.id ? { background: primaryColor } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Propiedades destacadas (solo cuando no hay filtro activo) */}
        {featured.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
              Propiedades destacadas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map(p => (
                <PropertyCard
                  key={p.id}
                  property={p as Product & { category?: { name: string } | null }}
                  currency={currency}
                  primaryColor={primaryColor}
                  whatsapp={whatsapp}
                  zoneName={p.category_id ? zoneMap[p.category_id] : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* Todas las propiedades */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Home size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No se encontraron propiedades</p>
            {(search || activeCat) && (
              <button
                onClick={() => { setSearch(''); setActiveCat(null) }}
                className="mt-3 text-xs font-semibold"
                style={{ color: primaryColor }}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <section>
            {(search || activeCat) && (
              <p className="text-sm text-gray-400 mb-4">
                {filtered.length} {filtered.length === 1 ? 'propiedad' : 'propiedades'}
                {activeZone ? ` en ${activeZone.name}` : ''}
              </p>
            )}

            {/* Si hay destacadas, el título de la sección "todas" */}
            {featured.length > 0 && !search && !activeCat && (
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                Todas las propiedades
              </h2>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(p => (
                <PropertyCard
                  key={p.id}
                  property={p as Product & { category?: { name: string } | null }}
                  currency={currency}
                  primaryColor={primaryColor}
                  whatsapp={whatsapp}
                  zoneName={p.category_id ? zoneMap[p.category_id] : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* Footer info */}
        {whatsapp && (
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-2">
              ¿Tenés alguna consulta general?
            </p>
            <a
              href={buildWhatsAppLink(whatsapp, 'una propiedad de ' + business.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5
                         text-sm font-semibold text-white"
              style={{ background: '#25D366' }}>
              <MessageCircle size={16} />
              Contactar a {business.name}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
