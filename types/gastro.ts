export interface BusinessHours {
  id: string; business_id: string; branch_id?: string | null
  day_of_week: number; is_open: boolean; open_time: string; close_time: string
}

export interface Combo {
  id: string; business_id: string; name: string; description?: string | null
  price: number; image_url?: string | null; active: boolean; featured: boolean
  valid_from?: string | null; valid_until?: string | null; created_at: string
  items?: ComboItem[]
}

export interface ComboItem {
  id: string; combo_id: string; product_id?: string | null
  product_name: string; quantity: number
}

export type KitchenStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled'
export const KITCHEN_FLOW: KitchenStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered']

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'unavailable' | 'waiting_attention' | 'bill_requested' | 'needs_cleaning'
export type TableShape  = 'square' | 'round' | 'rectangle'

export interface RestaurantTable {
  id: string; business_id: string; name: string; section?: string | null
  capacity: number; shape: TableShape; color: string
  x_pos: number; y_pos: number; status: TableStatus
  active: boolean; sort_order: number; notes?: string | null
  qr_token: string; alert_after_minutes?: number | null
  created_at: string; updated_at: string
}

export type TableSessionStatus = 'open' | 'closed' | 'voided'

export interface DeliveryRider {
  id: string; business_id: string; name: string
  phone?: string | null; active: boolean; created_at: string; updated_at: string
}

export interface TableReservation {
  id: string; business_id: string; table_id?: string | null
  customer_name: string; customer_phone?: string | null
  party_size: number; date: string; time: string; notes?: string | null
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'noshow'
  created_at: string; updated_at: string
  table?: { id: string; name: string } | null
}
