// components/store/StoreHero.tsx
'use client'
import Link from 'next/link'
import { Calendar, ChevronRight, Clock, MapPin, Star, Scissors } from 'lucide-react'
import type { Business } from '@/types'
import { getVertical, getVerticalGroup } from '@/lib/verticals'

interface HeroConfig {
  style?: 'gradient' | 'image' | 'minimal' | 'dark'
  title?: string
  subtitle?: string
  ctaText?: string
  ctaAction?: string
}

interface Props {
  business: Business
  heroConfig?: HeroConfig
  slug: string
}

export default function StoreHero({ business, heroConfig, slug }: Props) {
  const vertical = getVertical(business.vertical_type ?? 'general')
  const group    = getVerticalGroup(business.vertical_type)
  const color    = business.primary_color ?? vertical.color
  const secondary = business.secondary_color ?? '#ffffff'

  const style    = heroConfig?.style ?? 'gradient'
  const title    = heroConfig?.title ?? business.name
  const subtitle = heroConfig?.subtitle ?? vertical.description
  const ctaText  = heroConfig?.ctaText ?? (
    vertical.checkoutType === 'booking' ? 'Reservar turno' :
    vertical.checkoutType === 'lead'    ? 'Consultar ahora' : 'Ver productos'
  )

  // Fondo del hero
  const heroBg =
    style === 'image' && business.banner_url
      ? { backgroundImage: `url(${business.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : style === 'dark'
        ? { background: '#0B1929' }
        : style === 'minimal'
          ? { background: '#ffffff' }
          : { background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)` }

  const overlay = style === 'image'
  const textLight = style !== 'minimal'
  const textColor = textLight ? '#ffffff' : color

  // ── HERO SERVICIOS (barbershop / beauty / servicios group) ─
  if (group === 'servicios' || business.vertical_type === 'barbershop' || business.vertical_type === 'beauty') {
    return (
      <section className="relative overflow-hidden" style={{ ...heroBg, minHeight: '320px' }}>
        {overlay && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />}
        {/* Patrón decorativo */}
        {style !== 'minimal' && (
          <>
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-10"
              style={{ background: '#ffffff' }} />
            <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full opacity-10"
              style={{ background: '#ffffff' }} />
          </>
        )}

        <div className="relative max-w-2xl mx-auto px-5 py-12 lg:py-16 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', color: textColor, border: '1px solid rgba(255,255,255,0.2)' }}>
            <Scissors size={12} />
            {business.vertical_type === 'barbershop' ? 'Barbería · Reservas online' : 'Reservas online'}
          </div>

          {/* Logo + nombre */}
          <div className="flex items-center gap-3 mb-4">
            {business.logo_url && (
              <img src={business.logo_url} alt={business.name}
                className="h-14 w-14 rounded-2xl object-cover shadow-lg ring-2 ring-white/20" />
            )}
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight"
              style={{ color: textColor }}>
              {title}
            </h1>
          </div>

          <p className="text-base lg:text-lg mb-8 max-w-sm leading-relaxed"
            style={{ color: textColor, opacity: 0.85 }}>
            {subtitle}
          </p>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href={`/store/${slug}/book`}
              className="flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4
                         text-sm font-bold shadow-xl transition-all active:scale-[0.97]
                         hover:opacity-90"
              style={{ background: secondary, color: color }}>
              <Calendar size={18} />
              {ctaText}
              <ChevronRight size={16} />
            </Link>
            <a href={`#productos`}
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4
                         text-sm font-semibold border-2 transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.4)', color: textColor }}>
              Ver servicios
            </a>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-4 mt-8 flex-wrap justify-center">
            {business.address && (
              <span className="flex items-center gap-1.5 text-xs"
                style={{ color: textColor, opacity: 0.7 }}>
                <MapPin size={12} /> {business.address}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs"
              style={{ color: textColor, opacity: 0.7 }}>
              <Clock size={12} /> Reservas online 24/7
            </span>
            <span className="flex items-center gap-1.5 text-xs"
              style={{ color: textColor, opacity: 0.7 }}>
              <Star size={12} /> Sin esperas
            </span>
          </div>
        </div>
      </section>
    )
  }

  // ── HERO GASTRO ────────────────────────────────────────────
  if (group === 'gastro' || business.vertical_type === 'food') {
    return (
      <section className="relative overflow-hidden" style={{ ...heroBg, minHeight: '220px' }}>
        {overlay && <div className="absolute inset-0 bg-black/40" />}
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-10"
          style={{ background: '#ffffff' }} />

        <div className="relative max-w-2xl mx-auto px-5 py-10 flex flex-col sm:flex-row
                        items-center gap-5">
          <div className="flex-1 text-center sm:text-left">
            {business.logo_url && (
              <img src={business.logo_url} alt={business.name}
                className="h-16 w-16 rounded-2xl object-cover shadow-lg mb-4
                           mx-auto sm:mx-0 ring-2 ring-white/20" />
            )}
            <h1 className="text-3xl font-black leading-tight" style={{ color: textColor }}>
              {title}
            </h1>
            <p className="text-sm mt-2 mb-5" style={{ color: textColor, opacity: 0.8 }}>
              {subtitle}
            </p>
            <a href="#productos"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3
                         text-sm font-bold shadow-lg"
              style={{ background: secondary, color: color }}>
              {ctaText} <ChevronRight size={15} />
            </a>
          </div>
        </div>
      </section>
    )
  }

  // ── HERO GENERAL / FASHION / SERVICES ─────────────────────
  return (
    <section className="relative overflow-hidden" style={{ ...heroBg, minHeight: '200px' }}>
      {overlay && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative max-w-2xl mx-auto px-5 py-10 text-center">
        {business.logo_url && (
          <img src={business.logo_url} alt={business.name}
            className="h-14 w-14 rounded-2xl object-cover shadow-lg mx-auto mb-4 ring-2 ring-white/20" />
        )}
        <h1 className="text-3xl font-black leading-tight" style={{ color: textColor }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-2 mb-5" style={{ color: textColor, opacity: 0.8 }}>
            {subtitle}
          </p>
        )}
        <a href="#productos"
          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3
                     text-sm font-bold shadow-lg"
          style={{ background: secondary, color: color }}>
          {ctaText} <ChevronRight size={15} />
        </a>
      </div>
    </section>
  )
}
