import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AgreementDetailPage } from './pages/AgreementDetailPage'
import { AgreementStatusPage } from './pages/AgreementStatusPage'
import { CreateAgreementPage } from './pages/CreateAgreementPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/create',
    element: <CreateAgreementPage />,
  },
  {
    path: '/status',
    element: <AgreementStatusPage />,
  },
  {
    path: '/agreement/:id',
    element: <AgreementDetailPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
