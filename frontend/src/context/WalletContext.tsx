import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  isFreighterInstalled,
  connectWallet,
  getPublicKey,
  getNetworkPassphrase,
  isAppAllowed,
} from '../lib/wallet';
import { NETWORK_PASSPHRASE } from '../lib/config';

export type WalletStatus =
  | 'detecting'
  | 'unavailable'
  | 'disconnected'
  | 'connecting'
  | 'connected';

interface WalletContextValue {
  status: WalletStatus;
  publicKey: string | null;
  wrongNetwork: boolean;
  error: string | null;
  connected: boolean;
  connecting: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  recheckInstall(): void;
  clearError(): void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = 'trellis_wallet_connected';
const ACCOUNT_POLL_INTERVAL_MS = 3_000;
const PASSPHRASE_RETRY_ATTEMPTS = 3;
const PASSPHRASE_RETRY_DELAY_MS = 500;
const PASSPHRASE_FETCH_TIMEOUT_MS = 5_000;

function readIntent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeIntent(value: boolean): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

async function fetchNetworkPassphraseWithRetry(
  signal?: AbortSignal,
  attempts = PASSPHRASE_RETRY_ATTEMPTS,
  delay = PASSPHRASE_RETRY_DELAY_MS
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PASSPHRASE_FETCH_TIMEOUT_MS);

      const passphrase = await Promise.race([
        getNetworkPassphrase(),
        new Promise<string | null>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new Error('Timeout')))
        ),
      ]);

      clearTimeout(timeoutId);

      if (passphrase && passphrase.length > 0) {
        return passphrase;
      }

      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (i === attempts - 1) {
        console.warn('Failed to fetch network passphrase after retries:', error);
        return null;
      }

      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectNonce, setDetectNonce] = useState(0);

  const status: WalletStatus =
    phase === 'connected'
      ? 'connected'
      : phase === 'connecting'
        ? 'connecting'
        : installed === null
          ? 'detecting'
          : installed
            ? 'disconnected'
            : 'unavailable';

  const refreshNetwork = useCallback(async (signal?: AbortSignal) => {
    const passphrase = await fetchNetworkPassphraseWithRetry(signal);
    if (signal?.aborted) return;
    setNetworkPassphrase(passphrase);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const apply = (fn: () => void) => {
      if (!signal.aborted) fn();
    };

    void (async () => {
      try {
        apply(() => setInstalled(null));

        const found = await isFreighterInstalled(signal);
        if (signal.aborted) return;
        apply(() => setInstalled(found));

        if (!found) {
          apply(() => {
            setPublicKey(null);
            setPhase('idle');
            setNetworkPassphrase(null);
          });
          return;
        }

        if (!readIntent()) {
          apply(() => setPhase('idle'));
          return;
        }

        const allowed = await isAppAllowed();
        if (signal.aborted) return;
        if (!allowed) {
          writeIntent(false);
          apply(() => { setPublicKey(null); setPhase('idle'); });
          return;
        }

        const address = await getPublicKey();
        if (signal.aborted) return;
        if (!address) {
          writeIntent(false);
          apply(() => { setPublicKey(null); setPhase('idle'); });
          return;
        }

        apply(() => {
          setPublicKey(address);
          setPhase('connected');
        });
        await refreshNetwork(signal);
      } catch {
        apply(() => {
          setInstalled((prev) => (prev === null ? false : prev));
          setPhase('idle');
        });
      }
    })();

    return () => controller.abort();
  }, [detectNonce, refreshNetwork]);

  // While connected, poll for the active Freighter account and network so
  // switching accounts or networks in the extension (which fires no event
  // Freighter exposes) is reflected here instead of silently going stale.
  useEffect(() => {
    if (phase !== 'connected') return;

    let mounted = true;

    const intervalId = setInterval(() => {
      void (async () => {
        const [address, passphrase] = await Promise.all([
          getPublicKey(),
          fetchNetworkPassphraseWithRetry(),
        ]);

        if (!mounted) return;

        if (!address) {
          writeIntent(false);
          setPublicKey(null);
          setNetworkPassphrase(null);
          setPhase('idle');
          return;
        }

        setPublicKey((prev) => (prev !== address ? address : prev));
        setNetworkPassphrase((prev) => (prev !== passphrase ? passphrase : prev));
      })();
    }, ACCOUNT_POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [phase]);

  const connect = useCallback(async () => {
    setError(null);
    setPhase('connecting');

    const result = await connectWallet();

    if (!result.ok) {
      writeIntent(false);
      setPublicKey(null);
      setError(result.error.message);
      setPhase('idle');
      return;
    }

    setInstalled(true);
    setPublicKey(result.value);
    setPhase('connected');
    writeIntent(true);
    await refreshNetwork();
  }, [refreshNetwork]);

  const disconnect = useCallback(() => {
    writeIntent(false);
    setPublicKey(null);
    setNetworkPassphrase(null);
    setPhase('idle');
    setError(null);
  }, []);

  const recheckInstall = useCallback(() => {
    setError(null);
    setDetectNonce((n) => n + 1);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const wrongNetwork =
    phase === 'connected' &&
    !!NETWORK_PASSPHRASE &&
    networkPassphrase !== null &&
    networkPassphrase.trim() !== '' &&
    networkPassphrase !== NETWORK_PASSPHRASE;

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      publicKey,
      wrongNetwork,
      error,
      connected: status === 'connected',
      connecting: status === 'connecting',
      connect,
      disconnect,
      recheckInstall,
      clearError,
    }),
    [status, publicKey, wrongNetwork, error, connect, disconnect, recheckInstall, clearError],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
