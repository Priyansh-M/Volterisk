import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { useAuth } from './lib/auth.tsx'
import { AchievementsPage } from './pages/AchievementsPage.tsx'
import { ArsenalPage } from './pages/ArsenalPage.tsx'
import { CityPage } from './pages/CityPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { HeistsPage } from './pages/HeistsPage.tsx'
import { LeaderboardPage } from './pages/LeaderboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { MapPage } from './pages/MapPage.tsx'
import { MarketPage } from './pages/MarketPage.tsx'
import { NotificationsPage } from './pages/NotificationsPage.tsx'
import { OnboardingPage } from './pages/OnboardingPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { ReputationPage } from './pages/ReputationPage.tsx'
import { PropertiesPage } from './pages/PropertiesPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { VaultPage } from './pages/VaultPage.tsx'
import { WorkPage } from './pages/WorkPage.tsx'

function Protected() {
  const { me, loading } = useAuth()
  if (loading) {
    return (
      <div className="classified-grid flex min-h-screen items-center justify-center">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Opening the ledger…</p>
      </div>
    )
  }
  if (!me) return <Navigate to="/login" replace />
  if (!me.onboarding.hasClaimedStarter || !me.onboarding.hasBase) return <OnboardingPage />
  return <Shell />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/city" element={<CityPage />} />
        <Route path="/heists" element={<HeistsPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/arsenal" element={<ArsenalPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/assets" element={<PropertiesPage />} />
        <Route path="/properties" element={<Navigate to="/assets" replace />} />
        <Route path="/work" element={<WorkPage />} />
        <Route path="/reputation" element={<ReputationPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
