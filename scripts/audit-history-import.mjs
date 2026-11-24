// scripts/audit-history-import.mjs — 2024-2025 历史流水导入审计
// 用法：node scripts/audit-history-import.mjs
// 校验：12 份券商流水 → 交易/调整/冲销 → 资金口径 → 快照 basis 不变 → 榜单
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSnapshotInputs } from '../src/utils/historicalSnapshotLedger.js'
import { computeClearedRankings } from '../src/utils/rankings.js'
import { ADJUST_LABELS, parseAdjustNote } from '../src/utils/adjustItems.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
const headers = { apikey: key, Authorization: `Bearer ${key}` }
const dir = path.join(os.homedir(), 'Documents')
const decoder = new TextDecoder('gb18030')
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const sum = (rows, pred, fn) => round2(rows.filter(pred).reduce((s, r) => s + fn(r), 0))
const shanghaiDate = iso => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(iso))

let pass = true
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) pass = false
}

/* ===== 解析券商流水 ===== */
const files = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '.txt')
const rows = []
for (const f of files) {
  const text = decoder.decode(fs.readFileSync(path.join(dir, f)))
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{8})\s+(\d{2}:\d{2}:\d{2})\s+(收入|支出)\s+(-?[\d.]+)\s+([\d.]+)\s+(.*?)\s+人民币\s*$/)
    if (!m) continue
    rows.push({
      date: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`,
      time: m[2], amount: round2(m[4]), balance: round2(m[5]), summary: m[6].trim()
    })
  }
}
rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

function classify(row) {
  const s = row.summary
  const trade = s.match(/(买|卖)([^()]+?)\((\d{6})\)\s*(\d+)股\*([\d.]+)/)
  if (trade) {
    const side = trade[1] === '买' ? 'buy' : 'sell'
    const quantity = Number(trade[4]), price = Number(trade[5])
    const gross = round2(quantity * price)
    const fee = side === 'buy' ? round2(Math.abs(row.amount) - gross) : round2(gross - row.amount)
    return { kind: 'trade', side, stockCode: trade[3], stockName: trade[2].trim(), quantity, price, gross, fee, cash: row.amount }
  }
  if (s.includes('转帐转入') || s.includes('存管转帐转入')) return { kind: 'transfer_in' }
  if (s.includes('转帐转出') || s.includes('存管转帐转出')) return { kind: 'transfer_out' }
  if (s.includes('股息差别税') || s.includes('红利差别税')) return { kind: 'dividend_tax' }
  if (s.includes('红利到帐') || (s.includes('领') && s.includes('红利'))) return { kind: 'dividend' }
  if (s.includes('结息') || s.includes('利息结转')) return { kind: 'interest' }
  throw new Error(`无法识别：${s}`)
}

const events = rows.map(r => ({ ...r, ...classify(r) }))
const trades = events.filter(e => e.kind === 'trade')
const dividends = events.filter(e => e.kind === 'dividend')
const interests = events.filter(e => e.kind === 'interest' && Math.abs(e.amount) > 0.001)
const taxes = events.filter(e => e.kind === 'dividend_tax')
const transfers = events.filter(e => e.kind === 'transfer_in' || e.kind === 'transfer_out')

/* ===== 读取数据库 ===== */
async function get(pathname) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers })
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${await res.text()}`)
  return res.json()
}
const [holdings, transactions, capitalLogs, snapshots] = await Promise.all([
  get('solo_holdings?select=*&order=stock_code'),
  get('solo_transactions?select=*&order=id&limit=1000'),
  get('solo_capital_log?select=*&order=id&limit=1000'),
  get('solo_app_config?select=key,value&key=like.pos_snap*')
])

/* ===== 一、源文件与期初/期末现金 ===== */
console.log('===== 一、券商流水 =====')
const openingCash = round2(rows[0].balance - rows[0].amount)
check('12 份文件 68 行', rows.length === 68, `${rows.length} 行`)
check('时间范围 2024-01-05～2025-12-22', rows[0].date === '2024-01-05' && rows.at(-1).date === '2025-12-22',
  `${rows[0].date}～${rows.at(-1).date}`)
