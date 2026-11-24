import { describe, it, expect } from 'vitest'
import { calcNewCostPrice } from '../src/utils/calculators'

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
