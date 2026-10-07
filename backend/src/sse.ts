const encoder = new TextEncoder()

export type SseEvent =
  | { type: 'text'; text: string }
  | { type: 'system'; message: string }
  | { type: 'function_call'; name: string; status: 'success' }
  | { type: 'error'; message: string }

export function encodeSse(data: SseEvent | '[DONE]'): Uint8Array {
  const payload = data === '[DONE]' ? data : JSON.stringify(data)
  return encoder.encode(`data: ${payload}\n\n`)
}
