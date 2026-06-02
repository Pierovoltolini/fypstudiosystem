// components/store/StoreSections.tsx
// Secciones extra que aparecen según vertical_type y page_config
'use client'
import Link from 'next/link'
import { Calendar, Instagram, Globe, MessageCircle, Clock, MapPin, ChevronRight, Star } from 'lucide-react'
import { getVerticalGroup } from '@/lib/verticals'
import type { Business } from '@/types'

interface Staff {
  id: string; name: string; role: string; avatar_url?: string | null; color: string; bio?: string | null
}

interface Props {
  business: Business
  slug: string
  staff?: Staff[]
  pageConfig?: Record<string, unknown>
}

export default function StoreSections({ business, slug, staff = [], pageConfig }: Props) {
  const color    = business.primary_color ?? '#1565FF'
  const vertical = business.vertical_type ?? 'general'
  const group    = getVerticalGroup(vertical)

  const showBooking = group === 'servicios' || vertical === 'barbershop' || vertical === 'beauty'
  const showTeam    = showBooking && staff.length > 0
  const isBarberia  = vertical === 'barbershop' || (business as Business & { vertical_sub?: string }).vertical_sub === 'barberia'
  const showSocials    = !!(business.instagram || business.tiktok || business.website)
  const showContact    = !!(business.address || business.whatsapp)

  return (
    <div className="space-y-0">

      {/* ── SECCIÓN RESERVAS (barbershop / beauty) ── */}
      {showBooking && (
        <section className="px-4 py-8 max-w-2xl mx-auto">
          <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)`, borderColor: `${color}20` }}>
            <div className="px-6 py-7 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
                style={{ background: color }}>
                <Calendar size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Reservá tu turno online</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">
                {isBarberia
                  ? 'Elegí el día, la hora y el barbero. Rápido, sin llamadas, disponible 24/7.'
                  : 'Elegí el día, la hora y el profesional. Rápido, sin llamadas, disponible 24/7.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href={`/store/${slug}/book`}
                  className="flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4
                             text-sm font-bold text-white shadow-lg transition-all active:scale-[0.97]"
                  style={{ background: color }}>
                  <Calendar size={16} /> Reservar turno <ChevronRight size={15} />
                </Link>
                {business.whatsapp && (
                  <a href={`https://wa.me/${business.whatsapp}`} target="_blank"
                    className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4
                               text-sm font-semibold bg-green-500 text-white transition-all active:scale-[0.97]">
                    <MessageCircle size={16} /> Consultar por WA
                  </a>
                )}
              </div>
              {/* Features */}
              <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
                {[
                  { icon: Clock,   text: 'Sin esperar' },
                  { icon: Star,    text: 'Confirmación inmediata' },
                  { icon: Calendar,text: 'Cancelación fácil' },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon size={12} style={{ color }} /> {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── EQUIPO / BARBEROS ── */}
      {showTeam && (
        <section className="px-4 py-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-black text-gray-900 mb-4">
            {isBarberia ? 'Nuestros barberos' : 'Nuestro equipo'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {staff.map(s => (
              <Link key={s.id} href={`/store/${slug}/book`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100
                           bg-white p-4 text-center hover:shadow-md hover:border-gray-200
                           transition-all active:scale-[0.97]">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt={s.name}
                    className="h-16 w-16 rounded-full object-cover ring-2"
                    style={{ '--tw-ring-color': color } as React.CSSProperties} />
                ) : (
                  <div className="h-16 w-16 rounded-full flex items-center justify-center
                                  text-white text-xl font-black"
                    style={{ background: s.color || color }}>
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{s.role}</p>
                  {s.bio && (
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-tight">{s.bio}</p>
                  )}
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full text-white mt-1"
                  style={{ background: color }}>
                  Reservar
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTACTO + REDES ── */}
      {(showContact || showSocials) && (
        <section className="px-4 py-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Contacto</h3>

            {business.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
                target="_blank"
                className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `${color}15`, color }}>
                  <MapPin size={14} />
                </div>
                {business.address}
              </a>
            )}

            {business.whatsapp && (
              <a href={`https://wa.me/${business.whatsapp}`} target="_blank"
                className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0 bg-green-50 text-green-600">
                  <MessageCircle size={14} />
                </div>
                WhatsApp
              </a>
            )}

            {(business.instagram || business.tiktok || business.website) && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {business.instagram && (
                  <a href={`https://instagram.com/${business.instagram}`} target="_blank"
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold
                               text-white transition-all"
                    style={{ background: 'linear-gradient(135deg,#E1306C,#833AB4)' }}>
                    <Instagram size={12} /> @{business.instagram}
                  </a>
                )}
                {business.tiktok && (
                  <a href={`https://tiktok.com/@${business.tiktok}`} target="_blank"
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold
                               bg-black text-white transition-all">
                    TikTok @{business.tiktok}
                  </a>
                )}
                {business.website && (
                  <a href={business.website} target="_blank"
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold
                               border border-gray-200 text-gray-700 transition-all hover:bg-gray-50">
                    <Globe size={12} /> Web
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