check('期初现金 10,580.03', Math.abs(openingCash - 10580.03) < 0.001, openingCash.toFixed(2))
check('末行余额 44,864.55', Math.abs(rows.at(-1).balance - 44864.55) < 0.001, rows.at(-1).balance.toFixed(2))
check('交易 43 / 红利 5 / 利息 8 / 税 7 / 转账 3',
  trades.length === 43 && dividends.length === 5 && interests.length === 8 && taxes.length === 7 && transfers.length === 3,
  `${trades.length}/${dividends.length}/${interests.length}/${taxes.length}/${transfers.length}`)

/* ===== 二、历史交易逐笔 ===== */
console.log('\n===== 二、历史交易逐笔 =====')
const historyTx = transactions.filter(t => String(t.note || '').startsWith('券商历史导入'))
const synthetic = transactions.filter(t => String(t.note || '').startsWith('期初建仓'))
const real2026 = transactions.filter(t => !String(t.note || '').startsWith('券商历史导入') && !String(t.note || '').startsWith('期初建仓'))
const logByTx = new Map(capitalLogs.filter(l => l.source_tx_id != null).map(l => [l.source_tx_id, l]))
check('历史交易 43 笔', historyTx.length === 43, `${historyTx.length}`)
check('2026 真实交易 55 笔', real2026.length === 55, `${real2026.length}`)
check('期初合成买入已清除', synthetic.length === 0, `${synthetic.length}`)

const dbByKey = new Map()
for (const t of historyTx) {
  const k = `${t.trade_date}|${t.stock_code}|${t.type}|${t.quantity}`
  if (!dbByKey.has(k)) dbByKey.set(k, [])
  dbByKey.get(k).push(t)
}
const tradeIssues = []
let matched = 0
for (const e of trades) {
  const t = (dbByKey.get(`${e.date}|${e.stockCode}|${e.side}|${e.quantity}`) || []).shift()
  if (!t) { tradeIssues.push(`缺 ${e.date} ${e.side} ${e.stockCode} ${e.quantity}股`); continue }
  matched++
  const log = logByTx.get(t.id)
  const priceOk = Math.abs(Number(t.price) - e.price) <= 0.0006
  const amountOk = Math.abs(Number(t.amount) - e.gross) < 0.005
  const feeOk = Math.abs(Number(t.fee || 0) - e.fee) < 0.005
  const cashOk = log && Math.abs(Number(log.amount) - Math.abs(e.cash)) < 0.005
    && log.type === (e.side === 'buy' ? 'remove' : 'add') && log.category === 'trade'
  if (!priceOk || !amountOk || !feeOk || !cashOk) {
    tradeIssues.push(`${e.date} ${e.side} ${e.stockCode}: 价 ${t.price}/${e.price} 额 ${t.amount}/${e.gross} 费 ${t.fee}/${e.fee} 流水 ${log?.amount}/${Math.abs(e.cash)}`)
  }
}
check('43 笔价格/金额/费用/流水一致', matched === 43 && tradeIssues.length === 0, tradeIssues.slice(0, 5).join('; ') || `${matched} 笔`)
check('历史交易均有 trade 流水', historyTx.every(t => logByTx.has(t.id)), `${historyTx.filter(t => logByTx.has(t.id)).length}/43`)
check('2026 真实交易均有 trade 流水', real2026.every(t => logByTx.has(t.id)), `${real2026.filter(t => logByTx.has(t.id)).length}/55`)

/* ===== 三、历史调整与冲销 ===== */
console.log('\n===== 三、历史调整与冲销 =====')
const historyAdjust = capitalLogs.filter(l => l.category === 'adjust' && String(l.note || '').includes('券商历史导入'))
check('历史调整流水 20 条', historyAdjust.length === 20, `${historyAdjust.length}`)
const adjustIssues = []
for (const e of [...dividends, ...interests, ...taxes]) {
  const expectCat = e.kind === 'dividend' ? 'stock_dividend' : e.kind === 'interest' ? 'interest' : 'dividend_tax'
  const hit = historyAdjust.find(l => {
    const p = parseAdjustNote(l.note)
    return shanghaiDate(l.created_at) === e.date && (p?.items || []).some(it =>
      it.category === expectCat && Math.abs((it.signedAmount || 0) - Math.round(e.amount * 100)) < 1)
  })
  if (!hit) adjustIssues.push(`${e.date} ${expectCat} ${e.amount}`)
}
check('20 条调整日期/类别/金额一致', adjustIssues.length === 0, adjustIssues.slice(0, 5).join('; ') || '全部命中')

