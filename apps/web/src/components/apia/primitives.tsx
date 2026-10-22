'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

type DivProps = React.HTMLAttributes<HTMLDivElement>

// ── Dialog ───────────────────────────────────────────────────────────────────
export const Dialog = DialogPrimitive.Root

export const DialogContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        ref={ref}
        className={clsx('fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 shadow-xl outline-none', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Închide">
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
)
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: DivProps) => <div className={clsx('flex flex-col gap-1.5', className)} {...props} />
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

// ── Sheet (right/left drawer built on Dialog) ────────────────────────────────
export const Sheet = DialogPrimitive.Root

export const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'left' | 'right' }
>(({ className, children, side = 'right', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
    <DialogPrimitive.Content
      ref={ref}
      className={clsx('fixed inset-y-0 z-50 shadow-xl outline-none', side === 'right' ? 'right-0' : 'left-0', className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Închide">
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

export const SheetHeader = ({ className, ...props }: DivProps) => <div className={clsx('flex flex-col gap-1.5', className)} {...props} />
export const SheetTitle = DialogPrimitive.Title

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: DivProps) {
  return <div className={clsx('animate-pulse rounded-md bg-gray-200', className)} {...props} />
}

// ── Dropdown menu ────────────────────────────────────────────────────────────
export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>>(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={clsx('z-50 min-w-[8rem] overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  ),
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>>(
  ({ className, ...props }, ref) => (
    <DropdownPrimitive.Item
      ref={ref}
      className={clsx('relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-[13px] outline-none focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)}
      {...props}
    />
  ),
)
DropdownMenuItem.displayName = 'DropdownMenuItem'
