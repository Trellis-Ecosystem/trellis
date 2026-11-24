import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  getActiveNetwork,
  getContractId,
  getNetworkPassphrase,
  getRpcUrl,
  getSelectedNetwork,
  setSelectedNetwork,
} from './config'

// These assert against .env.test, which Vite layers over any local .env when
// running in test mode.
describe('config', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects a contract ID with an invalid checksum', () => {
    vi.stubEnv('VITE_CONTRACT_ID', CONTRACT_ID.slice(0, -1) + 'A')
    expect(getContractId).toThrow(/VITE_CONTRACT_ID.*valid Stellar contract address/)
  })

  it.each(['not a URL', 'ftp://example.com'])('rejects invalid RPC URL %s', (value) => {
    vi.stubEnv('VITE_RPC_URL', value)
    expect(getRpcUrl).toThrow(/VITE_RPC_URL.*HTTP or HTTPS URL/)
  })

  it('rejects a whitespace-only passphrase', () => {
    vi.stubEnv('VITE_NETWORK_PASSPHRASE', '   ')
    expect(getNetworkPassphrase).toThrow(/VITE_NETWORK_PASSPHRASE.*non-empty/)
  })

  // Named re-exports (backwards-compat)
  it('exposes the deployed contract ID', () => {
    expect(CONTRACT_ID).toBe('CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q')
  })

  it('exposes the Soroban RPC endpoint', () => {
    expect(RPC_URL).toBe('https://soroban-testnet.stellar.org')
  })

  it('exposes the network passphrase', () => {
    expect(NETWORK_PASSPHRASE).toBe('Test SDF Network ; September 2015')
  })

  // Getter functions (lazy API)
  it('getContractId() returns the deployed contract ID', () => {
    expect(getContractId()).toBe('CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q')
  })

  it('getRpcUrl() returns the Soroban RPC endpoint', () => {
    expect(getRpcUrl()).toBe('https://soroban-testnet.stellar.org')
  })

  it('getNetworkPassphrase() returns the network passphrase', () => {
    expect(getNetworkPassphrase()).toBe('Test SDF Network ; September 2015')
  })
})

describe('runtime network selection (#501)', () => {
  afterEach(() => localStorage.clear())

  it('uses build-time values when nothing is selected', () => {
    expect(getRpcUrl()).toBe('https://soroban-testnet.stellar.org')
    expect(getActiveNetwork()).toBe('testnet')
  })

  it('resolves RPC URL and passphrase from the selected preset', () => {
    setSelectedNetwork('mainnet')
    expect(getActiveNetwork()).toBe('mainnet')
    expect(getRpcUrl()).toBe('https://mainnet.sorobanrpc.com')
    expect(getNetworkPassphrase()).toBe('Public Global Stellar Network ; September 2015')
    expect(getContractId()).toBe('CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q')
  })

  it('ignores an invalid stored value and "custom" keeps build-time values', () => {
    localStorage.setItem('trellis.network', 'bogus')
    expect(getSelectedNetwork()).toBeNull()
    setSelectedNetwork('custom')
    expect(getRpcUrl()).toBe('https://soroban-testnet.stellar.org')
  })
})
