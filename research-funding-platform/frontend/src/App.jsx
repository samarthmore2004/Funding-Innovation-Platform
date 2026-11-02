import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute, RoleRoute } from './auth/ProtectedRoute'
import { FullPageLoader } from './components/ui/Spinner'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'

// Route-level code splitting: every page is its own chunk.
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const FundingPage = lazy(() => import('./pages/FundingPage'))
const FundingDetailPage = lazy(() => import('./pages/FundingDetailPage'))
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'))
const ResearchPage = lazy(() => import('./pages/ResearchPage'))
const PatentsPage = lazy(() => import('./pages/PatentsPage'))
const PatentDetailPage = lazy(() => import('./pages/PatentDetailPage'))
const TechnologyPage = lazy(() => import('./pages/TechnologyPage'))
const TechnologyAreaPage = lazy(() => import('./pages/TechnologyAreaPage'))
const InnovationPage = lazy(() => import('./pages/InnovationPage'))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))
const CommercializationPage = lazy(() => import('./pages/CommercializationPage'))
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="funding" element={<FundingPage />} />
          <Route path="funding/:id" element={<FundingDetailPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="patents" element={<PatentsPage />} />
          <Route path="patents/:id" element={<PatentDetailPage />} />
          <Route path="technology" element={<TechnologyPage />} />
          <Route path="technology/:key" element={<TechnologyAreaPage />} />
          <Route path="innovation" element={<InnovationPage />} />
          <Route path="innovation/:id" element={<ProjectDetailPage />} />
          <Route path="commercialization" element={<CommercializationPage />} />
          <Route
            path="portfolio"
            element={
              <RoleRoute roles={['innovation_manager', 'admin']}>
                <PortfolioPage />
              </RoleRoute>
            }
          />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin"
            element={
              <RoleRoute roles={['admin']}>
                <AdminPage />
              </RoleRoute>
            }
          />
          <Route path="*" element={<NotFoundPage inApp />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
