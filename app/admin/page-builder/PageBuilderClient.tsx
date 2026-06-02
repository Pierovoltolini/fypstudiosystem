// app/admin/page-builder/PageBuilderClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getVertical } from '@/lib/verticals'
import { formatPrice, productImageUrl } from '@/lib/utils'
import {
  Monitor, Smartphone, Check, Loader2, Palette, Type,
  Layout, Image, ChevronRight, Star, ShoppingBag, Eye,
  ExternalLink, Layers, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Business } from '@/types'

interface Product { id: string; name: string; price: number; images: string[]; featured: boolean }
interface Category { id: string; name: string; slug: string }

interface Props {
  business: Business
  products: Product[]
  categories: Category[]
}

type DeviceView = 'desktop' | 'mobile'

// Paletas predefinidas por vertical
const PALETTES = {
  food: [
    { name: 'Fuego',    primary: '#FF5722', secondary: '#ffffff', bg: '#FFF3E0' },
    { name: 'Noche',    primary: '#1a1a1a', secondary: '#ffffff', bg: '#f5f5f5' },
    { name: 'Fresco',   primary: '#00BCD4', secondary: '#ffffff', bg: '#E0F7FA' },
    { name: 'Campo',    primary: '#4CAF50', secondary: '#ffffff', bg: '#F1F8E9' },
    { name: 'Vino',     primary: '#880E4F', secondary: '#ffffff', bg: '#FCE4EC' },
  ],
  barbershop: [
    { name: 'Clásico',  primary: '#0B1929', secondary: '#C9A84C', bg: '#F7F7F5' },
    { name: 'Azul',     primary: '#1565FF', secondary: '#ffffff', bg: '#EFF6FF' },
    { name: 'Negro',    primary: '#111111', secondary: '#ffffff', bg: '#F5F5F5' },
    { name: 'Vintage',  primary: '#5D4037', secondary: '#FFF8E1', bg: '#EFEBE9' },
  ],
  beauty: [
    { name: 'Rosa',     primary: '#EC4899', secondary: '#ffffff', bg: '#FDF2F8' },
    { name: 'Lavanda',  primary: '#7C3AED', secondary: '#ffffff', bg: '#F5F3FF' },
    { name: 'Nude',     primary: '#C2956C', secondary: '#ffffff', bg: '#FDF8F3' },
    { name: 'Esmeralda',primary: '#059669', secondary: '#ffffff', bg: '#ECFDF5' },
  ],
  fashion: [
    { name: 'Minimalista', primary: '#111111', secondary: '#ffffff', bg: '#FAFAFA' },
    { name: 'Violeta',  primary: '#7C3AED', secondary: '#ffffff', bg: '#F5F3FF' },
    { name: 'Dorado',   primary: '#D97706', secondary: '#111111', bg: '#FFFBEB' },
    { name: 'Rosa nude',primary: '#BE185D', secondary: '#ffffff', bg: '#FDF2F8' },
  ],
  general: [
    { name: 'Azul',     primary: '#1565FF', secondary: '#ffffff', bg: '#EFF6FF' },
    { name: 'Verde',    primary: '#059669', secondary: '#ffffff', bg: '#ECFDF5' },
    { name: 'Negro',    primary: '#111111', secondary: '#ffffff', bg: '#F9FAFB' },
    { name: 'Coral',    primary: '#F43F5E', secondary: '#ffffff', bg: '#FFF1F2' },
  ],
}

const FONTS = [
  { key: 'inter',    label: 'Inter',    sample: 'Aa', style: { fontFamily: 'Inter, sans-serif' } },
  { key: 'georgia',  label: 'Georgia',  sample: 'Aa', style: { fontFamily: 'Georgia, serif' } },
  { key: 'system',   label: 'Sistema',  sample: 'Aa', style: { fontFamily: 'system-ui, sans-serif' } },
]

