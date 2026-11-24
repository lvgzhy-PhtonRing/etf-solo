// src/utils/decimalInput.js — 金额输入过滤（与原 my-assets 一致）

/**
 * 过滤金额输入：仅数字、单个小数点、最多 5 位整数、2 位小数、上限 99999.99
 * allowNegative 时负号只允许在首位，且值为 0 时不保留
 */
export function filterDecimal(raw, { allowNegative = false } = {}) {
  let v = String(raw ?? '').replace(/,/g, '')
  const hasMinus = allowNegative && /^-\s*/.test(v)
  v = v.replace(/[^0-9.]/g, '')

  const firstDot = v.indexOf('.')
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  }
  const dotIdx = v.indexOf('.')
  if (dotIdx !== -1 && v.length - dotIdx > 3) v = v.slice(0, dotIdx + 3)

  const intPart = dotIdx !== -1 ? v.slice(0, dotIdx) : v
  if (intPart.length > 5) {
    v = dotIdx !== -1 ? intPart.slice(0, 5) + v.slice(dotIdx) : intPart.slice(0, 5)
  }

  const num = parseFloat(v)
  if (!Number.isNaN(num) && num > 99999.99) v = '99999.99'
  if (hasMinus && parseFloat(v) > 0) v = '-' + v
  return v
}

/** ± 按钮：空/0 → '-'，否则取反 */
export function applySignToggle(value) {
  const v = String(value ?? '')
  const num = parseFloat(v) || 0
  if (num === 0) return '-'
  return String(-num)
}
