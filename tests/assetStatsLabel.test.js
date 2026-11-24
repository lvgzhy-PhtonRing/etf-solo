import { describe, it, expect } from 'vitest'
import { statsWindow, periodLabel } from '../src/utils/assetStats'

const now = new Date(2026, 10, 24)

describe('assetStats 周期标签（与源程序 getStatsPeriodLabel 一致）', () => {
  it('按月：YYYY年M月', () => {
    expect(periodLabel('month', statsWindow('month', 0, { now }))).toBe('2026年11月')
  })

  it('前半年：起止月份', () => {
    expect(periodLabel('half', statsWindow('half', 0, { now }))).toBe('2026/6~2026/11')
  })

  it('前一年：跨年月份', () => {
    expect(periodLabel('year', statsWindow('year', 0, { now }))).toBe('2025/12~2026/11')
  })

  it('前90天：结束日不含（end-1）', () => {
    expect(periodLabel('90d', statsWindow('90d', 0, { now }))).toBe('8/27~11/24')
  })

  it('自定义：显示所选起止日（不含 +1 天）', () => {
    const w = statsWindow('custom', 0, { customStart: '2026-03-01', customEnd: '2026-03-31' })
    expect(periodLabel('custom', w, { customStart: '2026-03-01', customEnd: '2026-03-31' }))
      .toBe('2026-03-01 ~ 2026-03-31')
  })

  it('无区间返回空串', () => {
    expect(periodLabel('custom', null)).toBe('')
  })
})
