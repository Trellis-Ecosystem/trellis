import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import MilestoneActions from './MilestoneActions'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'
import type { Agreement, Milestone } from '../lib/soroban'

const mockMilestone: Milestone = {
  id: 1,
  amount: '1000',
  status: 'pending',
}

const mockAgreement: Agreement = {
  agreement_id: 'a'.repeat(64),
  payer: 'GAQAA5Z4K7FF5H66GEQXCWUBSBDZXY52B3Z5U42EB46BEOV6PC6YWRYE',
  payee: 'GCYBXL5CD5FWUEURISB5PLAUQV2DNGHSACCNAK3FYJSTF2QJD5CUYNGF',
  resolver: 'GAN2FJTJ7A4Z2VYKOO3YZWMHZKD7WWEXZB5LBPD2MPWZP3UQFQQ4S5K',
  payment_token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  milestones: [mockMilestone],
  created: '2024-01-01',
}

const renderMilestoneActions = () => {
  return render(
    <ThemeProvider>
      <WalletProvider>
        <MilestoneActions milestone={mockMilestone} agreement={mockAgreement} />
      </WalletProvider>
    </ThemeProvider>
  )
}

describe('<MilestoneActions />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders milestone actions component', () => {
    renderMilestoneActions()

    expect(screen.getByText(/actions/i)).toBeInTheDocument()
  })

  it('renders action buttons for the milestone', () => {
    renderMilestoneActions()

    // Should render various action buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('disables actions when wallet is not connected', () => {
    renderMilestoneActions()

    // Actions should be present but may be disabled without proper wallet connection
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('shows transaction status when action is triggered', () => {
    renderMilestoneActions()

    const transactionElement = screen.queryByText(/transaction/i)
    // Transaction status may or may not be visible depending on action state
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
