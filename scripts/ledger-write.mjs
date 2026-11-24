// scripts/ledger-write.mjs — AI 写库脚本（资金流水）
// 用法：
//   node scripts/ledger-write.mjs --type add --amount 500000 --category capital --note 初始
//   node scripts/ledger-write.mjs --type add --amount 123.45 --category adjust --note '{"items":[...]}'
//   node scripts/ledger-write.mjs --type remove --amount 1000 --category capital --note 取现
//   --dry-run 只打印不写入
//
// 红利分项（category=stock_dividend 且带 stockCode）会同步冲减持仓成本：
//   node scripts/ledger-write.mjs --type add --amount 468 --category adjust --note-file items.json
//   （PowerShell 直接传 JSON 容易丢引号，建议用 --note-file）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAdjustNote } from '../src/utils/adjustItems.js'
import { calcCostAfterDividend } from '../src/utils/calculators.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = [path.join(root, '.env'), path.join(root, 'src/.env')].find(p => fs.existsSync(p))
const envText = fs.readFileSync(envPath, 'utf8')
const url = envText.match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1].trim()
if (!url || !key) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（src/.env）')
  process.exit(1)
}

const args = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : fallback
}
const dryRun = args.includes('--dry-run')

const type = arg('type')
const amount = parseFloat(arg('amount'))
const category = arg('category', 'adjust')
const noteFile = arg('note-file')
const note = noteFile ? fs.readFileSync(path.resolve(noteFile), 'utf8') : arg('note', '')
const createdBy = arg('by', 'solo')

if (!['add', 'remove'].includes(type)) { console.error('--type 必须是 add 或 remove'); process.exit(1) }
if (!Number.isFinite(amount) || amount <= 0) { console.error('--amount 必须是正数'); process.exit(1) }
if (!['capital', 'trade', 'adjust'].includes(category)) { console.error('--category 必须是 capital/trade/adjust'); process.exit(1) }

const row = { type, amount: parseFloat(amount.toFixed(2)), category, note: normalizeNote(category, note), created_by: createdBy }

// 调整类流水统一存 [校对分项] JSON（UI 分类小计依赖该契约）
function normalizeNote(cat, text) {
  if (cat !== 'adjust') return text
  const trimmed = (text || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('[校对分项]')) return trimmed
  if (trimmed.startsWith('{')) return '[校对分项]' + trimmed
  return trimmed
}
if (dryRun) {
  console.log('[dry-run] 不写入：', JSON.stringify(row, null, 2))
  process.exit(0)
}

const res = await fetch(`${url}/rest/v1/solo_capital_log`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  },
  body: JSON.stringify(row)
})
if (!res.ok) {
  console.error('写入失败:', res.status, await res.text())
  process.exit(1)
}
const data = await res.json()
console.log('已写入 solo_capital_log：', JSON.stringify(data[0]))

// 红利冲减持仓成本：只认 stock_dividend 且带 stockCode 的分项
if (category === 'adjust') {
  const parsed = parseAdjustNote(row.note)
  const dividends = (parsed?.items || []).filter(it =>
    it.category === 'stock_dividend' && it.stockCode && (it.signedAmount || 0) > 0)
  for (const item of dividends) {
    const hRes = await fetch(`${url}/rest/v1/solo_holdings?select=stock_code,stock_name,quantity,cost_price&stock_code=eq.${item.stockCode}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
    if (!hRes.ok) {
      console.error(`读取持仓 ${item.stockCode} 失败:`, hRes.status, await hRes.text())
      process.exit(1)
    }
    const rows = await hRes.json()
    const h = rows[0]
    if (!h || !(h.quantity > 0)) {
      console.warn(`持仓 ${item.stockCode} 不存在或已清仓，跳过成本冲减`)
      continue
    }
    const newCost = calcCostAfterDividend(h.cost_price, h.quantity, item.signedAmount / 100)
    const pRes = await fetch(`${url}/rest/v1/solo_holdings?stock_code=eq.${item.stockCode}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        cost_price: parseFloat(newCost.toFixed(6)),
        updated_at: new Date().toISOString()
      })
    })
    if (!pRes.ok) {
      console.error(`更新持仓 ${item.stockCode} 成本失败:`, pRes.status, await pRes.text())
      process.exit(1)
    }
    console.log(`已同步 ${item.stockCode} 成本：${h.cost_price} → ${newCost.toFixed(6)}`)
  }
}
