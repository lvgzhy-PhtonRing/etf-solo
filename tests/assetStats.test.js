import { describe, it, expect } from 'vitest'
import { STATS_MODES, statsWindow, flowsInWindow, aggregateByCategory } from '../src/utils/assetStats'

const now = new Date(2026, 10, 24) // 2026-11-24 本地

describe('assetStats（统计报表）', () => {
  it('5 种模式：按月/前90天/前半年/前一年/自定义', () => {
    expect(STATS_MODES.map(m => m.label)).toEqual(['按月', '前90天', '前半年', '前一年', '自定义'])
  })

  it('按月：当月 1 号到下月 1 号（左闭右开）', () => {
    expect(statsWindow('month', 0, { now })).toMatchObject({ start: '2026-11-01', end: '2026-12-01' })
  })

  it('按月：offset=-1 回退一个月', () => {
    expect(statsWindow('month', -1, { now })).toMatchObject({ start: '2026-10-01', end: '2026-11-01' })
  })

  it('前90天：以今天为终点往前 90 天', () => {
    expect(statsWindow('90d', 0, { now })).toMatchObject({ start: '2026-08-27', end: '2026-11-25' })
  })

  it('前半年：当月结束往前 6 个日历月', () => {
    expect(statsWindow('half', 0, { now })).toMatchObject({ start: '2026-06-01', end: '2026-12-01' })
  })

  it('前一年：当月结束往前 12 个日历月（与 v0.42 一致）', () => {
    expect(statsWindow('year', 0, { now })).toMatchObject({ start: '2025-12-01', end: '2026-12-01' })
  })

  it('自定义：起止日都包含（结束日 +1 天）', () => {
    expect(statsWindow('custom', 0, { customStart: '2026-03-01', customEnd: '2026-03-31' }))
      .toMatchObject({ start: '2026-03-01', end: '2026-04-01' })
  })

  it('自定义缺参数返回 null', () => {
    expect(statsWindow('custom', 0, {})).toBe(null)
  })

  it('flowsInWindow 左闭右开过滤', () => {
    const flows = [
      { date: '2026-10-31', amount: -1 },
      { date: '2026-11-01', amount: -2 },
      { date: '2026-11-30', amount: -3 },
      { date: '2026-12-01', amount: -4 }
    ]
    const w = statsWindow('month', 0, { now })
    expect(flowsInWindow(flows, w).map(f => f.amount)).toEqual([-2, -3])
  })

  it('分类聚合：支出取绝对值、按金额降序、给出占比', () => {
    const flows = [
      { type: 'expense', category: '生活购物', amount: -300 },
      { type: 'expense', category: '数字服务', amount: -100 },
      { type: 'expense', category: '生活购物', amount: -100 },
      { type: 'income', category: '初始资金', amount: 5000 }
    ]
    const r = aggregateByCategory(flows, 'expense')
    expect(r.total).toBe(500)
    expect(r.items).toEqual([
      { category: '生活购物', amount: 400, count: 2, pct: 80 },
      { category: '数字服务', amount: 100, count: 1, pct: 20 }
    ])
  })

  it('分类聚合：收入按正额', () => {
    const flows = [
      { type: 'income', category: '德州入账', amount: 242.5 },
      { type: 'income', category: '公款转入', amount: 100 }
    ]
    const r = aggregateByCategory(flows, 'income')
    expect(r.total).toBe(342.5)
    expect(r.items[0].category).toBe('德州入账')
  })
})
