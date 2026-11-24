import { useWallet } from '../context/WalletContext';
import { networkLabel } from '../lib/explorer';

export default function WalletConnect() {
  const { address, connect, disconnect, wrongNetwork } = useWallet();

  if (!address) {
    return (
      <button
        type="button"
        onClick={connect}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {wrongNetwork && (
        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          Switch Freighter to {networkLabel()}
        </span>
      )}
      <span className="font-mono text-sm text-slate-600">
        {address.slice(0, 4)}…{address.slice(-4)}
      </span>
      <button
        type="button"
        onClick={disconnect}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Disconnect
      </button>
    </div>
  );
}
