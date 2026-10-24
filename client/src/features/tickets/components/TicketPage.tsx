import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { isUnread } from '@livedesk/shared'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useCurrentUser } from '@/features/auth/api'
import { isApiError } from '@/lib/api'
import { useTicketRoom } from '@/features/realtime/useTicketRoom'
import { useActivity, useMarkRead, useMessages, useSendMessage, useTicket } from '../api'
import { AiDraftButton } from '@/features/ai/AiDraftButton'
import { RatingCard } from './RatingCard'
import { SavedReplyPicker } from './SavedReplyPicker'
import { StaffControls } from './StaffControls'
import { TicketDetailView } from './TicketDetailView'
import { TicketNotFound } from './TicketNotFound'

interface TicketPageProps {
  ticketId: string
  backHref: string
  backLabel: string
}

/** Loads a ticket and its chat for any role, with loading / not-found / error states. */
export function TicketPage({ ticketId, backHref, backLabel }: TicketPageProps) {
  const me = useCurrentUser()
  const [params] = useSearchParams()
  const ticket = useTicket(ticketId)
  const messages = useMessages(ticketId)
  const activity = useActivity(ticketId)
  const send = useSendMessage(ticketId)
  const markRead = useMarkRead(ticketId)
  const room = useTicketRoom(ticketId, me.id)
  const side = me.role === 'customer' ? 'customer' : 'staff'

  // Opening the ticket (or a new message arriving while it's open) marks the chat
  // read, which clears the unread dot and shows "Seen" to the other side.
  const unread = ticket.data ? isUnread(ticket.data, side) : false
  const { mutate: markAsRead, isPending: marking } = markRead
  useEffect(() => {
    if (unread && !marking) markAsRead()
  }, [unread, marking, markAsRead, ticket.data?.lastMessageAt])

  if (ticket.isPending) {
    return (
      <Card>
        <SkeletonRows rows={5} label="Loading ticket" />
      </Card>
    )
  }
  if (ticket.isError) {
    if (isApiError(ticket.error) && ticket.error.status === 404)
      return <TicketNotFound backHref={backHref} />
    return (
      <Card>
        <ErrorState
          message={ticket.error.message}
          onRetry={() => void ticket.refetch()}
          retrying={ticket.isFetching}
        />
      </Card>
    )
  }

  const isStaff = side === 'staff'
  return (
    <TicketDetailView
      side={side}
      viewers={room.viewers}
      typing={room.typing}
      onTyping={room.sendTyping}
      composerTools={
        isStaff
          ? (insert) => (
              <>
                <SavedReplyPicker ticket={ticket.data} me={me} onInsert={insert} />
                <AiDraftButton ticketId={ticket.data.id} onInsert={insert} />
              </>
            )
          : undefined
      }
      banner={isStaff ? undefined : <RatingCard ticket={ticket.data} />}
      ticket={ticket.data}
      messages={messages.data ?? []}
      messagesLoading={messages.isPending}
      activity={activity.data ?? []}
      currentUserId={me.id}
      backHref={backHref}
      backLabel={backLabel}
      focusChat={params.get('chat') === '1'}
      staffControls={isStaff ? <StaffControls ticket={ticket.data} currentUser={me} /> : undefined}
      onReply={async (input) => {
        try {
          await send.mutateAsync(input)
          return true
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Message not sent. Please try again.')
          return false
        }
      }}
    />
  )
}
