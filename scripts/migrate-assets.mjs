// scripts/migrate-assets.mjs
// 把 my-assets 导出的 JSON 迁移到 goofish（asset_* 表）
// 用法：node scripts/migrate-assets.mjs <export.json> [--dry-run] [--skip-flows]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  for (const p of [path.join(root, '.env'), path.join(root, 'src', '.env')]) {
    if (!fs.existsSync(p)) continue
    const out = {}
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    if (out.VITE_SUPABASE_URL) return out
  }
  throw new Error('未找到 .env（需要 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）')
}

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')

if (!file) {
  console.error('用法：node scripts/migrate-assets.mjs <export.json> [--dry-run] [--skip-flows]')
  process.exit(1)
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
const parse = v => (typeof v === 'string' ? JSON.parse(v || 'null') : v)

const assets = parse(raw.assets) || {}
const logs = parse(raw.logs) || []
const snapshots = parse(raw.snapshots) || {}

const ACCOUNT_IDS = ['wx_lq', 'wx_lqt', 'wx_lct', 'ali_ye', 'ali_yeb', 'ali_ylb', 'ali_lc', 'bank_jt']
const ADJ_IDS = ['adj_lend', 'adj_shop', 'adj_family']

const num = v => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

const accountRows = ACCOUNT_IDS.map(id => ({ id, balance: num(assets[id]) }))
const adjRows = ADJ_IDS.map(id => ({ id, amount: num(assets[id]) }))

const flowRows = logs.map(l => ({
  date: l.date,
  type: l.type,
  category: l.category,
  amount: Math.round(Number(l.amount) * 100) / 100,
  note: l.title || null,
  account: l.account || null,
  dz_mode: l.dzMode || null
}))

console.log('=== 迁移预览 ===')
console.log('账户余额：', accountRows.map(r => `${r.id}=${r.balance}`).join(', '))
console.log('调整项：  ', adjRows.map(r => `${r.id}=${r.amount}`).join(', '))
console.log('流水条数：', flowRows.length)
console.log('快照日期：', Object.keys(snapshots).join(', ') || '(无)')
const wx = accountRows.filter(r => r.id.startsWith('wx')).reduce((s, r) => s + r.balance, 0)
const ali = accountRows.filter(r => r.id.startsWith('ali')).reduce((s, r) => s + r.balance, 0)
const bank = accountRows.filter(r => r.id.startsWith('bank')).reduce((s, r) => s + r.balance, 0)
console.log('零钱资产总计：', Math.round((wx + ali + bank) * 100) / 100)
const adj = adjRows.reduce((s, r) => s + r.amount * (r.id === 'adj_lend' ? 1 : -1), 0)
console.log('调整项合计：', Math.round(adj * 100) / 100)
console.log('实际可支配：', Math.round((wx + ali + bank + adj) * 100) / 100)

if (dryRun) {
  console.log('\n--dry-run：未写入数据库')
  process.exit(0)
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal'
}

async function req(pathname, init = {}) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers, ...init })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${pathname} → ${res.status} ${body.slice(0, 200)}`)
  }
  return res
}

// 1) 账户余额
for (const r of accountRows) {
  await req(`asset_accounts?id=eq.${r.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ balance: r.balance, updated_at: new Date().toISOString() })
  })
}
console.log('✅ 账户余额已写入')

// 2) 调整项
for (const r of adjRows) {
  await req(`asset_adjustments?id=eq.${r.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: r.amount })
  })
}
console.log('✅ 调整项已写入')

// 3) 流水（清空后批量插入）
if (!args.includes('--skip-flows')) {
  await req('asset_flows?id=gt.0', { method: 'DELETE' })
  for (let i = 0; i < flowRows.length; i += 100) {
    await req('asset_flows', { method: 'POST', body: JSON.stringify(flowRows.slice(i, i + 100)) })
  }
  console.log(`✅ 流水已写入 ${flowRows.length} 条`)
}

console.log('\n迁移完成。打开「资产 → 概览」核对数字。')
