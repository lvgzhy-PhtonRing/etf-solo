// src/utils/etfNav.js — ETF 金枪不倒净值（只读 RPC）
export const ETF_NAV_BASE_DATE = '2026-07-29'
export const ETF_NAV_BASE_ASSET = 848405

export function mapEtfPosSnaps(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => r && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date >= ETF_NAV_BASE_DATE && Number(r.asset) > 0)
    .map(r => ({ date: r.date, nav: Number(r.asset) / ETF_NAV_BASE_ASSET }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchEtfNav({ url, key, fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  if (!url || !key) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/get_etf_pos_snaps`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: controller.signal
    })
    if (!res.ok) return null
    const points = mapEtfPosSnaps(await res.json())
    return points.length ? points : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
