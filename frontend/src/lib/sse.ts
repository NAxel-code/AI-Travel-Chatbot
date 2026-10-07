export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'system'; message: string }
  | { type: 'function_call'; name: string; status: 'success' }
  | { type: 'error'; message: string }

export class SseParser {
  private buffer = ''

  push(chunk: string): Array<StreamEvent | '[DONE]'> {
    this.buffer = `${this.buffer}${chunk}`.replace(/\r\n/g, '\n')
    const events: Array<StreamEvent | '[DONE]'> = []
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      const parsed = this.parseBlock(block)
      if (parsed) events.push(parsed)
      boundary = this.buffer.indexOf('\n\n')
    }
    return events
  }

  finish(): Array<StreamEvent | '[DONE]'> {
    const remainder = this.buffer.trim()
    this.buffer = ''
    const parsed = remainder ? this.parseBlock(remainder) : null
    return parsed ? [parsed] : []
  }

  private parseBlock(block: string): StreamEvent | '[DONE]' | null {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim()
    if (!data) return null
    if (data === '[DONE]') return '[DONE]'
    return JSON.parse(data) as StreamEvent
  }
}

export async function readSse(response: Response, onEvent: (event: StreamEvent) => void): Promise<void> {
  if (!response.body) throw new Error('Browser tidak menerima stream dari server.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()

  while (true) {
    const { value, done } = await reader.read()
    const events = parser.push(value ? decoder.decode(value, { stream: !done }) : decoder.decode())
    for (const event of events) {
      if (event === '[DONE]') {
        await reader.cancel()
        return
      }
      onEvent(event)
    }
    if (done) break
  }

  for (const event of parser.finish()) {
    if (event === '[DONE]') return
    onEvent(event)
  }
  throw new Error('Koneksi stream terputus sebelum respons selesai.')
}
