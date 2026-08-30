import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="flex flex-col items-center justify-center px-6 pt-32 pb-32 text-center">
      <p className="text-cyan-400 dark:text-cyan-400 light:text-cyan-600 font-mono text-sm tracking-widest">404</p>
      <h1 className="mt-3 text-3xl font-bold text-white dark:text-white light:text-gray-900">Page not found</h1>
      <p className="mt-3 text-gray-400 dark:text-gray-400 light:text-gray-600 max-w-md">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-8 bg-cyan-400 text-navy-900 font-semibold px-6 py-3 rounded-lg text-sm hover:bg-cyan-300 transition-colors"
      >
        Back to Home
      </Link>
    </main>
  )
}

export default NotFoundPage
