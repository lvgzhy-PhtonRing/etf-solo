import { describe, it, expect } from 'vitest'
import { computeAdjustCategories } from '../src/utils/capitalCategories'
import { serializeAdjustNote } from '../src/utils/adjustItems'

const note = (category, signedAmount) => serializeAdjustNote({ version: 1, items: [{ category, signedAmount }] })
const logs = [
  { id: 1, type: 'add', amount: 468, category: 'adjust', note: note('stock_dividend', 46800) },
  { id: 2, type: 'add', amount: 43.96, category: 'adjust', note: note('stock_dividend', 4396) },
  { id: 3, type: 'add', amount: 3.3, category: 'adjust', note: note('interest', 330) },
  { id: 4, type: 'add', amount: 1.23, category: 'adjust', note: note('interest', 123) },
  { id: 5, type: 'add', amount: 5.67, category: 'adjust', note: note('interest', 567) },
  { id: 6, type: 'remove', amount: 25.2, category: 'adjust', note: note('dividend_tax', -2520) },
  { id: 7, type: 'remove', amount: 7.2, category: 'adjust', note: note('dividend_tax', -720) },
  { id: 8, type: 'remove', amount: 3.6, category: 'adjust', note: note('dividend_tax', -360) },
  { id: 9, type: 'remove', amount: 10.8, category: 'adjust', note: note('dividend_tax', -1080) },
  { id: 10, type: 'add', amount: 100, category: 'trade', note: '买入 002364' }
]

describe('computeAdjustCategories（分类小计只算调整）', () => {
  it('红利/利息/红利税汇总，忽略交易流水', () => {
    const rows = computeAdjustCategories(logs)
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]))
    expect(byKey.stock_dividend).toBe(511.96)
    expect(byKey.interest).toBe(10.2)
    expect(byKey.dividend_tax).toBe(-46.8)
    expect(byKey.reverse_repo).toBe(0)
    expect(byKey.fee_error).toBe(0)
    expect(byKey.otherAdjust).toBe(0)
  })

  it('普通备注的调整进其他调整', () => {
    const rows = computeAdjustCategories([{ type: 'add', amount: 5, category: 'adjust', note: '利息' }])
    expect(rows.find(r => r.key === 'otherAdjust').value).toBe(5)
  })
})
