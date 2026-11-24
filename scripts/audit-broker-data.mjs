// scripts/audit-broker-data.mjs — 2026 期初导入审计（存档）
// 用法：node scripts/audit-broker-data.mjs
// 说明：01.txt…06.txt 已被 2024-2025 历史流水替换，本脚本仅保留 2026 期初导入的核对口径。
//       当前合并账本请用 audit-history-import.mjs。
// 数据源：~/Documents/01.txt…06.txt（券商资金流水）+ 最终持仓截图数值（内置）
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
const headers = { apikey: key, Authorization: `Bearer ${key}` }

// ===== 券商截图（2026-11-24 14:56，未休市） =====
const BROKER = {
  totalAsset: 119981.03,
  marketValue: 83573.00,
  cash: 36408.03,
  floatPnl: -32527.66,
  todayPnl: 1274.00,
  positionRatio: 69.6,
  prices: { '002364': 20.980, '002475': 48.190, '600089': 18.380, '513500': 2.528, '300736': 24.070 },
  holdings: [
    { stock_code: '002364', stock_name: '中恒电气', quantity: 1800, cost_price: 32.723, pnl: -21217.90 },
    { stock_code: '002475', stock_name: '立讯精密', quantity: 400, cost_price: 55.077, pnl: -2795.14 },
    { stock_code: '600089', stock_name: '特变电工', quantity: 900, cost_price: 26.726, pnl: -7546.51 },
    { stock_code: '513500', stock_name: '标普500', quantity: 3000, cost_price: 1.487, pnl: 3109.99 },
    { stock_code: '300736', stock_name: '百邦科技', quantity: 100, cost_price: 64.789, pnl: -4078.10 }
  ]
}

const decoder = new TextDecoder('gb18030')
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const sum = (rows, pred, fn) => round2(rows.filter(pred).reduce((s, r) => s + fn(r), 0))

function parseRows(dir) {
  const rows = []
  for (const f of ['01.txt', '02.txt', '03.txt', '04.txt', '05.txt', '06.txt']) {
    const text = decoder.decode(fs.readFileSync(path.join(dir, f)))
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^(\d{8})\s+(\d{2}:\d{2}:\d{2})\s+(收入|支出)\s+(-?[\d.]+)\s+([\d.]+)\s+(.*?)\s+人民币\s*$/)
      if (!m) continue
      rows.push({
        date: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`,
        time: m[2],
        amount: round2(m[4]),
        balance: round2(m[5]),
        summary: m[6].trim()
      })
    }
  }
  rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  return rows
}

function classify(row) {
  const s = row.summary
  const trade = s.match(/(买|卖)([^()]+?)\((\d{6})\)\s*(\d+)股\*([\d.]+)/)
  if (trade) {
    const side = trade[1] === '买' ? 'buy' : 'sell'
    const quantity = Number(trade[4])
    const price = Number(trade[5])
    const gross = round2(quantity * price)
    const fee = side === 'buy' ? round2(Math.abs(row.amount) - gross) : round2(gross - row.amount)
    return { kind: 'trade', side, stockCode: trade[3], stockName: trade[2].trim(), quantity, price, gross, fee, cash: row.amount }
  }
  if (s.includes('转帐转入')) return { kind: 'transfer_in' }
  if (s.includes('转帐转出')) return { kind: 'transfer_out' }
  if (s.includes('红利差别税')) return { kind: 'dividend_tax', stockCode: /证券代码:(\d{6})/.exec(s)?.[1] || '' }
  if (s.includes('红利到帐')) return { kind: 'dividend', stockCode: /(\d{6})红利到帐/.exec(s)?.[1] || '' }
  if (s.includes('领') && s.includes('红利')) return { kind: 'dividend', stockCode: /领(\d{6})红利/.exec(s)?.[1] || '' }
  if (s.includes('结息')) return { kind: 'interest' }
  throw new Error(`无法识别：${s}`)
}

async function get(pathname) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers })
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchPrevCloses(codes, date) {
  const out = {}
  for (const code of codes) {
    const sym = /^[569]/.test(code) ? `sh${code}` : `sz${code}`
    const endpoint = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=30`
    const res = await fetch(endpoint, { headers: { Referer: 'https://finance.sina.com.cn/' } })
    if (!res.ok) throw new Error(`${sym} 行情 ${res.status}`)
    const bars = await res.json()
    const idx = bars.findIndex(b => b.day === date)
    if (idx >= 0) out[code] = Number(bars[idx].close)
  }
  return out
}

const shanghaiDate = iso => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(iso))

let pass = true
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) pass = false
}

