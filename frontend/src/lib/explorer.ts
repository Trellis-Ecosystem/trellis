export type ExplorerLinkType = 'tx' | 'contract' | 'account'

const TESTNET_EXPLORER_BASE = 'https://stellar.expert/explorer/testnet'
const MAINNET_EXPLORER_BASE = 'https://stellar.expert/explorer/public'

export const getExplorerBase = (network = import.meta.env.VITE_NETWORK as string | undefined) => {
  return network?.trim().toLowerCase() === 'testnet' ? TESTNET_EXPLORER_BASE : MAINNET_EXPLORER_BASE
}

export const explorerLinks = {
  tx: (hash: string) => `${getExplorerBase()}/tx/${hash}`,
  contract: (contractId: string) => `${getExplorerBase()}/contract/${contractId}`,
  account: (publicKey: string) => `${getExplorerBase()}/account/${publicKey}`,
} satisfies Record<ExplorerLinkType, (value: string) => string>

export const truncateExplorerValue = (value: string, start = 6, end = 6) => {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}…${value.slice(-end)}`
}