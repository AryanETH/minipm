/**
 * Browser-local image storage via localStorage.
 * Images are stored as base64 data URIs — no server, no filesystem writes.
 * Works on Vercel, Netlify, any read-only host.
 *
 * Keys stored:
 *   minipm:avatar    — profile photo
 *   minipm:adlogo    — brand/ad logo
 *   minipm:bgimage   — Yourstory background photo
 */

export type ImageKey = 'avatar' | 'adlogo' | 'bgimage'

const PREFIX = 'minipm:'

function storageKey(k: ImageKey) {
  return PREFIX + k
}

/** Read a stored data URI (or '' if not set / SSR) */
export function getLocalImage(key: ImageKey): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(storageKey(key)) ?? ''
  } catch {
    return ''
  }
}

/** Store a File as a base64 data URI in localStorage */
export async function storeLocalImage(key: ImageKey, file: File): Promise<string> {
  const dataUri = await fileToDataUri(file)
  try {
    localStorage.setItem(storageKey(key), dataUri)
  } catch (e) {
    // localStorage can throw QuotaExceededError for large images
    const msg = e instanceof Error ? e.message : 'Storage full'
    throw new Error(`Could not save image locally: ${msg}`)
  }
  return dataUri
}

/** Remove a stored image */
export function clearLocalImage(key: ImageKey): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(key))
  } catch { /* ignore */ }
}

/** Convert a File to a base64 data URI */
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
