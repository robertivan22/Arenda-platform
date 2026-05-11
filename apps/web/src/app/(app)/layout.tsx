import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { SidebarOverlay } from '@/components/layout/SidebarOverlay'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay backdrop */}
      <SidebarOverlay />

      {/* Left Sidebar */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top utility bar */}
        <AppTopbar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
