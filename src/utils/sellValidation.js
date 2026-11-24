// src/utils/sellValidation.js — 卖出前置校验（防止 0 价格/超卖/到账不足费用）
export function validateSellOrder({ price, qty, holdingQty, fee = 0 }) {
  if (!(price > 0)) return { ok: false, error: '请输入有效的卖出价格' }
  if (!(qty > 0)) return { ok: false, error: '请输入卖出数量' }
  if (qty > holdingQty) return { ok: false, error: '卖出数量超过持仓' }
  if (qty % 100 !== 0) return { ok: false, error: '数量必须为100的整数倍' }
  if (qty * price - fee <= 0) return { ok: false, error: '卖出到账不足以覆盖手续费' }
  return { ok: true }
}
