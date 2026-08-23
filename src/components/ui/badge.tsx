import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
        outline: 'border-zinc-700 text-zinc-400',
        indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
        emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        red: 'bg-red-500/15 text-red-400 border-red-500/30',
        blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
