import type { TicketCategory } from '@livedesk/shared'

// Validated with the dataviz palette checker (lightness, chroma, colour-blind
// separation of neighbouring slices). Change these only after re-running it.
export const CATEGORY_COLORS: Record<TicketCategory, string> = {
  bug: '#e5484d',
  billing: '#3e63dd',
  account: '#30a46c',
  feature: '#c08a08',
  performance: '#8e4ec6',
  other: '#0894b3',
}

export const TREND_COLORS = {
  created: '#3e63dd',
  resolved: '#30a46c',
} as const
