// src/utils/adjustItems.js — 调整分项 JSON 契约（红利/利息/逆回购/红利税/费用误差）
export const ADJUST_LABELS = {
  stock_dividend: '红利',
  interest: '利息',
  reverse_repo: '逆回购',
  dividend_tax: '红利税',
  fee_error: '费用误差'
}

const PREFIX = '[校对分项]'

/**
 * 解析备注中的分项 JSON；接受带前缀或裸 JSON 两种写法
 */
export function parseAdjustNote(note) {
  if (!note || typeof note !== 'string') return null
  const idx = note.indexOf('{')
  if (idx < 0) return null
  try {
    const parsed = JSON.parse(note.slice(idx))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function serializeAdjustNote(payload) {
  return PREFIX + JSON.stringify(payload)
}
