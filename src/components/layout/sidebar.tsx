'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  Zap,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Post Studio', href: '/', icon: LayoutDashboard },
  { label: 'Scrape',      href: '/reviews', icon: Star },
  { label: 'Settings',    href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside suppressHydrationWarning className="fixed left-0 top-0 h-screen w-[240px] bg-zinc-950 border-r border-zinc-800/60 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">Mini PM</p>
            <p className="text-[10px] text-zinc-500 leading-tight">Product research toolkit</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-indigo-400' : 'text-zinc-600 group-hover:text-zinc-400'
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800/60">
        <p className="text-[11px] text-zinc-600">Local-first · No cloud</p>
      </div>
    </aside>
  )
}
