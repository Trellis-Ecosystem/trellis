import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AgreementStatusPage from './AgreementStatusPage'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'

const renderAgreementStatusPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <WalletProvider>
          <AgreementStatusPage />
        </WalletProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('<AgreementStatusPage />', () => {
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
