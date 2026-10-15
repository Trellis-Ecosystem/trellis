import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventFeed from './EventFeed'

const ALL_TYPES = [
  'created',
  'locked',
  'work_submitted',
  'released',
  'disputed',
  'resolved',
  'cancelled',
  'partially_released',
  'completed',
  'deadline_set',
  'expired',
  'ttl_extended',
]

vi.mock('../hooks/useAgreementEvents', () => ({
  useAgreementEvents: () => ({
    events: ALL_TYPES.map((type, i) => ({
      type,
      ledger: 500_000 + i,
      txHash: `hash${i}`,
      timestamp: '2026-01-01T00:00:00Z',
      agreementId: 'a'.repeat(64),
    })),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

describe('<EventFeed />', () => {
  it('renders a real description for every contract event type', () => {
    render(<EventFeed agreementId={'a'.repeat(64)} />)

    // The fallback renders 'Event: <type>' — every mapped type must have a
    // proper description instead.
    expect(screen.queryByText(/^Event: /)).not.toBeInTheDocument()
    expect(screen.getByText('Agreement created')).toBeInTheDocument()
    expect(screen.getByText('Agreement completed')).toBeInTheDocument()
    expect(screen.getByText('Contract storage TTL extended')).toBeInTheDocument()
  })
})
