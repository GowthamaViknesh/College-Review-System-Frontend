import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, errorMessage } from './api'

// Puts the API's per-field validation errors under the matching form fields.
// Returns a message for anything that does not belong to a field, to show above the form.
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): string | null {
  if (error instanceof ApiError && error.errors.length) {
    const unmatched: string[] = []
    for (const { field, message } of error.errors) {
      // Joi quotes the field name: "email" must be a valid email -> must be a valid email
      const text = message.replace(/^"[^"]+"\s*/, '')
      if ((fields as readonly string[]).includes(field)) setError(field as Path<T>, { message: text.charAt(0).toUpperCase() + text.slice(1) })
      else unmatched.push(message)
    }
    return unmatched.length ? unmatched.join('. ') : null
  }

  // Conflicts name the field in the message, e.g. "email already exists"
  if (error instanceof ApiError && error.status === 409) {
    const field = fields.find((name) => error.message.toLowerCase().startsWith(String(name).toLowerCase()))
    if (field) {
      setError(field, { message: error.message.charAt(0).toUpperCase() + error.message.slice(1) })
      return null
    }
  }
  return errorMessage(error)
}
