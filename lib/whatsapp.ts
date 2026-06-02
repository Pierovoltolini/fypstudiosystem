import type { CartItem, CheckoutFormData } from '@/types'

export function buildWhatsAppMessage(items: CartItem[], checkout: CheckoutFormData, currency = 'UYU'): string {
  const fmt = (n: number) => new Intl.NumberFormat('es-UY', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(n)

  const lines = items.map(({ product, quantity, note }) => {
    const noteLine = note?.trim() ? `\n  ↳ ${note.trim()}` : ''
    return `• ${quantity}x ${product.name} — ${fmt(product.price * quantity)}${noteLine}`
  }).join('\n')

  const total = items.reduce((acc, { product, quantity }) => acc + product.price * quantity, 0)
  const deliveryLine = checkout.delivery_type === 'delivery'
    ? `📍 Dirección: ${checkout.address ?? 'a confirmar'}`
    : '🏃 Retiro en local'
  const commentLine = checkout.comment ? `\n💬 Comentario: ${checkout.comment}` : ''

  const message =
    `Hola! Quiero hacer este pedido:\n\n` +
    `*Productos:*\n${lines}\n\n` +
    `*Total: ${fmt(total)}*\n\n` +
    `*Mis datos:*\n` +
    `Nombre: ${checkout.name}\n` +
    `Teléfono: ${checkout.phone}\n` +
    `${deliveryLine}${commentLine}`

  return encodeURIComponent(message)
}

export function getWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`
}
