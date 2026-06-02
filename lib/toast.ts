// lib/toast.ts — wrapper de Sonner con mensajes consistentes en español
export { toast } from 'sonner'

import { toast as _toast } from 'sonner'

export const toastSuccess = (msg: string) => _toast.success(msg)
export const toastError   = (msg: string) => _toast.error(msg)
export const toastInfo    = (msg: string) => _toast.info(msg)
export const toastLoading = (msg: string) => _toast.loading(msg)

export const toastPromise = <T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string }
) => _toast.promise(promise, messages)
