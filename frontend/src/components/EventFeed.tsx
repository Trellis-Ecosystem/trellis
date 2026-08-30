import { useMemo } from 'react'
import { useAgreementEvents } from '../hooks/useAgreementEvents'
import { ExplorerLink } from './ExplorerLink'

interface EventFeedProps {
  agreementId: string
}

export default function EventFeed({ agreementId }: EventFeedProps) {
  const { events, isLoading, error } = useAgreementEvents(agreementId)

  const eventDescriptions = useMemo(() => {
    return events.map((event) => ({
      ...event,
      description: formatEventDescription(event),
      icon: getEventIcon(event.type),
      color: getEventColor(event.type),
    }))
  }, [events])

  if (isLoading && events.length === 0) {
    return (
      <div className="rounded-xl border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6">
        <h2 className="text-xl font-semibold text-white dark:text-white light:text-gray-900 mb-4">Event Timeline</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-navy-700 dark:bg-navy-700 light:bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-navy-700 dark:bg-navy-700 light:bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-navy-700 dark:bg-navy-700 light:bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6">
        <h2 className="text-xl font-semibold text-white dark:text-white light:text-gray-900 mb-4">Event Timeline</h2>
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">Failed to load events</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 light:text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6">
        <h2 className="text-xl font-semibold text-white dark:text-white light:text-gray-900 mb-4">Event Timeline</h2>
        <div className="text-center py-8">
          <p className="text-gray-400 dark:text-gray-400 light:text-gray-600">No events found for this agreement</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6">
      <h2 className="text-xl font-semibold text-white dark:text-white light:text-gray-900 mb-6">Event Timeline</h2>

      <div className="space-y-6">
        {eventDescriptions.map((event, index) => (
          <div key={`${event.txHash}-${index}`} className="flex gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${event.color} flex items-center justify-center`}>
              {event.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-white dark:text-white light:text-gray-900 font-medium">{event.description}</p>
              
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-400 light:text-gray-600">
                <span>{new Date(event.timestamp).toLocaleString()}</span>
                {event.milestoneId !== undefined && (
                  <span className="font-mono">Milestone #{event.milestoneId}</span>
                )}
                {event.txHash && (
                  <ExplorerLink type="tx" value={event.txHash} />
                )}
              </div>

              {event.caller && (
                <div className="mt-2 text-xs">
                  <span className="text-gray-400 dark:text-gray-400 light:text-gray-600">By: </span>
                  <ExplorerLink type="account" value={event.caller} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatEventDescription(event: { type: string; amount?: string; milestoneId?: number; caller?: string }): string {
  const milestone = event.milestoneId !== undefined ? ` #${event.milestoneId}` : ''
  const amount = event.amount ? ` — ${event.amount}` : ''

  switch (event.type) {
    case 'created':
      return 'Agreement created'
    case 'locked':
      return `Payer funded milestone${milestone}${amount}`
    case 'work_submitted':
      return `Payee submitted work for milestone${milestone}`
    case 'approved':
      return `Milestone${milestone} approved — funds released${amount}`
    case 'disputed':
      return `Dispute raised for milestone${milestone}`
    case 'resolved':
      return `Dispute resolved for milestone${milestone}`
    case 'refunded':
      return `Milestone${milestone} refunded${amount}`
    default:
      return `Event: ${event.type}`
  }
}

function getEventIcon(type: string): JSX.Element {
  const iconClass = "w-5 h-5"
  
  switch (type) {
    case 'created':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      )
    case 'locked':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      )
    case 'work_submitted':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      )
    case 'approved':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )
    case 'disputed':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    case 'refunded':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )
  }
}

function getEventColor(type: string): string {
  switch (type) {
    case 'created':
      return 'bg-cyan-500'
    case 'locked':
      return 'bg-blue-500'
    case 'work_submitted':
      return 'bg-yellow-500'
    case 'approved':
      return 'bg-green-500'
    case 'disputed':
      return 'bg-red-500'
    case 'resolved':
      return 'bg-purple-500'
    case 'refunded':
      return 'bg-gray-500'
    default:
      return 'bg-navy-600'
  }
}
