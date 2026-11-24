import { describe, it, expect } from 'vitest'
import { parseAdjustNote, ADJUST_LABELS, serializeAdjustNote } from '../src/utils/adjustItems'

const payload = { version: 1, items: [{ category: 'stock_dividend', stockName: '格林美', signedAmount: 12345 }] }

describe('adjustItems（调整分项 JSON 契约）', () => {
  it('接受带 [校对分项] 前缀的备注', () => {
    const text = `[校对分项]${JSON.stringify(payload)}`
    expect(parseAdjustNote(text)?.items?.[0]?.signedAmount).toBe(12345)
  })

  it('接受裸 JSON 备注（AI 脚本旧格式）', () => {
    expect(parseAdjustNote(JSON.stringify(payload))?.items?.[0]?.category).toBe('stock_dividend')
  })

  it('普通备注返回 null', () => {
    expect(parseAdjustNote('买入 000001')).toBe(null)
  })

  it('序列化带前缀且可回读', () => {
    const text = serializeAdjustNote(payload)
    expect(text.startsWith('[校对分项]')).toBe(true)
    expect(parseAdjustNote(text)).toEqual(payload)
  })

  it('分项标签齐全', () => {
    expect(Object.keys(ADJUST_LABELS)).toEqual(['stock_dividend', 'interest', 'reverse_repo', 'dividend_tax', 'fee_error'])
  })
})
