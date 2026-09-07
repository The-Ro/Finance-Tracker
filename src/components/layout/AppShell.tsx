import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'
import { GlobalModalsProvider } from '@/context/GlobalModalsContext'
import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { WhatsNewModal } from '@/components/onboarding/WhatsNewModal'

export function AppShell() {
  const location = useLocation()

  return (
    <GlobalModalsProvider>
      <div className="flex min-h-dvh flex-col bg-app-bg">
        <WelcomeModal />
        <WhatsNewModal />
        {/* Floating toggle -- fixed positioning, doesn't occupy layout space. */}
        <Sidebar />
        <TopBar />
        <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-8">
          {/* Keying by path replays the fade-in-up animation on every navigation. */}
          <div key={location.pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </GlobalModalsProvider>
  )
}
