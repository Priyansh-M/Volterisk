import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { useAuth } from './lib/auth.tsx'
import { ArsenalPage } from './pages/ArsenalPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { HeistsPage } from './pages/HeistsPage.tsx'
import { LeaderboardPage } from './pages/LeaderboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { VaultPage } from './pages/VaultPage.tsx'

function Protected() {
  const { me, loading } = useAuth()
  if (loading) return <p className="p-8 text-sm text-muted">Opening the ledger…</p>
  if (!me) return <Navigate to="/login" replace />
  return <Shell />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/heists" element={<HeistsPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/arsenal" element={<ArsenalPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
