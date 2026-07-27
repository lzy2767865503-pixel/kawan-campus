import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const AdminConsole = lazy(() => import('./components/AdminConsole.jsx'))
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={<main className="route-loading" aria-busy="true">正在载入安全管理后台…</main>}>
        <AdminConsole />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
