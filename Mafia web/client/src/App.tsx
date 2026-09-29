import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { useAuth } from './lib/auth.tsx'
import { ArsenalPage } from './pages/ArsenalPage.tsx'
import { CityPage } from './pages/CityPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { HeistsPage } from './pages/HeistsPage.tsx'
import { LeaderboardPage } from './pages/LeaderboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { MarketPage } from './pages/MarketPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { VaultPage } from './pages/VaultPage.tsx'

function Protected() {
  const { me, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-ink p-8">
        <p className="text-sm text-muted">Opening the ledger…</p>
      </div>
    )
  }
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
        <Route path="/city" element={<CityPage />} />
        <Route path="/heists" element={<HeistsPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/arsenal" element={<ArsenalPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
