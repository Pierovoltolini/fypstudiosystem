// app/admin/food/page.tsx — ruta legacy, redirige a /admin/gastro
import { redirect } from 'next/navigation'

export default function FoodPageRedirect() {
  redirect('/admin/gastro')
}
