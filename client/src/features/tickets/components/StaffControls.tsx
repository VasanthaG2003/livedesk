import { useState } from 'react'
import { toast } from 'sonner'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  TICKET_PRIORITIES,
  type PublicUser,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { isApiError } from '@/lib/api'
import { useAgents, useUpdateTicket } from '../api'

interface StaffControlsProps {
  ticket: TicketDetail
  currentUser: PublicUser
}

/**
 * Status / priority / assignment. The UI only offers what the user's role may
 * do; the server enforces the same rules regardless.
 */
export function StaffControls({ ticket, currentUser }: StaffControlsProps) {
  const isAdmin = currentUser.role === 'admin'
  const assigneeId = ticket.assignedAgent?.id ?? ''
  // Only unsaved edits live in state; everything else comes straight from the
  // ticket, so live updates from other people show up without remounting.
  const [draft, setDraft] = useState<{
    status?: TicketStatus
    priority?: TicketPriority
    assignee?: string
  }>({})
  const status = draft.status ?? ticket.status
  const priority = draft.priority ?? ticket.priority
  const assignee = draft.assignee ?? assigneeId
  const setStatus = (v: TicketStatus) => setDraft((d) => ({ ...d, status: v }))
  const setPriority = (v: TicketPriority) => setDraft((d) => ({ ...d, priority: v }))
  const setAssignee = (v: string) => setDraft((d) => ({ ...d, assignee: v }))
  const agents = useAgents(isAdmin)
  const update = useUpdateTicket(ticket.id)

  const closed = ticket.status === 'closed'
  const assignedToOther =
    !isAdmin && !!ticket.assignedAgent && ticket.assignedAgent.id !== currentUser.id
  const locked = closed || assignedToOther
  const statusOptions = [ticket.status, ...STATUS_TRANSITIONS[ticket.status]]
  const dirty = status !== ticket.status || priority !== ticket.priority || assignee !== assigneeId

  function save(changes: Omit<UpdateTicketInput, 'expectedUpdatedAt'>, success: string) {
    update.mutate(
      { ...changes, expectedUpdatedAt: ticket.updatedAt },
      {
        onSuccess: () => {
          setDraft({})
          toast.success(success)
        },
        onError: (err) => {
          // Drop the edits; the ticket is being refetched so the form shows the latest version.
          setDraft({})
          toast.error(
            isApiError(err, 'STALE_TICKET')
              ? 'Someone else just updated this ticket. Showing the latest version.'
              : err.message,
          )
        },
      },
    )
  }

  function saveForm() {
    const changes: Omit<UpdateTicketInput, 'expectedUpdatedAt'> = {}
    if (status !== ticket.status) changes.status = status
    if (priority !== ticket.priority) changes.priority = priority
    if (assignee !== assigneeId) changes.assignedAgentId = assignee || null
    save(changes, 'Ticket updated')
  }

  return (
    <Card>
      <CardHeader title="Manage ticket" />
      <div className="space-y-4 p-5">
        {assignedToOther && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Assigned to {ticket.assignedAgent?.name}. Only they or an admin can change it.
          </p>
        )}

        {!isAdmin && !closed && !assignedToOther && (
          <Button
            variant="secondary"
            className="w-full"
            loading={update.isPending}
            onClick={() =>
              ticket.assignedAgent
                ? save({ assignedAgentId: null }, 'You released this ticket')
                : save({ assignedAgentId: currentUser.id }, 'Ticket assigned to you')
            }
          >
            {ticket.assignedAgent ? 'Release ticket' : 'Assign to me'}
          </Button>
        )}

        <Field label="Status">
          {(a11y) => (
            <Select
              {...a11y}
              value={status}
              disabled={locked}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(a11y) => (
            <Select
              {...a11y}
              value={priority}
              disabled={locked}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {isAdmin && (
          <Field label="Assignee">
            {(a11y) => (
              <Select
                {...a11y}
                value={assignee}
                disabled={closed || agents.isPending}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Button
          className="w-full"
          disabled={!dirty || locked}
          loading={update.isPending}
          onClick={saveForm}
        >
          Save changes
        </Button>
      </div>
    </Card>
  )
}
