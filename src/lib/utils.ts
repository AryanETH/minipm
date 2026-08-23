import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function scoreColor(score: number): string {
  if (score >= 8.5) return 'text-emerald-400'
  if (score >= 7.5) return 'text-green-400'
  if (score >= 6) return 'text-yellow-400'
  return 'text-red-400'
}

export function scoreBadgeClass(score: number): string {
  if (score >= 8.5) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (score >= 7.5) return 'bg-green-500/15 text-green-400 border-green-500/30'
  if (score >= 6) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
}

export function platformColor(platform: string): string {
  switch (platform) {
    case 'X': return 'text-sky-400'
    case 'LINKEDIN': return 'text-blue-500'
    default: return 'text-zinc-400'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'DRAFT': return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
    case 'APPROVED': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    case 'SCHEDULED': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'POSTED': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'FAILED': return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'REJECTED': return 'bg-zinc-700/40 text-zinc-500 border-zinc-700/30'
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}
