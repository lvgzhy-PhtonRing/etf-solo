import { describe, it, expect } from 'vitest'
import { weekKey, weekLabel, groupFlows } from '../src/utils/assetLedger'

const flows = [
  { id: 1, date: '2026-11-23', amount: -67.12, category: '数字服务', title: '月付', account: '微信支付', dzMode: null },
  { id: 2, date: '2026-11-22', amount: 242.5, category: '德州入账', title: '入账', account: '微信支付', dzMode: '线上' },
  { id: 3, date: '2026-11-21', amount: -247.5, category: '德州出账', title: '出账', account: '微信支付', dzMode: '线上' },
  { id: 4, date: '2026-03-08', amount: -10, category: '其他', title: '旧账', account: '支付宝', dzMode: null }
]

const now = new Date(2026, 10, 24)

describe('assetLedger（账本分组）', () => {
  it('weekKey 取周一', () => {
    expect(weekKey('2026-11-24')).toBe('2026-11-23')
    expect(weekKey('2026-11-23')).toBe('2026-11-23')
    expect(weekKey('2026-11-29')).toBe('2026-11-23')
  })

  it('weekLabel 显示起止', () => {
    expect(weekLabel('2026-11-23')).toBe('11/23-11/29')
  })

  it('按月分组：收/支/净与倒序', () => {
    const g = groupFlows(flows, 'month', { now })
    expect(g.map(x => x.key)).toEqual(['2026-11', '2026-03'])
    expect(g[0].income).toBe(242.5)
    expect(g[0].expense).toBe(314.62)
    expect(g[0].total).toBe(-72.12)
    expect(g[0].label).toBe('2026年11月')
  })

  it('组内按日期倒序、同日按 id 倒序', () => {
    const g = groupFlows(flows, 'month', { now })
    expect(g[0].items.map(i => i.id)).toEqual([1, 2, 3])
  })

  it('超过 6 个月的组标记为旧组（默认折叠）', () => {
    const g = groupFlows(flows, 'month', { now })
    expect(g.find(x => x.key === '2026-03').isOld).toBe(true)
    expect(g.find(x => x.key === '2026-11').isOld).toBe(false)
  })

  it('按周分组', () => {
    const g = groupFlows(flows, 'week', { now })
    expect(g[0].key).toBe('2026-11-23')
    expect(g[0].label).toBe('11/23-11/29')
    expect(g[0].total).toBe(-67.12)
  })
})