const offsetTrade = capitalLogs.find(l => l.note === '历史期初结转')
const offsetAdjust = capitalLogs.find(l => l.note === '历史调整结转')
check('历史期初结转 -31,110.18（trade）', offsetTrade && offsetTrade.category === 'trade'
  && offsetTrade.type === 'remove' && Math.abs(Number(offsetTrade.amount) - 31110.18) < 0.001,
  offsetTrade ? `${offsetTrade.type} ${offsetTrade.amount}` : '缺')
check('历史调整结转 -1,265.34（adjust）', offsetAdjust && offsetAdjust.category === 'adjust'
  && offsetAdjust.type === 'remove' && Math.abs(Number(offsetAdjust.amount) - 1265.34) < 0.001,
  offsetAdjust ? `${offsetAdjust.type} ${offsetAdjust.amount}` : '缺')

/* ===== 四、资金口径 ===== */
console.log('\n===== 四、资金口径 =====')
const capital = sum(capitalLogs, l => l.category === 'capital', l => l.type === 'add' ? l.amount : -l.amount)
const adjust = sum(capitalLogs, l => l.category === 'adjust', l => l.type === 'add' ? l.amount : -l.amount)
const trade = sum(capitalLogs, l => l.category === 'trade', l => l.type === 'add' ? l.amount : -l.amount)
const available = round2(capital + adjust + trade)
check('交易 98 笔', transactions.length === 98, `${transactions.length}`)
check('资金流水 134 条', capitalLogs.length === 134, `${capitalLogs.length}`)
check('累计投入 142,955.55', Math.abs(capital - 142955.55) < 0.001, capital.toFixed(2))
check('调整净额 +475.36', Math.abs(adjust - 475.36) < 0.001, adjust.toFixed(2))
check('买卖净额 -107,022.88', Math.abs(trade - (-107022.88)) < 0.001, trade.toFixed(2))
check('可用资金 36,408.03', Math.abs(available - 36408.03) < 0.001, available.toFixed(2))

/* ===== 五、快照 basis 不变 ===== */
console.log('\n===== 五、快照 basis（净值不变） =====')
const snapDates = snapshots.map(s => s.key.slice('pos_snap:'.length)).sort()
const inputs = buildSnapshotInputs(snapDates, holdings, transactions, capitalLogs)
const inputByDate = Object.fromEntries(inputs.map(i => [i.date, i]))
let basisOk = 0
const basisIssues = []
for (const s of snapshots) {
  const date = s.key.slice('pos_snap:'.length)
  const stored = JSON.parse(s.value)
  if (!stored.basis) continue
  if (stored.basis === inputByDate[date]?.basis) basisOk++
  else basisIssues.push(date)
}
check('214 个历史快照 basis 全部一致', basisOk === 214 && basisIssues.length === 0, `${basisOk}/214${basisIssues.length ? ' 差异 ' + basisIssues.slice(0, 5).join(',') : ''}`)
const base = snapshots.find(s => s.key === 'pos_snap:2026-07-17')
check('7/17 基准资产 131,846', base && JSON.parse(base.value).asset === 131846,
  base ? String(JSON.parse(base.value).asset) : '缺')
const latest = snapshots.find(s => s.key === 'pos_snap:2026-11-24')
check('11/24 资产 119,944（净值 0.9097）', latest && JSON.parse(latest.value).asset === 119944,
  latest ? String(JSON.parse(latest.value).asset) : '缺')

/* ===== 六、榜单 ===== */
console.log('\n===== 六、已清仓榜单 =====')
const rankings = computeClearedRankings(transactions)
check('已清仓 10 只', rankings.length === 10, `${rankings.length}`)
check('榜首 锋龙股份 +12,927.38', rankings[0]?.stock_name === '锋龙股份' && Math.abs(rankings[0].profit - 12927.38) < 0.01,
  rankings[0] ? `${rankings[0].stock_name} ${rankings[0].profit.toFixed(2)}` : '缺')

console.log(`\n${pass ? '历史导入审计全部通过' : '存在不一致，见上'}`)
process.exit(pass ? 0 : 1)
