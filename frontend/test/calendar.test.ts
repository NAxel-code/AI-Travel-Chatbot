import assert from 'node:assert/strict'
import test from 'node:test'
import { createIcs } from '../src/lib/calendar.ts'

test('calendar export uses destination timezone, activity time, duration, escaping, and CRLF', () => {
  const output = createIcs({
    id: 'trip-1',
    start_date: '2026-10-07',
    timezone: 'Asia/Jakarta',
    items: [{
      id: 'item-1',
      day_number: 2,
      time_slot: '14:30',
      title: 'Museum, Seni',
      description: 'Lantai 1; galeri',
      address: 'Jl. Contoh, Bandung',
    }],
  })
  assert.match(output, /X-WR-TIMEZONE:Asia\/Jakarta\r\n/)
  assert.match(output, /DTSTART;TZID=Asia\/Jakarta:20261008T143000\r\n/)
  assert.match(output, /DTEND;TZID=Asia\/Jakarta:20261008T160000\r\n/)
  assert.match(output, /SUMMARY:Museum\\, Seni\r\n/)
  assert.ok(!/(^|[^\r])\n/.test(output), 'all line endings should use CRLF')
})
