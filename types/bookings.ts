export interface Branch {
  id: string; business_id: string; name: string
  address?: string | null; phone?: string | null; whatsapp?: string | null
  city?: string | null; is_main: boolean; active: boolean; created_at: string
}

export interface Staff {
  id: string; business_id: string; branch_id?: string | null
  name: string; role: string; bio?: string | null; avatar_url?: string | null
  phone?: string | null; color: string; active: boolean
  created_at: string; updated_at: string
  branch?: Branch | null
}

export interface StaffSchedule {
  id: string; staff_id: string; business_id: string
  day_of_week: number; start_time: string; end_time: string
  break_start?: string | null; break_end?: string | null; is_working: boolean
}

export type StaffScheduleFull = Omit<StaffSchedule, 'id'> & { id?: string }

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled' | 'noshow'

export interface Booking {
  id: string; business_id: string; branch_id?: string | null
  staff_id?: string | null; product_id?: string | null
  customer_name: string; customer_phone?: string | null; customer_email?: string | null
  date: string; start_time: string; end_time: string
  duration_min: number; status: BookingStatus
  notes?: string | null; price?: number | null; source: string
  created_at: string; updated_at: string
  staff?: Staff | null; branch?: Branch | null
  product?: { name: string; price: number } | null
}

export interface BlockedSlot {
  id: string; business_id: string; staff_id?: string | null
  branch_id?: string | null; date: string; time_slot?: string | null
  reason?: string | null; created_at: string
}

export interface BlockedRange {
  id: string; business_id: string; staff_id?: string | null
  date?: string | null; date_from?: string | null; date_to?: string | null
  time_slot?: string | null; time_from?: string | null; time_to?: string | null
  reason?: string | null; created_at?: string | null
}

export interface ClosedDay {
  id: string; business_id: string
  date?: string | null; date_from?: string | null; date_to?: string | null
  reason?: string | null; created_at?: string | null
}

export interface StaffPermission {
  id: string; profile_id: string; business_id: string
  can_view_orders: boolean; can_manage_orders: boolean
  can_view_products: boolean; can_manage_products: boolean
  can_view_customers: boolean; can_view_analytics: boolean
  can_view_inventory: boolean; can_manage_inventory: boolean
  can_use_pos: boolean; can_manage_tables: boolean
  created_at: string; updated_at: string
}
