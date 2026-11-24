// src/utils/assetPoker.js — 德州战绩（按日/周/月聚合）

export const POKER_CATEGORIES = ['德州入账', '德州出账']

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function r2(n) {
  return Math.round(n * 100) / 100
}

export function pokerFlows(flows, filter = 'all') {
  return (flows || []).filter(f =>
    POKER_CATEGORIES.includes(f.category) && (filter === 'all' || f.dz_mode === filter)
  )
}

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return ymd(d)
}

export function pokerPeriodKey(dateStr, mode) {
  const s = String(dateStr)
  if (mode === 'month') return s.slice(0, 7)
  if (mode === 'week') return weekKey(s)
  return s.slice(0, 10)
}

export function buildPokerBars(flows, mode = 'day', filter = 'all') {
  const map = new Map()
  for (const f of pokerFlows(flows, filter)) {
    const key = pokerPeriodKey(f.date, mode)
    const rec = map.get(key) || { key, income: 0, expense: 0, pnl: 0, count: 0 }
    if (f.category === '德州入账') rec.income += Math.abs(Number(f.amount) || 0)
    else rec.expense += Math.abs(Number(f.amount) || 0)
    rec.pnl = rec.income - rec.expense
    rec.count += 1
    map.set(key, rec)
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(r => ({ ...r, income: r2(r.income), expense: r2(r.expense), pnl: r2(r.pnl) }))
}
