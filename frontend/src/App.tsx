import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ExplorerLink } from './components/ExplorerLink'
import { NetworkBackground } from './components/NetworkBackground'
import { WalletProvider } from './context/WalletContext'
import { ThemeProvider } from './context/ThemeContext'
import ToastProvider from './components/toast/ToastProvider'
import { CONTRACT_ID } from './lib/config'
import { explorerBaseUrl, networkLabel } from './lib/explorer'
import HomePage from './pages/HomePage'
import StatusPage from './pages/StatusPage'
import CreateAgreementPage from './pages/CreateAgreementPage'
import AgreementHistoryPage from './pages/AgreementHistoryPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ToastProvider>
          <div className="relative min-h-screen text-gray-200 dark:text-gray-200 light:text-gray-900 bg-navy-900 dark:bg-navy-900 light:bg-white">
            <NetworkBackground />
            <div className="relative z-10">
              <Navbar />
              
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/agreement/:id" element={<StatusPage />} />
                <Route path="/create" element={<CreateAgreementPage />} />
                <Route path="/history" element={<AgreementHistoryPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>

              <p className="mt-12 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-500 light:text-gray-600">
                <span>Escrow contract on {networkLabel()}:</span>
                <ExplorerLink type="contract" value={CONTRACT_ID} full />
              </p>
            </div>

            <footer className="border-t border-navy-700/60 px-6 py-8 text-center text-sm text-gray-500">
              <p>
                Every agreement, deposit, and dispute resolution is recorded on-chain. Verify any of
                them yourself on{' '}
                <a
                  href={explorerBaseUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-2 transition-colors hover:text-cyan-300"
                >
                  Stellar Expert
                </a>
                .
              </p>
              <p className="mt-2 text-xs text-gray-600">Trellis v{__APP_VERSION__}</p>
            </footer>
          </div>
        </ToastProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}

export default App