const HERO_STYLES = [
  { key: 'gradient', label: 'Gradiente', desc: 'Fondo con gradiente de color' },
  { key: 'image',    label: 'Imagen',    desc: 'Usa tu banner como fondo' },
  { key: 'minimal',  label: 'Minimalista',desc: 'Texto sobre fondo blanco' },
  { key: 'dark',     label: 'Oscuro',   desc: 'Fondo negro premium' },
]

const LAYOUTS = [
  { key: 'grid',   label: 'Grilla',   desc: 'Productos en cuadrícula 2×2' },
  { key: 'list',   label: 'Lista',    desc: 'Fila con imagen y descripción' },
  { key: 'cards',  label: 'Cards',    desc: 'Tarjetas con imagen grande' },
]

const RADIUS_OPTIONS = [
  { key: 'none', label: 'Angular',  class: 'rounded-none' },
  { key: 'sm',   label: 'Suave',    class: 'rounded-lg'   },
  { key: 'lg',   label: 'Redondeado',class: 'rounded-2xl' },
  { key: 'full', label: 'Pill',     class: 'rounded-full' },
]

export default function PageBuilderClient({ business, products, categories }: Props) {
  const router = useRouter()
  const vertical = getVertical(business.vertical_type ?? 'general')
  const paletteKey = (business.vertical_type as keyof typeof PALETTES) in PALETTES
    ? (business.vertical_type as keyof typeof PALETTES)
    : 'general'
  const palettes = PALETTES[paletteKey] ?? PALETTES.general

  // Estado del diseño
  const [primary,    setPrimary]    = useState(business.primary_color   ?? '#1565FF')
  const [secondary,  setSecondary]  = useState(business.secondary_color ?? '#ffffff')
  const [heroStyle,  setHeroStyle]  = useState<string>('gradient')
  const [heroTitle,  setHeroTitle]  = useState(business.name)
  const [heroSub,    setHeroSub]    = useState(`${vertical.label} · ${business.address ?? 'Tu ciudad'}`)
  const [heroCTA,    setHeroCTA]    = useState(
    vertical.checkoutType === 'booking' ? 'Reservar turno' :
    vertical.checkoutType === 'lead'    ? 'Consultar' : 'Ver productos'
  )
  const [layout,     setLayout]     = useState('list')
  const [radius,     setRadius]     = useState('lg')
  const [font,       setFont]       = useState('inter')
  const [showFeatured, setShowFeatured] = useState(true)
  const [showCategories, setShowCategories] = useState(true)
  const [device,     setDevice]     = useState<DeviceView>('mobile')
  const [activeTab,  setActiveTab]  = useState<'theme'|'hero'|'layout'|'sections'>('theme')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  function applyPalette(p: typeof palettes[0]) {
    setPrimary(p.primary)
    setSecondary(p.secondary)
  }

  async function handleSave() {
    setSaving(true)
    const pageConfig = {
      theme: { primaryColor: primary, secondaryColor: secondary, font, borderRadius: radius },
      hero:  { style: heroStyle, title: heroTitle, subtitle: heroSub, ctaText: heroCTA },
      layout: { productLayout: layout, showFeatured, showCategories },
    }
    await fetch('/api/business/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primary_color:   primary,
        secondary_color: secondary,
        page_config:     pageConfig,
      }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    router.refresh()
  }

  // Estilo del hero en el preview
  const heroBackground = useMemo(() => {
    if (heroStyle === 'image' && business.banner_url)
      return { backgroundImage: `url(${business.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    if (heroStyle === 'dark')
      return { background: '#111111' }
    if (heroStyle === 'minimal')
      return { background: '#ffffff' }
    return { background: `linear-gradient(135deg,${primary},${primary}99)` }
  }, [heroStyle, primary, business.banner_url])

  const heroTextColor = heroStyle === 'minimal' ? primary : (secondary ?? '#ffffff')

  // Radius class
  const rdClass: Record<string,string> = { none:'rounded-none', sm:'rounded-lg', lg:'rounded-2xl', full:'rounded-full' }
  const rd = rdClass[radius] ?? 'rounded-2xl'

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
            Diseño de tienda
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Personalizá cómo ven tu negocio los clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {business.slug && (
            <a href={`/store/${business.slug}`} target="_blank"
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2
                         text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <ExternalLink size={13} /> Ver tienda
            </a>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: saved ? '#10B981' : primary }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Publicar cambios'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── PANEL IZQUIERDO: Controles ── */}
        <div className="space-y-4">

          {/* Tabs de control */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key:'theme',    label:'Colores',  icon: Palette  },
              { key:'hero',     label:'Hero',     icon: Image    },
              { key:'layout',   label:'Layout',   icon: Layout   },
              { key:'sections', label:'Secciones',icon: Layers   },
            ] as {key:'theme'|'hero'|'layout'|'sections';label:string;icon:React.ElementType}[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all flex-1 justify-center',
                  activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ── COLORES ── */}
          {activeTab === 'theme' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Paletas para {vertical.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {palettes.map(p => (
                    <button key={p.name} onClick={() => applyPalette(p)}
                      className={cn('flex items-center gap-2 rounded-xl border p-2.5 transition-all',
                        primary === p.primary ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300')}>
                      <div className="flex shrink-0">
                        <div className="h-6 w-6 rounded-l-lg" style={{ background: p.primary }}/>
                        <div className="h-6 w-3 rounded-r-lg border-l border-white/20" style={{ background: p.secondary }}/>
                      </div>
                      <span className="text-xs font-medium text-gray-700">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label text-xs">Color principal</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                      className="h-9 w-9 rounded-xl border border-gray-200 cursor-pointer p-0.5"/>
                    <input type="text" value={primary} onChange={e => setPrimary(e.target.value)}
                      className="input-base font-mono text-xs py-2 flex-1"/>
                  </div>
                </div>
                <div>
                  <label className="field-label text-xs">Color secundario</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)}
                      className="h-9 w-9 rounded-xl border border-gray-200 cursor-pointer p-0.5"/>
                    <input type="text" value={secondary} onChange={e => setSecondary(e.target.value)}
                      className="input-base font-mono text-xs py-2 flex-1"/>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Tipografía</p>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map(f => (
                    <button key={f.key} onClick={() => setFont(f.key)}
                      className={cn('flex flex-col items-center gap-1 rounded-xl border p-3 transition-all',
                        font === f.key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300')}>
                      <span className="text-xl font-bold text-gray-800" style={f.style}>{f.sample}</span>
                      <span className="text-[10px] text-gray-500">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Bordes</p>
                <div className="grid grid-cols-4 gap-2">
                  {RADIUS_OPTIONS.map(r => (
                    <button key={r.key} onClick={() => setRadius(r.key)}
                      className={cn('flex flex-col items-center gap-1.5 p-2.5 border transition-all',
                        r.class,
                        radius === r.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400')}>
                      <div className="h-4 w-8 border-2 border-current" style={{
                        borderRadius: r.key==='none'?'0':r.key==='sm'?'6px':r.key==='lg'?'12px':'999px'
                      }}/>
                      <span className="text-[10px] text-gray-600">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── HERO ── */}
          {activeTab === 'hero' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Estilo del hero</p>
                <div className="grid grid-cols-2 gap-2">
                  {HERO_STYLES.map(s => (
                    <button key={s.key} onClick={() => setHeroStyle(s.key)}
                      className={cn('flex flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                        heroStyle===s.key?'border-blue-500 bg-blue-50':'border-gray-100 hover:border-gray-300')}>
                      <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                      <p className="text-[10px] text-gray-500">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="field-label text-xs">Título principal</label>
                  <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)}
                    placeholder="Nombre de tu negocio" className="input-base text-sm py-2.5"/>
                </div>
                <div>
                  <label className="field-label text-xs">Subtítulo</label>
                  <input type="text" value={heroSub} onChange={e => setHeroSub(e.target.value)}
                    placeholder="Tu slogan o descripción" className="input-base text-sm py-2.5"/>
                </div>
                <div>
                  <label className="field-label text-xs">Texto del botón</label>
                  <input type="text" value={heroCTA} onChange={e => setHeroCTA(e.target.value)}
                    placeholder="Ver menú / Reservar / Ver productos" className="input-base text-sm py-2.5"/>
                </div>
              </div>
            </div>
          )}

          {/* ── LAYOUT ── */}
          {activeTab === 'layout' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Layout de productos</p>
                <div className="grid grid-cols-3 gap-2">
                  {LAYOUTS.map(l => (
                    <button key={l.key} onClick={() => setLayout(l.key)}
                      className={cn('flex flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                        layout===l.key?'border-blue-500 bg-blue-50':'border-gray-100 hover:border-gray-300')}>
                      {/* Ícono del layout */}
                      <div className="flex gap-0.5 mb-1">
                        {l.key==='grid' && [0,1,2,3].map(i=><div key={i} className="h-3 w-3 bg-gray-300 rounded"/>)}
                        {l.key==='list' && [0,1,2].map(i=><div key={i} className="h-1.5 w-8 bg-gray-300 rounded mb-0.5" style={{display:'block'}}/>)}
                        {l.key==='cards' && [0,1].map(i=><div key={i} className="h-6 w-5 bg-gray-300 rounded"/>)}
                      </div>
                      <p className="text-xs font-semibold text-gray-800">{l.label}</p>
                      <p className="text-[10px] text-gray-500 leading-tight">{l.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SECCIONES ── */}
          {activeTab === 'sections' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-600">Secciones visibles</p>
              {[
                { key:'showFeatured',    label:'Productos destacados', val:showFeatured,    set:setShowFeatured },
                { key:'showCategories',  label:'Filtro de categorías', val:showCategories,  set:setShowCategories },
              ].map(({ key, label, val, set }) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button type="button" onClick={() => set(!val)}
                    className={cn('relative h-5 w-9 rounded-full transition-colors', val?'bg-blue-500':'bg-gray-200')}>
                    <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                      val?'left-4':'left-0.5')}/>
                  </button>
                </label>
              ))}

              {/* Secciones específicas por vertical */}
              {vertical.features.hasDelivery && (
                <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                  <p className="text-xs font-semibold text-orange-800">🛵 Delivery activado</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    Configurá delivery fee y tiempo en <a href="/admin/settings" className="underline">Configuración</a>
                  </p>
                </div>
              )}
              {vertical.features.hasBooking && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800">📅 Reservas online activas</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Los clientes pueden reservar desde tu tienda pública
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PANEL DERECHO: Preview ── */}
        <div className="space-y-3">
          {/* Device toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Vista previa</p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { key:'desktop', icon: Monitor    },
                { key:'mobile',  icon: Smartphone },
              ] as {key:DeviceView;icon:React.ElementType}[]).map(({ key, icon: Icon }) => (
                <button key={key} onClick={() => setDevice(key)}
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    device===key?'bg-white shadow-sm text-gray-900':'text-gray-400 hover:text-gray-700')}>
                  <Icon size={15}/>
                </button>
              ))}
            </div>
          </div>

          {/* Preview frame */}
          <div className={cn(
            'mx-auto overflow-hidden border border-gray-200 shadow-xl transition-all duration-300',
            device === 'mobile' ? 'w-[320px] rounded-[32px]' : 'w-full rounded-2xl'
          )}>
            <div className="overflow-y-auto" style={{ maxHeight: device==='mobile'?'580px':'520px', background:'#f9f9f8' }}>

              {/* ── HERO PREVIEW ── */}
              <div className="relative" style={{ ...heroBackground, minHeight: device==='mobile'?'180px':'200px' }}>
                {heroStyle==='image' && business.banner_url && (
                  <div className="absolute inset-0 bg-black/40"/>
                )}
                <div className="relative flex flex-col items-center justify-center h-full py-10 px-5 text-center">
                  {business.logo_url && (
                    <img src={business.logo_url} alt=""
                      className={cn('h-12 w-12 object-cover mb-3', rd)}/>
                  )}
                  <h1 className="font-bold text-lg leading-tight" style={{ color: heroTextColor }}>
                    {heroTitle}
                  </h1>
                  <p className="text-xs mt-1 opacity-80" style={{ color: heroTextColor }}>
                    {heroSub}
                  </p>
                  <button className={cn('mt-4 px-5 py-2 text-xs font-bold transition-all', rd)}
                    style={{ background: secondary, color: primary }}>
                    {heroCTA}
                  </button>
                </div>
              </div>

              {/* ── CATEGORIES PREVIEW ── */}
              {showCategories && categories.length > 0 && (
                <div className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-hide">
                  {['Todo',...categories.map(c=>c.name)].map(cat => (
                    <span key={cat}
                      className={cn('shrink-0 px-3 py-1 text-[10px] font-semibold', rd,
                        cat==='Todo'?'text-white':'bg-white text-gray-600 border border-gray-200')}
                      style={cat==='Todo'?{background:primary}:{}}>
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* ── FEATURED ── */}
              {showFeatured && products.some(p=>p.featured) && (
                <div className="px-3 pb-2">
                  <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">⭐ Destacados</p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {products.filter(p=>p.featured).slice(0,3).map(p=>(
                      <div key={p.id} className={cn('shrink-0 w-28 bg-white border border-gray-100 overflow-hidden', rd)}>
                        <div className="h-16 bg-gray-100 overflow-hidden">
                          <img src={productImageUrl(p.images)} alt="" className="h-full w-full object-cover"/>
                        </div>
                        <div className="p-1.5">
                          <p className="text-[9px] font-bold text-gray-900 truncate">{p.name}</p>
                          <p className="text-[9px] font-bold mt-0.5" style={{color:primary}}>
                            {formatPrice(p.price,'UYU')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PRODUCTOS PREVIEW ── */}
              <div className="px-3 pb-4">
                <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Productos</p>
                {layout === 'grid' && (
                  <div className="grid grid-cols-2 gap-2">
                    {products.slice(0,4).map(p=>(
                      <div key={p.id} className={cn('bg-white border border-gray-100 overflow-hidden', rd)}>
                        <div className="h-16 bg-gray-100">
                          <img src={productImageUrl(p.images)} alt="" className="h-full w-full object-cover"/>
                        </div>
                        <div className="p-1.5">
                          <p className="text-[9px] font-bold text-gray-900 truncate">{p.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[9px] font-bold" style={{color:primary}}>{formatPrice(p.price,'UYU')}</p>
                            <div className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px]"
                              style={{background:primary}}>+</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {layout === 'list' && (
                  <div className="space-y-2">
                    {products.slice(0,3).map(p=>(
                      <div key={p.id} className={cn('flex items-center gap-2 bg-white border border-gray-100 p-2', rd)}>
                        <div className="h-10 w-10 bg-gray-100 shrink-0 overflow-hidden rounded-lg">
                          <img src={productImageUrl(p.images)} alt="" className="h-full w-full object-cover"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold text-gray-900 truncate">{p.name}</p>
                          <p className="text-[9px] font-bold" style={{color:primary}}>{formatPrice(p.price,'UYU')}</p>
                        </div>
                        <div className="h-6 w-6 rounded-lg flex items-center justify-center text-white text-xs shrink-0"
                          style={{background:primary}}>+</div>
                      </div>
                    ))}
                  </div>
                )}
                {layout === 'cards' && (
                  <div className="grid grid-cols-1 gap-3">
                    {products.slice(0,2).map(p=>(
                      <div key={p.id} className={cn('bg-white border border-gray-100 overflow-hidden', rd)}>
                        <div className="h-24 bg-gray-100">
                          <img src={productImageUrl(p.images)} alt="" className="h-full w-full object-cover"/>
                        </div>
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-gray-900">{p.name}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[10px] font-bold" style={{color:primary}}>{formatPrice(p.price,'UYU')}</p>
                            <button className={cn('px-2 py-1 text-[9px] font-bold text-white', rd)}
                              style={{background:primary}}>Agregar</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nota */}
          <p className="text-xs text-center text-gray-400">
            Vista previa aproximada · Guardá para ver los cambios en la tienda real
          </p>
        </div>
      </div>
    </div>
  )
}
