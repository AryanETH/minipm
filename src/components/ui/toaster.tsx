'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[380px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
    variant?: 'default' | 'destructive' | 'success'
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(
      'group pointer-events-auto relative flex w-full items-center justify-between space-x-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
      'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
      variant === 'default' && 'border-zinc-800 bg-zinc-900 text-zinc-100',
      variant === 'destructive' && 'border-red-500/30 bg-red-950/80 text-red-300',
      variant === 'success' && 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300',
      className
    )}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn('text-zinc-500 hover:text-zinc-300 transition-colors', className)}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-sm font-medium', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn('text-xs opacity-70', className)} {...props} />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

// Simple global toast store
type ToastData = {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

let toastQueue: ToastData[] = []
let setToastsRef: React.Dispatch<React.SetStateAction<ToastData[]>> | null = null

export function toast(data: Omit<ToastData, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const item = { ...data, id }
  if (setToastsRef) {
    setToastsRef((prev) => [...prev, item])
  } else {
    toastQueue.push(item)
  }
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  React.useEffect(() => {
    setToastsRef = setToasts
    if (toastQueue.length > 0) {
      setToasts(toastQueue)
      toastQueue = []
    }
    return () => { setToastsRef = null }
  }, [])

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant }) => (
        <Toast key={id} variant={variant} onOpenChange={(open) => {
          if (!open) setToasts((prev) => prev.filter((t) => t.id !== id))
        }}>
          <div className="flex-1">
            <ToastTitle>{title}</ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
