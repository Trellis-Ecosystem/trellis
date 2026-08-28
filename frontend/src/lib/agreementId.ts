export function generateAgreementId(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validates that an agreement ID is a 64-character lowercase hex string,
 * matching the 32-byte on-chain representation.
 */
export function isValidHexAgreementId(id: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(id)
}
