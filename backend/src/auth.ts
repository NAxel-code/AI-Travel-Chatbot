import type { Context } from 'hono'
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password'
import {
  consumeRateLimit,
  createToken,
  getAuthUserId,
  hashToken,
  isAuthorized,
} from './session'
import type { AppEnv } from './types'
import { parseLoginRequest, parseRegisterRequest, ValidationError } from './validation'

const AUTH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const AUTH_RATE_LIMIT = 20 // attempts per IP per window
const EMAIL_RATE_LIMIT = 10 // login attempts per email per window
const AUTH_WINDOW_SECONDS = 15 * 60

type UserRow = { id: string; email: string; password_hash: string; display_name: string }

function publicUser(user: Pick<UserRow, 'id' | 'email' | 'display_name'>) {
  return { id: user.id, email: user.email, display_name: user.display_name }
}

async function rateLimited(c: Context<AppEnv>, emailKey?: string): Promise<Response | null> {
  const ip = c.req.header('CF-Connecting-IP') || 'local'
  const checks = [consumeRateLimit(c.env.DB, `auth-ip:${ip}`, AUTH_RATE_LIMIT, AUTH_WINDOW_SECONDS)]
  if (emailKey) checks.push(consumeRateLimit(c.env.DB, `auth-email:${emailKey}`, EMAIL_RATE_LIMIT, AUTH_WINDOW_SECONDS))
  const results = await Promise.all(checks)
  const blocked = results.find((result) => !result.allowed)
  if (!blocked) return null
  c.header('Retry-After', String(blocked.retryAfter))
  return c.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429)
}

async function issueAuthToken(db: D1Database, userId: string): Promise<string> {
  const token = createToken()
  const now = Date.now()
  await db.batch([
    db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').bind(now),
    db.prepare('INSERT INTO auth_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await hashToken(token), userId, now, now + AUTH_TOKEN_TTL_MS),
  ])
  return token
}

async function getSessionOwner(db: D1Database, sessionId: string): Promise<string | null> {
  const row = await db.prepare('SELECT user_id FROM sessions WHERE id = ? LIMIT 1')
    .bind(sessionId).first<{ user_id: string | null }>()
  return row?.user_id ?? null
}

// Attach the anonymous session to the account and fold its preferences into the account's.
// When both have the same category, the value already saved on the account wins.
async function linkSession(db: D1Database, sessionId: string, userId: string): Promise<void> {
  await db.batch([
    db.prepare('UPDATE sessions SET user_id = ? WHERE id = ? AND user_id IS NULL').bind(userId, sessionId),
    db.prepare(`
      DELETE FROM user_preferences
      WHERE session_id = ?1 AND user_id IS NULL
        AND preference_category IN (SELECT preference_category FROM user_preferences WHERE user_id = ?2)
    `).bind(sessionId, userId),
    db.prepare('UPDATE user_preferences SET user_id = ? WHERE session_id = ? AND user_id IS NULL')
      .bind(userId, sessionId),
  ])
}

const SESSION_CONFLICT = 'Sesi ini milik akun lain. Mulai sesi baru lalu coba lagi.'

export async function registerHandler(c: Context<AppEnv>) {
  try {
    const body = await c.req.json().catch(() => {
      throw new ValidationError('Request JSON tidak valid.')
    })
    const { sessionId, email, password, displayName } = parseRegisterRequest(body)
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    const limited = await rateLimited(c)
    if (limited) return limited
    if (await getSessionOwner(c.env.DB, sessionId)) return c.json({ error: SESSION_CONFLICT }, 409)

    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    try {
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(userId, email, passwordHash, displayName, Date.now()).run()
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        return c.json({ error: 'Email sudah terdaftar. Silakan masuk.' }, 409)
      }
      throw error
    }

    await linkSession(c.env.DB, sessionId, userId)
    const authToken = await issueAuthToken(c.env.DB, userId)
    return c.json({ data: { user: { id: userId, email, display_name: displayName }, auth_token: authToken } }, 201)
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error(error)
    return c.json({ error: 'Pendaftaran gagal.' }, 500)
  }
}

export async function loginHandler(c: Context<AppEnv>) {
  try {
    const body = await c.req.json().catch(() => {
      throw new ValidationError('Request JSON tidak valid.')
    })
    const { sessionId, email, password } = parseLoginRequest(body)
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    const limited = await rateLimited(c, email)
    if (limited) return limited

    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = ? LIMIT 1',
    ).bind(email).first<UserRow>()
    // Always run one hash so an unknown email is not distinguishable by response time.
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH)
    if (!user || !valid) return c.json({ error: 'Email atau password salah.' }, 401)

    const owner = await getSessionOwner(c.env.DB, sessionId)
    if (owner && owner !== user.id) return c.json({ error: SESSION_CONFLICT }, 409)
    await linkSession(c.env.DB, sessionId, user.id)
    const authToken = await issueAuthToken(c.env.DB, user.id)
    return c.json({ data: { user: publicUser(user), auth_token: authToken } })
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error(error)
    return c.json({ error: 'Login gagal.' }, 500)
  }
}

export async function logoutHandler(c: Context<AppEnv>) {
  const token = c.req.header('X-Auth-Token')
  if (token && token.length <= 200) {
    await c.env.DB.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').bind(await hashToken(token)).run()
  }
  return c.json({ success: true })
}

export async function meHandler(c: Context<AppEnv>) {
  const userId = await getAuthUserId(c)
  if (!userId) return c.json({ error: 'Belum masuk.' }, 401)
  const user = await c.env.DB.prepare('SELECT id, email, display_name FROM users WHERE id = ? LIMIT 1')
    .bind(userId).first<Pick<UserRow, 'id' | 'email' | 'display_name'>>()
  if (!user) return c.json({ error: 'Belum masuk.' }, 401)
  return c.json({ data: { user: publicUser(user) } })
}

// Latest itinerary of each of the account's sessions, newest first.
export async function tripsHandler(c: Context<AppEnv>) {
  try {
    const userId = await getAuthUserId(c)
    if (!userId) return c.json({ error: 'Belum masuk.' }, 401)
    const result = await c.env.DB.prepare(`
      SELECT i.session_id, i.destination, i.start_date, i.end_date, i.created_at
      FROM itineraries i JOIN sessions s ON s.id = i.session_id
      WHERE s.user_id = ?
        AND i.created_at = (SELECT MAX(created_at) FROM itineraries WHERE session_id = i.session_id)
      ORDER BY i.created_at DESC LIMIT 30
    `).bind(userId).all()
    return c.json({ data: result.results || [] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Gagal memuat perjalanan.' }, 500)
  }
}
