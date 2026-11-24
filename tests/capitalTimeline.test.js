import { describe, it, expect } from 'vitest'
import { buildCapitalTimeline } from '../src/utils/capitalTimeline'

const logs = [
  { id: 1, type: 'add', amount: 92955.55, category: 'capital', note: '期初结转', created_at: '2026-01-05T00:00:00+08:00' },
  { id: 2, type: 'add', amount: 69000, category: 'capital', note: '银证转入', created_at: '2026-03-03T12:01:48+08:00' },
  { id: 3, type: 'remove', amount: 138000, category: 'capital', note: '银证转出', created_at: '2026-03-03T12:02:49+08:00' },
  { id: 4, type: 'add', amount: 69000, category: 'capital', note: '银证转入', created_at: '2026-03-17T14:52:19+08:00' },
  { id: 5, type: 'add', amount: 50000, category: 'capital', note: '银证转入', created_at: '2026-06-09T09:27:11+08:00' },
  { id: 6, type: 'add', amount: 468, category: 'adjust', note: '红利', created_at: '2026-07-03T19:05:56+08:00' }
]

describe('buildCapitalTimeline（资本总览累计）', () => {
  it('只算 category=capital，按时间累计', () => {
    const rows = buildCapitalTimeline(logs)
    expect(rows.map(r => r.running)).toEqual([92955.55, 161955.55, 23955.55, 92955.55, 142955.55])
  })

  it('升序排列并保留原始字段', () => {
    const rows = buildCapitalTimeline([...logs].reverse())
    expect(rows[0].id).toBe(1)
    expect(rows.at(-1).id).toBe(5)
    expect(rows[0].note).toBe('期初结转')
  })
})
