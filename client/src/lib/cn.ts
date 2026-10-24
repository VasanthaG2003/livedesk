import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Joins class names, skipping falsy values. Conflicting Tailwind classes are
 * resolved so the later one wins (e.g. a `w-auto` override beats a base `w-full`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
