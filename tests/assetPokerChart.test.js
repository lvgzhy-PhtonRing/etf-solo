import { describe, it, expect } from 'vitest'
import { pokerChart } from '../src/utils/assetPoker'

const bars = [
  { key: '2026-11-02', income: 1019, expense: 0, pnl: 1019, count: 2 },
  { key: '2026-11-09', income: 213, expense: 0, pnl: 213, count: 1 },
  { key: '2026-11-16', income: 242.5, expense: 247.5, pnl: -5, count: 2 }
]

describe('assetPoker 图表几何', () => {
  it('统计：周期/盈利/亏损/场均', () => {
    const r = pokerChart(bars)
    expect(r.stats.periods).toBe(3)
    expect(r.stats.wins).toBe(2)
    expect(r.stats.losses).toBe(1)
    expect(r.stats.avgNet).toBe(409)
  })

  it('maxAbs 取绝对值最大，halfRange 留 25% 余量', () => {
    const r = pokerChart(bars)
    expect(r.maxAbs).toBe(1019)
    expect(r.halfRange).toBe(1273.75)
  })

  it('每根蜡烛有方向与高度百分比（相对半幅）', () => {
    const r = pokerChart(bars)
    expect(r.items.map(i => i.isUp)).toEqual([true, true, false])
    // 1019 / 1273.75 ≈ 80%
    expect(r.items[0].heightPct).toBeCloseTo(80, 1)
    // -5 / 1273.75 ≈ 0.39% → 最小可视高度
    expect(r.items[2].heightPct).toBeGreaterThan(0)
  })

  it('空数据安全', () => {
    const r = pokerChart([])
    expect(r.items).toEqual([])
    expect(r.stats.periods).toBe(0)
    expect(r.stats.avgNet).toBe(0)
    expect(r.halfRange).toBeGreaterThan(0)
  })
})
