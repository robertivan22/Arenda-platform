/**
 * App layout — wraps all authenticated pages.
 *
 * The middleware already redirects unauthenticated users to /login,
 * so this layout can be a simple Server Component without extra checks.
 * The sidebar and topbar are client components that can call useAuthStore
 * to get the current Supabase user for display.
 */
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { SidebarOverlay } from '@/components/layout/SidebarOverlay'
import { MobileNav } from '@/components/layout/MobileNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay backdrop */}
      <SidebarOverlay />

      {/* Left Sidebar — hidden on mobile, visible md+ */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top utility bar */}
        <AppTopbar />

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-16 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation — visible only on <md */}
      <MobileNav />
    </div>
  )
}
