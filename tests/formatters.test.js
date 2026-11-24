import { describe, it, expect } from 'vitest'
import { isoWithDate } from '../src/utils/formatters'

describe('isoWithDate（保留原时刻，仅改日期）', () => {
  it('UTC ISO 转北京时刻后换日期', () => {
    expect(isoWithDate('2026-01-04T16:00:00Z', '2026-02-10')).toBe('2026-02-10T00:00:00+08:00')
  })

  it('保留时分秒', () => {
    expect(isoWithDate('2026-11-16T10:50:21+00:00', '2026-11-20')).toBe('2026-11-20T18:50:21+08:00')
  })

  it('无原时间用中午 12:00', () => {
    expect(isoWithDate('', '2026-02-10')).toBe('2026-02-10T12:00:00+08:00')
    expect(isoWithDate('不是时间', '2026-02-10')).toBe('2026-02-10T12:00:00+08:00')
  })
})
