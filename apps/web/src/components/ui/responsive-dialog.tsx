'use client'

/**
 * ResponsiveDialog
 *
 * On desktop (md+): standard centered Radix Dialog modal.
 * On mobile (<md):  bottom sheet that slides up from the bottom edge.
 *
 * Usage:
 *   <ResponsiveDialog open={open} onOpenChange={setOpen} title="Titlu">
 *     {children}
 *   </ResponsiveDialog>
 */

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  /** Max width class on desktop, e.g. 'max-w-lg' */
  maxWidth?: string
  /** Hide the default close (X) button */
  hideClose?: boolean
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
  hideClose = false,
}: ResponsiveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fadeIn" />

        {/* Content — bottom sheet on mobile, centered modal on md+ */}
        <Dialog.Content
          className={clsx(
            'fixed z-50 bg-white shadow-xl outline-none focus:outline-none',
            // Mobile: bottom sheet
            'bottom-0 inset-x-0 max-h-[92dvh] rounded-t-2xl overflow-y-auto',
            'data-[state=open]:animate-slideUp',
            // Desktop: centered modal
            `md:bottom-auto md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2`,
            `md:w-[90vw] md:${maxWidth} md:max-h-[90vh] md:rounded-xl`,
            'md:data-[state=open]:animate-none',
          )}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          {(title || !hideClose) && (
            <div className="flex items-start justify-between px-4 pt-3 pb-2 md:px-6 md:pt-5">
              <div>
                {title && (
                  <Dialog.Title className="text-base font-semibold text-gray-900 md:text-lg">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-gray-500">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              {!hideClose && (
                <Dialog.Close className="ml-4 mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </Dialog.Close>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-4 pb-6 md:px-6 md:pb-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Trigger wrapper — just re-exports Dialog.Trigger for convenience */
export const ResponsiveDialogTrigger = Dialog.Trigger
