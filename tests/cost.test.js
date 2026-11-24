import { describe, it, expect } from 'vitest'
import { calcNewCostPrice, calcCostAfterSell } from '../src/utils/calculators'

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
