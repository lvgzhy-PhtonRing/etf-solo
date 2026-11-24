// src/utils/assetPoker.js — 德州战绩（按日/周/月聚合 + K 线几何）

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

export function weekKey(dateStr) {
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

/**
 * K 线几何：以零轴为基准的蜡烛高度（百分比）与统计信息
 */
export function pokerChart(bars = []) {
  const nets = bars.map(b => Number(b.pnl) || 0)
  const periods = bars.length
  const wins = nets.filter(n => n >= 0).length
  const losses = periods - wins
  const avgNet = periods ? nets.reduce((s, n) => s + n, 0) / periods : 0
  const maxAbs = Math.max(1, ...nets.map(Math.abs))
  const halfRange = maxAbs * 1.25

  const items = bars.map((b, i) => {
    const net = nets[i]
    return {
      key: b.key,
      net,
      income: b.income || 0,
      expense: b.expense || 0,
      isUp: net >= 0,
      // 相对半幅的百分比；最小 1% 保证可见
      heightPct: Math.max(1, (Math.abs(net) / halfRange) * 100)
    }
  })

  return { items, stats: { periods, wins, losses, avgNet: r2(avgNet) }, maxAbs, halfRange }
}
