import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { RecurringPage } from '@/pages/RecurringPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { RulesPage } from '@/pages/RulesPage'
import { SettingsPage } from '@/pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
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
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
