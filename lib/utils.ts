import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatPrice(amount: number, currency = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: 'short' }).format(new Date(dateStr))
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmado', preparing: 'Preparando',
    ready: 'Listo', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
  }
  return labels[status] ?? status
}

export function orderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800', ready: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800', delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function truncate(str: string, maxLength: number): string {
  return str.length <= maxLength ? str : str.slice(0, maxLength).trimEnd() + '…'
}

export function productImageUrl(images: string[]): string {
  return images?.[0] ?? '/placeholder-product.png'
}
