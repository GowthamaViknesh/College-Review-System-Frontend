import { CircleAlert, CircleCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/format'
import { errorMessage } from '../lib/api'

interface ToastItem {
  id: number
  kind: 'success' | 'error'
  text: string
}

interface ToastValue {
  success: (text: string) => void
  // Accepts whatever was thrown and shows its message
  error: (error: unknown) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, kind, text }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const value = useMemo<ToastValue>(
    () => ({
      success: (text) => show('success', text),
      error: (error) => show('error', typeof error === 'string' ? error : errorMessage(error)),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn('pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-float', toast.kind === 'success' ? 'bg-ink' : 'bg-red-600')}
          >
            {toast.kind === 'success' ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}
