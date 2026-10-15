import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import MilestoneActions from './MilestoneActions'
import type { Agreement, Milestone } from '../lib/soroban'
import type { InvokeStatus } from '../hooks/useContractInvoke'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  reset: vi.fn(),
  status: 'idle' as InvokeStatus,
  publicKey: null as string | null,
  connected: true,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../hooks/useContractInvoke', () => ({
  useContractInvoke: () => ({
    invoke: mocks.invoke,
    status: mocks.status,
    txHash: null,
    error: mocks.status === 'error' ? 'transaction failed' : null,
    reset: mocks.reset,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    publicKey: mocks.publicKey,
    connected: mocks.connected,
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToastActions: () => ({
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}))

const PAYER = 'GAQAA5Z4K7FF5H66GEQXCWUBSBDZXY52B3Z5U42EB46BEOV6PC6YWRYE'
const PAYEE = 'GCYBXL5CD5FWUEURISB5PLAUQV2DNGHSACCNAK3FYJSTF2QJD5CUYNGF'

const mockMilestone: Milestone = {
  id: 1,
  amount: '1000',
  status: 'Pending',
  proof_uri: null,
}

const mockAgreement: Agreement = {
  agreement_id: 'a'.repeat(64),
  payer: PAYER,
  payee: PAYEE,
  token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  dispute_resolver: 'GAN2FJTJ7A4Z2VYKOO3YZWMHZKD7WWEXZB5LBPD2MPWZP3UQFQQ4S5K',
  milestones: [mockMilestone],
}

const renderMilestoneActions = (onSuccess?: () => void) =>
  render(
    <MilestoneActions milestone={mockMilestone} agreement={mockAgreement} onSuccess={onSuccess} />,
  )

const confirmLockFunds = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Lock Funds' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
}

describe('<MilestoneActions />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = 'idle'
    mocks.publicKey = PAYER
    mocks.connected = true
  })

  it('renders milestone action buttons for the payer', () => {
    renderMilestoneActions()

    expect(screen.getByRole('button', { name: 'Lock Funds' })).toBeInTheDocument()
  })

  it('disables actions when wallet is not connected', () => {
    mocks.connected = false
    renderMilestoneActions()

    expect(screen.getByRole('button', { name: 'Lock Funds' })).toBeDisabled()
  })

  it('shows only the success toast and calls onSuccess once when invoke resolves', async () => {
    mocks.invoke.mockResolvedValue('txhash')
    const onSuccess = vi.fn()
    renderMilestoneActions(onSuccess)

    confirmLockFunds()

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledTimes(1))
    expect(mocks.toastSuccess).toHaveBeenCalledWith({ title: 'Funds locked successfully' })
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('retries with a higher fee than the first attempt', async () => {
    mocks.status = 'error'
    mocks.invoke.mockRejectedValue(new Error('fee too low'))
    renderMilestoneActions()

    confirmLockFunds()
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /retry with adjusted gas/i }))
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2))

    const firstFee = mocks.invoke.mock.calls[0][3]
    const retryFee = mocks.invoke.mock.calls[1][3]
    expect(firstFee).toBeUndefined()
    expect(Number(retryFee)).toBeGreaterThan(100_000)
  })

  it('increases the fee again on a second retry', async () => {
    mocks.status = 'error'
    mocks.invoke.mockRejectedValue(new Error('fee too low'))
    renderMilestoneActions()

    confirmLockFunds()
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1))

    const retry = screen.getByRole('button', { name: /retry with adjusted gas/i })
    fireEvent.click(retry)
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(retry).not.toBeDisabled())
    fireEvent.click(retry)
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(3))

    const retryFees = mocks.invoke.mock.calls.slice(1).map((call) => Number(call[3]))
    expect(retryFees[0]).toBe(200_000)
    expect(retryFees[1]).toBe(300_000)
    expect(retryFees[1]).toBeGreaterThan(retryFees[0])
  })
})
