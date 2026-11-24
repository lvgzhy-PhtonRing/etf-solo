// scripts/verify-broker-import.mjs — 导入后账本核对
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSnapshotInputs } from '../src/utils/historicalSnapshotLedger.js'
import { parseAdjustNote } from '../src/utils/adjustItems.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
const headers = { apikey: key, Authorization: `Bearer ${key}` }

async function get(pathname) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers })
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${await res.text()}`)
  return res.json()
}

const [holdings, transactions, capitalLogs, configs] = await Promise.all([
  get('solo_holdings?select=*&order=stock_code'),
  get('solo_transactions?select=*&order=created_at.asc&limit=1000'),
  get('solo_capital_log?select=*&order=created_at.asc&limit=1000'),
  get('solo_app_config?select=key,value&key=like.pos_snap%3A*')
])

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100
const sum = (rows, pred, fn) => round2(rows.filter(pred).reduce((s, r) => s + fn(r), 0))
const capital = sum(capitalLogs, l => l.category === 'capital', l => l.type === 'add' ? l.amount : -l.amount)
const adjust = sum(capitalLogs, l => l.category === 'adjust', l => l.type === 'add' ? l.amount : -l.amount)
const trade = sum(capitalLogs, l => l.category === 'trade', l => l.type === 'add' ? l.amount : -l.amount)
const available = round2(capital + adjust + trade)
const cost = round2(holdings.reduce((s, h) => s + h.quantity * h.cost_price, 0))
const tradeLogs = capitalLogs.filter(l => l.category === 'trade')
const linked = tradeLogs.filter(l => l.source_tx_id != null)
const tradeTxIds = new Set(transactions.map(t => t.id))

let pass = true
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) pass = false
}

check('持仓 5 条', holdings.length === 5, `${holdings.length}`)
check('持仓成本合计 115,925.50', Math.abs(cost - 115925.50) < 0.001, cost.toFixed(2))
check('交易 59 笔', transactions.length === 59, `${transactions.length}`)
check('资金流水 73 条', capitalLogs.length === 73, `${capitalLogs.length}`)
check('累计投入 142,955.55', Math.abs(capital - 142955.55) < 0.001, capital.toFixed(2))
check('调整净额 +475.36', Math.abs(adjust - 475.36) < 0.001, adjust.toFixed(2))
check('期末可用资金 36,408.03', Math.abs(available - 36408.03) < 0.001, available.toFixed(2))
check('trade 流水 59 条', tradeLogs.length === 59, `${tradeLogs.length}`)
check('trade 流水均已关联交易', linked.length === 59, `${linked.length}`)
check('关联的 source_tx_id 均存在', linked.every(l => tradeTxIds.has(l.source_tx_id)), `${new Set(linked.map(l => l.source_tx_id)).size} unique`)
const snapValues = (configs || []).map(c => {
  try { return JSON.parse(c.value) } catch { return null }
})
check('pos_snap 快照均有效', snapValues.length > 0 && snapValues.every(v => Number.isFinite(v?.asset) && v.asset > 0), `${snapValues.length} 条`)

const adjustNotes = capitalLogs.filter(l => l.category === 'adjust').map(l => parseAdjustNote(l.note))
check('adjust 备注均可解析', adjustNotes.every(Boolean), `${adjustNotes.filter(Boolean).length}/9`)

// 历史倒推：1/5～11/21 每个自然日，确认没有负持仓
const dates = []
for (let d = new Date('2026-01-05T00:00:00'); d <= new Date('2026-11-21T00:00:00'); d.setDate(d.getDate() + 1)) {
  dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
}
const inputs = buildSnapshotInputs(dates, holdings, transactions, capitalLogs)
check('历史倒推无负持仓且覆盖全部日期', inputs.length === dates.length, `${inputs.length}/${dates.length}`)
const first = inputs.find(i => i.date === '2026-01-05')
check('1/5 快照存在', Boolean(first))
if (first) {
  const pos = Object.fromEntries(first.positions)
  check('1/5 现金 44,864.55', Math.abs(first.cash - 44864.55) < 0.001, first.cash.toFixed(2))
  check('1/5 持仓 4 只', first.positions.length === 4, JSON.stringify(pos))
  check('1/5 标普500 10,000 股', pos['513500'] === 10000, String(pos['513500']))
  check('1/5 东方财富 800 股', pos['300059'] === 800, String(pos['300059']))
  check('1/5 士兰微 100 股', pos['600460'] === 100, String(pos['600460']))
  check('1/5 真视通 100 股', pos['002771'] === 100, String(pos['002771']))
  const prices = { '513500': 2.468, '300059': 23.75, '600460': 28.72, '002771': 15.39 }
  const mv = round2(first.positions.reduce((s, [code, qty]) => s + qty * (prices[code] || 0), 0))
  const asset = round2(first.cash + mv)
  const nav = asset / 92955.55
  check('1/5 市值 48,091.00', Math.abs(mv - 48091) < 0.001, mv.toFixed(2))
  check('1/5 净值 1.0000', Math.abs(nav - 1) < 1e-9, nav.toFixed(4))
}

console.log('\n1/5 资金变动:', first?.capitalChange)
console.log('最新快照输入:', inputs.at(-1)?.date, '现金', inputs.at(-1)?.cash, '持仓', inputs.at(-1)?.positions)
console.log(`\n${pass ? '全部通过' : '存在失败项'}`)
process.exit(pass ? 0 : 1)
