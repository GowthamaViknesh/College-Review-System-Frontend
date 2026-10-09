import { ImageIcon, Upload, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ApiError, errorMessage } from '../lib/api'
import { cn } from '../lib/format'
import { Button } from './ui'

// The same limits the API applies, checked here first so a wrong file is refused before it is sent
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PICTURE_BYTES = 5 * 1024 * 1024

function pictureProblem(file: File): string | null {
  if (!PICTURE_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP picture.'
  if (file.size > MAX_PICTURE_BYTES) return `That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`
  return null
}

// The API's reason for refusing a picture is in its field errors, not the general "Validation failed"
export function uploadErrorMessage(error: unknown) {
  return (error instanceof ApiError && error.errors[0]?.message) || errorMessage(error)
}

// An address for showing a file the person has just chosen, before it is uploaded anywhere
export function usePreview(file: File | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const created = URL.createObjectURL(file)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [file])
  return url
}

interface PicturePickerProps {
  label: string
  // The picture to show: the saved one, or one just chosen. null shows the placeholder.
  preview: string | null
  placeholder?: ReactNode
  busy?: boolean
  // Stacked is for a column of its own: one tall frame that is clicked to choose the picture.
  // The default is a small preview with buttons beside it.
  stacked?: boolean
  error?: string | null
  onPick: (file: File) => void
  onRemove?: () => void
}

// A thumbnail with "choose" and "remove" buttons. What happens to the chosen file is up to the page:
// the profile uploads it straight away, the college form waits until the form is saved.
export function PicturePicker({ label, preview, placeholder, busy = false, stacked = false, error, onPick, onRemove }: PicturePickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const [problem, setProblem] = useState<string | null>(null)

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Cleared so choosing the same file again (after removing it, say) is still noticed
    event.target.value = ''
    if (!file) return

    const found = pictureProblem(file)
    setProblem(found)
    if (!found) onPick(file)
  }

  const message = problem ?? error
  const fileInput = <input ref={input} type="file" accept={PICTURE_TYPES.join(',')} className="hidden" tabIndex={-1} aria-labelledby={labelId} onChange={choose} />

  // Stacked: the frame is the button. It fills the height of whatever it sits beside, shows the
  // picture once there is one, and is clicked to choose or change it.
  if (stacked) {
    return (
      <div className="flex h-full flex-col">
        <p id={labelId} className="mb-1.5 text-sm font-semibold">
          {label}
        </p>
        <div className="relative min-h-44 flex-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            aria-describedby={labelId}
            className={cn(
              'group absolute inset-0 grid cursor-pointer place-items-center overflow-hidden rounded-2xl text-center transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:cursor-wait',
              preview ? 'ring-1 ring-zinc-200' : 'border-[1.5px] border-dashed border-zinc-300 bg-zinc-50 hover:border-ink hover:bg-zinc-100',
            )}
          >
            {preview ? (
              <>
                <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
                {/* Says what a click does, without covering the picture until it is pointed at */}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-ink/70 py-2 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Upload className="size-3.5" aria-hidden />
                  Change picture
                </span>
              </>
            ) : (
              <span className="px-3">
                <ImageIcon className="mx-auto size-8 text-zinc-400" aria-hidden />
                <span className="mt-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
                  <Upload className="size-3.5" aria-hidden />
                  Choose picture
                </span>
                <span className="mt-1 block text-xs text-zinc-500">JPG, PNG or WebP, up to 5 MB</span>
              </span>
            )}
          </button>
          {preview && onRemove && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setProblem(null)
                onRemove()
              }}
              aria-label="Remove picture"
              title="Remove picture"
              className="absolute top-2 right-2 grid size-8 cursor-pointer place-items-center rounded-full bg-white/95 text-ink shadow-sm transition-colors hover:bg-red-600 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {/* The same line a text field has under it, so the frame ends level with the field beside it */}
        <p className={cn('mt-1.5 text-xs', message ? 'font-medium text-red-600' : 'text-zinc-500')} role={message ? 'alert' : undefined}>
          {message ?? 'Optional'}
        </p>
        {fileInput}
      </div>
    )
  }

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-sm font-semibold">
        {label}
      </p>
      <div className="flex items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-zinc-400 ring-1 ring-zinc-200">
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : (placeholder ?? <ImageIcon className="size-6" aria-hidden />)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()} aria-describedby={labelId}>
              {!busy && <Upload className="size-3.5" aria-hidden />}
              {preview ? 'Change picture' : 'Choose picture'}
            </Button>
            {preview && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setProblem(null)
                  onRemove()
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className={cn('mt-1.5 text-xs', message ? 'font-medium text-red-600' : 'text-zinc-500')} role={message ? 'alert' : undefined}>
            {message ?? 'JPG, PNG or WebP, up to 5 MB.'}
          </p>
        </div>
      </div>
      {fileInput}
    </div>
  )
}
