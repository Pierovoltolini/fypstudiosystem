// app/store/[slug]/layout.tsx
// Inyecta los colores del comercio como CSS vars globales para toda la tienda
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Business } from '@/types'

interface Props {
  children: React.ReactNode
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('name, description')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!data) return { title: 'Tienda' }

  return {
    title: { default: data.name, template: `%s | ${data.name}` },
    description: data.description ?? `Tienda online de ${data.name}`,
  }
}

export default async function StoreLayout({ children, params }: Props) {
  const supabase = await createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!business) notFound()

  const b = business as Business
  const primary = b.primary_color ?? '#000000'
  const secondary = b.secondary_color ?? '#ffffff'

  return (
    <div
      style={{
        '--brand-primary': primary,
        '--brand-secondary': secondary,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
