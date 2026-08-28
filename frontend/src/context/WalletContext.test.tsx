import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { WalletProvider } from './WalletContext'

vi.mock('../lib/wallet', () => ({
  isFreighterInstalled: vi.fn().mockResolvedValue(false),
  connectWallet: vi.fn(),
  getPublicKey: vi.fn().mockResolvedValue('GABC1234'),
  getNetworkPassphrase: vi.fn().mockResolvedValue('Test SDF Network ; September 2015'),
  isAppAllowed: vi.fn().mockResolvedValue(false),
}))

vi.mock('../lib/config', () => ({
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  CONTRACT_ID: 'CTEST',
  RPC_URL: 'https://rpc.test',
}))

describe('WalletProvider polling cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears polling interval when component unmounts', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const { unmount } = render(
      <WalletProvider>
        <div />
      </WalletProvider>,
    )

    await act(async () => {
      vi.runAllTimersAsync()
    })

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('does not throw when mounted and unmounted rapidly', async () => {
    expect(() => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <WalletProvider>
            <div />
          </WalletProvider>,
        )
        unmount()
      }
    }).not.toThrow()
  })
})
