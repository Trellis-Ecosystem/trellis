import { StrKey } from '@stellar/stellar-sdk'

const DEV_FALLBACKS: Record<string, string> = {
  VITE_CONTRACT_ID: 'CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q',
  VITE_RPC_URL: 'https://soroban-testnet.stellar.org',
  VITE_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
}

function configError(name: string, reason: string): Error {
  const error = new Error(`Environment variable ${name} ${reason}. Copy .env.example to .env, update the value, and rebuild the frontend.`)
  error.name = 'ConfigurationError'
  return error
}

function validateContractId(name: string, value: string): string {
  if (!StrKey.isValidContract(value)) {
    throw configError(name, 'must be a valid Stellar contract address (C...)')
  }
  return value
}

function getEnv(name: keyof typeof DEV_FALLBACKS): string {
  const value = import.meta.env[name]

  if (typeof value === 'string' && value) {
    if (name === 'VITE_CONTRACT_ID') return validateContractId(name, value)
    if (name === 'VITE_RPC_URL') {
      const protocol = URL.canParse(value) ? new URL(value).protocol : null
      if (protocol !== 'http:' && protocol !== 'https:') {
        throw configError(name, 'must be an HTTP or HTTPS URL')
      }
    }
    if (name === 'VITE_NETWORK_PASSPHRASE' && !value.trim()) {
      throw configError(name, 'must be non-empty')
    }
    return value
  }

  const fallback = DEV_FALLBACKS[name]

  if (import.meta.env.DEV) {
    console.warn(
      `[config] ${name} is not set. Using dev fallback: "${fallback}". ` +
        'Copy .env.example to .env and fill in real values.',
    )
    return fallback
  }

  throw configError(name, 'is not set')
}

export type NetworkId = 'testnet' | 'mainnet' | 'futurenet' | 'custom'

export const NETWORK_IDS: NetworkId[] = ['testnet', 'mainnet', 'futurenet', 'custom']

/**
 * Presets mirroring the CLI's `--network` flag (cli/trellis_cli/src/config.rs).
 * `custom` has no preset: it uses the build-time VITE_* values.
 */
const PRESETS: Record<Exclude<NetworkId, 'custom'>, { rpcUrl: string; passphrase: string }> = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  futurenet: {
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    passphrase: 'Test SDF Future Network ; October 2022',
  },
}

const STORAGE_KEY = 'trellis.network'

function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === 'string' && (NETWORK_IDS as string[]).includes(value)
}

/** The network the user picked in the UI, or null to use build-time env values. */
export function getSelectedNetwork(): NetworkId | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isNetworkId(stored) ? stored : null
  } catch {
    return null
  }
}

/** Persists the choice. Consumers read config at import time, so callers should reload. */
export function setSelectedNetwork(network: NetworkId): void {
  try {
    localStorage.setItem(STORAGE_KEY, network)
  } catch {
    // Storage unavailable (private mode): the selection just won't persist.
  }
}

/** Network currently in effect, inferred from the build-time passphrase when nothing is selected. */
export function getActiveNetwork(): NetworkId {
  const selected = getSelectedNetwork()
  if (selected) return selected
  const passphrase = getEnv('VITE_NETWORK_PASSPHRASE')
  const match = (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).find(
    (id) => PRESETS[id].passphrase === passphrase,
  )
  return match ?? 'custom'
}

function preset(): (typeof PRESETS)[keyof typeof PRESETS] | null {
  const selected = getSelectedNetwork()
  return selected && selected !== 'custom' ? PRESETS[selected] : null
}

export function getContractId(): string {
  // A non-default preset may have its own deployment: VITE_CONTRACT_ID_MAINNET etc.
  const selected = getSelectedNetwork()
  if (selected && selected !== 'custom') {
    const name = `VITE_CONTRACT_ID_${selected.toUpperCase()}`
    const perNetwork = import.meta.env[name]
    if (typeof perNetwork === 'string' && perNetwork) return validateContractId(name, perNetwork)
  }
  return getEnv('VITE_CONTRACT_ID')
}

export function getRpcUrl(): string {
  return preset()?.rpcUrl ?? getEnv('VITE_RPC_URL')
}

export function getNetworkPassphrase(): string {
  return preset()?.passphrase ?? getEnv('VITE_NETWORK_PASSPHRASE')
}

/**
 * Base URL of the optional Trellis indexer/relay service (see indexer/ and
 * DEPLOYMENT.md). Unlike the variables above this one is optional: when it is
 * unset the event hooks poll Soroban RPC directly, exactly as before.
 */
export function getIndexerUrl(): string | null {
  const value = import.meta.env.VITE_INDEXER_URL
  return typeof value === 'string' && value ? value.replace(/\/+$/, '') : null
}

/** Optional token to prefill on the create agreement form. */
export function getDefaultTokenId(): string {
  return import.meta.env.VITE_DEFAULT_TOKEN_ID?.trim() ?? ''
}

// The entry point catches configuration errors while loading the app module.
export const CONTRACT_ID = getContractId()
export const RPC_URL = getRpcUrl()
export const NETWORK_PASSPHRASE = getNetworkPassphrase()
