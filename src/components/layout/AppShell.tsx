import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AnnouncementBanner } from './AnnouncementBanner'
import { TopBar } from './TopBar'
import { OfflineBanner } from './OfflineBanner'
import { GlobalModalsProvider } from '@/context/GlobalModalsContext'
import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { WhatsNewModal } from '@/components/onboarding/WhatsNewModal'

export function AppShell() {
  const location = useLocation()

  // Plain <BrowserRouter>/<Routes> (not a data router), so there's no
  // built-in <ScrollRestoration> -- without this, switching tabs (Home,
  // Transactions, ...) keeps whatever scroll offset the previous page was
  // at, so a short new page can open already scrolled past its own content,
  // or land in the middle of nowhere instead of at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <GlobalModalsProvider>
      {/* lg:pl-60 clears the persistent desktop sidebar (Sidebar.tsx, w-60,
          fixed) so the header and page content start beside it, not under it. */}
      <div className="flex min-h-dvh flex-col bg-app-bg lg:pl-60">
        <WelcomeModal />
        <WhatsNewModal />
        {/* Desktop rail (lg+) and the floating toggle below lg -- both fixed
            positioning, so neither occupies layout space. */}
        <Sidebar />
        <TopBar />
        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-8">
          <div className="mb-4 flex flex-col gap-3 empty:hidden">
            <OfflineBanner />
            <AnnouncementBanner />
          </div>
          {/* Keying by the top-level path replays the fade-in-up animation on every
              page change; sub-pages (/settings/<section>) animate their own content
              so the Settings sub-nav doesn't remount on each click. */}
          <div key={location.pathname.split('/')[1]} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </GlobalModalsProvider>
  )
}
