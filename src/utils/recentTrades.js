// src/utils/recentTrades.js — 最近 N 笔交易（做 T 价格参考）
const round = n => Math.round(Number(n) * 1000) / 1000

/**
 * 取某只股票最近 N 笔交易（按成交日倒序）
 * @param {Array} transactions 全部交易记录
 * @param {string} stockCode 6 位股票代码
 * @param {number} count 条数
 * @returns {Array<{date, side, qty, price}>} date 为 YY/MM/DD，如 26/06/05
 */
export function recentTrades(transactions, stockCode, count = 3) {
  const limit = Math.max(0, Math.floor(Number(count) || 0))
  return (transactions || [])
    .filter(t => t.stock_code === stockCode && (t.type === 'buy' || t.type === 'sell') && t.trade_date)
    .sort((a, b) =>
      String(b.trade_date).localeCompare(String(a.trade_date)) ||
      (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, limit)
    .map(t => ({
      date: shortDate(t.trade_date),
      side: t.type,
      qty: Number(t.quantity) || 0,
      price: round(t.price)
    }))
}

/** 2026-06-05 → 26/06/05 */
export function shortDate(dateStr) {
  const s = String(dateStr || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(2).replace(/-/g, '/') : s
}
