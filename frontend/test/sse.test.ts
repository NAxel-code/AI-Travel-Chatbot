import assert from 'node:assert/strict'
import test from 'node:test'
import { readSse, SseParser } from '../src/lib/sse.ts'

test('SSE parser preserves events split across arbitrary chunks', () => {
  const source = 'data: {"type":"text","text":"Halo"}\r\n\r\ndata: {"type":"system","message":"A = \\"B\\""}\n\ndata: [DONE]\n\n'
  const parser = new SseParser()
  const events = [...source].flatMap((character) => parser.push(character))
  assert.deepEqual(events, [
    { type: 'text', text: 'Halo' },
    { type: 'system', message: 'A = "B"' },
    '[DONE]',
  ])
})

test('SSE reader rejects transport EOF without DONE sentinel', async () => {
  const response = new Response('data: {"type":"text","text":"partial"}\n\n')
  await assert.rejects(() => readSse(response, () => undefined), /terputus sebelum respons selesai/)
})


test('SSE parser exposes safe progress status events', () => {
  const parser = new SseParser()
  assert.deepEqual(parser.push('data: {"type":"progress","stage":"places","message":"Mencari tempat nyata…"}\n\n'), [
    { type: 'progress', stage: 'places', message: 'Mencari tempat nyata…' },
  ])
})
