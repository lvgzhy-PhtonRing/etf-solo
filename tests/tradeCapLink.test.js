import { describe, it, expect } from 'vitest'
import { findTradeLog } from '../src/utils/tradeCapLink'

const logs = [
  { id: 1, category: 'trade', type: 'remove', amount: 1005, note: '买入 000001', source_tx_id: 11 },
  { id: 2, category: 'trade', type: 'add', amount: 1194, note: '卖出 000001', source_tx_id: 12 },
  { id: 3, category: 'trade', type: 'remove', amount: 505, note: '买入 000002', source_tx_id: null }
]

describe('findTradeLog（交易↔资金流水关联）', () => {
  it('优先按 source_tx_id 精确匹配（自定义备注也能命中）', () => {
    const tx = { id: 11, stock_code: '000001', type: 'buy', amount: 1000, fee: 5, note: '盘中追高' }
    expect(findTradeLog(logs, tx).id).toBe(1)
  })

  it('无 source_tx_id 时回退按代码+方向+含费金额匹配', () => {
    const tx = { id: 99, stock_code: '000002', type: 'buy', amount: 500, fee: 5, note: '自定义' }
    expect(findTradeLog(logs, tx).id).toBe(3)
  })

  it('匹配不到返回 null', () => {
    const tx = { id: 100, stock_code: '600000', type: 'sell', amount: 100, fee: 5, note: 'x' }
    expect(findTradeLog(logs, tx)).toBe(null)
  })
})
