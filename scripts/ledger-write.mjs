// scripts/ledger-write.mjs — AI 写库脚本（资金流水）
// 用法：
//   node scripts/ledger-write.mjs --type add --amount 500000 --category capital --note 初始
//   node scripts/ledger-write.mjs --type add --amount 123.45 --category adjust --note '{"items":[...]}'
//   node scripts/ledger-write.mjs --type remove --amount 1000 --category capital --note 取现
//   --dry-run 只打印不写入
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envText = fs.readFileSync(path.join(root, 'src/.env'), 'utf8')
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
const note = arg('note', '')
const createdBy = arg('by', 'solo')

if (!['add', 'remove'].includes(type)) { console.error('--type 必须是 add 或 remove'); process.exit(1) }
if (!Number.isFinite(amount) || amount <= 0) { console.error('--amount 必须是正数'); process.exit(1) }
if (!['capital', 'trade', 'adjust'].includes(category)) { console.error('--category 必须是 capital/trade/adjust'); process.exit(1) }

const row = { type, amount: parseFloat(amount.toFixed(2)), category, note, created_by: createdBy }
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
