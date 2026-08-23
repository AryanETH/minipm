export interface TemplateVariables {
  headline: string
  subheadline: string
  author: string
  handle: string
  category: string
  footer?: string
  avatarUrl?: string
  verified?: boolean
  postBody?: string
  advertMode?: boolean
  advertLogoUrl?: string
  advertLogoText?: string
  advertTagline?: string
  advertBgColor?: string
  // Yourstory template
  bgImageUrl?: string    // background photo
  accentColor?: string   // corner squares + accent color
  brandName?: string     // top-right brand label
  categoryLabel?: string // bottom bar category label
}

export interface ImageFormat {
  name: string
  width: number
  height: number
}

export const IMAGE_FORMATS: Record<string, ImageFormat> = {
  LINKEDIN_PORTRAIT: { name: 'LinkedIn Portrait', width: 1080, height: 1350 },
  SQUARE:            { name: 'Square',             width: 1080, height: 1080 },
  X_LANDSCAPE:       { name: 'X Landscape',        width: 1600, height: 900  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Converts markdown tokens → HTML after HTML-escaping.
// Blank lines (\n\n) become a small gap <div> instead of two <br> so
// paragraph spacing isn't double the normal line height.
function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text)
  // Split on double newlines first → paragraphs
  const paragraphs = escaped.split(/\n{2,}/)
  return paragraphs
    .map(p =>
      p
        .replace(/__([^_]+?)__/g, '<u>$1</u>')
        .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+?)_/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>')
    )
    .join('<div style="height:0.6em"></div>')
}

// Ad strip pinned to the bottom of the canvas.
// Shows an uploaded logo image OR falls back to bold text.
function adStrip(
  W: number, H: number,
  logoUrl: string, logoText: string,
  tagline: string, bg: string, fg = '#fff',
): string {
  const h   = Math.round(H * 0.082)
  const px  = Math.round(W * 0.055)
  const fs  = Math.round(W * 0.026)
  const lh  = Math.round(h * 0.55)   // logo height

  const logoEl = logoUrl
    ? `<img src="${logoUrl}" style="height:${lh}px;width:auto;object-fit:contain;flex-shrink:0;" />`
    : `<span style="background:rgba(255,255,255,0.18);border-radius:${Math.round(lh*0.25)}px;padding:${Math.round(lh*0.15)}px ${Math.round(lh*0.4)}px;font-size:${Math.round(lh*0.5)}px;font-weight:800;color:${fg};white-space:nowrap;letter-spacing:-0.01em;">${escapeHtml(logoText||'BRAND')}</span>`

  return `<div style="position:absolute;bottom:0;left:0;width:${W}px;height:${h}px;background:${escapeHtml(bg)};display:flex;align-items:center;padding:0 ${px}px;gap:${Math.round(W*0.022)}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${logoEl}
  <span style="font-size:${fs}px;color:${fg};opacity:0.92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(tagline||'')}</span>
</div>`
}

// ─── Shared renderer ──────────────────────────────────────────────────────────
// Layout strategy:
//   body = flex column, justify-content:flex-start (top-aligned so text grows down)
//   padY is kept small so there's more room for text
//   maxBodyH is calculated with minimal overhead, not over-subtracted
//   line-height is 1.4 (tighter) so less wasted space per line

interface Theme {
  bg: string
  fg: string
  fgHandle: string
  ring: string
  avatarFallbackBg: string
  avatarFallbackFg: string
  badgeFill: string
  badgeCheck: string
  font: string
  extraCss?: string
}

