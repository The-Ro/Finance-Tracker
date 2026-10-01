import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { Toaster } from '@/components/ui/Toaster'
import { UpdateBanner } from '@/components/layout/UpdateBanner'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { QueryPersistence } from '@/components/layout/QueryPersistence'
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

// Route-level code splitting -- each page becomes its own chunk instead of
// all of them (charts, csv parsing, drag-and-drop, everything) landing in
// one ~1.1MB bundle a first-time visitor has to download just to see Login.
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const RecurringPage = lazy(() => import('@/pages/RecurringPage').then((m) => ({ default: m.RecurringPage })))
const SubscriptionsPage = lazy(() => import('@/pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })))
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage').then((m) => ({ default: m.BudgetsPage })))
const BillsPage = lazy(() => import('@/pages/BillsPage').then((m) => ({ default: m.BillsPage })))
const SharedPage = lazy(() => import('@/pages/SharedPage').then((m) => ({ default: m.SharedPage })))
const FriendsPage = lazy(() => import('@/pages/FriendsPage').then((m) => ({ default: m.FriendsPage })))
const ReviewPage = lazy(() => import('@/pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const LentPage = lazy(() => import('@/pages/LentPage').then((m) => ({ default: m.LentPage })))
const GoalsPage = lazy(() => import('@/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const RulesPage = lazy(() => import('@/pages/RulesPage').then((m) => ({ default: m.RulesPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const CardPage = lazy(() => import('@/pages/CardPage').then((m) => ({ default: m.CardPage })))

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app-bg">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      // Kept for a day (not the 5-minute default) so pages visited earlier in
      // the session are still in the cache QueryPersistence saves for offline.
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <QueryPersistence />
        <ThemeProvider>
          <ToastProvider>
            <Toaster />
            <UpdateBanner />
            <InstallPrompt />
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route element={<PublicOnlyRoute />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  </Route>

                  {/* Not gated by PublicOnlyRoute/ProtectedRoute: a recovery link may or may
                      not have an active session by the time this mounts, and neither guard's
                      redirect behavior is what we want on this page either way. */}
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/transactions" element={<TransactionsPage />} />
                      <Route path="/recurring" element={<RecurringPage />} />
                      <Route path="/subscriptions" element={<SubscriptionsPage />} />
                      <Route path="/budgets" element={<BudgetsPage />} />
                      <Route path="/bills" element={<BillsPage />} />
                      <Route path="/cards/:account" element={<CardPage />} />
                      <Route path="/review" element={<ReviewPage />} />
                      <Route path="/friends" element={<FriendsPage />} />
                      <Route path="/shared" element={<SharedPage />} />
                      <Route path="/goals" element={<GoalsPage />} />
                      <Route path="/lent" element={<LentPage />} />
                      <Route path="/documents" element={<DocumentsPage />} />
                      <Route path="/rules" element={<RulesPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/settings/:section" element={<SettingsPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
