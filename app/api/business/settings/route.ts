// app/api/business/settings/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

const ALLOWED = [
  'name','whatsapp','address','currency','primary_color','secondary_color',
  'logo_url','banner_url','instagram','tiktok','website','vertical_type','vertical_sub',
  'delivery_enabled','pickup_enabled','delivery_fee','min_order','estimated_time',
  'page_config','enabled_modules','dashboard_config',
]

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('business_id').eq('user_id', user.id).single()

    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })

    const limited = await checkRateLimit(`biz-settings:${user.id}`, 10, '1 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })

    const body = await req.json()
    const payload: Record<string, unknown> = {}

    for (const key of ALLOWED) {
      if (!(key in body)) continue
      // Limpiezas específicas
      if (key === 'whatsapp')        payload[key] = (body[key] ?? '').replace(/[^\d]/g, '') || null
      else if (key === 'name')       payload[key] = (body[key] ?? '').trim() || null
      else if (['address','logo_url','banner_url','website'].includes(key))
                                     payload[key] = (body[key] ?? '').trim() || null
      else if (['instagram','tiktok'].includes(key))
                                     payload[key] = (body[key] ?? '').trim().replace(/^@/,'') || null
      else                           payload[key] = body[key]
    }

    if (!payload.name && 'name' in payload)
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('businesses').update(payload).eq('id', profile.business_id)
      .select('id,name,whatsapp,slug,vertical_type,primary_color').single()

    if (error) {
      console.error('[settings PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, business: data })
  } catch (err) {
    console.error('[settings PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
