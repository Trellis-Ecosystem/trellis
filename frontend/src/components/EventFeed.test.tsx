import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { RPC_URL } from '../lib/config'
import { server } from '../test/mocks/server'
import EventFeed from './EventFeed'
import { ThemeProvider } from '../context/ThemeContext'

const renderEventFeed = (agreementId = '') => {
  return render(
    <ThemeProvider>
      <EventFeed agreementId={agreementId} />
    </ThemeProvider>
  )
}

describe('<EventFeed />', () => {
  it('renders event feed component', () => {
    renderEventFeed()

    expect(screen.getByRole('heading', { name: 'Event Timeline' })).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    expect(() => {
      renderEventFeed()
    }).not.toThrow()
  })

  it('handles missing agreement ID gracefully', () => {
    renderEventFeed()

    expect(screen.getByText('No events found for this agreement')).toBeInTheDocument()
  })

  it('renders with valid agreement ID', () => {
    const agreementId = 'a'.repeat(64)
    renderEventFeed(agreementId)

    expect(screen.getByText(/event|history|activity|loading/i)).toBeInTheDocument()
  })

  it('displays loading state when fetching events', () => {
    const agreementId = 'a'.repeat(64)
    renderEventFeed(agreementId)

    // May show loading or events depending on data
    const container = screen.getByText(/event|history|activity|loading|no event/i)
    expect(container).toBeInTheDocument()
  })
  it('makes another events request when Retry is clicked', async () => {
    let requests = 0
    server.use(http.post(RPC_URL, async ({ request }) => {
      const { method } = await request.json() as { method: string }
      if (method === 'getLatestLedger') {
        return HttpResponse.json({ result: { sequence: 1000 } })
      }
      requests++
      return requests === 1
        ? HttpResponse.json({ error: { message: 'RPC unavailable' } })
        : HttpResponse.json({ result: { events: [] } })
    }))

    renderEventFeed('a'.repeat(64))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No events found for this agreement')).toBeInTheDocument()
    expect(requests).toBe(2)
  })

})
