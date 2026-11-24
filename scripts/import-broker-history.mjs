// scripts/import-broker-history.mjs — 导入 2024-01-05～2025-12-22 历史流水
//
// 规则（陛下 2026-11-24 批准）：
//   - 只导历史交易 + 红利/利息/税；不导历史银证转账
//   - 删除 2026-01-05 的 4 笔“期初建仓”合成买入，改由真实历史交易解释
//   - 一笔 trade 冲销 -31,110.18（替代合成买入与历史交易净现金流之差）
//   - 一笔 adjust 冲销 -1,265.34（抵消历史红利/利息/税净额）
//   - 保持：期末可用 36,408.03、累计投入 142,955.55、净值 0.9097
//   - 五粮液 200 股期初不补，不进入已清仓榜单
//
// 用法：
//   node scripts/import-broker-history.mjs --dry-run
//   node scripts/import-broker-history.mjs --write
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serializeAdjustNote } from '../src/utils/adjustItems.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = [path.join(root, '.env'), path.join(root, 'src/.env')].find(p => fs.existsSync(p))
const envText = fs.readFileSync(envPath, 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
if (!url || !key) { console.error('缺少 Supabase 配置'); process.exit(1) }

const args = process.argv.slice(2)
const write = args.includes('--write') && !args.includes('--dry-run')
const dir = process.env.HISTORY_DIR || 'C:/Users/ll_gg/Documents'
const files = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '.txt')
const MARKER = 'broker_history_import:2024-2025'
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const decoder = new TextDecoder('gb18030')

const EXPECT = {
  transactions: 98,
  capitalLogs: 134,
  capital: 142955.55,
  adjust: 475.36,
  trade: -107022.88,
  available: 36408.03,
  historyTrades: 43,
  historyAdjust: 20, // 5 红利 + 8 利息（跳过 2 笔 0 利息）+ 7 税
  syntheticBuys: 4,
  tradeOffset: 31110.18,
  adjustOffset: 1265.34
}

function parseFiles() {
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
  return rows
}

function normalizeName(name) {
  return String(name || '').replace(/\s+/g, '').trim()
}

function classify(row) {
  const s = row.summary
  const trade = s.match(/(买|卖)([^()]+?)\((\d{6})\)\s*(\d+)股\*([\d.]+)/)
  if (trade) {
    const side = trade[1] === '买' ? 'buy' : 'sell'
    const qty = Number(trade[4]), price = Number(trade[5])
    const gross = round2(qty * price)
    const fee = side === 'buy' ? round2(Math.abs(row.amount) - gross) : round2(gross - row.amount)
    return { kind: 'trade', side, stockCode: trade[3], stockName: normalizeName(trade[2]), qty, price, gross, fee, cash: row.amount }
  }
  if (s.includes('转帐转入') || s.includes('存管转帐转入')) return { kind: 'transfer_in' }
  if (s.includes('转帐转出') || s.includes('存管转帐转出')) return { kind: 'transfer_out' }
  if (s.includes('股息差别税') || s.includes('红利差别税')) return { kind: 'tax', stockCode: /证券(\d{6})/.exec(s)?.[1] || '' }
  if (s.includes('红利到帐')) return { kind: 'dividend', stockCode: /(\d{6})红利到帐/.exec(s)?.[1] || '' }
  if (s.includes('领') && s.includes('红利')) return { kind: 'dividend', stockCode: /领(\d{6})红利/.exec(s)?.[1] || '' }
  if (s.includes('结息') || s.includes('利息结转')) return { kind: 'interest' }
  return { kind: 'other' }
}

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

/* ========== 解析与构建 ========== */
const rows = parseFiles()
if (rows.length !== 68) throw new Error(`行数 ${rows.length}，预期 68`)
const openingCash = round2(rows[0].balance - rows[0].amount)
const lastBalance = rows.at(-1).balance
if (Math.abs(openingCash - 10580.03) > 0.001) throw new Error(`期初现金 ${openingCash} ≠ 10580.03`)
if (Math.abs(lastBalance - 44864.55) > 0.001) throw new Error(`末行余额 ${lastBalance} ≠ 44864.55`)

const events = rows.map(r => ({ ...r, ...classify(r) }))
const trades = events.filter(e => e.kind === 'trade')
const dividends = events.filter(e => e.kind === 'dividend')
const interests = events.filter(e => e.kind === 'interest' && Math.abs(e.amount) > 0.001)
const taxes = events.filter(e => e.kind === 'tax')
const transfers = events.filter(e => e.kind === 'transfer_in' || e.kind === 'transfer_out')
const others = events.filter(e => e.kind === 'other')
if (trades.length !== EXPECT.historyTrades) throw new Error(`历史交易 ${trades.length}，预期 43`)
if (dividends.length !== 5 || interests.length !== 8 || taxes.length !== 7) {
  throw new Error(`调整分类异常：红利 ${dividends.length} 利息 ${interests.length} 税 ${taxes.length}`)
}
if (transfers.length !== 3) throw new Error(`历史转账 ${transfers.length}，预期 3（本次不导入）`)
if (others.length) throw new Error(`未识别流水 ${others.length} 条`)

