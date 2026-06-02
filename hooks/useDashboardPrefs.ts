'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDefaultWidgets, getDefaultSize } from '@/lib/dashboard-widgets'
import type { WidgetEntry, WidgetSize } from '@/lib/dashboard-widgets'
import type { VerticalGroup } from '@/lib/verticals'

function normalize(raw: unknown[]): WidgetEntry[] {
  return raw.map(item => {
    if (typeof item === 'string') return { id: item, size: getDefaultSize(item) }
    const e = item as WidgetEntry
    return { id: e.id, size: e.size ?? getDefaultSize(e.id) }
  })
}

function idsToEntries(ids: string[]): WidgetEntry[] {
  return ids.map(id => ({ id, size: getDefaultSize(id) }))
}

export function useDashboardPrefs(
  businessId:   string,
  userId:       string,
  group:        VerticalGroup,
  verticalSub?: string,
) {
  const supabase = createClient()
  const [widgets, setWidgets] = useState<WidgetEntry[]>(
    idsToEntries(getDefaultWidgets(group, verticalSub))
  )
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase
      .from('dashboard_preferences')
      .select('config')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config?.widgets && Array.isArray(data.config.widgets)) {
          setWidgets(normalize(data.config.widgets))
        }
        setLoaded(true)
      })
  }, [businessId, userId])

  const persist = useCallback(async (next: WidgetEntry[]) => {
    setWidgets(next)
    await supabase
      .from('dashboard_preferences')
      .upsert(
        {
          business_id: businessId,
          user_id:     userId,
          config:      { widgets: next },
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'business_id,user_id' }
      )
  }, [businessId, userId])

  const addWidget = useCallback((id: string) => {
    if (widgets.some(w => w.id === id)) return
    persist([...widgets, { id, size: getDefaultSize(id) }])
  }, [widgets, persist])

  const removeWidget = useCallback((id: string) => {
    persist(widgets.filter(w => w.id !== id))
  }, [widgets, persist])

  const resizeWidget = useCallback((id: string, size: WidgetSize) => {
    persist(widgets.map(w => w.id === id ? { ...w, size } : w))
  }, [widgets, persist])

  const reorderWidgets = useCallback((newOrder: WidgetEntry[]) => {
    persist(newOrder)
  }, [persist])

  return { widgets, loaded, addWidget, removeWidget, resizeWidget, reorderWidgets }
}
