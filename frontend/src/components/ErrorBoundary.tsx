import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-navy-900 dark:bg-navy-900 light:bg-white">
          <div className="max-w-md w-full bg-navy-800 dark:bg-navy-800 light:bg-white border border-navy-700 dark:border-navy-700 light:border-gray-200 rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white dark:text-white light:text-gray-900 mb-2">Something Went Wrong</h1>
              <p className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-sm mb-6">
                An unexpected error occurred. Our team has been notified.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 text-left bg-navy-900 dark:bg-navy-900 light:bg-white rounded p-4">
                <p className="text-xs text-red-400 font-mono break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-cyan-400 text-navy-900 font-semibold rounded-lg hover:bg-cyan-300 transition-colors"
              >
                Try Again
              </button>
              <a
                href="https://github.com/Trellis-Ecosystem/trellis/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 border border-cyan-400 text-cyan-400 dark:text-cyan-400 light:text-cyan-600 font-semibold rounded-lg hover:bg-cyan-400/10 transition-colors"
              >
                Report Issue
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
