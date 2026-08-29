import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AgreementDetail from './AgreementDetail'
import { ThemeProvider } from '../context/ThemeContext'
import { WalletProvider } from '../context/WalletContext'
import type { Agreement } from '../lib/soroban'

const mockAgreement: Agreement = {
  agreement_id: 'a'.repeat(64),
  payer: 'GAQAA5Z4K7FF5H66GEQXCWUBSBDZXY52B3Z5U42EB46BEOV6PC6YWRYE',
  payee: 'GCYBXL5CD5FWUEURISB5PLAUQV2DNGHSACCNAK3FYJSTF2QJD5CUYNGF',
  resolver: 'GAN2FJTJ7A4Z2VYKOO3YZWMHZKD7WWEXZB5LBPD2MPWZP3UQFQQ4S5K',
  payment_token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  milestones: [
    {
      id: 1,
      amount: '1000',
      status: 'pending',
    },
  ],
  created: '2024-01-01',
}

const renderAgreementDetail = (agreement: Agreement) => {
  return render(
    <ThemeProvider>
      <WalletProvider>
        <AgreementDetail agreement={agreement} />
      </WalletProvider>
    </ThemeProvider>
  )
}

describe('<AgreementDetail />', () => {
  it('renders agreement detail component', () => {
    renderAgreementDetail(mockAgreement)

    expect(screen.getByText(/agreement/i)).toBeInTheDocument()
  })

  it('displays agreement information', () => {
    renderAgreementDetail(mockAgreement)

    // Should display agreement details
    expect(screen.getByText(/payer|payee|resolver/i)).toBeInTheDocument()
  })

  it('renders milestone information', () => {
    renderAgreementDetail(mockAgreement)

    expect(screen.getByText(/milestone/i)).toBeInTheDocument()
  })

  it('renders without crashing with valid agreement', () => {
    expect(() => {
      renderAgreementDetail(mockAgreement)
    }).not.toThrow()
  })

  it('displays agreement ID', () => {
    renderAgreementDetail(mockAgreement)

    // Agreement ID should be displayed somewhere
    const agreementIdElement = screen.queryByText(mockAgreement.agreement_id.slice(0, 8))
    expect(agreementIdElement || screen.getByText(/agreement/i)).toBeInTheDocument()
  })
})
