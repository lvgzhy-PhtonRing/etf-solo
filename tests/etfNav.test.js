import { describe, it, expect, vi } from 'vitest'
import {
  ETF_NAV_BASE_DATE,
  ETF_NAV_BASE_ASSET,
  mapEtfPosSnaps,
  fetchEtfNav
} from '../src/utils/etfNav'

describe('etfNav 常量', () => {
  it('基准日期与基准资产与 ETF 口径一致', () => {
    expect(ETF_NAV_BASE_DATE).toBe('2026-07-29')
    expect(ETF_NAV_BASE_ASSET).toBe(848405)
  })
})

describe('mapEtfPosSnaps', () => {
  it('过滤基准日之前与非正资产', () => {
    const out = mapEtfPosSnaps([
      { date: '2026-07-28', asset: 900000 },
      { date: '2026-07-29', asset: 848405 },
      { date: '2026-08-01', asset: 0 },
      { date: '2026-08-02', asset: -1 }
    ])
    expect(out.map(p => p.date)).toEqual(['2026-07-29'])
  })

  it('按 asset/848405 归一化并按日期升序', () => {
    const out = mapEtfPosSnaps([
      { date: '2026-08-02', asset: 900000 },
      { date: '2026-07-29', asset: 848405 }
    ])
    expect(out).toEqual([
      { date: '2026-07-29', nav: 1 },
      { date: '2026-08-02', nav: 900000 / 848405 }
    ])
  })

  it('接受字符串 asset', () => {
    expect(mapEtfPosSnaps([{ date: '2026-07-29', asset: '848405' }])).toEqual([
      { date: '2026-07-29', nav: 1 }
    ])
  })

  it('非数组输入返回空数组', () => {
    expect(mapEtfPosSnaps(null)).toEqual([])
    expect(mapEtfPosSnaps({})).toEqual([])
  })

  it('过滤非 ISO 日期格式', () => {
    const out = mapEtfPosSnaps([
      { date: 'foo', asset: 900000 },
      { date: '2026-08-01', asset: 900000 }
    ])
    expect(out.map(p => p.date)).toEqual(['2026-08-01'])
  })

  it('过滤缺失或非数字 asset', () => {
    const out = mapEtfPosSnaps([
      { date: '2026-08-01' },
      { date: '2026-08-02', asset: 'abc' },
      { date: '2026-08-03', asset: 100 }
    ])
    expect(out.map(p => p.date)).toEqual(['2026-08-03'])
  })

  it('过滤缺失或非字符串 date', () => {
    const out = mapEtfPosSnaps([
      { asset: 100 },
      { date: 20260804, asset: 100 },
      { date: '2026-08-05', asset: 100 }
    ])
    expect(out.map(p => p.date)).toEqual(['2026-08-05'])
  })
})

describe('fetchEtfNav', () => {
  it('缺少 url 或 key 时返回 null 且不发起请求', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchEtfNav({ url: '', key: 'k', fetchImpl })).toBeNull()
    expect(await fetchEtfNav({ url: 'https://x', key: '', fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POST RPC 并返回归一化后的点', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-07-29', asset: 848405 }]
    })
    const out = await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://x/rest/v1/rpc/get_etf_pos_snaps',
      expect.objectContaining({ method: 'POST' })
    )
    expect(out).toEqual([{ date: '2026-07-29', nav: 1 }])
  })

  it('非 2xx 返回 null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => [] })
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })

  it('网络异常返回 null', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })

  it('返回空数据时返回 null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })

  it('为请求设置超时中断信号', async () => {
    let received
    const fetchImpl = vi.fn((_url, opts) => {
      received = opts
      return Promise.resolve({ ok: true, json: async () => [{ date: '2026-07-29', asset: 848405 }] })
    })
    await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl, timeoutMs: 1000 })
    expect(received.signal).toBeInstanceOf(AbortSignal)
  })

  it('超时后中止请求并返回 null', async () => {
    let aborted = false
    const fetchImpl = vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('Aborted', 'AbortError'))
      })
    }))
    const out = await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl, timeoutMs: 20 })
    expect(aborted).toBe(true)
    expect(out).toBeNull()
  })
})
