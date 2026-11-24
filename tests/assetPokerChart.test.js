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
    expect(r.chartHeight).toBe(180)
  })

  it('蜡烛按旧版固定像素坐标与影线几何计算', () => {
    const r = pokerChart(bars)
    expect(r.items.map(i => i.isUp)).toEqual([true, true, false])
    expect(r.items[0]).toMatchObject({
      candleHeight: 72,
      candleTop: 18,
      candleBottom: 90,
      wickHeight: 4,
      wickTop: 14,
      wickBottom: 18,
      capTop: 90
    })
    expect(r.items[2]).toMatchObject({
      candleHeight: 2,
      candleTop: 90,
      candleBottom: 92,
      wickHeight: 0.6,
      wickTop: 92,
      wickBottom: 92.6,
      capTop: 90
    })
  })

  it('零盈亏归为正方向并保留2px最小蜡烛', () => {
    const r = pokerChart([{ key: '2026-11-22', pnl: 0 }])
    expect(r.items[0]).toMatchObject({
      isUp: true,
      candleHeight: 2,
      candleTop: 88,
      candleBottom: 90,
      wickTop: 87.4,
      wickBottom: 88,
      capTop: 90
    })
  })

  it('大额亏损影线延伸到柱体下方并限制在坐标区内', () => {
    const r = pokerChart([{ key: '2026-11-22', pnl: -1000 }])
    expect(r.items[0]).toMatchObject({
      isUp: false,
      candleTop: 90,
      candleBottom: 162,
      wickTop: 162,
      wickBottom: 166,
      capTop: 90
    })
  })

  it('空数据安全', () => {
    const r = pokerChart([])
    expect(r.items).toEqual([])
    expect(r.stats.periods).toBe(0)
    expect(r.stats.avgNet).toBe(0)
    expect(r.halfRange).toBeGreaterThan(0)
  })
})
