// scripts/backfill-snapshots.mjs — 按账本与收盘价回填每日仓位快照
// 用法：node scripts/backfill-snapshots.mjs [--write]
// 默认 dry-run；--write 写入 solo_app_config 的 pos_snap:*。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSnapshotInputs, estimateSnapshot } from '../src/utils/historicalSnapshotLedger.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
const headers = { apikey: key, Authorization: `Bearer ${key}` }
const write = process.argv.includes('--write')

async function get(pathname) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers })
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchBars(symbol) {
  const endpoint = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=400`
  const res = await fetch(endpoint, { headers: { Referer: 'https://finance.sina.com.cn/' } })
  if (!res.ok) throw new Error(`${symbol} 行情 HTTP ${res.status}`)
  const bars = await res.json()
  return bars.filter(b => b.day && Number(b.close) > 0).map(b => ({ day: b.day, close: Number(b.close) }))
}

const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())

const [holdings, transactions, capitalLogs] = await Promise.all([
  get('solo_holdings?select=stock_code,quantity'),
  get('solo_transactions?select=stock_code,type,quantity,amount,fee,trade_date&order=id&limit=1000'),
  get('solo_capital_log?select=type,amount,category,note,created_at&order=id&limit=1000')
])

const indexBars = await fetchBars('sh000001')
const dates = indexBars.map(b => b.day).filter(d => d >= '2026-01-05' && d < today).sort()
if (!dates.length) throw new Error('没有可用交易日')

const inputs = buildSnapshotInputs(dates, holdings, transactions, capitalLogs)
if (!inputs.length) throw new Error('没有可用快照输入')

const codes = [...new Set(inputs.flatMap(i => i.positions.map(([code]) => code)))]
const closes = {}
for (const code of codes) {
  const sym = /^[569]/.test(code) ? `sh${code}` : `sz${code}`
  const bars = await fetchBars(sym)
  closes[code] = Object.fromEntries(bars.map(b => [b.day, b.close]))
}

const estimates = []
const missed = []
for (const input of inputs) {
  const e = estimateSnapshot(input, closes)
  if (e) estimates.push(e)
  else missed.push(input.date)
}

console.log(`交易日 ${dates.length}；可估算 ${estimates.length}；缺价跳过 ${missed.length}`)
if (estimates.length) {
  console.log('首个:', estimates[0].date, '资产', estimates[0].asset, '仓位', estimates[0].ratio, '资本变动', estimates[0].capitalChange)
  console.log('末个:', estimates.at(-1).date, '资产', estimates.at(-1).asset, '仓位', estimates.at(-1).ratio)
  console.log('1/5 净值:', estimates[0].date === '2026-01-05' ? (estimates[0].asset / 92955.55).toFixed(4) : '—')
}
if (missed.length) console.log('缺价日期:', missed.slice(0, 20).join(', '), missed.length > 20 ? '…' : '')

if (!write) {
  console.log('\n[dry-run] 未写库。确认后执行：node scripts/backfill-snapshots.mjs --write')
  process.exit(0)
}

const rows = estimates.map(e => ({ key: `pos_snap:${e.date}`, value: JSON.stringify(e) }))
for (let i = 0; i < rows.length; i += 100) {
  const res = await fetch(`${url}/rest/v1/solo_app_config?on_conflict=key`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows.slice(i, i + 100))
  })
  if (!res.ok) throw new Error(`写快照失败 ${res.status}: ${await res.text()}`)
  console.log(`已写入 ${Math.min(i + 100, rows.length)}/${rows.length}`)
}
console.log('快照回填完成。')