const nameByCode = Object.fromEntries(trades.map(t => [t.stockCode, t.stockName]))
const historyTradeNet = round2(trades.reduce((s, t) => s + t.cash, 0))
const historyAdjustNet = round2(
  dividends.reduce((s, e) => s + e.amount, 0) +
  interests.reduce((s, e) => s + e.amount, 0) +
  taxes.reduce((s, e) => s + e.amount, 0)
)
if (Math.abs(historyTradeNet - (-16980.82)) > 0.001) throw new Error(`历史交易净额 ${historyTradeNet} ≠ -16980.82`)
if (Math.abs(historyAdjustNet - EXPECT.adjustOffset) > 0.001) throw new Error(`历史调整净额 ${historyAdjustNet} ≠ 1265.34`)

const historicalTransactions = trades.map(t => ({
  stock_code: t.stockCode,
  stock_name: t.stockName,
  type: t.side,
  quantity: t.qty,
  price: t.price,
  amount: t.gross,
  fee: t.fee,
  trade_date: t.date,
  note: `券商历史导入：${t.side === 'buy' ? '买入' : '卖出'} ${t.stockCode}`,
  created_by: 'solo',
  created_at: `${t.date}T${t.time}+08:00`,
  updated_at: `${t.date}T${t.time}+08:00`
}))

const historicalTradeLogs = trades.map(t => ({
  type: t.side === 'buy' ? 'remove' : 'add',
  amount: Math.abs(t.cash),
  category: 'trade',
  note: `${t.side === 'buy' ? '买入' : '卖出'} ${t.stockCode}`,
  created_by: 'solo',
  created_at: `${t.date}T${t.time}+08:00`,
  source_tx_id: null
}))

const historicalAdjustLogs = []
for (const e of dividends) {
  historicalAdjustLogs.push({
    type: 'add', amount: e.amount, category: 'adjust',
    note: serializeAdjustNote({
      version: 1, note: '券商历史导入',
      items: [{ category: 'stock_dividend', stockName: nameByCode[e.stockCode] || '', stockCode: e.stockCode, signedAmount: Math.round(e.amount * 100) }]
    }),
    created_by: 'solo', created_at: `${e.date}T${e.time}+08:00`, source_tx_id: null
  })
}
for (const e of interests) {
  historicalAdjustLogs.push({
    type: 'add', amount: e.amount, category: 'adjust',
    note: serializeAdjustNote({
      version: 1, note: '券商历史导入',
      items: [{ category: 'interest', stockName: '', stockCode: '', signedAmount: Math.round(e.amount * 100) }]
    }),
    created_by: 'solo', created_at: `${e.date}T${e.time}+08:00`, source_tx_id: null
  })
}
for (const e of taxes) {
  historicalAdjustLogs.push({
    type: 'remove', amount: Math.abs(e.amount), category: 'adjust',
    note: serializeAdjustNote({
      version: 1, note: '券商历史导入',
      items: [{ category: 'dividend_tax', stockName: nameByCode[e.stockCode] || '', stockCode: e.stockCode, signedAmount: Math.round(e.amount * 100) }]
    }),
    created_by: 'solo', created_at: `${e.date}T${e.time}+08:00`, source_tx_id: null
  })
}
const offsetLogs = [
  { type: 'remove', amount: EXPECT.tradeOffset, category: 'trade', note: '历史期初结转', created_by: 'solo', created_at: '2024-01-05T00:00:00+08:00', source_tx_id: null },
  { type: 'remove', amount: EXPECT.adjustOffset, category: 'adjust', note: '历史调整结转', created_by: 'solo', created_at: '2024-01-05T00:00:00+08:00', source_tx_id: null }
]

console.log('===== 历史导入清单 =====')
console.log(`文件 ${files.join(', ')}；${rows.length} 行，${rows[0].date}～${rows.at(-1).date}`)
console.log(`期初现金 ${openingCash.toFixed(2)}；末行余额 ${lastBalance.toFixed(2)}`)
console.log(`交易 ${trades.length} 笔（净现金 ${historyTradeNet.toFixed(2)}）；红利 ${dividends.length}；利息 ${interests.length}（跳过 ${events.filter(e => e.kind === 'interest' && Math.abs(e.amount) <= 0.001).length} 笔 0 利息）；税 ${taxes.length}`)
console.log(`历史调整净额 ${historyAdjustNet.toFixed(2)}；历史转账 ${transfers.length} 笔（本次不导入）`)
console.log(`将删除 2026 期初合成买入 ${EXPECT.syntheticBuys} 笔 + 其 trade 流水`)
console.log(`冲销：trade -${EXPECT.tradeOffset.toFixed(2)}；adjust -${EXPECT.adjustOffset.toFixed(2)}`)
console.log(`预期写入：交易 ${EXPECT.transactions} 笔、资金流水 ${EXPECT.capitalLogs} 条`)
console.log(`预期口径：累计投入 ${EXPECT.capital.toFixed(2)}；调整净额 ${EXPECT.adjust.toFixed(2)}；买卖净额 ${EXPECT.trade.toFixed(2)}；可用 ${EXPECT.available.toFixed(2)}`)

