// src/utils/capitalTimeline.js — 资本总览：入金/出金累计
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * 只取 category=capital 的流水，按时间升序累计。
 * 返回每行带 running（累计资本），首行即基准资本。
 */
export function buildCapitalTimeline(logs) {
  const sorted = (logs || [])
    .filter(l => l.category === 'capital')
    .slice()
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  let running = 0
  return sorted.map(log => {
    running += log.type === 'add' ? Number(log.amount) : -Number(log.amount)
    return { ...log, running: round2(running) }
  })
}
