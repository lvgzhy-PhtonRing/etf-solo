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

/**
 * 删除一笔交易后，从当前持仓成本回滚：
 * 删买入：总成本 − (成交额 + 费用)，数量 − 股数
 * 删卖出：总成本 + (成交额 − 费用)，数量 + 股数
 */
export function calcHoldingAfterDelete(currentCostPrice, currentQuantity, tx) {
  let quantity = currentQuantity || 0
  let totalCost = (currentCostPrice || 0) * quantity
  if (tx.type === 'buy') {
    quantity -= tx.quantity
    totalCost -= tx.amount + (tx.fee || 0)
  } else {
    quantity += tx.quantity
    totalCost += tx.amount - (tx.fee || 0)
  }
  if (quantity <= 0) return { quantity: 0, costPrice: 0 }
  return { quantity, costPrice: Math.max(totalCost / quantity, 0) }
}

/**
 * 编辑一笔交易后，从当前持仓成本先回滚旧交易，再重放新交易。
 * 旧/新交易的方向必须相同（界面不允许改方向）。
 */
export function calcHoldingAfterEdit(currentCostPrice, currentQuantity, oldTx, newTx) {
  let quantity = currentQuantity || 0
  let totalCost = (currentCostPrice || 0) * quantity
  if (oldTx.type === 'buy') {
    quantity -= oldTx.quantity
    totalCost -= oldTx.amount + (oldTx.fee || 0)
  } else {
    quantity += oldTx.quantity
    totalCost += oldTx.amount - (oldTx.fee || 0)
  }
  if (quantity <= 0) return { quantity: 0, costPrice: 0 }
  if (newTx.type === 'buy') {
    quantity += newTx.quantity
    totalCost += newTx.amount + (newTx.fee || 0)
  } else {
    quantity -= newTx.quantity
    totalCost -= newTx.amount - (newTx.fee || 0)
  }
  if (quantity <= 0) return { quantity: 0, costPrice: 0 }
  return { quantity, costPrice: Math.max(totalCost / quantity, 0) }
}

/**
 * 编辑交易时决定金额/费用：
 * 价格和数量都没变（只改备注/日期）→ 保留原始 amount/fee，避免 4 位小数价被截断后重算。
 * 价格或数量变了 → 按新价格/数量重算，费用由调用方传入 calcFee 回调。
 */
export function calcTradeEdit(log, price, quantity, calcFee) {
  const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
  const priceChanged = Math.abs(Number(price) - Number(log.price)) > 1e-9
  const qtyChanged = Number(quantity) !== Number(log.quantity)
  const recalc = priceChanged || qtyChanged
  const amount = recalc ? round2(price * quantity) : Number(log.amount)
  const fee = recalc ? calcFee(amount) : Number(log.fee || 0)
  const actualAmount = log.type === 'sell' ? round2(amount - fee) : round2(amount + fee)
  return {
    priceChanged,
    qtyChanged,
    price: priceChanged ? Number(price) : log.price,
    amount,
    fee,
    actualAmount
  }
}

/**
 * 红利冲减成本：新成本 = 原成本 − 红利总额 / 持仓数量
 * 券商按红利（税前）冲减成本；红利税只影响现金，不再冲减成本。
 */
export function calcCostAfterDividend(currentCostPrice, currentQuantity, dividendAmount) {
  if (!(currentQuantity > 0)) return 0
  return Math.max((currentCostPrice || 0) - (dividendAmount || 0) / currentQuantity, 0)
}
