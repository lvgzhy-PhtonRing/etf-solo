// src/utils/assetStats.js — 统计报表（周期窗口 + 分类聚合）

export const STATS_MODES = [
  { key: 'month', label: '按月' },
  { key: '90d', label: '前90天' },
  { key: 'half', label: '前半年' },
  { key: 'year', label: '前一年' },
  { key: 'custom', label: '自定义' }
]

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 区间 [start, end)（左闭右开），日期均为 YYYY-MM-DD
 */
export function statsWindow(mode, offset = 0, { now = new Date(), customStart, customEnd } = {}) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (mode === 'custom') {
    if (!customStart || !customEnd) return null
    const start = new Date(customStart + 'T00:00:00')
    const end = new Date(customEnd + 'T00:00:00')
    end.setDate(end.getDate() + 1) // 含结束日
    return { start: ymd(start), end: ymd(end) }
  }

  if (mode === 'month') {
    return {
      start: ymd(new Date(today.getFullYear(), today.getMonth() + offset, 1)),
      end: ymd(new Date(today.getFullYear(), today.getMonth() + offset + 1, 1))
    }
  }

  if (mode === '90d') {
    const end = new Date(today)
    end.setDate(end.getDate() + 1 + offset * 90)
    const start = new Date(end)
    start.setDate(start.getDate() - 90)
    return { start: ymd(start), end: ymd(end) }
  }

  if (mode === 'half') {
    const end = new Date(today.getFullYear(), today.getMonth() + 1 + offset * 6, 1)
    return { start: ymd(new Date(end.getFullYear(), end.getMonth() - 6, 1)), end: ymd(end) }
  }

  const end = new Date(today.getFullYear() + offset, today.getMonth() + 1, 1)
  return { start: ymd(new Date(end.getFullYear(), end.getMonth() - 12, 1)), end: ymd(end) }
}

export function flowsInWindow(flows, w) {
  if (!w) return []
  return (flows || []).filter(f => f.date >= w.start && f.date < w.end)
}

function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmtMD = d => `${d.getMonth() + 1}/${d.getDate()}`
const fmtYM = d => `${d.getFullYear()}/${d.getMonth() + 1}`
const yy = d => String(d.getFullYear()).slice(2)

/**
 * 周期标签（对齐源程序 getStatsPeriodLabel）
 */
export function periodLabel(mode, w, { customStart, customEnd } = {}) {
  if (!w) return ''
  if (mode === 'custom') return `${customStart} ~ ${customEnd}`

  const start = parseDate(w.start)
  const endExcl = parseDate(w.end)

  if (mode === 'month') return `${start.getFullYear()}年${start.getMonth() + 1}月`
  if (mode === 'half' || mode === 'year') {
    const lastMonth = new Date(endExcl.getFullYear(), endExcl.getMonth() - 1, 1)
    return `${fmtYM(start)}~${fmtYM(lastMonth)}`
  }

  const last = new Date(endExcl)
  last.setDate(last.getDate() - 1)
  if (start.getFullYear() === last.getFullYear()) {
    return `${fmtMD(start)}~${fmtMD(last)}`
  }
  return `${yy(start)}/${fmtMD(start)}~${yy(last)}/${fmtMD(last)}`
}

// 统计报表口径：排除德州入账/出账（源程序 renderStats 的过滤规则）
export function excludePoker(flows) {
  return (flows || []).filter(f => f.category !== '德州入账' && f.category !== '德州出账')
}

export function aggregateByCategory(flows, type) {
  const map = new Map()
  let total = 0
  for (const f of flows || []) {
    if (f.type !== type) continue
    const amt = Math.abs(Number(f.amount) || 0)
    total += amt
    const cur = map.get(f.category) || { category: f.category, amount: 0, count: 0 }
    cur.amount += amt
    cur.count += 1
    map.set(f.category, cur)
  }
  total = Math.round(total * 100) / 100
  const items = [...map.values()]
    .map(it => ({
      category: it.category,
      amount: Math.round(it.amount * 100) / 100,
      count: it.count,
      pct: total > 0 ? Math.round((it.amount / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
  return { total, items }
}
