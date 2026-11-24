import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { rpc } from '@stellar/stellar-sdk'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { HISTORY_STORAGE_KEY } from '../lib/history'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgreementStatusPage from './AgreementStatusPage'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem(HISTORY_STORAGE_KEY)
})

const renderAgreementStatusPage = (path = '/agreement') => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <WalletProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/agreement/:id?" element={<AgreementStatusPage />} />
            </Routes>
          </ErrorBoundary>
        </WalletProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

describe('<AgreementStatusPage />', () => {
  it('shows an inline error for a malformed route without recording it in history', () => {
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction')
    renderAgreementStatusPage('/agreement/xyz')

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid agreement ID')
    expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument()
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull()
    expect(simulate).not.toHaveBeenCalled()
  })

  it('shows a Retry button that refetches a failed agreement', async () => {
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockResolvedValue({
      _parsed: true, id: '1', latestLedger: 1, events: [], error: 'Agreement does not exist',
    })
    renderAgreementStatusPage('/agreement/' + 'a'.repeat(64))

    expect(await screen.findByRole('heading', { name: 'Agreement not found' })).toBeInTheDocument()
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull()
    const initialCalls = simulate.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(simulate).toHaveBeenCalledTimes(initialCalls + 1))
  })

  it('renders the agreement status page title', () => {
    renderAgreementStatusPage()

    expect(screen.getByText('Agreement Status')).toBeInTheDocument()
    expect(screen.getByText(/Look up an agreement/i)).toBeInTheDocument()
  })

  it('renders search input field', () => {
    renderAgreementStatusPage()

    const searchInput = screen.getByPlaceholderText(/Enter agreement ID/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('renders search button', () => {
    renderAgreementStatusPage()

    const searchButton = screen.getByRole('button', { name: 'Search' })
    expect(searchButton).toBeInTheDocument()
  })

  it('disables search button when input is empty', () => {
    renderAgreementStatusPage()

    const searchButton = screen.getByRole('button', { name: 'Search' })
    expect(searchButton).toBeDisabled()
  })

  it('enables search button when input has content', () => {
    renderAgreementStatusPage()

    const searchInput = screen.getByPlaceholderText(/Enter agreement ID/i) as HTMLInputElement
    const searchButton = screen.getByRole('button', { name: 'Search' })

    fireEvent.change(searchInput, { target: { value: 'a'.repeat(64) } })
    expect(searchButton).not.toBeDisabled()
  })

  it('shows validation error for invalid agreement ID format', async () => {
    renderAgreementStatusPage()

    const searchInput = screen.getByPlaceholderText(/Enter agreement ID/i) as HTMLInputElement
    const searchButton = screen.getByRole('button', { name: 'Search' })

    fireEvent.change(searchInput, { target: { value: 'invalid-id' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid agreement ID/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for empty search', async () => {
    renderAgreementStatusPage()

    const searchButton = screen.getByRole('button', { name: 'Search' })

    // Manually enable the button by temporarily setting input
    const searchInput = screen.getByPlaceholderText(/Enter agreement ID/i) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'test' } })

    // Clear and try to search
    fireEvent.change(searchInput, { target: { value: '' } })

    expect(searchButton).toBeDisabled()
  })

  it('handles Enter key press in search input', () => {
    renderAgreementStatusPage()

    const searchInput = screen.getByPlaceholderText(/Enter agreement ID/i)

    fireEvent.change(searchInput, { target: { value: 'a'.repeat(64) } })
    fireEvent.keyPress(searchInput, { key: 'Enter' })

    // Valid ID should not show error
    expect(screen.queryByText(/Please enter an agreement ID/i)).not.toBeInTheDocument()
  })
})
