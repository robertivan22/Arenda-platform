'use client'

import { useSidebarStore } from '@/store/sidebar.store'

export function SidebarOverlay() {
  const { open, close } = useSidebarStore()
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-black/50 z-20 md:hidden"
      onClick={close}
    />
  )
}
