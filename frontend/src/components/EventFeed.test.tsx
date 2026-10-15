import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import EventFeed from './EventFeed'

const mocks = vi.hoisted(() => ({
  events: [] as Array<Record<string, unknown>>,
  isLoading: false,
  isError: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

vi.mock('../hooks/useAgreementEvents', () => ({
  useAgreementEvents: () => ({
    events: mocks.events,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    error: mocks.error,
    refetch: mocks.refetch,
  }),
}))

describe('<EventFeed />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.events = []
    mocks.isLoading = false
    mocks.isError = false
    mocks.error = null
  })

  it('offers a Retry button in the error state that triggers refetch', () => {
    mocks.error = 'RPC HTTP 500'
    mocks.isError = true
    render(<EventFeed agreementId={'a'.repeat(64)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })
})
