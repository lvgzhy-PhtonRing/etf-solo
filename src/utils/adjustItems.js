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

/**
 * 编辑调整类流水金额时，同步单分项金额：
 * 单分项 → 按原符号更新 signedAmount（分为单位），返回新备注；
 * 多分项 → 返回 null（不允许改金额，需走分项维护）；
 * 普通备注 → 原样返回。
 */
export function updateAdjustAmount(note, amount) {
  const data = parseAdjustNote(note)
  if (!data?.items?.length) return note || ''
  if (data.items.length !== 1) return null
  const item = data.items[0]
  const sign = (item.signedAmount || 0) < 0 ? -1 : 1
  item.signedAmount = Math.round(amount * 100) * sign
  return serializeAdjustNote(data)
}
