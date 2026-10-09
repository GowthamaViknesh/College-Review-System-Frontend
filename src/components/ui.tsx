import { ChevronLeft, ChevronRight, LoaderCircle, Star, X } from 'lucide-react'
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn, formatRating } from '../lib/format'
import type { Meta } from '../lib/types'

// ---------- Button ----------

const BUTTON_VARIANTS = {
  primary: 'bg-ink text-white hover:bg-zinc-800 disabled:bg-zinc-400',
  secondary: 'bg-white text-ink ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 disabled:text-zinc-400',
  ghost: 'text-zinc-600 hover:bg-zinc-200/70 hover:text-ink disabled:text-zinc-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
}

const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-11 px-5 text-sm',
  icon: 'size-9',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS
  size?: keyof typeof BUTTON_SIZES
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

// ---------- Surfaces ----------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-3xl bg-panel p-5', className)}>{children}</div>
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'dark'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-zinc-200/80 text-zinc-700',
    good: 'bg-emerald-100 text-emerald-800',
    bad: 'bg-red-100 text-red-800',
    warn: 'bg-amber-100 text-amber-800',
    dark: 'bg-ink text-white',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl bg-ink font-display text-sm font-medium text-white uppercase', className)} aria-hidden>
      {name.slice(0, 2)}
    </span>
  )
}

// ---------- Form fields ----------

const FIELD = 'w-full rounded-xl bg-white px-4 text-sm ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-ink focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-500'

// A label, the field itself and its error message, wired together for screen readers
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (ids: { id: string; describedBy?: string }) => ReactNode }) {
  const id = useId()
  const messageId = `${id}-message`
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? messageId : undefined })}
      {(error || hint) && (
        <p id={messageId} className={cn('mt-1.5 text-xs', error ? 'font-medium text-red-600' : 'text-zinc-500')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, 'h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'min-h-28 py-3', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, 'h-11 cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  )
}

// ---------- Feedback ----------

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {label}…
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-12 text-center">
      <p className="font-display text-lg font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{children}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {children}
    </p>
  )
}

// ---------- Ratings ----------

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={cn('size-4', star <= Math.round(value) ? 'fill-star text-star' : 'fill-zinc-200 text-zinc-200')} aria-hidden />
      ))}
    </span>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className="cursor-pointer rounded-lg p-1 transition-transform hover:scale-110"
        >
          <Star className={cn('size-8', star <= value ? 'fill-star text-star' : 'fill-zinc-200 text-zinc-200')} aria-hidden />
        </button>
      ))}
    </div>
  )
}

// The average rating drawn as a ring that fills in proportion to rating / 5
export function RatingRing({ rating, size = 56 }: { rating: number | null; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const filled = rating === null ? 0 : (rating / 5) * circumference

  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={rating === null ? 'Not rated yet' : `Rated ${rating} out of 5`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-zinc-200" />
        {/* With no rating there is no arc to draw; a zero-length arc with round ends would show as a dot */}
        {rating !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="stroke-ink"
          />
        )}
      </svg>
      <span className="absolute font-display text-sm font-medium">{formatRating(rating)}</span>
    </span>
  )
}

// ---------- Pagination ----------

export function Pagination({ meta, onPage }: { meta?: Meta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null
  const first = (meta.page - 1) * meta.limit + 1
  const last = Math.min(meta.page * meta.limit, meta.total)

  return (
    <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Pagination">
      <p className="text-sm text-zinc-500">
        {first}–{last} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="min-w-16 text-center text-sm font-semibold">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="secondary" size="icon" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

// ---------- Modal ----------

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while the dialog is open
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('w-full rounded-3xl bg-white p-6 shadow-float sm:p-8', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl leading-tight font-medium">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" aria-hidden />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

// A yes/no question before something that cannot be undone
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  loading,
  error,
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-zinc-600">{children}</div>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
