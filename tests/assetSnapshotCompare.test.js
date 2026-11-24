import { describe, it, expect } from 'vitest'
import { buildCompare, buildLogDiff } from '../src/utils/assetSnapshots'

const s1 = {
  timestamp: 1000,
  date: '2026-11-18',
  actualVal: 17900,
  ledgerTotal: 17300,
  diff: 600,
  assets: { wx_lq: '0', wx_lqt: '2700', ali_ye: '3000', adj_lend: '2000' }
}
const s2 = {
  timestamp: 2000,
  date: '2026-11-22',
  actualVal: 18000,
  ledgerTotal: 17375.91,
  diff: 624.09,
  assets: { wx_lq: '0', wx_lqt: '2800', ali_ye: '3000', adj_lend: '2000' }
}

describe('assetSnapshots 对比', () => {
  it('两个快照：只输出有变化的行，含增减额', () => {
    const r = buildCompare([s1, s2], null)
    const labels = r.rows.map(x => x.label)
    expect(labels).toContain('实际可支配')
    expect(labels).toContain('微信-零钱通')
    expect(labels).not.toContain('微信-零钱')
    expect(r.rows.find(x => x.label === '微信-零钱通').change).toBe(100)
    expect(r.rows.find(x => x.label === '实际可支配').change).toBe(100)
  })

  it('变化方向：增=up，减=down（按时间升序比较）', () => {
    const r = buildCompare([s1, s2], null)
    expect(r.rows.find(x => x.label === '微信-零钱通').dir).toBe('up')
    const s3 = { ...s2, timestamp: 3000, date: '2026-11-23', assets: { ...s2.assets, wx_lqt: '2700' } }
    const r2 = buildCompare([s2, s3], null)
    expect(r2.rows.find(x => x.label === '微信-零钱通').dir).toBe('down')
  })

  it('单个快照：与当前值对比', () => {
    const current = { actualVal: 18100, ledgerTotal: 17375.91, diff: 724.09, assets: { wx_lqt: '2900' } }
    const r = buildCompare([s1], current)
    expect(r.rows.find(x => x.label === '微信-零钱通').change).toBe(200)
    expect(r.cols).toEqual(['11-18 08:00', '当前'])
  })

  it('无选择返回空', () => {
    expect(buildCompare([], null).rows).toEqual([])
  })
})

describe('assetSnapshots 收支对比', () => {
  it('新增/删除按 date-title-amount 识别', () => {
    const l1 = { date: '2026-11-18', title: 'A', amount: -10 }
    const l2 = { date: '2026-11-18', title: 'B', amount: -20 }
    const l3 = { date: '2026-11-19', title: 'C', amount: 30 }
    const r = buildLogDiff([l1, l2], [l2, l3])
    expect(r.added.map(x => x.title)).toEqual(['C'])
    expect(r.removed.map(x => x.title)).toEqual(['A'])
    expect(buildLogDiff([l1], [l1])).toEqual({ added: [], removed: [] })
  })
})
