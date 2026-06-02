// types/index.ts — re-exports para backward compatibility
// Los tipos están organizados en archivos por dominio:
//   business.ts   → Business, Profile, Plan, UserRole
//   orders.ts     → Order, OrderItem, Customer, Cart, DiscountCode
//   products.ts   → Product, Category, ProductVariant
//   inventory.ts  → InventoryItem, Supplier, PurchaseOrder
//   bookings.ts   → Booking, Staff, Branch, StaffPermission
//   gastro.ts     → RestaurantTable, Combo, DeliveryRider
//   loyalty.ts    → LoyaltyPoint, CashRegister, AI types

export * from './business'
export * from './orders'
export * from './products'
export * from './inventory'
export * from './bookings'
export * from './gastro'
export * from './loyalty'
export * from './custom-modules'
