import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'

const root = createRoot(document.getElementById('root')!)

async function startApp() {
  try {
    const { default: App } = await import('./App.tsx')
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (error) {
    const isConfigError = error instanceof Error && error.name === 'ConfigurationError'
    if (!isConfigError) console.error(error)
    root.render(
      <main role="alert" className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">
          {isConfigError ? 'Configuration error' : 'Unable to start Trellis'}
        </h1>
        <p className="mt-4">
          {isConfigError ? error.message : 'Reload the page to try again.'}
        </p>
      </main>,
    )
  }
}

void startApp()
