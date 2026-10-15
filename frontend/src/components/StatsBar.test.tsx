/**
 * Tests for StatsBar component.
 *
 * The hook is mocked so we can control each status independently.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatsBar } from './StatsBar'

vi.mock('../hooks/useContractStats', () => ({
  useContractStats: vi.fn(),
}))

import { useContractStats } from '../hooks/useContractStats'
const mockUseContractStats = vi.mocked(useContractStats)

describe('<StatsBar />', () => {
  it('shows skeleton while loading', () => {
    mockUseContractStats.mockReturnValue({ stats: null, status: 'loading', lastUpdated: null, error: null })
    const { container } = render(<StatsBar />)
    // Should have animated placeholder elements but no numeric values
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/N\/A/)).toBeNull()
  })

  it('displays live counts when status is ok', () => {
    mockUseContractStats.mockReturnValue({
      stats: { agreements: 5, milestonesLocked: 12 },
      status: 'ok',
      lastUpdated: '2026-07-27T12:00:00.000Z', error: null,
    })
    render(<StatsBar />)

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // No warning icon in ok state
    expect(screen.queryByRole('img', { name: /unavailable/i })).toBeNull()
  })

  it('shows stale counts with a warning icon when status is stale', () => {
    mockUseContractStats.mockReturnValue({
      stats: { agreements: 3, milestonesLocked: 7 },
      status: 'stale',
      lastUpdated: '2026-07-27T11:00:00.000Z', error: null,
    })
    render(<StatsBar />)

    // Data still visible
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    // Warning icon(s) present
    const warnings = screen.getAllByRole('img')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('shows N/A and RPC Unavailable alert when status is error — fix for #93', () => {
    mockUseContractStats.mockReturnValue({ stats: null, status: 'error', lastUpdated: null, error: null })
    render(<StatsBar />)

    // All stats show N/A
    const naItems = screen.getAllByText('N/A')
    expect(naItems.length).toBeGreaterThan(0)

    // Alert message present
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert').textContent).toMatch(/RPC Unavailable/i)
  })

  it('never renders a hardcoded numeric value in error state — no fabricated zeros', () => {
    mockUseContractStats.mockReturnValue({ stats: null, status: 'error', lastUpdated: null, error: null })
    render(<StatsBar />)

    // Numeric zero must not appear anywhere as a stat value
    const allText = document.body.textContent ?? ''
    // "0" as a stat value would be a fabrication; N/A is the correct placeholder
    expect(allText).not.toMatch(/\b0\b.*agreements/i)
    expect(allText).not.toMatch(/\b0\b.*milestones/i)
  })
})
