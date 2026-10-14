// PBKDF2-SHA256 password hashing on WebCrypto (no extra dependency).
// 100_000 is the maximum iteration count the Workers runtime accepts.
const SCHEME = 'pbkdf2-sha256'
const ITERATIONS = 100_000
const MAX_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256

// Verified against when an email is unknown, so login takes the same time either way.
export const DUMMY_PASSWORD_HASH = `${SCHEME}$${ITERATIONS}$${'00'.repeat(SALT_BYTES)}$${'00'.repeat(HASH_BITS / 8)}`

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `${SCHEME}$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltHex, hashHex] = stored.split('$')
  const iterations = Number(iterationsRaw)
  if (scheme !== SCHEME || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false
  const salt = fromHex(saltHex ?? '')
  const expected = fromHex(hashHex ?? '')
  if (!salt || !expected) return false

  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i]
  return difference === 0
}
