import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface WalletErrorBoundaryProps {
  children: ReactNode
}

interface WalletErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Scoped error boundary for wallet-related UI (WalletConnect and anything
 * that talks to the Freighter extension). Freighter can throw during
 * detection or connection when the extension is unresponsive or its
 * injected state is corrupted; without this boundary that error propagates
 * past WalletConnect and crashes the whole app instead of just the wallet
 * widget in the navbar.
 */
export class WalletErrorBoundary extends Component<WalletErrorBoundaryProps, WalletErrorBoundaryState> {
  constructor(props: WalletErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): WalletErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WalletErrorBoundary caught a wallet error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-gold-400 text-xs font-medium max-w-[16rem] text-right">
            Wallet connection failed unexpectedly.
          </span>
          <button
            onClick={this.handleRetry}
            className="bg-cyan-400 text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-cyan-300 transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
