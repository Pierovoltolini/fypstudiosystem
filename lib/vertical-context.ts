// lib/vertical-context.ts
// Single source of truth for vertical context — read in any client component via useVertical()
'use client'
import { createContext, useContext } from 'react'
import type { Business, UserRole } from '@/types'
import type { VerticalConfig, VerticalGroup } from '@/lib/verticals'

export interface VerticalContextValue {
  business:    Business
  businessId:  string
  userId:      string
  vertical:    VerticalConfig
  group:       VerticalGroup
  verticalSub: string   // sub-vertical key ('barberia', 'restaurante', etc.) o legacy type como fallback
  role:        UserRole
  currency:    string
  color:       string   // primary_color
  userEmail:   string
}

export const VerticalContext = createContext<VerticalContextValue | null>(null)

export function useVertical(): VerticalContextValue {
  const ctx = useContext(VerticalContext)
  if (!ctx) throw new Error('useVertical must be used inside VerticalProvider')
  return ctx
}
