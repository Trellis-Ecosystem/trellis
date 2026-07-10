import { useCallback, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

function generateAgreementId() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function AgreementIdGenerator() {
  const [agreementId, setAgreementId] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(() => {
    setAgreementId(generateAgreementId())
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!agreementId) return

    await copyToClipboard(agreementId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [agreementId])

  const handleUseThisId = useCallback(async () => {
    if (!agreementId) return

    await copyToClipboard(agreementId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [agreementId])

  return (
    <section className="mx-auto mt-20 w-full max-w-2xl rounded-2xl border border-navy-700 bg-navy-800/75 p-6 text-left shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Agreement ID Utility
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">Generate a secure Agreement ID</h2>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Create a cryptographically random 64-character hex ID and share it with your
            counterparty before using the same ID on-chain.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300"
          onClick={handleGenerate}
        >
          Generate New ID
        </button>
      </div>

      <p className="mt-6 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-400">
        Save this ID — you will need it to check agreement status and share it with your counterparty
      </p>

      {agreementId ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <label className="text-sm font-semibold text-gray-300" htmlFor="agreement-id-output">
              Generated Agreement ID
            </label>
            <div
              id="agreement-id-output"
              className="mt-2 break-all rounded-lg border border-navy-700 bg-navy-900/80 p-4 font-mono text-sm leading-6 text-cyan-400"
            >
              {agreementId}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="rounded-lg border border-cyan-400 px-5 py-3 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/10"
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy ID'}
              </button>
              <button
                type="button"
                className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300"
                onClick={handleUseThisId}
              >
                Use This ID
              </button>
            </div>
          </div>

          <div className="mx-auto rounded-2xl border border-cyan-400/30 bg-navy-900/80 p-4">
            <QRCodeSVG
              value={agreementId}
              size={200}
              bgColor="transparent"
              fgColor="#00C2FF"
              level="M"
              title="Agreement ID QR code"
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-navy-700 bg-navy-900/40 p-6 text-center text-sm text-gray-500">
          Click “Generate New ID” to create a 64-character hex Agreement ID and QR code.
        </div>
      )}
    </section>
  )
}
