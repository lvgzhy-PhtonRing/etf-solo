import { describe, it, expect } from 'vitest'
import {
  calcNewCostPrice,
  calcCostAfterSell,
  calcHoldingAfterDelete,
  calcHoldingAfterEdit,
  calcTradeEdit,
  calcCostAfterDividend
} from '../src/utils/calculators'

describe('calcNewCostPrice（券商移动平均成本）', () => {
  it('首次买入含费成本', () => {
    expect(calcNewCostPrice(1100, 100, 0, 0)).toBe(11)
  })

  it('加仓后加权平均', () => {
    expect(calcNewCostPrice(550, 50, 100, 5)).toBeCloseTo(7, 6)
  })

  it('清仓后不产生 Infinity/NaN', () => {
    const v = calcNewCostPrice(0, 0, 0, 0)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBe(0)
  })
})

describe('calcCostAfterSell（券商摊薄成本）', () => {
  it('盈利卖出降低剩余成本', () => {
    expect(calcCostAfterSell(10, 100, 50, 600)).toBe(8)
  })

  it('亏损卖出抬高剩余成本', () => {
    expect(calcCostAfterSell(10, 100, 50, 400)).toBe(12)
  })

  it('清仓返回 0', () => {
    expect(calcCostAfterSell(10, 100, 100, 1200)).toBe(0)
  })

  it('净到账超过成本总额时下限为 0', () => {
    expect(calcCostAfterSell(10, 100, 50, 1200)).toBe(0)
  })

  it('特变电工 900股@26.726 卖100股净到账1,835.95 → 27.7718', () => {
    expect(calcCostAfterSell(26.726, 900, 100, 1835.95)).toBeCloseTo(27.7718, 4)
  })

  it('百邦科技 100股@64.789 清仓 → 0', () => {
    expect(calcCostAfterSell(64.789, 100, 100, 2407)).toBe(0)
  })
})

describe('编辑/删除交易后的持仓成本（当前成本增量回滚）', () => {
  it('删除买入：900股@26.726 删除500股@45.83（含费36.31）→ 400股@2.755225', () => {
    const r = calcHoldingAfterDelete(26.726, 900, {
      type: 'buy', quantity: 500, amount: 22915, fee: 36.31
    })
    expect(r.quantity).toBe(400)
    expect(r.costPrice).toBeCloseTo(2.755225, 6)
  })

  it('删除卖出：900股@26.726 删除300股@21.69（含费13.63）→ 1200股@25.455642', () => {
    const r = calcHoldingAfterDelete(26.726, 900, {
      type: 'sell', quantity: 300, amount: 6507, fee: 13.63
    })
    expect(r.quantity).toBe(1200)
    expect(r.costPrice).toBeCloseTo(25.455642, 6)
  })

  it('备注-only 编辑不改变成本', () => {
    const tx = { type: 'buy', quantity: 500, amount: 22915, fee: 36.31 }
    const r = calcHoldingAfterEdit(26.726, 900, tx, { ...tx })
    expect(r.quantity).toBe(900)
    expect(r.costPrice).toBeCloseTo(26.726, 6)
  })

  it('编辑数量：500股买入改400股，成本按当前持仓重放', () => {
    const r = calcHoldingAfterEdit(26.726, 900,
      { type: 'buy', quantity: 500, amount: 22915, fee: 36.31 },
      { type: 'buy', quantity: 400, amount: 18332, fee: 29.05 }
    )
    expect(r.quantity).toBe(800)
    expect(r.costPrice).toBeCloseTo(24.328925, 6)
  })
})

describe('calcTradeEdit（编辑交易的金额/费用）', () => {
  it('只改备注时保留原始 amount/fee，不按截断价重算', () => {
    const log = { type: 'sell', price: 27.854, quantity: 2200, amount: 61277.92, fee: 127.65 }
    expect(calcTradeEdit(log, 27.854, 2200, () => 999)).toEqual({
      priceChanged: false,
      qtyChanged: false,
      price: 27.854,
      amount: 61277.92,
      fee: 127.65,
      actualAmount: 61150.27
    })
  })

  it('改数量时按价格重算 amount 和 fee', () => {
    const log = { type: 'buy', price: 26, quantity: 600, amount: 15600, fee: 24.72 }
    const r = calcTradeEdit(log, 26, 500, amount => amount === 13000 ? 20.6 : 0)
    expect(r.amount).toBe(13000)
    expect(r.fee).toBe(20.6)
    expect(r.actualAmount).toBe(13020.6)
  })
})

describe('calcCostAfterDividend（红利冲减成本）', () => {
  it('特变电工 27.246 × 900 股，红利 468 → 26.726', () => {
    expect(calcCostAfterDividend(27.246, 900, 468)).toBeCloseTo(26.726, 6)
  })

  it('无持仓返回 0', () => {
    expect(calcCostAfterDividend(10, 0, 100)).toBe(0)
  })

  it('红利超过成本总额时下限为 0', () => {
    expect(calcCostAfterDividend(10, 100, 2000)).toBe(0)
  })
})
