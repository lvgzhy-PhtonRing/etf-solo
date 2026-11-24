// src/utils/feeCalculator.js
// 费率以 2026-08-24～2026-11-16 券商流水反推：
// 买入：佣金约 1.5846‰；沪市（5/6/9 开头）另加过户费 0.0108‰
// 卖出：佣金 1.5846‰ + 印花税 0.5‰（仅股票，ETF/基金免）+ 沪市过户费 0.0108‰
// 最低费用 5 元

const COMMISSION_RATE = 0.0015846
const STAMP_RATE = 0.0005
const TRANSFER_RATE = 0.0000108
const MIN_FEE = 5

function isShanghai(stockCode) {
  return /^[569]/.test(stockCode || '')
}

function isFund(stockCode) {
  return /^(5|15|16|18)/.test(stockCode || '')
}

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100

/** 计算买入手续费（最低 5 元只作用于佣金） */
export function calcBuyFee(amount, stockCode = '') {
  if (!(amount > 0)) return 0
  const commission = Math.max(round2(amount * COMMISSION_RATE), MIN_FEE)
  const transfer = isShanghai(stockCode) ? round2(amount * TRANSFER_RATE) : 0
  return round2(commission + transfer)
}

/** 计算卖出手续费（佣金 + 印花税 + 沪市过户费；最低 5 元只作用于佣金） */
export function calcSellFee(amount, stockCode = '') {
  if (!(amount > 0)) return 0
  const commission = Math.max(round2(amount * COMMISSION_RATE), MIN_FEE)
  const stamp = isFund(stockCode) ? 0 : round2(amount * STAMP_RATE)
  const transfer = isShanghai(stockCode) ? round2(amount * TRANSFER_RATE) : 0
  return round2(commission + stamp + transfer)
}

/** 买入：计算含手续费的实际金额和成本价 */
export function calcBuyActual(amount, stockCode = '') {
  const fee = calcBuyFee(amount, stockCode)
  return { fee, actualAmount: parseFloat((amount + fee).toFixed(2)) }
}

/** 卖出：计算扣除费用后的实际到账金额 */
export function calcSellActual(amount, stockCode = '') {
  const fee = calcSellFee(amount, stockCode)
  return { fee, actualAmount: parseFloat((amount - fee).toFixed(2)) }
}

/** @deprecated 保留兼容，默认按买入计算 */
export function calcFee(amount, stockCode = '') {
  return calcBuyFee(amount, stockCode)
}

/** @deprecated 保留兼容，默认按买入计算 */
export function calcActualAmount(amount, stockCode = '') {
  return calcBuyActual(amount, stockCode)
}

/** 计算含手续费的每股成本 */
export function calcCostPrice(amount, quantity, stockCode = '') {
  if (!quantity || quantity <= 0) return 0
  const { actualAmount } = calcBuyActual(amount, stockCode)
  return parseFloat((actualAmount / quantity).toFixed(3))
}
