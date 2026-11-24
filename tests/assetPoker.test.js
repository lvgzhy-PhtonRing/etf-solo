import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { weekLabel } from '../src/utils/assetLedger'
import { pokerFlows, pokerPeriodKey, buildPokerBars, POKER_CATEGORIES } from '../src/utils/assetPoker'

const originalTimezone = process.env.TZ
beforeAll(() => { process.env.TZ = 'Asia/Shanghai' })
afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
})

const flows = [
  { date: '2026-11-23', category: '德州入账', amount: 242.5, dz_mode: '线上' },
  { date: '2026-11-23', category: '德州出账', amount: -100, dz_mode: '线上' },
  { date: '2026-11-24', category: '德州入账', amount: 50, dz_mode: '线下' },
  { date: '2026-11-24', category: '生活购物', amount: -300, dz_mode: null }
]

describe('assetPoker（德州战绩）', () => {
  it('只取德州入账/出账两类', () => {
    expect(POKER_CATEGORIES).toEqual(['德州入账', '德州出账'])
    expect(pokerFlows(flows, 'all')).toHaveLength(3)
  })

  it('按线上/线下过滤', () => {
    expect(pokerFlows(flows, '线上')).toHaveLength(2)
    expect(pokerFlows(flows, '线下')).toHaveLength(1)
  })

  it('未设置场次的旧流水默认计入线上', () => {
    const legacyFlows = [
      { category: '德州入账', amount: 10 },
      { category: '德州出账', amount: -5, dz_mode: null },
      { category: '德州入账', amount: 8, dzMode: '' },
      { category: '德州入账', amount: 12, dz_mode: '线下' }
    ]
    expect(pokerFlows(legacyFlows, '线上')).toHaveLength(3)
    expect(pokerFlows(legacyFlows, '线下')).toHaveLength(1)
  })

  it('周日周期键和周标签沿用旧程序日期解析', async () => {
    expect(pokerPeriodKey('2026-11-22', 'week')).toBe('2026-11-15')
    const { pokerWeekLabel } = await import('../src/utils/assetPoker')
    expect(pokerWeekLabel?.('2026-11-15')).toBe('11/15-11/21')
    expect(weekLabel('2026-11-15')).toBe('11/15-11/21')
  })

  it('日K标签沿用旧程序的本地日期解析', async () => {
    const original = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      const { pokerDayLabel } = await import('../src/utils/assetPoker')
      expect(pokerDayLabel?.('2026-11-22')).toBe('11/21')
    } finally {
      process.env.TZ = original
    }
  })

  it('周期键：日 / 周 / 月', () => {
    expect(pokerPeriodKey('2026-11-24', 'day')).toBe('2026-11-24')
    expect(pokerPeriodKey('2026-11-24', 'week')).toBe('2026-11-22')
    expect(pokerPeriodKey('2026-11-23', 'week')).toBe('2026-11-22')
    expect(pokerPeriodKey('2026-11-24', 'month')).toBe('2026-11')
  })

  it('周一边界保留旧程序的周键与标签', async () => {
    expect(pokerPeriodKey('2026-11-23', 'week')).toBe('2026-11-22')
    const { pokerWeekLabel } = await import('../src/utils/assetPoker')
    expect(pokerWeekLabel('2026-11-22')).toBe('11/22-11/28')
  })

  it('按日聚合收入/支出/净盈亏', () => {
    const bars = buildPokerBars(flows, 'day', 'all')
    expect(bars).toHaveLength(2)
    const d23 = bars.find(b => b.key === '2026-11-23')
    expect(d23.income).toBe(242.5)
    expect(d23.expense).toBe(100)
    expect(d23.pnl).toBe(142.5)
    expect(d23.count).toBe(2)
  })

  it('按月聚合并按时间升序', () => {
    const bars = buildPokerBars(flows, 'month', 'all')
    expect(bars).toHaveLength(1)
    expect(bars[0]).toMatchObject({ key: '2026-11', income: 292.5, expense: 100, pnl: 192.5, count: 3 })
  })

  it('汇总口径：总收入/总支出/总净盈亏', () => {
    const bars = buildPokerBars(flows, 'day', 'all')
    const sum = bars.reduce((s, b) => ({
      income: s.income + b.income,
      expense: s.expense + b.expense,
      pnl: s.pnl + b.pnl
    }), { income: 0, expense: 0, pnl: 0 })
    expect(sum.income).toBe(292.5)
    expect(sum.expense).toBe(100)
    expect(sum.pnl).toBe(192.5)
  })
})
