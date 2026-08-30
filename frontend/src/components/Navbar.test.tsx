import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import Navbar from './Navbar'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'
import { explorerBaseUrl } from '../lib/explorer'

const renderNavbar = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <WalletProvider>
          <Navbar />
        </WalletProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('<Navbar />', () => {
  it('renders the product name and tagline', () => {
    renderNavbar()

    expect(screen.getByText('Trellis')).toBeInTheDocument()
    expect(screen.getByText('Trustless Milestone Escrow')).toBeInTheDocument()
  })

  it('renders the network badge linked to the explorer', () => {
    renderNavbar()

    const badge = screen.getByRole('status', { name: /Network status/i })
    expect(badge).toHaveAttribute('href', explorerBaseUrl())
    expect(badge).toHaveAttribute('target', '_blank')
  })

  it('includes internal navigation links for routes', () => {
    renderNavbar()

    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/')

    const createLink = screen.getByRole('link', { name: 'Create Agreement' })
    expect(createLink).toHaveAttribute('href', '/create')

    const statusLink = screen.getByRole('link', { name: 'Check Status' })
    expect(statusLink).toHaveAttribute('href', '/status')

    const historyLink = screen.getByRole('link', { name: 'History' })
    expect(historyLink).toHaveAttribute('href', '/history')
  })

  it('points external links at Stellar Expert', () => {
    renderNavbar()

    const links = screen.getAllByRole('link')
    const externalLinks = links.filter((link) => {
      const href = link.getAttribute('href')
      return href && href.startsWith('https')
    })

    expect(externalLinks.length).toBeGreaterThan(0)

    for (const link of externalLinks) {
      const href = link.getAttribute('href')
      if (href && href.includes('stellar.expert')) {
        expect(href).toMatch(/^https:\/\/stellar\.expert\/explorer\//)
      }
    }
  })
})
