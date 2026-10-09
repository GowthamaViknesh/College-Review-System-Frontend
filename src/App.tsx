import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout, RequirePermission } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ApiError } from './lib/api'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages'

// Each page is downloaded the first time it is opened, so the login screen stays small
// and the chart library is only fetched by people who reach the dashboard
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const CollegesPage = lazy(() => import('./pages/CollegesPage').then((module) => ({ default: module.CollegesPage })))
const CollegeDetailPage = lazy(() => import('./pages/CollegeDetailPage').then((module) => ({ default: module.CollegeDetailPage })))
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage').then((module) => ({ default: module.MyReviewsPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })))
const RolesPage = lazy(() => import('./pages/RolesPage').then((module) => ({ default: module.RolesPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const ActionLogsPage = lazy(() => import('./pages/ActionLogsPage').then((module) => ({ default: module.ActionLogsPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Retrying helps with a network blip, not with "not allowed" or "not found"
      retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Everything below needs a logged-in user; AppLayout redirects to /login otherwise */}
              <Route element={<AppLayout />}>
                {/* The bare address sends people to the dashboard, so old links and bookmarks keep working */}
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="colleges" element={<CollegesPage />} />
                <Route path="colleges/:id" element={<CollegeDetailPage />} />
                <Route
                  path="my-reviews"
                  element={
                    <RequirePermission anyOf={['review:create']}>
                      <MyReviewsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="users"
                  element={
                    <RequirePermission anyOf={['user:read', 'user:create']}>
                      <UsersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="roles"
                  element={
                    <RequirePermission anyOf={['role:read']}>
                      <RolesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="logs"
                  element={
                    <RequirePermission anyOf={['log:read']}>
                      <ActionLogsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              {/* Any address the app does not have goes to the login page, which sends people already logged in on to the dashboard */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
