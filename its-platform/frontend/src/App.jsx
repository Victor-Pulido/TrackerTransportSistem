import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout          from './components/layout/Layout'
import Login           from './pages/Login'
import Dashboard       from './pages/Dashboard'
import MapView         from './pages/MapView'
import Analytics       from './pages/Analytics'
import Fiscalization   from './pages/Fiscalization'
import Financial       from './pages/Financial'
import OperatorReports from './pages/OperatorReports'

// ── ProtectedRoute ────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect unauthorized roles to dashboard
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// ── RootRedirect ──────────────────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Protected layout routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map"       element={<MapView />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route
            path="/fiscalization"
            element={
              <ProtectedRoute allowedRoles={['fiscalizador', 'superadmin']}>
                <Fiscalization />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['operator', 'superadmin']}>
                <OperatorReports />
              </ProtectedRoute>
            }
          />
          <Route path="/financial" element={<Financial />} />
        </Route>

        {/* Catch-all: redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
