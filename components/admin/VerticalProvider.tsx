// components/admin/VerticalProvider.tsx
// Wraps the admin app so any client component can call useVertical()
// instead of re-fetching business/profile data from the DB.
'use client'
import { VerticalContext, type VerticalContextValue } from '@/lib/vertical-context'

export default function VerticalProvider({
  value,
  children,
}: {
  value:    VerticalContextValue
  children: React.ReactNode
}) {
  return (
    <VerticalContext.Provider value={value}>
      {children}
    </VerticalContext.Provider>
  )
}