/* ===== 数据 ===== */
const rows = parseRows(path.join(os.homedir(), 'Documents'))
const events = rows.map(r => ({ ...r, ...classify(r) }))
const trades = events.filter(e => e.kind === 'trade')
const transfers = events.filter(e => e.kind === 'transfer_in' || e.kind === 'transfer_out')
const adjusts = events.filter(e => ['dividend', 'interest', 'dividend_tax'].includes(e.kind))

const [holdings, transactions, capitalLogs] = await Promise.all([
  get('solo_holdings?select=*&order=stock_code'),
  get('solo_transactions?select=*&order=id&limit=1000'),
  get('solo_capital_log?select=*&order=id&limit=1000')
])
const opening = transactions.filter(t => String(t.note || '').startsWith('期初建仓'))
const real = transactions.filter(t => !String(t.note || '').startsWith('期初建仓'))
const logById = new Map(capitalLogs.map(l => [l.id, l]))
const logByTx = new Map(capitalLogs.filter(l => l.source_tx_id != null).map(l => [l.source_tx_id, l]))

console.log('===== 一、持仓 vs 券商截图 =====')
for (const b of BROKER.holdings) {
  const h = holdings.find(x => x.stock_code === b.stock_code)
  const ok = h && h.quantity === b.quantity && Math.abs(Number(h.cost_price) - b.cost_price) < 1e-9
  check(`${b.stock_code} ${b.stock_name} ${b.quantity}股@${b.cost_price}`, ok,
    h ? `库 ${h.quantity}@${h.cost_price}` : '缺')
}
check('持仓 5 只', holdings.length === 5, `${holdings.length}`)
const cost = sum(holdings, () => true, h => h.quantity * h.cost_price)
check('持仓成本合计 115,925.50', Math.abs(cost - 115925.50) < 0.001, cost.toFixed(2))

console.log('\n===== 二、逐笔交易 vs 券商流水 =====')
check('真实交易 55 笔', real.length === trades.length, `库 ${real.length} / 券商 ${trades.length}`)
check('期初建仓 4 笔', opening.length === 4, `${opening.length}`)
const txKey = t => `${t.trade_date}|${t.stock_code}|${t.type}|${t.quantity}`
const dbByKey = new Map()
for (const t of real) {
  const k = txKey(t)
  if (!dbByKey.has(k)) dbByKey.set(k, [])
  dbByKey.get(k).push(t)
}
let matched = 0
const mismatches = []
for (const e of trades) {
  const cands = dbByKey.get(`${e.date}|${e.stockCode}|${e.side}|${e.quantity}`) || []
  const t = cands.shift()
  if (!t) { mismatches.push(`缺 ${e.date} ${e.side} ${e.stockCode} ${e.quantity}股`); continue }
  matched++
  const priceOk = Math.abs(Number(t.price) - e.price) <= 0.0006
  const amountOk = Math.abs(Number(t.amount) - e.gross) < 0.005
  const feeOk = Math.abs(Number(t.fee || 0) - e.fee) < 0.005
  const log = logByTx.get(t.id)
  const cashOk = log && Math.abs(Number(log.amount) - Math.abs(e.cash)) < 0.005
    && log.type === (e.side === 'buy' ? 'remove' : 'add') && log.category === 'trade'
  if (!priceOk || !amountOk || !feeOk || !cashOk) {
    mismatches.push(`${e.date} ${e.side} ${e.stockCode}: 价 ${t.price}/${e.price} 额 ${t.amount}/${e.gross} 费 ${t.fee}/${e.fee} 流水 ${log?.amount}/${Math.abs(e.cash)}`)
  }
}
check('55 笔逐笔金额/费用/价格/流水一致', matched === trades.length && mismatches.length === 0, mismatches.slice(0, 5).join('; ') || `${matched} 笔`)
check('真实交易均有 trade 流水', real.every(t => logByTx.has(t.id)), `${real.filter(t => logByTx.has(t.id)).length}/${real.length}`)
const buyCash = sum(trades, e => e.side === 'buy', e => Math.abs(e.cash))
const sellCash = sum(trades, e => e.side === 'sell', e => e.cash)
check('买入现金 -428,431.05', Math.abs(buyCash - 428431.05) < 0.005, buyCash.toFixed(2))
check('卖出现金 +369,499.17', Math.abs(sellCash - 369499.17) < 0.005, sellCash.toFixed(2))

