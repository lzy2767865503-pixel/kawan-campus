import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const AdminConsole = lazy(() => import('./components/AdminConsole.jsx'))

function isAdminLocation() {
  const path = window.location.pathname
  return path === '/admin'
    || path.startsWith('/admin/')
    || window.location.hash === '#admin'
    || new URLSearchParams(window.location.search).get('view') === 'admin'
}

function RootRouter() {
  const [isAdminRoute, setIsAdminRoute] = useState(isAdminLocation)

  useEffect(() => {
    const syncRoute = () => setIsAdminRoute(isAdminLocation())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  const exitAdmin = () => {
    window.history.replaceState(null, '', '/')
    setIsAdminRoute(false)
  }

  return isAdminRoute ? (
    <Suspense fallback={<main className="route-loading" aria-busy="true">正在载入安全管理后台…</main>}>
      <AdminConsole onExit={exitAdmin} />
    </Suspense>
  ) : (
    <App />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>,
)