function tweetCardHtml(vars: TemplateVariables, fmt: ImageFormat, theme: Theme): string {
  const {
    author, handle, avatarUrl, verified = true,
    postBody, headline,
    advertMode,
    advertLogoUrl = '', advertLogoText = '',
    advertTagline = '', advertBgColor = '#6366f1',
  } = vars

  const LIMIT = 400
  const raw   = postBody || headline || ''
  const plain = raw.replace(/\*\*|__|_/g, '')
  const body  = plain.length > LIMIT ? raw.slice(0, LIMIT).trimEnd() + '…' : raw

  const W = fmt.width
  const H = fmt.height

  const adH  = advertMode ? Math.round(H * 0.082) : 0

  // Tight padding — just enough breathing room
  const padX = Math.round(W * 0.075)
  const padT = Math.round(H * 0.055)   // top padding
  const padB = padT + adH              // bottom = same as top + ad strip

  // Avatar & name sizes
  const avSz   = Math.round(W * 0.088)
  const namePx = Math.round(W * 0.033)
  const hdlPx  = Math.round(namePx * 0.82)
  const hdrGap = Math.round(avSz * 0.30)      // gap between avatar and name col
  const hdrMB  = Math.round(H * 0.028)        // margin below header row

  // Body font — shrinks for landscape AND for longer text
  const isLandscape = W > H
  const lsf = isLandscape ? 0.80 : 1
  const bodyPx =
    plain.length <= 80  ? Math.round(W * 0.048 * lsf) :
    plain.length <= 160 ? Math.round(W * 0.041 * lsf) :
    plain.length <= 280 ? Math.round(W * 0.036 * lsf) :
                          Math.round(W * 0.030 * lsf)

  // Available height for body text — generous, just exclude what we truly use
  const usableH  = H - adH - padT - padB + adH  // = H - adH - padT - padT
  const headerH  = avSz + hdrMB
  const maxBodyH = usableH - headerH

  const bodyHtml    = renderMarkdown(body)

  // Avatar: clean circular photo — no inner padding that causes a border line
  const avatarInner = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : `<div style="width:100%;height:100%;border-radius:50%;background:${theme.avatarFallbackBg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(avSz*0.42)}px;font-weight:700;color:${theme.avatarFallbackFg};">${escapeHtml(author.charAt(0).toUpperCase())}</div>`

  const bsz   = Math.round(namePx * 1.1)
  const badge = verified
    ? `<svg width="${bsz}" height="${bsz}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-left:${Math.round(namePx*0.28)}px;flex-shrink:0;"><circle cx="12" cy="12" r="12" fill="${theme.badgeFill}"/><path d="M9.5 16.5L5.5 12.5L6.91 11.09L9.5 13.67L17.09 6.09L18.5 7.5L9.5 16.5Z" fill="${theme.badgeCheck}"/></svg>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${theme.bg};}
body{
  font-family:${theme.font};
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
  padding:${padT}px ${padX}px ${padB}px;
  position:relative;
}
.hdr{
  display:flex;align-items:center;
  gap:${hdrGap}px;
  margin-bottom:${hdrMB}px;
  flex-shrink:0;
}
.av{
  width:${avSz}px;height:${avSz}px;
  border-radius:50%;
  overflow:hidden;
  flex-shrink:0;
  background:${theme.ring};
  padding:3px;
}
.av-inner{
  width:100%;height:100%;
  border-radius:50%;
  overflow:hidden;
  display:block;
}
.nc{display:flex;flex-direction:column;gap:${Math.round(namePx*0.15)}px;overflow:hidden;}
.name{display:flex;align-items:center;font-size:${namePx}px;font-weight:700;color:${theme.fg};line-height:1.2;white-space:nowrap;}
.hdl{font-size:${hdlPx}px;color:${theme.fgHandle};line-height:1.2;white-space:nowrap;}
.body{
  font-size:${bodyPx}px;
  color:${theme.fg};
  line-height:1.42;
  word-break:break-word;
  overflow-wrap:break-word;
  overflow:hidden;
  max-height:${maxBodyH}px;
  flex-shrink:0;
}
${theme.extraCss ?? ''}
</style>
</head>
<body>
  <div class="hdr">
    <div class="av"><div class="av-inner">${avatarInner}</div></div>
    <div class="nc">
      <div class="name">${escapeHtml(author)}${badge}</div>
      <div class="hdl">${escapeHtml(handle)}</div>
    </div>
  </div>
  <div class="body">${bodyHtml}</div>
  ${advertMode ? adStrip(W, H, advertLogoUrl, advertLogoText, advertTagline, advertBgColor) : ''}
</body>
</html>`
}

// ─── 5 Layouts ────────────────────────────────────────────────────────────────

function buildTweetCard(v: TemplateVariables, f: ImageFormat): string {
  return tweetCardHtml(v, f, {
    bg: '#ffffff', fg: '#0f1419', fgHandle: '#536471',
    ring: 'linear-gradient(135deg,#f97316,#ec4899)',
    avatarFallbackBg: 'linear-gradient(135deg,#f97316,#ec4899)', avatarFallbackFg: '#fff',
    badgeFill: '#1d9bf0', badgeCheck: 'white',
    font: `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`,
  })
}

function buildTweetCardDark(v: TemplateVariables, f: ImageFormat): string {
  return tweetCardHtml(v, f, {
    bg: '#0f1419', fg: '#e7e9ea', fgHandle: '#71767b',
    ring: 'linear-gradient(135deg,#6366f1,#818cf8)',
    avatarFallbackBg: 'linear-gradient(135deg,#6366f1,#818cf8)', avatarFallbackFg: '#fff',
    badgeFill: '#1d9bf0', badgeCheck: 'white',
    font: `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`,
    extraCss: `.body strong{color:#fff;} .body u{text-decoration-color:#6366f1;}`,
  })
}

