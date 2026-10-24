import { useState } from 'react'
import { Star } from 'lucide-react'
import type { TicketDetail } from '@livedesk/shared'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { cn } from '@/lib/cn'
import { useRateTicket } from '../api'

const words = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent']

export function Stars({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex gap-0.5', className)}
      role="img"
      aria-label={`${score} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('size-4', n <= score ? 'fill-amber-400 text-amber-400' : 'text-ink-300')}
          aria-hidden
        />
      ))}
    </span>
  )
}

/** Shown to the customer under the chat once the ticket is resolved. */
export function RatingCard({ ticket }: { ticket: TicketDetail }) {
  const rate = useRateTicket(ticket.id)
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')

  if (ticket.status !== 'resolved' && ticket.status !== 'closed') return null

  if (ticket.rating) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <Stars score={ticket.rating.score} />
        <p className="text-[13px] text-ink-700">
          Thanks for your feedback!
          {ticket.rating.comment && (
            <span className="text-ink-500"> “{ticket.rating.comment}”</span>
          )}
        </p>
      </Card>
    )
  }

  const shown = hover || score
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold text-ink-900">How did we do?</h2>
      <p className="mt-0.5 text-xs text-ink-500">Rate the help you got on this ticket.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (score) rate.mutate({ score, ...(comment.trim() && { comment: comment.trim() }) })
        }}
      >
        <FormError message={rate.error?.message} />
        <fieldset>
          <legend className="sr-only">Rating</legend>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                onMouseEnter={() => setHover(n)}
                className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
              >
                <input
                  type="radio"
                  name="score"
                  value={n}
                  className="sr-only"
                  checked={score === n}
                  onChange={() => setScore(n)}
                />
                <span className="sr-only">
                  {n} star{n > 1 ? 's' : ''}
                </span>
                <Star
                  className={cn(
                    'size-7 transition-colors',
                    n <= shown ? 'fill-amber-400 text-amber-400' : 'text-ink-300',
                  )}
                  aria-hidden
                />
              </label>
            ))}
            <span className="ml-2 text-[13px] text-ink-500" aria-live="polite">
              {words[shown]}
            </span>
          </div>
        </fieldset>
        {score > 0 && (
          <Textarea
            aria-label="Comment (optional)"
            placeholder="Anything you'd like to add? (optional)"
            rows={2}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}
        <Button type="submit" disabled={!score} loading={rate.isPending}>
          Submit rating
        </Button>
      </form>
    </Card>
  )
}
