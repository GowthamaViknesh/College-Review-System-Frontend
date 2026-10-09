const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' })

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

// How long ago something happened, in words: "Just now", "5 minutes ago", "Yesterday".
// Anything older than a week is shown as its date, which reads better than "23 days ago".
const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
export function formatAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const sentence = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    const text = relativeFormat.format(-value, unit)
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  if (seconds < 3600) return sentence(Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return sentence(Math.floor(seconds / 3600), 'hour')
  if (seconds < 7 * 86_400) return sentence(Math.floor(seconds / 86_400), 'day')
  return formatDate(iso)
}

// "2026-10-09" -> "fri". The API counts days in UTC, so the label is read in UTC too.
export const weekdayOf = (dateKey: string) => weekdayFormat.format(new Date(`${dateKey}T00:00:00Z`)).toLowerCase()

export const formatRating = (rating: number | null) => (rating === null ? '–' : rating.toFixed(1))

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

// How a person's name is shown anywhere in the app: first letter capital, the rest as they typed it.
// Display only. The stored username is unchanged, so logging in and editing it use the real value.
export const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

export const initials = (name: string) => name.slice(0, 2).toUpperCase()

// Pictures are stored far larger than a thumbnail needs. Cloudinary resizes on request when the size is
// written into the address, so a 48px tile downloads a small file instead of the full picture.
// Addresses from anywhere else are returned unchanged.
export function thumbnail(url: string, size: number) {
  const marker = '/image/upload/'
  // Twice the shown size, so it stays sharp on high-density screens
  return url.includes(marker) ? url.replace(marker, `${marker}c_fill,w_${size * 2},h_${size * 2},f_auto,q_auto/`) : url
}

// Joins class names, skipping anything falsy
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
