import { describe, expect, it } from 'vitest'

import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  getContractId,
  getNetworkPassphrase,
  getRpcUrl,
} from './config'

// These assert against .env.test, which Vite layers over any local .env when
// running in test mode.
describe('config', () => {
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
