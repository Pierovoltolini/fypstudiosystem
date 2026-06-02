// app/admin/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'
import VerticalSettings from './VerticalSettings'
import type { Business } from '@/types'
import type { VerticalType } from '@/lib/verticals'
import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'

export const metadata = { title: 'Configuración' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single()

  if (!business) redirect('/admin/onboarding')

  const verticalType = (business.vertical_type ?? 'general') as VerticalType

  const [hoursRes, branchesRes, staffRes] = await Promise.all([
    supabase.from('business_hours').select('*').eq('business_id', profile.business_id).order('day_of_week'),
    supabase.from('branches').select('id,name,address,phone,is_main').eq('business_id', profile.business_id).eq('active', true),
    supabase.from('staff').select('id,name,role').eq('business_id', profile.business_id).eq('active', true).order('name'),
  ])

  const biz = business as Record<string, unknown>

  return (
    <div className="animate-fade-in max-w-2xl">

      {/* Hero gradient card */}
      <div className="relative mb-8 rounded-2xl overflow-hidden shadow-2xl shadow-blue-300/40">
        {/* Gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-10 -right-10 h-52 w-52 rounded-full bg-sky-400/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 h-40 w-40 rounded-full bg-blue-300/20 blur-2xl pointer-events-none" />

        <div className="relative px-7 py-10 lg:px-10 lg:py-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20
                          text-white text-[10px] tracking-[0.28em] uppercase font-bold px-3.5 py-1.5 rounded-full mb-6">
            <Sparkles size={10} className="shrink-0" />
            FYP Studio
          </div>

          {/* Title */}
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.05] tracking-tight">
            Personaliza<br />
            <span className="text-sky-200">tu tienda</span>
          </h1>

          {/* Subtitle */}
          <p className="text-blue-100 font-light mt-4 text-sm leading-relaxed max-w-xs">
            Cada detalle cuenta. Hacé que tu negocio sea inconfundible.
          </p>

          {/* CTA */}
          <Link
            href="/admin/page-builder"
            className="inline-flex items-center gap-2 mt-7 bg-white text-blue-700 font-black
                       text-[11px] tracking-[0.12em] uppercase px-6 py-3 rounded-full
                       shadow-xl hover:bg-blue-50 hover:shadow-2xl transition-all active:scale-[0.97]"
          >
            Diseñar tienda <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Intro configuración */}
      <div className="mb-6 animate-fade-up">
        <div className="flex items-start gap-4 bg-white rounded-2xl border border-blue-100 px-6 py-5 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center text-white text-lg shrink-0 shadow-md shadow-blue-200">
            📋
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 leading-tight">
              Completá los datos de tu negocio
            </h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Toda la información que tus clientes necesitan para encontrarte, contactarte y reconocerte.
            </p>
          </div>
        </div>
      </div>

      {/* Configuración general */}
      <SettingsForm business={business as Business} />

      {/* Configuración del vertical */}
      <VerticalSettings
        businessId={profile.business_id}
        verticalType={verticalType}
        business={biz}
        hours={hoursRes.data ?? []}
        branches={branchesRes.data ?? []}
        staff={staffRes.data ?? []}
      />
    </div>
  )
}
