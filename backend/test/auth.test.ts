import assert from 'node:assert/strict'
import test from 'node:test'
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../src/password.ts'
import { parseLoginRequest, parseRegisterRequest, ValidationError } from '../src/validation.ts'

test('password hash verifies only the original password and is salted', async () => {
  const first = await hashPassword('kata sandi rahasia')
  const second = await hashPassword('kata sandi rahasia')
  assert.notEqual(first, second)
  assert.ok(first.startsWith('pbkdf2-sha256$100000$'))
  assert.equal(await verifyPassword('kata sandi rahasia', first), true)
  assert.equal(await verifyPassword('kata sandi rahasia ', first), false)
  assert.equal(await verifyPassword('salah', first), false)
})

test('password verification rejects malformed or unsafe stored hashes', async () => {
  assert.equal(await verifyPassword('x', 'plaintext'), false)
  assert.equal(await verifyPassword('x', 'pbkdf2-sha256$100000$zz$zz'), false)
  assert.equal(await verifyPassword('x', 'pbkdf2-sha256$999999999$00$00'), false)
  assert.equal(await verifyPassword('x', DUMMY_PASSWORD_HASH), false)
})

test('register request normalizes email and derives a display name', () => {
  const sessionId = crypto.randomUUID()
  const result = parseRegisterRequest({
    session_id: sessionId,
    email: '  Budi.Santoso@Example.COM ',
    password: 'abcdefgh',
  })
  assert.equal(result.email, 'budi.santoso@example.com')
  assert.equal(result.displayName, 'budi.santoso')
  assert.equal(result.password, 'abcdefgh')
})

test('register request rejects bad email and short or oversized passwords', () => {
  const session_id = crypto.randomUUID()
  assert.throws(() => parseRegisterRequest({ session_id, email: 'bukan-email', password: 'abcdefgh' }), ValidationError)
  assert.throws(() => parseRegisterRequest({ session_id, email: 'a@b.co', password: 'pendek' }), ValidationError)
  assert.throws(() => parseRegisterRequest({ session_id, email: 'a@b.co', password: 'x'.repeat(129) }), ValidationError)
  assert.throws(() => parseRegisterRequest({ session_id: 'invalid', email: 'a@b.co', password: 'abcdefgh' }), ValidationError)
})

test('login request requires a password but does not enforce the registration minimum', () => {
  const session_id = crypto.randomUUID()
  assert.equal(parseLoginRequest({ session_id, email: 'a@b.co', password: 'x' }).password, 'x')
  assert.throws(() => parseLoginRequest({ session_id, email: 'a@b.co', password: '' }), ValidationError)
})