console.log('\n===== 三、资金流水 vs 券商 =====')
const dbTransfers = capitalLogs.filter(l => l.category === 'capital' && !String(l.note || '').startsWith('期初'))
check('银证转账 4 笔', dbTransfers.length === transfers.length, `库 ${dbTransfers.length} / 券商 ${transfers.length}`)
for (const t of transfers) {
  const hit = dbTransfers.find(l => l.type === (t.kind === 'transfer_in' ? 'add' : 'remove')
    && Math.abs(Number(l.amount) - Math.abs(t.amount)) < 0.005
    && shanghaiDate(l.created_at) === t.date)
  check(`转账 ${t.date} ${t.kind === 'transfer_in' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}`, Boolean(hit))
}
const dbAdjust = capitalLogs.filter(l => l.category === 'adjust')
check('红利/利息/税 9 笔', dbAdjust.length === adjusts.length, `库 ${dbAdjust.length} / 券商 ${adjusts.length}`)
for (const a of adjusts) {
  const expectCat = a.kind === 'dividend' ? 'stock_dividend' : a.kind === 'interest' ? 'interest' : 'dividend_tax'
  const hit = dbAdjust.find(l => {
    const i = l.note.indexOf('{')
    if (i < 0) return false
    try {
      const p = JSON.parse(l.note.slice(i))
      return (p.items || []).some(it => it.category === expectCat
        && Math.abs((it.signedAmount || 0) - Math.round(a.amount * 100)) < 1
        && (!a.stockCode || it.stockCode === a.stockCode))
    } catch { return false }
  })
  check(`${a.date} ${expectCat} ${a.amount.toFixed(2)}`, Boolean(hit))
}
const openingCapital = capitalLogs.find(l => l.category === 'capital' && String(l.note || '').startsWith('期初结转'))
check('期初结转 92,955.55 @1/5', openingCapital && Math.abs(Number(openingCapital.amount) - 92955.55) < 0.001
  && shanghaiDate(openingCapital.created_at) === '2026-01-05',
  openingCapital ? `${openingCapital.amount} @${shanghaiDate(openingCapital.created_at)}` : '缺')

console.log('\n===== 四、资金口径 =====')
const capital = sum(capitalLogs, l => l.category === 'capital', l => l.type === 'add' ? l.amount : -l.amount)
const adjustNet = sum(capitalLogs, l => l.category === 'adjust', l => l.type === 'add' ? l.amount : -l.amount)
const tradeNet = sum(capitalLogs, l => l.category === 'trade', l => l.type === 'add' ? l.amount : -l.amount)
const available = round2(capital + adjustNet + tradeNet)
check('累计投入 142,955.55', Math.abs(capital - 142955.55) < 0.001, capital.toFixed(2))
check('调整净额 +475.36', Math.abs(adjustNet - 475.36) < 0.001, adjustNet.toFixed(2))
check('可用资金 36,408.03', Math.abs(available - BROKER.cash) < 0.001, available.toFixed(2))

console.log('\n===== 五、按截图 14:56 价格复算 =====')
const mv = round2(holdings.reduce((s, h) => s + (BROKER.prices[h.stock_code] || 0) * h.quantity, 0))
const asset = round2(mv + available)
const floatPnl = round2(mv - cost)
check('总市值 83,573.00', Math.abs(mv - BROKER.marketValue) < 0.005, mv.toFixed(2))
check('总资产 119,981.03', Math.abs(asset - BROKER.totalAsset) < 0.005, asset.toFixed(2))
const ratioRaw = mv / asset * 100
check('总仓位 69.6%（券商截断；App 四舍五入 69.7）', Math.abs(Math.floor(ratioRaw * 10) / 10 - BROKER.positionRatio) < 0.05,
  `原始 ${ratioRaw.toFixed(2)} → 截断 ${Math.floor(ratioRaw * 10) / 10} / 四舍五入 ${ratioRaw.toFixed(1)}`)
check('浮动盈亏 -32,352.50（券商 -32,527.66，差 175.16 为行情时点）', Math.abs(floatPnl - (-32352.50)) < 0.005, floatPnl.toFixed(2))
console.log('个股盈亏对照（App 成本价 × 截图现价 vs 券商）：')
for (const b of BROKER.holdings) {
  const h = holdings.find(x => x.stock_code === b.stock_code)
  const pnl = round2((BROKER.prices[b.stock_code] - Number(h.cost_price)) * h.quantity)
  console.log(`  ${b.stock_name}: App ${pnl.toFixed(2)} / 券商 ${b.pnl.toFixed(2)} / 差 ${(pnl - b.pnl).toFixed(2)}`)
}
const prev = await fetchPrevCloses(Object.keys(BROKER.prices), '2026-11-23')
const todayPnl = round2(holdings.reduce((s, h) => {
  const price = BROKER.prices[h.stock_code]
  return s + (prev[h.stock_code] ? (price - prev[h.stock_code]) * h.quantity : 0)
}, 0))
check('今日盈亏 +1,274.00（昨收=11/23 收盘）', Math.abs(todayPnl - BROKER.todayPnl) < 1, todayPnl.toFixed(2))

console.log(`\n${pass ? '审计全部通过' : '存在不一致，见上'}`)
process.exit(pass ? 0 : 1)
