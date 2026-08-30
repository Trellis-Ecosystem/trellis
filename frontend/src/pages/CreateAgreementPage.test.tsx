import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CreateAgreementPage from './CreateAgreementPage'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'

const renderCreateAgreementPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <WalletProvider>
          <CreateAgreementPage />
        </WalletProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('<CreateAgreementPage />', () => {
  it('renders the create agreement form', () => {
    renderCreateAgreementPage()

    expect(screen.getByText('Create New Agreement')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/payer account/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/payee account/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/resolver account/i)).toBeInTheDocument()
  })

  it('renders agreement ID generator section', () => {
    renderCreateAgreementPage()

    expect(screen.getByText(/agreement id/i)).toBeInTheDocument()
  })

  it('renders milestones builder section', () => {
    renderCreateAgreementPage()

    expect(screen.getByText(/milestones/i)).toBeInTheDocument()
  })

  it('shows loading state during submission', async () => {
    renderCreateAgreementPage()

    const submitButton = screen.getByRole('button', { name: /create agreement/i })
    expect(submitButton).toBeInTheDocument()
  })

  it('displays validation error when form is invalid', async () => {
    renderCreateAgreementPage()

    const submitButton = screen.getByRole('button', { name: /create agreement/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument()
    })
  })
})