if (!write) {
  console.log('\n[dry-run] 未写库。确认后执行：node scripts/import-broker-history.mjs --write')
  process.exit(0)
}

/* ========== 写库 ========== */
const [txs, logs, marker] = await Promise.all([
  api('solo_transactions?select=*&order=id&limit=1000'),
  api('solo_capital_log?select=*&order=id&limit=1000'),
  api(`solo_app_config?select=key,value&key=eq.${encodeURIComponent(MARKER)}`)
])
if (marker?.length) throw new Error(`已存在导入标记 ${MARKER}，拒绝重复导入`)
const synthetic = txs.filter(t => String(t.note || '').startsWith('期初建仓'))
if (txs.length !== 59 || logs.length !== 73) throw new Error(`现有数据不是 59 交易/73 流水（实际 ${txs.length}/${logs.length}），拒绝导入`)
if (synthetic.length !== EXPECT.syntheticBuys) throw new Error(`期初合成买入 ${synthetic.length}，预期 4`)

// 备份
const backupPath = path.join('C:/Users/ll_gg/AppData/Local/Temp/opencode', `solo-before-history-${Date.now()}.json`)
fs.writeFileSync(backupPath, JSON.stringify({ transactions: txs, capital_logs: logs }, null, 2))
console.log(`已备份到 ${backupPath}`)

const syntheticIds = synthetic.map(t => t.id)
const syntheticLogIds = logs.filter(l => syntheticIds.includes(l.source_tx_id)).map(l => l.id)
console.log(`删除合成交易 ${syntheticIds.length} 笔、流水 ${syntheticLogIds.length} 条 …`)
if (syntheticLogIds.length) await api(`solo_capital_log?id=in.(${syntheticLogIds.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
await api(`solo_transactions?id=in.(${syntheticIds.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })

console.log(`写入 ${historicalTransactions.length} 笔历史交易 …`)
for (let i = 0; i < historicalTransactions.length; i++) {
  const tx = historicalTransactions[i]
  const created = await api('solo_transactions', { method: 'POST', body: tx, headers: { Prefer: 'return=representation' } })
  historicalTradeLogs[i].source_tx_id = created[0].id
  if (i % 10 === 9) console.log(`  已写入 ${i + 1}/${historicalTransactions.length}`)
}

const allLogs = [...historicalTradeLogs, ...historicalAdjustLogs, ...offsetLogs]
console.log(`写入 ${allLogs.length} 条历史/冲销流水 …`)
for (let i = 0; i < allLogs.length; i += 50) {
  await api('solo_capital_log', { method: 'POST', body: allLogs.slice(i, i + 50), headers: { Prefer: 'return=minimal' } })
}

await api('solo_app_config', {
  method: 'POST',
  body: [{ key: MARKER, value: JSON.stringify({ version: 1, importedAt: new Date().toISOString(), trades: historicalTransactions.length, adjust: historicalAdjustLogs.length }) }],
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
})
console.log('写入完成，已设导入标记。')

/* ========== 写后核对 ========== */
const [postTxs, postLogs] = await Promise.all([
  api('solo_transactions?select=*&order=id&limit=1000'),
  api('solo_capital_log?select=*&order=id&limit=1000')
])
const capital = round2(postLogs.filter(l => l.category === 'capital').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
const adjust = round2(postLogs.filter(l => l.category === 'adjust').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
const trade = round2(postLogs.filter(l => l.category === 'trade').reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0))
const available = round2(capital + adjust + trade)
console.log('\n===== 写后核对 =====')
console.log(`交易 ${postTxs.length} / 预期 ${EXPECT.transactions}`)
console.log(`资金流水 ${postLogs.length} / 预期 ${EXPECT.capitalLogs}`)
console.log(`累计投入 ${capital.toFixed(2)} / 预期 ${EXPECT.capital.toFixed(2)}`)
console.log(`调整净额 ${adjust.toFixed(2)} / 预期 ${EXPECT.adjust.toFixed(2)}`)
console.log(`买卖净额 ${trade.toFixed(2)} / 预期 ${EXPECT.trade.toFixed(2)}`)
console.log(`可用资金 ${available.toFixed(2)} / 预期 ${EXPECT.available.toFixed(2)}`)
const ok = postTxs.length === EXPECT.transactions && postLogs.length === EXPECT.capitalLogs &&
  Math.abs(capital - EXPECT.capital) < 0.01 && Math.abs(adjust - EXPECT.adjust) < 0.01 &&
  Math.abs(trade - EXPECT.trade) < 0.01 && Math.abs(available - EXPECT.available) < 0.01
console.log(ok ? '全部通过' : '存在偏差！')
process.exit(ok ? 0 : 1)
