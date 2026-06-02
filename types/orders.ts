import type { Product } from './products'
import type { DeliveryRider } from './gastro'

export type OrderStatus   = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type DeliveryType  = 'delivery' | 'pickup' | 'dine_in'

export interface Customer {
  id: string; business_id: string; name: string; phone?: string | null
  address?: string | null; email?: string | null; total_orders: number
  total_spent: number; notes?: string | null; tags?: string[]
  created_at: string; updated_at: string
}

export interface OrderItem {
  id: string; order_id: string; product_id?: string | null
  product_name: string; unit_price: number; quantity: number; subtotal: number
  cost_price?: number | null; note?: string | null
  product?: Product | null
}

export interface TableSession {
  id: string; business_id: string; table_id: string
  opened_at: string; closed_at?: string | null
  people_count: number; waiter_name?: string | null; notes?: string | null
  total_billed: number; status: 'open' | 'closed' | 'voided'
  last_alert?: string | null; alert_at?: string | null; created_at: string
  table?: import('./gastro').RestaurantTable | null
  orders?: Order[]
}

export interface Order {
  id: string; business_id: string; customer_id?: string | null
  order_number: number; status: OrderStatus; payment_status: PaymentStatus
  confirmed_sale: boolean; delivery_type: DeliveryType; subtotal: number
  total: number; comment?: string | null; customer_name: string
  customer_phone?: string | null; customer_address?: string | null
  table_id?: string | null; session_id?: string | null; rider_id?: string | null
  delivery_fee?: number | null; delivery_zone?: string | null
  discount_code?: string | null; discount_amount?: number | null
  loyalty_discount?: number | null
  created_at: string; updated_at: string
  items?: OrderItem[]; customer?: Customer | null
  table?: { id: string; name: string; qr_token?: string; alert_after_minutes?: number | null } | null
  session?: TableSession | null
  rider?: DeliveryRider | null
}

export interface CartItem    { product: Product; quantity: number; note?: string }
export interface CheckoutFormData {
  name: string; phone: string; address?: string
  delivery_type: DeliveryType; comment?: string
}
export interface CreateOrderResponse { orderId: string; orderNumber: number }

export interface DiscountCode {
  id: string; business_id: string; code: string
  type: 'percent' | 'fixed'; value: number
  min_order: number; max_uses?: number | null; uses_count: number
  active: boolean; expires_at?: string | null; created_at: string
}

export interface DashboardStats {
  pendingOrders: number; confirmedOrders: number; totalRevenue: number
  todayRevenue: number; totalProducts: number; totalCustomers: number
  recentOrders: Order[]; topProducts: { name: string; count: number; revenue: number }[]
  cancelRate?: number
}
