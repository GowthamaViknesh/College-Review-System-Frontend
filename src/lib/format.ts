const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' })

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

// "2026-10-09" -> "fri". The API counts days in UTC, so the label is read in UTC too.
export const weekdayOf = (dateKey: string) => weekdayFormat.format(new Date(`${dateKey}T00:00:00Z`)).toLowerCase()

export const formatRating = (rating: number | null) => (rating === null ? '–' : rating.toFixed(1))

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export const initials = (name: string) => name.slice(0, 2).toUpperCase()

// Joins class names, skipping anything falsy
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
