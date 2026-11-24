// src/utils/assetSnapshots.js — 快照仅存本地（方案 A：无登录、无云端）
const KEY = 'asset_snapshots_solo_v1'
const KEEP_DAYS = 7

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
