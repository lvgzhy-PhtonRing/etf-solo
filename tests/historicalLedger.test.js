import { describe, it, expect } from 'vitest'
import { buildSnapshotInputs, marketDate } from '../src/utils/historicalSnapshotLedger'

// 交易回填到过去日期时，现金应按 trade_date 扣除
const holdings = [{ stock_code: '000001', quantity: 100 }]
const transactions = [
  { stock_code: '000001', type: 'buy', quantity: 100, amount: 1000, fee: 5, trade_date: '2026-11-10' }
]
const capitalLogs = [
  { type: 'add', amount: 100000, category: 'capital', note: '初始', created_at: '2026-11-01T03:00:00Z' },
  // 现金扣款是 12 号才录入，但成交日是 10 号
  { type: 'remove', amount: 1005, category: 'trade', note: '买入 000001', created_at: '2026-11-12T03:00:00Z' }
]

describe('buildSnapshotInputs（单账户历史快照）', () => {
  it('现金按成交日而非录入日归集', () => {
    const inputs = buildSnapshotInputs(['2026-11-09', '2026-11-10'], holdings, transactions, capitalLogs)
    const nov9 = inputs.find(i => i.date === '2026-11-09')
    const nov10 = inputs.find(i => i.date === '2026-11-10')
    // 11-09：还没买入，现金应为 10 万
    expect(nov9.cash).toBeCloseTo(100000, 2)
    expect(nov9.positions).toEqual([])
    // 11-10：成交日当天，现金扣 1005，持仓 100 股
    expect(nov10.cash).toBeCloseTo(98995, 2)
    expect(nov10.positions).toEqual([['000001', 100]])
  })

  it('初始入金不计入 capitalChange', () => {
    const inputs = buildSnapshotInputs(['2026-11-01'], holdings, transactions, capitalLogs)
    expect(inputs[0].capitalChange).toBe(0)
  })

  it('marketDate 按上海时区归日', () => {
    expect(marketDate('2026-11-24T16:30:00Z')).toBe('2026-11-25')
  })
})
