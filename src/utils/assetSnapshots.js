// src/utils/assetSnapshots.js — 快照仅存本地（方案 A：无登录、无云端）
const KEY = 'asset_snapshots_solo_v1'
const KEEP_DAYS = 7

export const COMPARE_ROWS = [
  { label: '实际可支配', key: 'actualVal', core: true },
  { label: '账面资产', key: 'ledgerTotal', core: true },
  { label: '差异', key: 'diff', core: true },
  { label: '微信-零钱', key: 'wx_lq' },
  { label: '微信-零钱通', key: 'wx_lqt' },
  { label: '微信-理财通', key: 'wx_lct' },
  { label: '支付宝-余额', key: 'ali_ye' },
  { label: '支付宝-余额宝', key: 'ali_yeb' },
  { label: '支付宝-余利宝', key: 'ali_ylb' },
  { label: '支付宝-理财', key: 'ali_lc' },
  { label: '银行卡-交行', key: 'bank_jt' },
  { label: '调整项-借出', key: 'adj_lend' },
  { label: '调整项-闲鱼店', key: 'adj_shop' },
  { label: '调整项-家庭', key: 'adj_family' }
]

export function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function pruneOld(now = Date.now()) {
  const all = readAll()
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000
  const next = {}
  for (const [date, list] of Object.entries(all)) {
    const kept = (list || []).filter(s => s.timestamp > cutoff)
    if (kept.length) next[date] = kept
  }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function flatList() {
  const all = readAll()
  const out = []
  for (const [date, list] of Object.entries(all)) {
    ;(list || []).forEach((s, idx) => out.push({ ...s, date, idx }))
  }
  return out.sort((a, b) => b.timestamp - a.timestamp)
}

export function createSnapshot(payload) {
  const all = pruneOld()
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (!all[date]) all[date] = []
  all[date].push({ timestamp: d.getTime(), ...payload })
  localStorage.setItem(KEY, JSON.stringify(all))
  return date
}

export function deleteSnapshot(date, idx) {
  const all = readAll()
  if (!all[date]) return
  all[date].splice(idx, 1)
  if (!all[date].length) delete all[date]
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function timeOf(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function valOf(snap, key) {
  if (!snap) return 0
  if (key === 'actualVal') return Number(snap.actualVal) || 0
  if (key === 'ledgerTotal') return Number(snap.ledgerTotal) || 0
  if (key === 'diff') return Number(snap.diff) || 0
  return parseFloat(snap.assets?.[key]) || 0
}

function r2(n) {
  return Math.round(n * 100) / 100
}

/**
 * 快照对比：2 个快照互相比较；1 个快照与当前值比较
 * 仅输出有变化的行（与原程序一致）
 */
export function buildCompare(selected = [], current = null) {
  if (!selected.length) return { cols: [], rows: [], two: false }
  const sorted = [...selected].sort((a, b) => a.timestamp - b.timestamp)
  const two = sorted.length === 2
  const left = sorted[0]
  const right = two ? sorted[1] : current
  const cols = two
    ? sorted.map(s => `${s.date.slice(5)} ${timeOf(s.timestamp)}`)
    : [`${left.date.slice(5)} ${timeOf(left.timestamp)}`, '当前']

  const rows = COMPARE_ROWS.map(r => {
    const v1 = valOf(left, r.key)
    const v2 = valOf(right, r.key)
    const change = r2(v2 - v1)
    return {
      label: r.label,
      core: !!r.core,
      v1,
      v2,
      change,
      dir: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
    }
  }).filter(r => r.change !== 0)

  return { cols, rows, two }
}

/** 收支明细对比：按 date-title-amount 识别新增/删除（源程序同口径） */
export function buildLogDiff(logs1 = [], logs2 = []) {
  const keyOf = l => `${l.date}-${l.title ?? l.note ?? ''}-${l.amount}`
  const k1 = new Set((logs1 || []).map(keyOf))
  const k2 = new Set((logs2 || []).map(keyOf))
  const added = (logs2 || []).filter(l => !k1.has(keyOf(l)))
  const removed = (logs1 || []).filter(l => !k2.has(keyOf(l)))
  const sortDesc = (a, b) => String(b.date).localeCompare(String(a.date))
  return { added: added.slice().sort(sortDesc), removed: removed.slice().sort(sortDesc) }
}
