import { describe, it, expect } from 'vitest'
import { recentTrades, shortDate } from '../src/utils/recentTrades'

const tx = (id, code, type, date, qty, price) => ({ id, stock_code: code, type, trade_date: date, quantity: qty, price })

describe('shortDate', () => {
  it('2026-06-05 → 26/06/05', () => {
    expect(shortDate('2026-06-05')).toBe('26/06/05')
  })
  it('非法输入原样返回', () => {
    expect(shortDate('')).toBe('')
    expect(shortDate('20260605')).toBe('20260605')
  })
})

describe('recentTrades', () => {
  const list = [
    tx(1, '002364', 'buy', '2026-06-05', 600, 7.12),
    tx(2, '002364', 'sell', '2026-06-03', 600, 7.45),
    tx(3, '002364', 'buy', '2026-05-20', 300, 7.01),
    tx(4, '002364', 'sell', '2026-05-18', 300, 7.3),
    tx(5, '002364', 'buy', '2026-05-10', 600, 6.88),
    tx(6, '300059', 'buy', '2026-06-01', 800, 23.75),
    // 无日期/类型异常的脏数据应被过滤
    tx(7, '002364', 'buy', '', 100, 7),
    tx(8, '002364', 'dividend', '2026-06-06', 0, 0)
  ]

  it('按成交日倒序取最近 3 笔，只含该股买卖', () => {
    const rows = recentTrades(list, '002364', 3)
    expect(rows.map(r => r.date)).toEqual(['26/06/05', '26/06/03', '26/05/20'])
    expect(rows[0]).toEqual({ date: '26/06/05', side: 'buy', qty: 600, price: 7.12 })
  })

  it('取 5 笔覆盖到 5/10', () => {
    const rows = recentTrades(list, '002364', 5)
    expect(rows.length).toBe(5)
    expect(rows[4].date).toBe('26/05/10')
  })

  it('同日多笔按 id 倒序', () => {
    const same = [
      tx(11, '002364', 'buy', '2026-06-05', 100, 7.0),
      tx(12, '002364', 'sell', '2026-06-05', 100, 7.2)
    ]
    const rows = recentTrades(same, '002364', 2)
    expect(rows[0].side).toBe('sell')
    expect(rows[1].side).toBe('buy')
  })

  it('空数据/未知代码返回空数组', () => {
    expect(recentTrades([], '002364', 3)).toEqual([])
    expect(recentTrades(list, '999999', 3)).toEqual([])
  })

  it('count 为 0 或非法时不返回任何行', () => {
    expect(recentTrades(list, '002364', 0)).toEqual([])
    expect(recentTrades(list, '002364', -1)).toEqual([])
  })
})
