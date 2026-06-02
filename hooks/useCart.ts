'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/types'

interface CartStore {
  items: CartItem[]
  businessSlug: string | null
  addItem: (product: Product, businessSlug: string) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateNote: (productId: string, note: string) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
  isEmpty: () => boolean
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      businessSlug: null,

      addItem: (product, businessSlug) => set((state) => {
        if (state.businessSlug && state.businessSlug !== businessSlug)
          return { businessSlug, items: [{ product, quantity: 1 }] }
        const existing = state.items.find(i => i.product.id === product.id)
        if (existing)
          return { businessSlug, items: state.items.map(i =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )}
        return { businessSlug, items: [...state.items, { product, quantity: 1 }] }
      }),

      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.product.id !== productId),
      })),

      updateQuantity: (productId, quantity) => set((state) => ({
        items: quantity <= 0
          ? state.items.filter(i => i.product.id !== productId)
          : state.items.map(i => i.product.id === productId ? { ...i, quantity } : i),
      })),

      updateNote: (productId, note) => set((state) => ({
        items: state.items.map(i => i.product.id === productId ? { ...i, note } : i),
      })),

      clearCart: () => set({ items: [], businessSlug: null }),
      total: () => get().items.reduce((acc, { product, quantity }) => acc + product.price * quantity, 0),
      itemCount: () => get().items.reduce((acc, { quantity }) => acc + quantity, 0),
      isEmpty: () => get().items.length === 0,
    }),
    {
      name: 'fyp-cart',
      partialize: (state) => ({ items: state.items, businessSlug: state.businessSlug }),
    }
  )
)
