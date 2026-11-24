// src/utils/assetLedger.js — 收支账本分组（按月/按周）

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return ymd(d)
}

export function weekLabel(key) {
  const start = new Date(key + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const f = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${f(start)}-${f(end)}`
}

function r2(n) {
  return Math.round(n * 100) / 100
}

/**
 * @param {Array} flows 流水（必须含 date / amount）
 * @param {'month'|'week'} mode
 * @returns 分组数组，按时间倒序；组内含 income/expense/total/items/isOld
 */
export function groupFlows(flows, mode = 'month', { now = new Date() } = {}) {
  const map = new Map()
  for (const f of flows || []) {
    if (!f.date) continue
    const key = mode === 'month' ? String(f.date).slice(0, 7) : weekKey(f.date)
    if (!map.has(key)) map.set(key, { key, income: 0, expense: 0, total: 0, items: [] })
    const g = map.get(key)
    const amt = Number(f.amount) || 0
    if (amt > 0) g.income += amt
    else g.expense += Math.abs(amt)
    g.total += amt
    g.items.push(f)
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)

  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(g => {
      const groupDate = mode === 'month'
        ? new Date(Number(g.key.slice(0, 4)), Number(g.key.slice(5, 7)) - 1, 1)
        : new Date(g.key + 'T00:00:00')
      return {
        ...g,
        label: mode === 'month' ? g.key.replace('-', '年') + '月' : weekLabel(g.key),
        income: r2(g.income),
        expense: r2(g.expense),
        total: r2(g.total),
        isOld: groupDate < sixMonthsAgo,
        items: g.items.slice().sort((a, b) => {
          const da = String(a.date || '')
          const db = String(b.date || '')
          if (da !== db) return db.localeCompare(da)
          return (Number(b.id) || 0) - (Number(a.id) || 0)
        })
      }
    })
}
