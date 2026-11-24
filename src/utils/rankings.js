// src/utils/rankings.js — 盈亏榜单纯函数（单账户）

/**
 * 已清仓股票盈亏榜
 * @param {Array} transactions 交易记录（无 status，金额以 amount 为准）
 * @returns {Array} 按 profit 降序；含买卖均价、日期区间、次数
 */
export function computeClearedRankings(transactions) {
  const byStock = {}
  for (const tx of transactions) {
    if (!byStock[tx.stock_code]) {
      byStock[tx.stock_code] = {
        stock_code: tx.stock_code,
        stock_name: tx.stock_name,
        buyQty: 0,
        sellQty: 0,
        buyAmount: 0,
        sellAmount: 0,
        buyFees: 0,
        sellFees: 0,
        buyDates: [],
        sellDates: [],
        txs: []
      }
    }
    const entry = byStock[tx.stock_code]
    entry.txs.push(tx)
    if (tx.type === 'buy') {
      entry.buyQty += tx.quantity
      entry.buyAmount += tx.amount
      entry.buyFees += tx.fee || 0
      if (tx.trade_date) entry.buyDates.push(tx.trade_date)
    } else {
      entry.sellQty += tx.quantity
      entry.sellAmount += tx.amount
      entry.sellFees += tx.fee || 0
      if (tx.trade_date) entry.sellDates.push(tx.trade_date)
    }
  }

  return Object.values(byStock)
    .filter(s => s.buyQty > 0 && s.buyQty === s.sellQty)
    .map(s => {
      const netSell = s.sellAmount - s.sellFees
      const totalBuy = s.buyAmount + s.buyFees
      const profit = netSell - totalBuy
      return {
        ...s,
        profit,
        profitPct: totalBuy > 0 ? (profit / totalBuy) * 100 : 0,
        buyAvgPrice: s.buyQty > 0 ? totalBuy / s.buyQty : 0,
        sellAvgPrice: s.sellQty > 0 ? netSell / s.sellQty : 0,
        buyRange: dateRange(s.buyDates),
        sellRange: dateRange(s.sellDates),
        cycleCount: s.txs.length
      }
    })
    .sort((a, b) => b.profit - a.profit)
}

/**
 * 当前持仓的浮动盈亏
 * @param {Array} holdings
 * @param {Object} prices { [code]: { price, stock_name } }
 */
export function computeHoldingProfits(holdings, prices = {}) {
  return holdings
    .filter(h => h.quantity > 0)
    .map(h => {
      const priceData = prices[h.stock_code] || {}
      const price = priceData.price || h.cost_price || 0
      const marketValue = price * h.quantity
      const cost = h.cost_price * h.quantity
      const profit = marketValue - cost
      return {
        stock_code: h.stock_code,
        stock_name: priceData.stock_name || h.stock_name || h.stock_code,
        quantity: h.quantity,
        costPrice: h.cost_price,
        price,
        marketValue,
        profit,
        profitPct: cost > 0 ? (profit / cost) * 100 : null
      }
    })
    .sort((a, b) => b.profit - a.profit)
}

function dateRange(dates) {
  if (!dates.length) return ''
  const sorted = dates.slice().sort()
  const fmt = d => {
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }
  return sorted[0] === sorted[sorted.length - 1]
    ? fmt(sorted[0])
    : `${fmt(sorted[0])}~${fmt(sorted[sorted.length - 1])}`
}
