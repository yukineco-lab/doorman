import { net } from 'electron'
import type { PageMeta } from '@shared/types'

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico'
}

const FETCH_TIMEOUT = 8000

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await net.fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Doorman/0.1'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

function decodeBody(buffer: ArrayBuffer, contentType: string | null): string {
  let charset = 'utf-8'
  if (contentType) {
    const m = contentType.match(/charset=([^;]+)/i)
    if (m) charset = m[1].trim().toLowerCase()
  }
  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  const raw = m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return raw || null
}

interface IconCandidate {
  href: string
  size: number
}

function extractIconHrefs(html: string): IconCandidate[] {
  const result: IconCandidate[] = []
  const linkRe = /<link\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html))) {
    const tag = m[0]
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)
    if (!relMatch) continue
    const rel = relMatch[1].toLowerCase()
    if (
      !/(^|\s)(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(
        rel
      )
    ) {
      continue
    }
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)
    if (!hrefMatch) continue
    const sizesMatch = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)
    let size = 16
    if (sizesMatch) {
      const s = sizesMatch[1].toLowerCase()
      if (s === 'any') size = 9999
      else {
        const sm = s.match(/(\d+)/)
        if (sm) size = parseInt(sm[1], 10)
      }
    }
    if (rel.includes('apple-touch')) size = Math.max(size, 180)
    result.push({ href: hrefMatch[1], size })
  }
  return result
}

function bufferToDataUrl(buf: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
}

function extFromUrl(u: string): string | null {
  try {
    const path = new URL(u).pathname
    const m = path.match(/\.([a-zA-Z0-9]+)$/)
    if (!m) return null
    const ext = '.' + m[1].toLowerCase()
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)
      ? ext
      : null
  } catch {
    return null
  }
}

async function tryFetchIcon(
  url: string
): Promise<{ dataUrl: string; ext: string } | null> {
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT)
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim()
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return null
    let mime = ct
    let ext = MIME_TO_EXT[mime]
    if (!ext) {
      ext = extFromUrl(url) ?? '.ico'
      mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/x-icon'
    }
    return { dataUrl: bufferToDataUrl(buf, mime), ext }
  } catch {
    return null
  }
}

export async function fetchPageMeta(targetUrl: string): Promise<PageMeta> {
  let baseUrl: URL
  try {
    baseUrl = new URL(targetUrl)
  } catch {
    return { title: null, iconDataUrl: null, iconExt: null }
  }

  let title: string | null = null
  const candidates: IconCandidate[] = []

  try {
    const res = await fetchWithTimeout(baseUrl.toString())
    if (res.ok) {
      const ct = res.headers.get('content-type')
      const buf = await res.arrayBuffer()
      const html = decodeBody(buf, ct)
      title = extractTitle(html)
      const links = extractIconHrefs(html)
      for (const l of links) {
        try {
          candidates.push({ href: new URL(l.href, baseUrl).toString(), size: l.size })
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore — fall through to favicon.ico fallback
  }

  // Fallback to /favicon.ico
  candidates.push({ href: new URL('/favicon.ico', baseUrl).toString(), size: 0 })

  // Try in descending size order
  candidates.sort((a, b) => b.size - a.size)

  let iconDataUrl: string | null = null
  let iconExt: string | null = null
  for (const c of candidates) {
    const got = await tryFetchIcon(c.href)
    if (got) {
      iconDataUrl = got.dataUrl
      iconExt = got.ext
      break
    }
  }

  return { title, iconDataUrl, iconExt }
}
