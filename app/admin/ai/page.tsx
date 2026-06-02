// app/admin/ai/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AIAssistant from './AIAssistant'
import PlanGate from '@/components/admin/PlanGate'
import AIUsageBanner from '@/components/admin/AIUsageBanner'
import { Sparkles } from 'lucide-react'
export const metadata = { title: 'IA' }

export default async function AIPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IA Assistant</h1>
          <p className="text-sm text-gray-400 mt-0.5">Creá productos, promos e insights con IA</p>
        </div>
      </div>

      <AIUsageBanner />

      <PlanGate
        required="pro"
        feature="IA Assistant"
        description="La generación de contenido con IA está disponible en el plan Pro y Premium."
      >
        <AIAssistant />
      </PlanGate>
    </div>
  )
}
