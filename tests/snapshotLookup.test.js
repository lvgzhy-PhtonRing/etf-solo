import { describe, it, expect } from 'vitest'
import { snapshotOnOrBefore } from '../src/utils/snapshotLookup'

const snapshots = [
  { date: '2026-01-05', asset: 100 },
  { date: '2026-02-01', asset: 110 }
]

describe('snapshotOnOrBefore（净值区间取值）', () => {
  it('返回区间内最后一个快照对象，而不是资产数字', () => {
    expect(snapshotOnOrBefore(snapshots, '2026-01-15')).toEqual({ date: '2026-01-05', asset: 100 })
  })

  it('日期正好等于快照日时返回该快照', () => {
    expect(snapshotOnOrBefore(snapshots, '2026-02-01')).toEqual({ date: '2026-02-01', asset: 110 })
  })

  it('早于首个快照返回 null', () => {
    expect(snapshotOnOrBefore(snapshots, '2026-01-01')).toBeNull()
  })

  it('晚于最后快照返回最后一条', () => {
    expect(snapshotOnOrBefore(snapshots, '2026-03-01')).toEqual({ date: '2026-02-01', asset: 110 })
  })
})
