import { describe, it, expect } from 'vitest'
import { calcBuyFee, calcSellFee, calcBuyActual, calcSellActual } from '../src/utils/feeCalculator'

describe('feeCalculator（近3个月券商费率）', () => {
  it('深市买入：中恒电气 15,600 元 → 24.72', () => {
    expect(calcBuyFee(15600, '002364')).toBe(24.72)
  })

  it('沪市买入：特变电工 9,540 元 → 15.22（含过户费）', () => {
    expect(calcBuyFee(9540, '600089')).toBe(15.22)
  })

  it('深市卖出：东方财富 18,000 元 → 37.52', () => {
    expect(calcSellFee(18000, '300059')).toBe(37.52)
  })

  it('沪市卖出：特变电工 11,382 元 → 23.85（含印花税+过户费）', () => {
    expect(calcSellFee(11382, '600089')).toBe(23.85)
  })

  it('ETF 卖出不收印花税：标普500 5,420 元 → 8.65', () => {
    expect(calcSellFee(5420, '513500')).toBe(8.65)
  })

  it('最低费用 5 元', () => {
    expect(calcBuyFee(1000, '002364')).toBe(5)
  })

  it('金额为 0 时返回 0', () => {
    expect(calcBuyFee(0, '002364')).toBe(0)
    expect(calcSellFee(0, '002364')).toBe(0)
  })

  it('买入实际金额：15,600 + 24.72 = 15,624.72', () => {
    expect(calcBuyActual(15600, '002364')).toEqual({ fee: 24.72, actualAmount: 15624.72 })
  })

  it('卖出实际到账：18,000 − 37.52 = 17,962.48', () => {
    expect(calcSellActual(18000, '300059')).toEqual({ fee: 37.52, actualAmount: 17962.48 })
  })
})
