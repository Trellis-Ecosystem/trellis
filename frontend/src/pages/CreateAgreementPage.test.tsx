import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTRACT_ID } from '../lib/config'
import CreateAgreementPage from './CreateAgreementPage'
import { ThemeProvider } from '../context/ThemeContext'
import ToastProvider from '../components/toast/ToastProvider'
import { WalletProvider } from '../context/WalletContext'

const mockInvoke = vi.fn()

vi.mock('../hooks/useContractInvoke', () => ({
  useContractInvoke: () => ({
    invoke: mockInvoke,
    status: 'idle',
    error: null,
    reset: vi.fn(),
  }),
}))

const renderCreateAgreementPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <WalletProvider>
          <ToastProvider>
            <CreateAgreementPage />
          </ToastProvider>
        </WalletProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('<CreateAgreementPage />', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('leaves the token empty when no default is configured', () => {
    vi.stubEnv('VITE_DEFAULT_TOKEN_ID', undefined)
    renderCreateAgreementPage()
    expect(screen.getByPlaceholderText('C...')).toHaveValue('')
    expect(screen.queryByText(/Testnet USDC/i)).not.toBeInTheDocument()
  })

  it('prefills the configured token contract', () => {
    vi.stubEnv('VITE_DEFAULT_TOKEN_ID', CONTRACT_ID)
    renderCreateAgreementPage()
    expect(screen.getByPlaceholderText('C...')).toHaveValue(CONTRACT_ID)
  })

  it('renders the create agreement form', () => {
    renderCreateAgreementPage()

    expect(screen.getByRole('heading', { name: 'Create Agreement' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Connect your wallet')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('G...')).toHaveLength(2)
  })

  it('renders agreement ID generator section', () => {
    renderCreateAgreementPage()

    expect(screen.getByText(/agreement id/i)).toBeInTheDocument()
  })

  it('renders milestones builder section', () => {
    renderCreateAgreementPage()

    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument()
  })

  it('disables submission when the wallet is disconnected', () => {
    renderCreateAgreementPage()

    expect(screen.getByRole('button', { name: /create agreement/i })).toBeDisabled()
  })

  it('re-enables the Create Agreement button after invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('User rejected the request'))

    renderCreateAgreementPage()

    const submitButton = screen.getByRole('button', { name: /create agreement/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(submitButton).toBeEnabled()
    })
  })
})
