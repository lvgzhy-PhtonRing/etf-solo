import { describe, it, expect } from 'vitest'
import { parseAdjustNote, ADJUST_LABELS, serializeAdjustNote, updateAdjustAmount } from '../src/utils/adjustItems'

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

  it('updateAdjustAmount：单分项按正负号同步金额', () => {
    const note = serializeAdjustNote({ version: 1, note: '券商流水导入', items: [{ category: 'stock_dividend', stockName: '特变电工', stockCode: '600089', signedAmount: 46800 }] })
    const next = updateAdjustAmount(note, 500)
    expect(parseAdjustNote(next).items[0].signedAmount).toBe(50000)
  })

  it('updateAdjustAmount：负分项（红利税）保持负号', () => {
    const note = serializeAdjustNote({ version: 1, items: [{ category: 'dividend_tax', signedAmount: -2520 }] })
    expect(parseAdjustNote(updateAdjustAmount(note, 10)).items[0].signedAmount).toBe(-1000)
  })

  it('updateAdjustAmount：多分项返回 null（不允许改）', () => {
    const note = serializeAdjustNote({ version: 1, items: [{ category: 'interest', signedAmount: 100 }, { category: 'fee_error', signedAmount: -50 }] })
    expect(updateAdjustAmount(note, 1)).toBe(null)
  })

  it('updateAdjustAmount：普通备注原样返回', () => {
    expect(updateAdjustAmount('利息', 5)).toBe('利息')
  })
})
