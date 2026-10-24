import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from './api'

/**
 * Puts server-side field errors on the matching inputs. Returns a message for
 * anything that isn't tied to a field, to show above the form.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string {
  if (isApiError(err) && err.fields) {
    let placed = false
    for (const [key, message] of Object.entries(err.fields)) {
      if ((fields as readonly string[]).includes(key)) {
        setError(key as Path<T>, { message })
        placed = true
      }
    }
    if (placed) return ''
  }
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}