function buildTweetCardPaper(v: TemplateVariables, f: ImageFormat): string {
  return tweetCardHtml(v, f, {
    bg: '#fef3c7', fg: '#1c1917', fgHandle: '#78716c',
    ring: 'linear-gradient(135deg,#d97706,#92400e)',
    avatarFallbackBg: 'linear-gradient(135deg,#d97706,#92400e)', avatarFallbackFg: '#fff',
    badgeFill: '#d97706', badgeCheck: 'white',
    font: `Georgia,'Times New Roman',serif`,
  })
}

function buildTweetCardNeon(v: TemplateVariables, f: ImageFormat): string {
  return tweetCardHtml(v, f, {
    bg: '#030712', fg: '#e2e8f0', fgHandle: '#4488ff',
    ring: 'linear-gradient(135deg,#00ffcc,#0066ff)',
    avatarFallbackBg: 'linear-gradient(135deg,#00ffcc,#0066ff)', avatarFallbackFg: '#000',
    badgeFill: '#00ffcc', badgeCheck: '#000',
    font: `'Courier New',Courier,monospace`,
    extraCss: `.name{color:#00ffcc;text-shadow:0 0 20px #00ffcc55;} .body strong{color:#00ffcc;}`,
  })
}

function buildTweetCardMinimal(v: TemplateVariables, f: ImageFormat): string {
  return tweetCardHtml(v, f, {
    bg: '#fafafa', fg: '#09090b', fgHandle: '#a1a1aa',
    ring: '#e4e4e7',   // plain border color, not gradient
    avatarFallbackBg: '#18181b', avatarFallbackFg: '#a1a1aa',
    badgeFill: '#3f3f46', badgeCheck: '#a1a1aa',
    font: `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`,
    extraCss: `.name{font-weight:600;letter-spacing:-0.01em;} .body{letter-spacing:-0.01em;}`,
  })
}

// ─── TEMPLATES map ────────────────────────────────────────────────────────────

export const TEMPLATES = {
  'tweet-card':         buildTweetCard,
  'tweet-card-dark':    buildTweetCardDark,
  'tweet-card-paper':   buildTweetCardPaper,
  'tweet-card-neon':    buildTweetCardNeon,
  'tweet-card-minimal': buildTweetCardMinimal,
  'yourstory':          buildYourstory,
}

export type TemplateKey = keyof typeof TEMPLATES

export function renderTemplate(key: TemplateKey, vars: TemplateVariables, format: ImageFormat): string {
  const fn = TEMPLATES[key]
  if (!fn) throw new Error(`Unknown template: ${key}`)
  return fn(vars, format)
}

export const TEMPLATE_METADATA = [
  { id: 'tweet-card',         name: 'Classic White',  description: 'Clean white with gradient avatar ring' },
  { id: 'tweet-card-dark',    name: 'Dark Mode',      description: 'Twitter dark theme, indigo accents' },
  { id: 'tweet-card-paper',   name: 'Paper / Warm',   description: 'Warm cream, serif font, editorial feel' },
  { id: 'tweet-card-neon',    name: 'Neon / Cyber',   description: 'Dark with cyan electric glow' },
  { id: 'tweet-card-minimal', name: 'Ultra Minimal',  description: 'Light, spacious, clean lines' },
  { id: 'yourstory',          name: 'Yourstory',       description: 'News-style: photo bg, vignette, headline box, accent corners' },
]

