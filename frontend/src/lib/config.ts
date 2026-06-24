export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string;
export const RPC_URL = import.meta.env.VITE_RPC_URL as string;
export const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

if (!CONTRACT_ID || !RPC_URL || !NETWORK_PASSPHRASE) {
  console.warn('Missing environment variables — copy .env.example to .env and fill in values');
}
