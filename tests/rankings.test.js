import { describe, it, expect } from 'vitest'
import { computeClearedRankings, computeHoldingProfits } from '../src/utils/rankings'

describe('computeClearedRankings（已清仓股票盈亏）', () => {
  it('完整买卖一轮按到手净额算净利（含双边手续费）', () => {
    const txs = [
      { stock_code: '000001', stock_name: '测试股', type: 'buy', quantity: 100, amount: 1000, fee: 5, trade_date: '2026-11-01' },
      { stock_code: '000001', stock_name: '测试股', type: 'sell', quantity: 100, amount: 1200, fee: 6, trade_date: '2026-11-10' }
    ]
    const [r] = computeClearedRankings(txs)
    expect(r.buyQty).toBe(100)
    expect(r.sellQty).toBe(100)
    expect(r.profit).toBe(189)
    expect(r.profitPct).toBeCloseTo((189 / 1005) * 100, 6)
  })

  it('未清仓股票不进入榜单', () => {
    const txs = [
      { stock_code: '000002', type: 'buy', quantity: 100, amount: 1000, fee: 5 },
      { stock_code: '000002', type: 'sell', quantity: 50, amount: 600, fee: 3 }
    ]
    expect(computeClearedRankings(txs)).toHaveLength(0)
  })
})

describe('computeHoldingProfits（当前持仓盈亏）', () => {
  it('按市值减成本计算浮盈与百分比', () => {
    const holdings = [{ stock_code: '000001', stock_name: '测试股', quantity: 100, cost_price: 10 }]
    const prices = { '000001': { price: 12, stock_name: '测试股' } }
    const [r] = computeHoldingProfits(holdings, prices)
    expect(r.profit).toBe(200)
    expect(r.profitPct).toBeCloseTo(20, 6)
    expect(r.marketValue).toBe(1200)
  })

  it('无行情的股票按成本价计（浮盈 0）', () => {
    const holdings = [{ stock_code: '000003', quantity: 100, cost_price: 8 }]
    const [r] = computeHoldingProfits(holdings, {})
    expect(r.profit).toBe(0)
    expect(r.profitPct).toBe(0)
  })

  it('成本已收回（成本为 0）时盈亏等于市值，收益率返回 null', () => {
    const holdings = [{ stock_code: '000004', quantity: 100, cost_price: 0 }]
    const [r] = computeHoldingProfits(holdings, { '000004': { price: 5 } })
    expect(r.profit).toBe(500)
    expect(r.profitPct).toBe(null)
  })
})
