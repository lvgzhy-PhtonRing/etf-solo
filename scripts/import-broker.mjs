// scripts/import-broker.mjs — 券商流水 → 股票大 Tab 数据
//
// 用法：
//   node scripts/import-broker.mjs --dry-run
//   node scripts/import-broker.mjs --write --reset
//
// 默认读取 ~/Documents/01.txt…06.txt（GB18030 券商资金流水）。
// 基准日默认 2026-01-05；期初持仓由期末持仓 + 全部交易倒推。
// 写入前会打印完整对账清单；--reset 会清空 solo_holdings / solo_transactions /
// solo_capital_log 与 pos_snap:* 后重新写入。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serializeAdjustNote } from '../src/utils/adjustItems.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = [path.join(root, '.env'), path.join(root, 'src/.env')].find(p => fs.existsSync(p))
if (!envPath) { console.error('缺少 .env'); process.exit(1) }
const envText = fs.readFileSync(envPath, 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
if (!url || !key) { console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1) }

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : fallback
}
const write = args.includes('--write') && !args.includes('--dry-run')
const reset = args.includes('--reset')
const dir = arg('dir', path.join(os.homedir(), 'Documents'))
const baseDate = arg('base-date', '2026-01-05')
const FILES = ['01.txt', '02.txt', '03.txt', '04.txt', '05.txt', '06.txt']

const FINAL_HOLDINGS = [
  { stock_code: '002364', stock_name: '中恒电气', quantity: 1800, cost_price: 32.723 },
  { stock_code: '002475', stock_name: '立讯精密', quantity: 400, cost_price: 55.077 },
  { stock_code: '600089', stock_name: '特变电工', quantity: 900, cost_price: 26.726 },
  { stock_code: '513500', stock_name: '标普500', quantity: 3000, cost_price: 1.487 },
  { stock_code: '300736', stock_name: '百邦科技', quantity: 100, cost_price: 64.789 }
]

const EXPECTED = {
  rows: 68,
  openingCash: 44864.55,
  finalCash: 36408.03,
  openingCapital: 92955.55,
  totalCapital: 142955.55,
  totalCost: 115925.50
}

const FALLBACK_BASE_PRICES = {
  '513500': 2.468,
  '300059': 23.75,
  '600460': 28.72,
  '002771': 15.39
}

