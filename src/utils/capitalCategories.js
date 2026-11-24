// src/utils/capitalCategories.js — 分类小计：只算 adjust（红利/利息/税等）
import { ADJUST_LABELS, parseAdjustNote } from './adjustItems'

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * 按分项 JSON 汇总调整类流水；交易与入金/出金不进入分类小计。
 */
export function computeAdjustCategories(logs) {
  const sums = Object.fromEntries(Object.keys(ADJUST_LABELS).map(key => [key, 0]))
  sums.otherAdjust = 0
  for (const log of (logs || []).filter(l => l.category === 'adjust')) {
    const data = parseAdjustNote(log.note)
    if (data?.items?.length) {
      for (const item of data.items) {
        const amount = (item.signedAmount || 0) / 100
        if (sums[item.category] !== undefined) sums[item.category] += amount
        else sums.otherAdjust += amount
      }
    } else {
      sums.otherAdjust += log.type === 'add' ? Number(log.amount) : -Number(log.amount)
    }
  }
  return [
    ...Object.entries(ADJUST_LABELS).map(([key, label]) => ({ key, label, value: round2(sums[key]) })),
    { key: 'otherAdjust', label: '其他调整', value: round2(sums.otherAdjust) }
  ]
}
