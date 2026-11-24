// src/utils/tradeCapLink.js — 交易与资金流水的关联
const EPS = 0.01

/**
 * 找到交易对应的资金流水
 * 优先 source_tx_id；旧数据回退：方向 + 股票代码 + 含费金额
 */
export function findTradeLog(logs, tx) {
  if (!tx) return null
  if (tx.id != null) {
    const byId = logs.find(l => l.source_tx_id != null && l.source_tx_id === tx.id)
    if (byId) return byId
  }
  const direction = tx.type === 'buy' ? 'remove' : 'add'
  const expected = tx.type === 'buy'
    ? (tx.amount || 0) + (tx.fee || 0)
    : (tx.amount || 0) - (tx.fee || 0)
  return logs.find(l =>
    l.category === 'trade' &&
    l.type === direction &&
    Math.abs(l.amount - expected) < EPS &&
    (!l.note || String(l.note).includes(tx.stock_code) || l.source_tx_id == null)
  ) || null
}
