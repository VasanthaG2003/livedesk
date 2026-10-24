import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/States'

export function TicketNotFound({ backHref }: { backHref: string }) {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Ticket not found"
        description="It may have been removed, or you may not have access to it."
        action={
          <Link to={backHref} className={buttonClasses('secondary', 'sm')}>
            Back to tickets
          </Link>
        }
      />
    </Card>
  )
}
