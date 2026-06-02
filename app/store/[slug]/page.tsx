// app/store/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StoreHero from '@/components/store/StoreHero'
import StoreSections from '@/components/store/StoreSections'
import StoreFront from '@/components/store/StoreFront'
import RealEstateStorefront from '@/components/store/RealEstateStorefront'
import { getVerticalGroup } from '@/lib/verticals'
import type { Business, Category, Product, ProductVariant } from '@/types'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('name, description')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()
  if (!data) return { title: 'Tienda' }
  return {
    title: data.name,
    description: data.description ?? `Tienda online de ${data.name}`,
  }
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  // Cargar negocio con todos los campos de configuración
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!business) notFound()

  const b = business as Business & { page_config?: Record<string, unknown> }

  // Leer page_config del negocio
  const pageConfig   = b.page_config ?? {}
  const heroConfig   = (pageConfig.hero   as Record<string, unknown>) ?? {}
  const layoutConfig = (pageConfig.layout as Record<string, unknown>) ?? {}

  // Cargar datos según vertical
  const group        = getVerticalGroup(b.vertical_type)
  const isServicio   = group === 'servicios' || b.vertical_type === 'barbershop' || b.vertical_type === 'beauty'
  const isGastro     = group === 'gastro'    || b.vertical_type === 'food'
  const isRealEstate = b.vertical_type === 'real_estate'

  const today10 = new Date().toISOString().slice(0, 10)

  const [catsRes, prodsRes, staffRes, hoursRes, combosRes, tablesRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('business_id', b.id)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('products')
      .select('*, category:categories(id,name,slug)')
      .eq('business_id', b.id)
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false }),
    // Staff para servicios (barbershop, beauty, salud, etc.)
    isServicio
      ? supabase
          .from('staff')
          .select('id,name,role,avatar_url,color,bio')
          .eq('business_id', b.id)
          .eq('active', true)
          .order('name')
      : Promise.resolve({ data: [] }),
    // Horarios para gastro
    isGastro
      ? supabase
          .from('business_hours')
          .select('*')
          .eq('business_id', b.id)
          .order('day_of_week')
      : Promise.resolve({ data: [] }),
    // Combos para gastro (filtramos fechas en el servidor)
    isGastro
      ? supabase
          .from('combos')
          .select('*, items:combo_items(id,product_id,product_name,quantity)')
          .eq('business_id', b.id)
          .eq('active', true)
          .or(`valid_from.is.null,valid_from.lte.${today10}`)
          .or(`valid_until.is.null,valid_until.gte.${today10}`)
          .order('featured', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Mesas para gastro (lookup de QR ?mesa=qr_token)
    isGastro
      ? supabase
          .from('restaurant_tables')
          .select('id,name,qr_token')
          .eq('business_id', b.id)
          .eq('active', true)
      : Promise.resolve({ data: [] }),
  ])

  const categories   = (catsRes.data ?? []) as Category[]
  const rawProducts  = (prodsRes.data ?? []) as Product[]
  const staff        = (staffRes.data ?? []) as { id:string;name:string;role:string;avatar_url?:string|null;color:string;bio?:string|null }[]
  const hours        = (hoursRes.data ?? []) as { day_of_week:number; is_open:boolean; open_time:string; close_time:string }[]
  const combos       = (combosRes.data ?? []) as import('@/types').Combo[]
  const storeTables  = (tablesRes.data ?? []) as { id: string; name: string; qr_token: string }[]

  // Compute open/closed for gastro
  let isOpen: boolean | null = null
  if (isGastro && hours.length > 0) {
    const now     = new Date()
    const dow     = now.getDay()
    const hhmm    = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const today   = hours.find(h => h.day_of_week === dow)
    isOpen = !!(today?.is_open && hhmm >= today.open_time && hhmm <= today.close_time)
  }

  // Fetch active variants for all products (if any)
  let products = rawProducts
  if (rawProducts.length > 0) {
    const ids = rawProducts.map(p => p.id)
    const { data: variantRows } = await supabase
      .from('product_variants')
      .select('id,product_id,name,sku,price_modifier,stock,active,sort_order')
      .in('product_id', ids)
      .eq('active', true)
      .order('sort_order')

    if (variantRows && variantRows.length > 0) {
      const varMap = new Map<string, ProductVariant[]>()
      for (const v of variantRows) {
        const list = varMap.get(v.product_id) ?? []
        list.push(v as unknown as ProductVariant)
        varMap.set(v.product_id, list)
      }
      products = rawProducts.map(p => ({
        ...p,
        variants: varMap.get(p.id) ?? [],
      }))
    }
  }

  // Opciones de layout desde page_config
  const showFeatured   = layoutConfig.showFeatured   !== false
  const showCategories = layoutConfig.showCategories !== false

  // ── INMOBILIARIA: layout completamente distinto, sin carrito ─────────
  if (isRealEstate) {
    return (
      <div
        style={{
          '--brand-primary':   b.primary_color   ?? '#1565FF',
          '--brand-secondary': b.secondary_color ?? '#ffffff',
        } as React.CSSProperties}
      >
        <StoreHero
          business={b}
          heroConfig={{
            style:    (heroConfig.style    as 'gradient' | 'image' | 'minimal' | 'dark') ?? 'gradient',
            title:    (heroConfig.title    as string) ?? b.name,
            subtitle: (heroConfig.subtitle as string) ?? 'Encontrá la propiedad ideal',
            ctaText:  (heroConfig.ctaText  as string) ?? 'Ver propiedades',
          }}
          slug={params.slug}
        />
        <RealEstateStorefront
          business={b}
          categories={categories}
          products={products}
        />
      </div>
    )
  }

  // ── RESTO DE VERTICALES: flow estándar con carrito ────────────────────
  return (
    <div
      style={{
        '--brand-primary':   b.primary_color   ?? '#1565FF',
        '--brand-secondary': b.secondary_color ?? '#ffffff',
      } as React.CSSProperties}
    >
      {/* ── HERO — siempre visible, estilo según vertical ── */}
      <StoreHero
        business={b}
        heroConfig={{
          style:    (heroConfig.style    as 'gradient' | 'image' | 'minimal' | 'dark') ?? 'gradient',
          title:    (heroConfig.title    as string) ?? b.name,
          subtitle: (heroConfig.subtitle as string) ?? undefined,
          ctaText:  (heroConfig.ctaText  as string) ?? undefined,
        }}
        slug={params.slug}
      />

      {/* ── SECCIONES EXTRA (reservas, equipo, contacto) ── */}
      <StoreSections
        business={b}
        slug={params.slug}
        staff={staff}
        pageConfig={pageConfig}
      />

      {/* ── PRODUCTOS / MENÚ ── */}
      {products.length > 0 && (
        <div id="productos">
          <StoreFront
            business={b}
            categories={categories}
            products={products}
            combos={combos}
            tables={storeTables}
            showFeatured={showFeatured}
            showCategories={showCategories}
            isOpen={isOpen}
          />
        </div>
      )}

      {/* Si no tiene productos pero es servicios, mostrar CTA final */}
      {products.length === 0 && isServicio && (
        <div className="max-w-2xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-gray-400 mb-4">
            Próximamente más información
          </p>
        </div>
      )}
    </div>
  )
}
