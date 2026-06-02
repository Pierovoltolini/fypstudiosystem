// app/admin/barbershop/page.tsx — ruta legacy, redirige a /admin/servicios
import { redirect } from 'next/navigation'

export default function BarbershopPageRedirect() {
  redirect('/admin/servicios')
}
