import { describe, it, expect } from 'vitest'
import { validateSellOrder } from '../src/utils/sellValidation'

describe('validateSellOrder（卖出前置校验）', () => {
  it('价格与数量合法时通过', () => {
    expect(validateSellOrder({ price: 10, qty: 100, holdingQty: 100 })).toEqual({ ok: true })
  })

  it('价格为 0 拒绝', () => {
    const r = validateSellOrder({ price: 0, qty: 100, holdingQty: 100 })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('价格')
  })

  it('超过持仓拒绝', () => {
    expect(validateSellOrder({ price: 10, qty: 200, holdingQty: 100 }).ok).toBe(false)
  })

  it('卖出到账不足手续费拒绝', () => {
    const r = validateSellOrder({ price: 0.01, qty: 100, holdingQty: 100, fee: 5 })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('手续费')
  })
})
