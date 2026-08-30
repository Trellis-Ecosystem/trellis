import { useWallet } from '../context/WalletContext';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function WalletConnect() {
  const { status, publicKey, wrongNetwork, connecting, error, connect, disconnect, recheckInstall, clearError } = useWallet();

  if (status === 'detecting') {
    return (
      <span className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-sm px-5 py-2 inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-2 border-navy-700 dark:border-navy-700 light:border-gray-200 border-t-cyan-400 animate-spin" />
        Checking wallet…
      </span>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="flex items-center gap-3">
        {error && (
          <span className="text-gold-400 text-xs font-medium max-w-[16rem] text-right">{error}</span>
        )}
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-cyan-400 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-cyan-300 transition-colors"
        >
          Install Freighter
        </a>
        <button
          onClick={recheckInstall}
          className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-xs underline underline-offset-2 hover:text-gray-200 dark:hover:text-gray-200 light:hover:text-gray-700 transition-colors"
        >
          Already installed?
        </button>
      </div>
    );
  }

  if (status === 'disconnected' || status === 'connecting') {
    return (
      <div className="flex items-center gap-3">
        {error && (
          <button onClick={clearError} className="text-gold-400 text-xs font-medium max-w-[16rem] text-right hover:text-gold-400/70 transition-colors">
            {error}
          </button>
        )}
        <button
          onClick={connect}
          disabled={connecting}
          aria-pressed={false}
          aria-disabled={connecting}
          aria-busy={connecting}
          className="bg-cyan-400 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {wrongNetwork && (
        <span className="text-gold-400 text-xs font-medium">Switch to Testnet</span>
      )}
      {publicKey ? (
        <>
          <span className="text-gray-300 dark:text-gray-300 light:text-gray-700 text-sm font-mono bg-navy-800 dark:bg-navy-800 light:bg-white px-3 py-1.5 rounded-md border border-navy-600 dark:border-navy-600 light:border-gray-300">
            {truncateAddress(publicKey)}
          </span>
          <button
            onClick={disconnect}
            aria-pressed={true}
            aria-label={`Disconnect wallet ${truncateAddress(publicKey)}`}
            className="text-gray-500 dark:text-gray-500 light:text-gray-600 text-xs hover:text-gray-300 dark:hover:text-gray-300 light:hover:text-gray-700 transition-colors"
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          {import.meta.env.DEV && console.warn('[WalletConnect] Connected status but publicKey is null/undefined — unexpected state')}
          <span className="text-gold-400 text-xs font-medium">Wallet key unavailable</span>
          <button
            onClick={disconnect}
            aria-pressed={true}
            aria-label="Disconnect wallet"
            className="text-gray-500 dark:text-gray-500 light:text-gray-600 text-xs hover:text-gray-300 dark:hover:text-gray-300 light:hover:text-gray-700 transition-colors"
          >
            Disconnect
          </button>
        </>
      )}
    </div>
  );
}
