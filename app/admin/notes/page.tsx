import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotesClient from './NotesClient'

export const metadata = { title: 'Notas' }
export const dynamic = 'force-dynamic'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('business_id').eq('user_id', user.id).single()
  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, content, tags, created_at, updated_at')
    .eq('business_id', profile.business_id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  return (
    <NotesClient
      businessId={profile.business_id}
      userId={user.id}
      initialNotes={notes ?? []}
    />
  )
}
