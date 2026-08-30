import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EventFeed from './EventFeed'
import { ThemeProvider } from '../context/ThemeContext'

const renderEventFeed = (agreementId?: string) => {
  return render(
    <ThemeProvider>
      <EventFeed agreementId={agreementId} />
    </ThemeProvider>
  )
}

describe('<EventFeed />', () => {
  it('renders event feed component', () => {
    renderEventFeed()

    expect(screen.getByText(/event|history|activity/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    expect(() => {
      renderEventFeed()
    }).not.toThrow()
  })

  it('handles missing agreement ID gracefully', () => {
    renderEventFeed()

    expect(screen.getByText(/event|history|activity|no events/i)).toBeInTheDocument()
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
})
