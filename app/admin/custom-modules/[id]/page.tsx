import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CustomModuleClient from './CustomModuleClient'
import type { CustomModule } from '@/types'

interface Props { params: Promise<{ id: string }> }

export default async function CustomModulePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: module } = await supabase
    .from('custom_modules')
    .select('*')
    .eq('id', id)
    .eq('business_id', profile.business_id)
    .single()

  if (!module) notFound()
  if (!module.active) {
    return (
      <div className="max-w-xl mx-auto pt-20 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Módulo pendiente de activación</h1>
        <p className="text-sm text-gray-500">
          Este módulo adicional requiere activación manual. Contactanos para habilitarlo.
        </p>
      </div>
    )
  }

  const { data: entries } = await supabase
    .from('custom_module_entries')
    .select('*')
    .eq('module_id', id)
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <CustomModuleClient
      module={module as CustomModule}
      initialEntries={entries ?? []}
    />
  )
}
