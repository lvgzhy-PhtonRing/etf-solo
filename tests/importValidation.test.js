import { describe, it, expect } from 'vitest'
import { validateImportData, TABLE_KEYS } from '../src/utils/importValidation'

const valid = {
  _version: 1,
  solo_holdings: [{ stock_code: '000001', quantity: 100, cost_price: 10 }],
  solo_transactions: [{ stock_code: '000001', type: 'buy', quantity: 100, amount: 1000, fee: 5, trade_date: '2026-11-01' }],
  solo_capital_log: [{ type: 'remove', amount: 1005, category: 'trade', note: '买入 000001' }],
  solo_stock_cache: [{ stock_code: '000001', price: 10 }],
  solo_app_config: [{ key: 'x', value: '1' }]
}

describe('validateImportData（导入前校验）', () => {
  it('完整文件通过并返回规范化行', () => {
    const r = validateImportData(valid)
    expect(r.ok).toBe(true)
    expect(r.rows.solo_holdings).toHaveLength(1)
  })

  it('缺少表直接拒绝', () => {
    const bad = { ...valid }
    delete bad.solo_transactions
    const r = validateImportData(bad)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('solo_transactions')
  })

  it('表内容不是数组则拒绝', () => {
    const r = validateImportData({ ...valid, solo_holdings: 'oops' })
    expect(r.ok).toBe(false)
  })

  it('必要列缺失则拒绝', () => {
    const r = validateImportData({
      ...valid,
      solo_transactions: [{ stock_code: '000001', type: 'buy', quantity: 100, amount: 1000 }]
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('trade_date')
  })

  it('表集合覆盖 5 张 solo 表', () => {
    expect(TABLE_KEYS).toEqual([
      'solo_holdings', 'solo_transactions', 'solo_capital_log', 'solo_stock_cache', 'solo_app_config'
    ])
  })
})
