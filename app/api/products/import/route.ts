import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

interface ImportRow {
  name: string
  description?: string
  price: number
  category_name?: string
  featured?: boolean
  active?: boolean
  tags?: string[]
}

export async function POST(req: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('business_id').eq('user_id', user.id).single()
    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio asociado' }, { status: 403 })

    // ── Rate limit ──────────────────────────────────────────────
    const limited = await checkRateLimit(`products-import:${user.id}`, 5, '1 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiadas importaciones. Esperá un momento.' }, { status: 429 })

    // ── Validar body ────────────────────────────────────────────
    const { businessId, rows } = await req.json() as { businessId: string; rows: ImportRow[] }
    if (!businessId || !rows?.length)
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    // Verificar que el negocio del token coincide con el del body
    if (profile.business_id !== businessId)
      return NextResponse.json({ error: 'Sin acceso a este negocio' }, { status: 403 })

    const service = createServiceClient()

    // Fetch existing categories
    const { data: existingCats } = await service
      .from('categories')
      .select('id, name')
      .eq('business_id', businessId)

    const catMap = new Map<string, string>(
      (existingCats ?? []).map(c => [c.name.toLowerCase().trim(), c.id])
    )

    // Collect unique new category names to create
    const newCatNames = Array.from(new Set(
      rows
        .map(r => r.category_name?.trim())
        .filter((n): n is string => !!n && !catMap.has(n.toLowerCase()))
    ))

    if (newCatNames.length > 0) {
      const { data: created } = await service
        .from('categories')
        .insert(newCatNames.map((name, i) => ({
          business_id: businessId,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          sort_order: (existingCats?.length ?? 0) + i,
          active: true,
        })))
        .select('id, name')
      ;(created ?? []).forEach(c => catMap.set(c.name.toLowerCase().trim(), c.id))
    }

    // Build product inserts
    const inserts = rows.map(r => ({
      business_id:  businessId,
      name:         r.name.trim(),
      slug: r.name.trim().toLowerCase()
        .replace(/[^a-z0-9À-ɏ]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Math.random().toString(36).slice(2, 7),
      description:  r.description?.trim() || null,
      price:        r.price,
      category_id:  r.category_name ? (catMap.get(r.category_name.toLowerCase().trim()) ?? null) : null,
      featured:     r.featured ?? false,
      active:       r.active ?? true,
      tags:         r.tags ?? [],
      images:       [] as string[],
      product_type: 'simple' as const,
    }))

    const { data: inserted, error } = await service
      .from('products')
      .insert(inserts)
      .select('id')

    if (error) throw error

    return NextResponse.json({ imported: inserted?.length ?? 0 })
  } catch (err) {
    console.error('[products/import]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
