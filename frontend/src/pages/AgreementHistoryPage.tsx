import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToastActions } from '../hooks/useToast'
import { formatRelativeTime, truncateAgreementId } from '../lib/format'
import {
  clearHistory,
  getHistory,
  removeFromHistory,
  type AgreementRole,
  type HistoryEntry,
} from '../lib/history'
import { ExplorerLink } from '../components/ExplorerLink'
import CopyButton from '../components/CopyButton'

const ROLE_STYLES: Record<AgreementRole, string> = {
  payer: 'border-cyan-400/40 text-cyan-400',
  payee: 'border-emerald-400/40 text-emerald-400',
  resolver: 'border-gold-400/40 text-gold-400',
  observer: 'border-navy-700 text-gray-400',
}

function AgreementHistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [confirmingClear, setConfirmingClear] = useState(false)
  const toast = useToastActions()

  useEffect(() => {
    setEntries(getHistory())
  }, [])

  const handleRemove = useCallback((agreementId: string) => {
    removeFromHistory(agreementId)
    setEntries(getHistory())
  }, [])

  const handleClearAll = useCallback(() => {
    clearHistory()
    setEntries([])
    setConfirmingClear(false)
    toast.info({ title: 'History cleared' })
  }, [toast])

  return (
    <main className="px-6 pt-16 pb-32 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Agreement History</h1>
          <p className="mt-2 text-gray-400">
            Agreements you've recently viewed or created, stored on this device.
          </p>
        </div>

        {entries.length > 0 &&
          (confirmingClear ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg border border-navy-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="shrink-0 rounded-lg border border-navy-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-red-400/40 hover:text-red-400"
            >
              Clear All
            </button>
          ))}
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-navy-700 bg-navy-800/60 p-10 text-center">
          <p className="text-gray-400">
            No agreements viewed yet — <Link to="/create" className="text-cyan-400 hover:underline">create one</Link>{' '}
            or <Link to="/status" className="text-cyan-400 hover:underline">check an existing agreement</Link> to get
            started
          </p>
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.agreementId}
              className="rounded-xl border border-navy-700 bg-navy-800/60 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">
                    {entry.label || 'Unnamed Agreement'}
                  </p>
                  {entry.role && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${ROLE_STYLES[entry.role]}`}
                    >
                      {entry.role}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <code className="font-mono text-sm text-gray-400">
                    {truncateAgreementId(entry.agreementId)}
                  </code>
                  <ExplorerLink type="contract" value={entry.agreementId} />
                  <CopyButton text={entry.agreementId} label={`Copy agreement ID ${entry.agreementId}`} />
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {formatRelativeTime(entry.lastViewed)}
                </p>
              </div>

              <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
                <Link
                  to={`/agreement/${entry.agreementId}`}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.agreementId)}
                  className="rounded-lg border border-navy-700 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-red-400/40 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default AgreementHistoryPage
