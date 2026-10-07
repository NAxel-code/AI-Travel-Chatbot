import type { Context } from 'hono'
import type { AppEnv, ChatMessage, Preference } from './types'
import { ValidationError, validateSessionId } from './validation'

const TOKEN_HEADER = 'X-Session-Token'

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`
}

export async function consumeRateLimit(
  database: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds
  const id = `${key}:${windowStart}`
  const row = await database.prepare(`
    INSERT INTO rate_limits (id, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(id, windowStart + windowSeconds * 2).first<{ count: number }>()
  return { allowed: Number(row?.count || 1) <= limit, retryAfter: windowStart + windowSeconds - now }
}

export async function isAuthorized(c: Context<AppEnv>, sessionId: string): Promise<boolean> {
  const token = c.req.header(TOKEN_HEADER)
  if (!token || token.length > 200) return false
  const tokenHash = await hashToken(token)
  const row = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND access_token_hash = ? LIMIT 1',
  ).bind(sessionId, tokenHash).first()
  return Boolean(row)
}

export async function createSessionHandler(c: Context<AppEnv>) {
  const ip = c.req.header('CF-Connecting-IP') || 'local'
  const rate = await consumeRateLimit(c.env.DB, `session:${ip}`, 20, 3600)
  if (!rate.allowed) {
    c.header('Retry-After', String(rate.retryAfter))
    return c.json({ error: 'Terlalu banyak sesi baru. Coba lagi nanti.' }, 429)
  }

  await c.env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Math.floor(Date.now() / 1000)).run()
  const body = await c.req.json().catch(() => ({})) as { session_id?: unknown }
  let requestedId: string | null = null
  if (body.session_id != null) {
    try {
      requestedId = validateSessionId(body.session_id)
    } catch {
      requestedId = null
    }
  }

  const token = createToken()
  const tokenHash = await hashToken(token)
  if (requestedId) {
    const existing = await c.env.DB.prepare(
      'SELECT access_token_hash FROM sessions WHERE id = ? LIMIT 1',
    ).bind(requestedId).first<{ access_token_hash: string | null }>()
    if (existing && !existing.access_token_hash) {
      const claim = await c.env.DB.prepare(
        'UPDATE sessions SET access_token_hash = ? WHERE id = ? AND access_token_hash IS NULL',
      ).bind(tokenHash, requestedId).run()
      if (claim.meta.changes === 1) return c.json({ data: { session_id: requestedId, token } })
    }
  }

  const sessionId = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, access_token_hash, created_at) VALUES (?, ?, ?)',
  ).bind(sessionId, tokenHash, Date.now()).run()
  return c.json({ data: { session_id: sessionId, token } }, 201)
}

export async function getHistoryHandler(c: Context<AppEnv>) {
  try {
    const sessionId = validateSessionId(c.req.param('session_id'))
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    const raw = await c.env.CHAT_HISTORY.get(`session:${sessionId}`)
    if (!raw) return c.json({ data: [] })
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return c.json({ data: [] })
    const messages = parsed.filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false
      const message = item as Partial<ChatMessage>
      return (message.role === 'user' || message.role === 'model') && typeof message.content === 'string'
    }).slice(-20)
    return c.json({ data: messages })
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error(error)
    return c.json({ error: 'Gagal memuat riwayat.' }, 500)
  }
}

export async function getPreferencesHandler(c: Context<AppEnv>) {
  try {
    const sessionId = validateSessionId(c.req.param('session_id'))
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    const result = await c.env.DB.prepare(`
      SELECT preference_category, preference_value
      FROM user_preferences WHERE session_id = ? ORDER BY preference_category ASC
    `).bind(sessionId).all<Preference>()
    return c.json({ data: result.results || [] })
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error(error)
    return c.json({ error: 'Gagal memuat preferensi.' }, 500)
  }
}

export async function deletePreferenceHandler(c: Context<AppEnv>) {
  try {
    const sessionId = validateSessionId(c.req.param('session_id'))
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    const category = c.req.param('category')
    if (!category || category.length > 60 || !/^[a-z0-9_-]+$/i.test(category)) {
      return c.json({ error: 'Kategori preferensi tidak valid.' }, 400)
    }
    await c.env.DB.prepare(
      'DELETE FROM user_preferences WHERE session_id = ? AND preference_category = ?',
    ).bind(sessionId, category).run()
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Gagal menghapus preferensi.' }, 500)
  }
}
