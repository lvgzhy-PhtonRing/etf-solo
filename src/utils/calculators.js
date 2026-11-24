// src/utils/calculators.js

/**
 * 计算盈亏 = (现价 - 成本价) × 持仓数量
 */
export function calcProfit(currentPrice, costPrice, quantity) {
  if (!currentPrice || !quantity || costPrice == null) return 0
  return (currentPrice - costPrice) * quantity
}

/**
 * 计算涨跌幅% = (现价 - 昨收) / 昨收 × 100
 */
export function calcChangePct(currentPrice, prevClose) {
  if (!currentPrice || !prevClose || prevClose === 0) return 0
  return ((currentPrice - prevClose) / prevClose) * 100
}

/**
 * 计算仓位比例 = 总市值 / 总资产 × 100
 */
export function calcPositionRatio(totalMarketValue, totalAsset) {
  if (!totalMarketValue || !totalAsset || totalAsset === 0) return 0
  return (totalMarketValue / totalAsset) * 100
}

/**
 * 计算持仓成本均价 = 总投入金额 / 总持仓数量
 * 买入时：新均价 = (原持仓金额 + 买入金额) / (原数量 + 买入数量)
 */
export function calcNewCostPrice(buyAmount, buyQuantity, currentQuantity, currentCostPrice) {
  const totalCost = (currentCostPrice || 0) * (currentQuantity || 0) + buyAmount
  const totalQty = (currentQuantity || 0) + buyQuantity
  return totalQty > 0 ? totalCost / totalQty : 0
}

/**
 * 券商摊薄成本：卖出后剩余成本 = (原成本总额 − 卖出净到账) / 剩余股数
 * 盈利卖出会降低成本，亏损卖出会抬高成本；清仓或净到账超过成本时返回 0。
 */
export function calcCostAfterSell(currentCostPrice, currentQuantity, sellQuantity, netProceeds) {
  const remaining = (currentQuantity || 0) - (sellQuantity || 0)
  if (remaining <= 0) return 0
  const totalCost = (currentCostPrice || 0) * (currentQuantity || 0) - (netProceeds || 0)
  return Math.max(totalCost / remaining, 0)
}