const decoder = new TextDecoder('gb18030')
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/* ========== 解析 ========== */
function parseRows() {
  const rows = []
  for (const f of FILES) {
    const full = path.join(dir, f)
    if (!fs.existsSync(full)) throw new Error(`找不到流水文件：${full}`)
    const text = decoder.decode(fs.readFileSync(full))
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^(\d{8})\s+(\d{2}:\d{2}:\d{2})\s+(收入|支出)\s+(-?[\d.]+)\s+([\d.]+)\s+(.*?)\s+人民币\s*$/)
      if (!m) continue
      rows.push({
        date: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`,
        time: m[2],
        kind: m[3],
        amount: round2(m[4]),
        balance: round2(m[5]),
        summary: m[6].trim()
      })
    }
  }
  rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const seen = new Set()
  for (const r of rows) {
    const k = `${r.date}|${r.time}|${r.amount}|${r.balance}|${r.summary}`
    if (seen.has(k)) throw new Error(`流水重复：${k}`)
    seen.add(k)
  }
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
    const fee = side === 'buy'
      ? round2(Math.abs(row.amount) - gross)
      : round2(gross - row.amount)
    if (fee < 0) throw new Error(`费用为负：${s}`)
    return { kind: 'trade', side, stockCode: trade[3], stockName: trade[2].trim(), quantity, price, gross, fee, cash: row.amount }
  }
  if (s.includes('转帐转入')) return { kind: 'transfer_in' }
  if (s.includes('转帐转出')) return { kind: 'transfer_out' }
  if (s.includes('红利差别税')) return { kind: 'dividend_tax', stockCode: /证券代码:(\d{6})/.exec(s)?.[1] || '' }
  if (s.includes('红利到帐')) return { kind: 'dividend', stockCode: /(\d{6})红利到帐/.exec(s)?.[1] || '' }
  if (s.includes('领') && s.includes('红利')) return { kind: 'dividend', stockCode: /领(\d{6})红利/.exec(s)?.[1] || '' }
  if (s.includes('结息')) return { kind: 'interest' }
  throw new Error(`无法识别的流水：${s}`)
}

/* ========== 基础数据 ========== */
function buildNameMap(events) {
  const map = Object.fromEntries(FINAL_HOLDINGS.map(h => [h.stock_code, h.stock_name]))
  for (const e of events) if (e.stockCode && e.stockName) map[e.stockCode] = e.stockName
  return map
}

function inferOpeningPositions(transactions, date) {
  const pos = Object.fromEntries(FINAL_HOLDINGS.map(h => [h.stock_code, h.quantity]))
  for (const tx of transactions.filter(t => t.trade_date > date).sort((a, b) => b.trade_date.localeCompare(a.trade_date))) {
    pos[tx.stock_code] = (pos[tx.stock_code] || 0) + (tx.type === 'buy' ? -tx.quantity : tx.quantity)
  }
  for (const [code, qty] of Object.entries(pos)) {
    if (qty < 0) throw new Error(`倒推持仓为负：${code} ${qty}`)
  }
  return Object.entries(pos).filter(([, qty]) => qty > 0)
    .map(([stockCode, quantity]) => ({ stockCode, quantity }))
    .sort((a, b) => a.stockCode.localeCompare(b.stockCode))
}

async function fetchClose(code, date) {
  const sym = /^[569]/.test(code) ? `sh${code}` : `sz${code}`
  const endpoint = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=400`
  try {
    const res = await fetch(endpoint, { headers: { Referer: 'https://finance.sina.com.cn/' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const bars = await res.json()
    const bar = bars.filter(b => b.day && b.day <= date).sort((a, b) => a.day.localeCompare(b.day)).at(-1)
    if (!bar) throw new Error('无行情')
    return { priceDate: bar.day, close: Number(bar.close) }
  } catch (e) {
    if (date === '2026-01-05' && FALLBACK_BASE_PRICES[code]) {
      console.warn(`  行情失败，使用 2026-01-05 备用收盘价 ${code} ${FALLBACK_BASE_PRICES[code]}（${e.message}）`)
      return { priceDate: date, close: FALLBACK_BASE_PRICES[code] }
    }
    throw new Error(`取 ${code} ${date} 收盘价失败：${e.message}`)
  }
}

/* ========== 构建写入行 ========== */
async function build() {
  const rows = parseRows()
  if (rows.length !== EXPECTED.rows) throw new Error(`流水行数 ${rows.length}，预期 ${EXPECTED.rows}`)
  if (baseDate >= rows[0].date) throw new Error(`基准日 ${baseDate} 必须早于第一笔流水 ${rows[0].date}`)

  const openingCash = round2(rows[0].balance - rows[0].amount)
  const finalCash = rows.at(-1).balance
  if (Math.abs(openingCash - EXPECTED.openingCash) > 0.001) throw new Error(`期初现金 ${openingCash} ≠ ${EXPECTED.openingCash}`)
  if (Math.abs(finalCash - EXPECTED.finalCash) > 0.001) throw new Error(`期末现金 ${finalCash} ≠ ${EXPECTED.finalCash}`)

  const events = rows.map(r => ({ ...r, ...classify(r) }))
  const nameMap = buildNameMap(events)
  const realTransactions = events.filter(e => e.kind === 'trade').map(e => ({
    stock_code: e.stockCode,
    stock_name: e.stockName || nameMap[e.stockCode] || e.stockCode,
    type: e.side,
    quantity: e.quantity,
    price: e.price,
    amount: e.gross,
    fee: e.fee,
    trade_date: e.date,
    note: `券商导入：${e.side === 'buy' ? '买入' : '卖出'} ${e.stockCode}`,
    created_by: 'solo',
    created_at: `${e.date}T${e.time}+08:00`,
    updated_at: `${e.date}T${e.time}+08:00`
  }))

  const opening = inferOpeningPositions(realTransactions, baseDate)
  const prices = []
  for (const item of opening) {
    const p = await fetchClose(item.stockCode, baseDate)
    if (p.priceDate !== baseDate) throw new Error(`${item.stockCode} 基准日 ${baseDate} 非交易日（最近收盘 ${p.priceDate}），请换一个交易日`)
    prices.push({ ...item, stockName: nameMap[item.stockCode] || item.stockCode, close: p.close, marketValue: round2(item.quantity * p.close) })
  }
  const openingMv = round2(prices.reduce((s, p) => s + p.marketValue, 0))
  const openingCapital = round2(openingCash + openingMv)
  if (Math.abs(openingMv - 48091) > 0.001) throw new Error(`期初市值 ${openingMv} ≠ 48091`)
  if (Math.abs(openingCapital - EXPECTED.openingCapital) > 0.001) throw new Error(`期初资本 ${openingCapital} ≠ ${EXPECTED.openingCapital}`)

  const createdAt = `${baseDate}T00:00:00+08:00`
  const transactions = []
  const tradeLogs = []

  // 4 笔期初建仓
  for (const p of prices) {
    transactions.push({
      stock_code: p.stockCode,
      stock_name: p.stockName,
      type: 'buy',
      quantity: p.quantity,
      price: p.close,
      amount: p.marketValue,
      fee: 0,
      trade_date: baseDate,
      note: `期初建仓（${baseDate} 收盘价）`,
      created_by: 'solo',
      created_at: createdAt,
      updated_at: createdAt
    })
    tradeLogs.push({
      type: 'remove', amount: p.marketValue, category: 'trade',
      note: `买入 ${p.stockCode}`, created_by: 'solo', created_at: createdAt, source_tx_id: null
    })
  }

  // 55 笔真实交易
  for (const e of events.filter(e => e.kind === 'trade')) {
    const ts = `${e.date}T${e.time}+08:00`
    transactions.push({
      stock_code: e.stockCode,
      stock_name: e.stockName || nameMap[e.stockCode] || e.stockCode,
      type: e.side,
      quantity: e.quantity,
      price: e.price,
      amount: e.gross,
      fee: e.fee,
      trade_date: e.date,
      note: `券商导入：${e.side === 'buy' ? '买入' : '卖出'} ${e.stockCode}`,
      created_by: 'solo',
      created_at: ts,
      updated_at: ts
    })
    tradeLogs.push({
      type: e.side === 'buy' ? 'remove' : 'add',
      amount: Math.abs(e.cash),
      category: 'trade',
      note: `${e.side === 'buy' ? '买入' : '卖出'} ${e.stockCode}`,
      created_by: 'solo',
      created_at: ts,
      source_tx_id: null
    })
  }

  // 期初资本 + 银证转账 + 红利/利息/税
  const capitalLogs = [{
    type: 'add', amount: openingCapital, category: 'capital',
    note: `期初结转（现金+期初持仓，${baseDate}）`, created_by: 'solo',
    created_at: createdAt, source_tx_id: null
  }]
  capitalLogs.push(...tradeLogs)

  for (const e of events.filter(e => e.kind === 'transfer_in' || e.kind === 'transfer_out')) {
    capitalLogs.push({
      type: e.kind === 'transfer_in' ? 'add' : 'remove',
      amount: Math.abs(e.amount),
      category: 'capital',
      note: e.kind === 'transfer_in' ? '银证转入' : '银证转出',
      created_by: 'solo',
      created_at: `${e.date}T${e.time}+08:00`,
      source_tx_id: null
    })
  }

  for (const e of events.filter(e => ['dividend', 'interest', 'dividend_tax'].includes(e.kind))) {
    const item = {
      category: e.kind === 'dividend' ? 'stock_dividend' : e.kind === 'interest' ? 'interest' : 'dividend_tax',
      stockName: e.stockCode ? (nameMap[e.stockCode] || '') : '',
      stockCode: e.stockCode || '',
      signedAmount: Math.round(e.amount * 100)
    }
    capitalLogs.push({
      type: e.amount >= 0 ? 'add' : 'remove',
      amount: Math.abs(e.amount),
      category: 'adjust',
      note: serializeAdjustNote({ version: 1, note: '券商流水导入', items: [item] }),
      created_by: 'solo',
      created_at: `${e.date}T${e.time}+08:00`,
      source_tx_id: null
    })
  }

  capitalLogs.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const capitalSum = round2(capitalLogs.filter(l => l.category === 'capital').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
  const adjustNet = round2(capitalLogs.filter(l => l.category === 'adjust').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
  const tradeNet = round2(capitalLogs.filter(l => l.category === 'trade').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
  const computedCash = round2(capitalSum + adjustNet + tradeNet)
  const totalCost = round2(FINAL_HOLDINGS.reduce((s, h) => s + h.quantity * h.cost_price, 0))
  if (Math.abs(computedCash - EXPECTED.finalCash) > 0.001) throw new Error(`计算期末现金 ${computedCash} ≠ ${EXPECTED.finalCash}`)
  if (Math.abs(capitalSum - EXPECTED.totalCapital) > 0.001) throw new Error(`累计投入 ${capitalSum} ≠ ${EXPECTED.totalCapital}`)
  if (Math.abs(totalCost - EXPECTED.totalCost) > 0.001) throw new Error(`持仓成本 ${totalCost} ≠ ${EXPECTED.totalCost}`)

  return {
    rows, events, openingCash, finalCash, prices, openingMv, openingCapital,
    transactions, capitalLogs, capitalSum, adjustNet, tradeNet, computedCash, totalCost
  }
}

/* ========== Supabase REST ========== */
async function api(pathname, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function resetTables() {
  console.log('清空 solo_capital_log / solo_transactions / solo_holdings …')
  await api('solo_capital_log?id=gt.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  await api('solo_transactions?id=gt.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  await api('solo_holdings?stock_code=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  const snaps = await api('solo_app_config?select=key&key=like.pos_snap%3A*')
  for (const s of snaps || []) {
    await api(`solo_app_config?key=eq.${encodeURIComponent(s.key)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  }
  console.log(`已删除 pos_snap ${snaps?.length || 0} 条`)
}

async function writeAll(data) {
  if (reset) await resetTables()

  console.log('写入 5 条持仓 …')
  await api('solo_holdings', {
    method: 'POST',
    body: FINAL_HOLDINGS,
    headers: { Prefer: 'return=representation' }
  })

  console.log(`写入 ${data.transactions.length} 笔交易 …`)
  const tradeLogs = data.capitalLogs.filter(l => l.category === 'trade')
  // 按 note + created_at 分组，组内按实际现金流金额匹配；同 note 多笔时消费后移除。
  const logsByKey = new Map()
  for (const log of tradeLogs) {
    const k = `${log.note}|${log.created_at}`
    if (!logsByKey.has(k)) logsByKey.set(k, [])
    logsByKey.get(k).push(log)
  }
  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i]
    const inserted = await api('solo_transactions', {
      method: 'POST',
      body: tx,
      headers: { Prefer: 'return=representation' }
    })
    const id = inserted[0].id
    const side = tx.type === 'buy' ? '买入' : '卖出'
    const expected = tx.note.startsWith('期初建仓')
      ? tx.amount
      : tx.type === 'buy' ? round2(tx.amount + tx.fee) : round2(tx.amount - tx.fee)
    const k = `${side} ${tx.stock_code}|${tx.created_at}`
    const candidates = logsByKey.get(k) || []
    const idx = candidates.findIndex(l => Math.abs(l.amount - expected) < 0.001)
    if (idx < 0) throw new Error(`找不到交易对应流水：${k}，期望金额 ${expected}`)
    const [log] = candidates.splice(idx, 1)
    log.source_tx_id = id
    if (i % 10 === 9) console.log(`  已写入 ${i + 1}/${data.transactions.length}`)
  }

  console.log(`写入 ${data.capitalLogs.length} 条资金流水 …`)
  for (let i = 0; i < data.capitalLogs.length; i += 50) {
    await api('solo_capital_log', {
      method: 'POST',
      body: data.capitalLogs.slice(i, i + 50),
      headers: { Prefer: 'return=minimal' }
    })
  }
  console.log('写入完成。')
}

/* ========== 主流程 ========== */
const data = await build()

console.log('\n===== 券商数据导入清单 =====')
console.log(`流水文件：${FILES.join(', ')}（${data.rows.length} 行，${data.rows[0].date}～${data.rows.at(-1).date}）`)
console.log(`基准日：${baseDate}`)
console.log(`期初现金：${data.openingCash.toFixed(2)}`)
console.log('期初持仓：')
for (const p of data.prices) console.log(`  ${p.stockCode} ${p.stockName}  ${p.quantity} 股 × ${p.close} = ${p.marketValue.toFixed(2)}`)
console.log(`期初市值：${data.openingMv.toFixed(2)}；期初总资产/基准资本：${data.openingCapital.toFixed(2)}`)
console.log(`期初建仓交易：${data.prices.length} 笔；真实交易：${data.transactions.length - data.prices.length} 笔；合计 ${data.transactions.length} 笔`)
console.log(`资金流水：${data.capitalLogs.length} 条（capital ${data.capitalLogs.filter(l => l.category === 'capital').length} / trade ${data.capitalLogs.filter(l => l.category === 'trade').length} / adjust ${data.capitalLogs.filter(l => l.category === 'adjust').length}）`)
console.log(`累计投入：${data.capitalSum.toFixed(2)}；调整净额：${data.adjustNet.toFixed(2)}；买卖净额：${data.tradeNet.toFixed(2)}`)
console.log(`计算期末现金：${data.computedCash.toFixed(2)}（券商 ${data.finalCash.toFixed(2)}）`)
console.log(`期末持仓成本：${data.totalCost.toFixed(2)}`)
console.log('\n样例交易：')
for (const tx of data.transactions.slice(0, 3)) console.log(' ', JSON.stringify(tx))
console.log('样例流水：')
for (const log of data.capitalLogs.slice(0, 3)) console.log(' ', JSON.stringify(log))

if (!write) {
  console.log('\n[dry-run] 未写库。确认后执行：node scripts/import-broker.mjs --write --reset')
  process.exit(0)
}

await writeAll(data)
