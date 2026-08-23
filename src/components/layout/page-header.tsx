import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between px-8 py-6 border-b border-zinc-800/60', className)}>
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
