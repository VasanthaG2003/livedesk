import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { StatusTabs } from '@/features/tickets/components/StatusTabs'
import { countByStatus } from '@/features/tickets/status-filter'

describe('badges', () => {
  it('renders human-readable status and priority labels', () => {
    render(
      <>
        <StatusBadge status="in_progress" />
        <PriorityBadge priority="high" />
      </>,
    )
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    // The priority badge carries a screen-reader prefix so colour isn't the only signal.
    expect(screen.getByText('Priority:')).toHaveClass('sr-only')
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('is disabled while loading so a form cannot be submitted twice', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('StatusTabs', () => {
  const tickets = [
    { status: 'open' as const },
    { status: 'open' as const },
    { status: 'closed' as const },
  ]

  it('shows a count per status and reports the clicked tab', async () => {
    const onChange = vi.fn()
    render(<StatusTabs value="all" onChange={onChange} counts={countByStatus(tickets)} />)
    expect(screen.getByRole('tab', { name: 'All (3)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Open (2)' })).toHaveAttribute('aria-selected', 'false')
    await userEvent.click(screen.getByRole('tab', { name: 'Closed (1)' }))
    expect(onChange).toHaveBeenCalledWith('closed')
  })
})

describe('empty and error states', () => {
  it('renders an empty state with its message', () => {
    render(<EmptyState title="No tickets yet" description="Create one to get started." />)
    expect(screen.getByRole('heading', { name: 'No tickets yet' })).toBeInTheDocument()
  })

  it('renders an error as an alert with a working retry button', async () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
