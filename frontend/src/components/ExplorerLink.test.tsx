import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExplorerLink } from './ExplorerLink'
import { STELLAR_EXPERT_ORIGIN, truncateId } from '../lib/explorer'

const CONTRACT = 'CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q'
const TX_HASH = 'b'.repeat(64)

describe('<ExplorerLink />', () => {
  it('links to the Stellar Expert record for the identifier', () => {
    render(<ExplorerLink type="contract" value={CONTRACT} network="testnet" />)

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `${STELLAR_EXPERT_ORIGIN}/explorer/testnet/contract/${CONTRACT}`,
    )
  })

  it('respects an explicit network over the configured default', () => {
    render(<ExplorerLink type="tx" value={TX_HASH} network="public" />)

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `${STELLAR_EXPERT_ORIGIN}/explorer/public/tx/${TX_HASH}`,
    )
  })

  it('shows a truncated identifier by default', () => {
    render(<ExplorerLink type="contract" value={CONTRACT} />)

    expect(screen.getByRole('link')).toHaveTextContent(truncateId(CONTRACT))
    expect(screen.getByRole('link')).not.toHaveTextContent(CONTRACT)
  })

  it('shows the full identifier when asked', () => {
    render(<ExplorerLink type="contract" value={CONTRACT} full />)

    expect(screen.getByRole('link')).toHaveTextContent(CONTRACT)
  })

  it('renders a custom label in place of the identifier', () => {
    render(<ExplorerLink type="tx" value={TX_HASH} label="View transaction" />)

    expect(screen.getByRole('link')).toHaveTextContent('View transaction')
  })

  it('opens in a new tab without leaking the referrer', () => {
    render(<ExplorerLink type="account" value="GABCDEF" />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('describes the record in its title for hover and screen readers', () => {
    render(<ExplorerLink type="tx" value={TX_HASH} network="testnet" />)

    expect(screen.getByRole('link')).toHaveAttribute(
      'title',
      `View transaction ${TX_HASH} on Stellar Expert (Testnet)`,
    )
  })

  it.each([undefined, null, '', '   '])('renders nothing for the blank value %o', (value) => {
    const { container } = render(<ExplorerLink type="tx" value={value} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('explorer-link')).not.toBeInTheDocument()
  })

  it('renders nothing for agreement type — hex IDs have no Stellar Expert page', () => {
    const { container } = render(
      <ExplorerLink type="agreement" value="abcdef1234567890abcdef1234567890" />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('explorer-link')).not.toBeInTheDocument()
  })
})
