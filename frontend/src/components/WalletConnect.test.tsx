import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WalletConnect from './WalletConnect'
import { useWallet } from '../context/WalletContext'

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockUseWallet = vi.mocked(useWallet)

const baseWallet = {
  wrongNetwork: false,
  connecting: false,
  error: null as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  recheckInstall: vi.fn(),
  clearError: vi.fn(),
  connected: false,
}

describe('<WalletConnect />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders truncated publicKey when connected', () => {
    mockUseWallet.mockReturnValue({
      ...baseWallet,
      status: 'connected',
      publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP',
      connected: true,
    })

    render(<WalletConnect />)

    expect(screen.getByText('GABC...MNOP')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Disconnect wallet GABC\.\.\.MNOP/i }),
    ).toBeInTheDocument()
  })

  it('does not crash when connected with null publicKey and shows fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockUseWallet.mockReturnValue({
      ...baseWallet,
      status: 'connected',
      publicKey: null,
      connected: true,
    })

    render(<WalletConnect />)

    expect(screen.getByText('Address unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect wallet' })).toBeInTheDocument()
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument()

    warn.mockRestore()
  })

  it('renders connect button when disconnected', () => {
    mockUseWallet.mockReturnValue({
      ...baseWallet,
      status: 'disconnected',
      publicKey: null,
    })

    render(<WalletConnect />)

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
  })
})