// ─── Yourstory template ───────────────────────────────────────────────────────
// Layout (matching the reference image):
//   • Full-bleed background photo with radial black vignette overlay
//   • Brand name top-right in small caps
//   • Circular logo badge centered (uses avatarUrl)
//   • Dark frosted headline box in the lower half with bold white text
//   • Bottom bar: black strip with logo + category label
//   • Corner accent squares (accent color) at bottom-left and bottom-right
function buildYourstory(vars: TemplateVariables, fmt: ImageFormat): string {
  const {
    postBody, headline, avatarUrl,
    brandName = 'BRAND',
    categoryLabel = 'NEWS',
    accentColor = '#22c55e',
    bgImageUrl = '',
    advertLogoUrl = '',
  } = vars

  const text = (postBody || headline || '').replace(/\*\*|__|_/g, '')
  const W    = fmt.width
  const H    = fmt.height

  // Proportional sizes
  const padX       = Math.round(W * 0.06)
  const brandPx    = Math.round(W * 0.030)
  const badgeSize  = Math.round(W * 0.13)
  const headlinePx = text.length <= 80  ? Math.round(W * 0.068)
                   : text.length <= 160 ? Math.round(W * 0.058)
                   :                      Math.round(W * 0.050)
  const catPx      = Math.round(W * 0.025)
  const cornerSz   = Math.round(W * 0.095)
  const barH       = Math.round(H * 0.075)
  const boxPadY    = Math.round(H * 0.035)
  const boxPadX    = Math.round(W * 0.055)

  // Background: image or fallback gradient
  const bgStyle = bgImageUrl
    ? `background-image:url('${bgImageUrl}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg,#0a1628,#0d2137,#071020);`

  // Center logo badge
  const logoContent = avatarUrl
    ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : `<div style="width:100%;height:100%;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;">
        <svg width="${Math.round(badgeSize*0.45)}" height="${Math.round(badgeSize*0.45)}" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="${accentColor}" stroke-width="1.5"/>
          <path d="M12 7v5l3 3" stroke="${accentColor}" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`

  // Bottom bar logo
  const barLogoEl = advertLogoUrl
    ? `<img src="${advertLogoUrl}" style="height:${Math.round(barH*0.5)}px;width:auto;object-fit:contain;" />`
    : `<span style="font-size:${Math.round(barH*0.32)}px;font-weight:700;color:#fff;letter-spacing:0.05em;">${escapeHtml(brandName)}</span>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${W}px;height:${H}px;overflow:hidden;}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  ${bgStyle}
  position:relative;
}
/* Vignette overlay */
.vignette{
  position:absolute;inset:0;
  background:radial-gradient(ellipse at 50% 40%,transparent 20%,rgba(0,0,0,0.55) 65%,rgba(0,0,0,0.85) 100%);
  pointer-events:none;
}
/* Brand top-right */
.brand{
  position:absolute;
  top:${Math.round(H*0.038)}px;
  right:${padX}px;
  font-size:${brandPx}px;
  font-weight:700;
  letter-spacing:0.12em;
  text-transform:uppercase;
  color:rgba(255,255,255,0.9);
  z-index:10;
}
/* Center badge */
.badge-wrap{
  position:absolute;
  left:50%;
  top:${Math.round(H*0.555)}px;
  transform:translate(-50%,-50%);
  z-index:10;
}
.badge{
  width:${badgeSize}px;height:${badgeSize}px;
  border-radius:50%;
  border:2px solid rgba(255,255,255,0.7);
  overflow:hidden;
  background:#111;
}
/* Headline box */
.headline-box{
  position:absolute;
  bottom:${barH}px;
  left:0;right:0;
  background:rgba(0,0,0,0.72);
  padding:${boxPadY}px ${boxPadX}px;
  text-align:center;
  z-index:10;
}
.headline-text{
  font-size:${headlinePx}px;
  font-weight:700;
  color:#ffffff;
  line-height:1.32;
  letter-spacing:-0.01em;
}
/* Bottom bar */
.bar{
  position:absolute;bottom:0;left:0;right:0;
  height:${barH}px;
  background:#000000;
  display:flex;align-items:center;justify-content:center;
  gap:${Math.round(W*0.015)}px;
  z-index:10;
}
.cat-label{
  font-size:${catPx}px;
  font-weight:600;
  color:rgba(255,255,255,0.85);
  letter-spacing:0.08em;
  text-transform:uppercase;
}
/* Corner accent squares */
.corner{
  position:absolute;
  width:${cornerSz}px;height:${cornerSz}px;
  background:${escapeHtml(accentColor)};
  z-index:20;
}
.corner-bl{bottom:0;left:0;}
.corner-br{bottom:0;right:0;}
/* Small inner dark squares on corners (like the reference) */
.corner-inner{
  position:absolute;
  width:${Math.round(cornerSz*0.52)}px;
  height:${Math.round(cornerSz*0.52)}px;
  background:#000;
  z-index:21;
}
.corner-bl .corner-inner{top:0;right:0;}
.corner-br .corner-inner{top:0;left:0;}
</style>
</head>
<body>
  <div class="vignette"></div>
  <div class="brand">${escapeHtml(brandName)}</div>
  <div class="badge-wrap">
    <div class="badge">${logoContent}</div>
  </div>
  <div class="headline-box">
    <div class="headline-text">${escapeHtml(text)}</div>
  </div>
  <div class="bar">
    ${barLogoEl}
    <span class="cat-label">✦ ${escapeHtml(categoryLabel)}</span>
  </div>
  <div class="corner corner-bl"><div class="corner-inner"></div></div>
  <div class="corner corner-br"><div class="corner-inner"></div></div>
</body>
</html>`
}
