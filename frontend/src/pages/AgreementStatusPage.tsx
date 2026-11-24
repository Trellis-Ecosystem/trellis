import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addToHistory } from '../lib/history'
import { isValidHexAgreementId } from '../lib/agreementId'
import { useAgreement } from '../hooks/useAgreement'
import { useTotalAmount } from '../hooks/useTotalAmount'
import AgreementDetail from '../components/AgreementDetail'
import EventFeed from '../components/EventFeed'

const INVALID_AGREEMENT_ID = 'Invalid agreement ID. Must be a 64-character hex string (0-9, a-f).'

function AgreementStatusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // The URL is the source of truth for which agreement is shown, so
  // bookmarks, shared links and back/forward navigation all work.
  const queriedId = id && isValidHexAgreementId(id) ? id : null
  const invalidPath = !!id && !queriedId
  const [searchId, setSearchId] = useState(id || '')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Keep the search box in sync when the URL changes (e.g. back button).
  useEffect(() => {
    setSearchId(id || '')
    setValidationError(null)
  }, [id])

  const { agreement, isLoading, isError, error, errorKind, refetch } = useAgreement(queriedId)
  const { totalAmount } = useTotalAmount(queriedId)

  // Viewing an agreement records it in the local history list.
  const loadedId = agreement?.agreement_id
  useEffect(() => {
    if (loadedId && loadedId === queriedId) {
      addToHistory({ agreementId: loadedId, lastViewed: new Date().toISOString() })
    }
  }, [loadedId, queriedId])

  const handleSearch = () => {
    const trimmed = searchId.trim()
    if (!trimmed) {
      setValidationError('Please enter an agreement ID')
      return
    }
    if (!isValidHexAgreementId(trimmed)) {
      setValidationError(INVALID_AGREEMENT_ID)
      return
    }
    setValidationError(null)
    navigate(`/agreement/${trimmed}`)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSearch()
  }

  const inlineError = validationError ?? (invalidPath ? INVALID_AGREEMENT_ID : null)

  return (
    <main className="px-6 pt-16 pb-32 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-white">Agreement Status</h1>
      <p className="mt-3 text-gray-400">
        Look up an agreement by its 64-character hex ID.
      </p>

      {/* Search Input */}
      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <label htmlFor="agreement-search" className="sr-only">
          Agreement ID
        </label>
        <input
          id="agreement-search"
          type="text"
          value={searchId}
          onChange={(e) => { setSearchId(e.target.value); setValidationError(null) }}
          placeholder="Enter agreement ID (hex)"
          className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 text-white rounded-lg focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={!searchId.trim()}
          className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-navy-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </form>
      {validationError && (
        <p className="mt-2 text-red-400 text-sm">{validationError}</p>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-10 rounded-xl border border-navy-700 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-navy-700 rounded w-1/3" />
            <div className="h-4 bg-navy-700 rounded w-2/3" />
            <div className="h-4 bg-navy-700 rounded w-1/2" />
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="mt-10 rounded-xl border border-red-500/50 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-8">
          <h2 className="text-red-400 font-semibold mb-2">
            {errorKind === 'contract' ? 'Agreement not found' : errorKind === 'rpc' ? 'Could not reach the network' : 'Could not load agreement'}
          </h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-4 px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-navy-900 font-semibold rounded"
          >
            Retry
          </button>
        </div>
      )}

      {/* Agreement Data */}
      {agreement && !isLoading && (
        <div className="mt-10 space-y-6">
          <AgreementDetail agreement={agreement} onUpdate={refetch} totalAmount={totalAmount} />
          <EventFeed agreementId={agreement.agreement_id} />
        </div>
      )}

      {/* Empty State */}
      {!id && !isLoading && (
        <div className="mt-10 rounded-xl border border-navy-700 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-8 text-center">
          <p className="text-gray-400">Enter an agreement ID above to view its details</p>
        </div>
      )}
    </main>
  )
}

export default AgreementStatusPage
