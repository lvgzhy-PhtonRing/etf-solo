import { describe, it, expect } from 'vitest'
import { sumCapitalChange } from '../src/utils/positionSnapshot'

const logs = [
  { id: 1, type: 'add', amount: 1000, category: 'capital', note: '入金', created_at: '2026-11-24T03:00:00Z' },
  { id: 2, type: 'remove', amount: 200, category: 'capital', note: '取现', created_at: '2026-11-24T04:00:00Z' },
  { id: 3, type: 'remove', amount: 5000, category: 'trade', note: '买入 000001', created_at: '2026-11-24T05:00:00Z' },
  { id: 4, type: 'add', amount: 80, category: 'adjust', note: '利息', created_at: '2026-11-24T06:00:00Z' },
  { id: 5, type: 'add', amount: 99999, category: 'capital', note: '初始', created_at: '2026-11-24T01:00:00Z' },
  { id: 6, type: 'add', amount: 300, category: 'capital', note: '入金', created_at: '2026-11-23T03:00:00Z' }
]

describe('sumCapitalChange（当日外部资金净变动）', () => {
  it('只计当日 category=capital 且非初始的流水', () => {
    expect(sumCapitalChange(logs, '2026-11-24')).toBe(800)
  })

  it('不同日期不串账', () => {
    expect(sumCapitalChange(logs, '2026-11-23')).toBe(300)
    expect(sumCapitalChange(logs, '2026-11-22')).toBe(0)
  })
})
