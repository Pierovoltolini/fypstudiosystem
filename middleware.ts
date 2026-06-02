import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Dominio permitido: NEXT_PUBLIC_APP_URL (definilo en .env.local y en producción)
// En dev también se permiten orígenes localhost para no bloquear el desarrollo.
function corsHeaders(origin: string | null): Record<string, string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const allowed =
    origin === appUrl ||
    (process.env.NODE_ENV !== 'production' && origin?.startsWith('http://localhost'))
      ? origin!
      : appUrl

  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  }
}

export async function middleware(request: NextRequest) {
  const path   = request.nextUrl.pathname
  const origin = request.headers.get('origin')

  // 1. Preflight CORS — responder antes de cualquier lógica de auth
  if (path.startsWith('/api/') && request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

  // 2. Rutas de API — agregar headers CORS y dejar pasar (cada ruta maneja su propia auth)
  if (path.startsWith('/api/')) {
    const res = NextResponse.next()
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v))
    return res
  }

  // 3. Rutas de la app — lógica de auth de Supabase
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (path.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/superadmin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('redirectTo', path)
      return NextResponse.redirect(url)
    }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'superadmin')
      return NextResponse.redirect(new URL('/admin', request.url))
  }

  if (path.startsWith('/auth/login') && user)
    return NextResponse.redirect(new URL('/admin', request.url))

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
