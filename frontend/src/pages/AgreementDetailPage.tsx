import { useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'

export function AgreementDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-navy-900 text-gray-200">
      <Navbar />
      <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Agreement Detail — Coming Soon
        </h1>
        {id ? <p className="mt-4 text-sm text-gray-500">Agreement ID: {id}</p> : null}
      </main>
    </div>
  )
}
