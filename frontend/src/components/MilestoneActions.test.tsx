import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MilestoneActions from './MilestoneActions'
import { DEFAULT_INCLUSION_FEE, type InvokeStatus } from '../hooks/useContractInvoke'
import type { Agreement, Milestone } from '../lib/soroban'

const payer = 'GAQAA5Z4K7FF5H66GEQXCWUBSBDZXY52B3Z5U42EB46BEOV6PC6YWRYE'
const submit = vi.fn()

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ connected: true, publicKey: payer }),
}))

vi.mock('../hooks/useToast', () => ({
  useToastActions: () => ({ error: vi.fn(), success: vi.fn() }),
}))

vi.mock('../hooks/useMilestoneDeadline', () => ({
  useMilestoneDeadline: () => ({ deadline: null }),
}))

vi.mock('../hooks/useContractInvoke', async (importOriginal) => {
  const original = await importOriginal<typeof import('../hooks/useContractInvoke')>()
  return {
    ...original,
    useContractInvoke: () => {
      const [status, setStatus] = useState<InvokeStatus>('idle')
      return {
        invoke: (method: string, args: unknown[], publicKey: string, fee = original.DEFAULT_INCLUSION_FEE) => {
          submit(method, args, publicKey, fee)
          setStatus('error')
          return Promise.reject(new Error('Network busy'))
        },
        status,
        txHash: null,
        error: 'Network busy',
        reset: () => setStatus('idle'),
      }
    },
  }
})

describe('<MilestoneActions />', () => {
  it('retries the failed action with a higher, bounded inclusion fee', async () => {
    const milestone: Milestone = { id: 1, amount: '1000', status: 'Pending', proof_uri: null }
    const agreement: Agreement = {
      agreement_id: 'a'.repeat(64),
      payer,
      payee: '',
      token: '',
      dispute_resolver: '',
      milestones: [milestone],
    }
    render(<MilestoneActions milestone={milestone} agreement={agreement} />)

    fireEvent.click(screen.getByRole('button', { name: 'Lock Funds' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry with adjusted gas' }))

    const [initial, retry] = submit.mock.calls
    expect(initial[0]).toBe('lock_funds')
    expect(initial[3]).toBe(DEFAULT_INCLUSION_FEE)
    expect(retry.slice(0, 3)).toEqual(initial.slice(0, 3))
    expect(Number(retry[3])).toBeGreaterThan(Number(initial[3]))
    expect(Number(retry[3])).toBeLessThanOrEqual(2 * Number(initial[3]))
  })
})
