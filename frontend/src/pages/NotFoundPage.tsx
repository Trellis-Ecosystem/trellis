import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-navy-900 text-gray-200">
      <Navbar />
      <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Page Not Found
        </h1>
        <Link
          to="/"
          className="mt-8 rounded-lg border border-cyan-400 px-6 py-3 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/10"
        >
          Back to Home
        </Link>
      </main>
    </div>
  )
}
