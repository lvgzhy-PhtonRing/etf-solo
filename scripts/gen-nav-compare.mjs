// scripts/gen-nav-compare.mjs — 生成净值对比静态数据
// 用法：node scripts/gen-nav-compare.mjs
// 输出：public/compare/etf_jinqiang.json、public/compare/fund_027730.json
// 数据源：ETF 备份 app_config 快照（金枪不倒）+ 东方财富 027730 净值
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/compare')
fs.mkdirSync(outDir, { recursive: true })

const ETF_BACKUP = process.argv.includes('--backup')
  ? process.argv[process.argv.indexOf('--backup') + 1]
  : 'D:/Projects/ETF/etf-backup-2026-11-19-merged-monthly.json'
const ETF_BASE_DATE = '2026-07-29'
const ETF_BASE_ASSET = 848405

// ===== ETF 金枪不倒：app_config pos_snap → asset / 848405 =====
const backup = JSON.parse(fs.readFileSync(ETF_BACKUP, 'utf8'))
const snaps = (backup.app_config || [])
  .filter(x => String(x.key || '').startsWith('pos_snap:'))
  .map(x => {
    const date = x.key.slice('pos_snap:'.length)
    let v = null
    try { v = JSON.parse(x.value) } catch {}
    return v && Number(v.asset) > 0 ? { date, asset: Number(v.asset) } : null
  })
  .filter(Boolean)
  .filter(x => x.date >= ETF_BASE_DATE)
  .sort((a, b) => a.date.localeCompare(b.date))

const etf = snaps.map(x => ({
  date: x.date,
  nav: Math.round((x.asset / ETF_BASE_ASSET) * 10000) / 10000
}))
fs.writeFileSync(path.join(outDir, 'etf_jinqiang.json'), JSON.stringify(etf, null, 2))
console.log(`ETF 金枪不倒：${etf.length} 条，${etf[0]?.date} → ${etf.at(-1)?.date}`)

// ===== 027730 沪深300增C：东方财富 pingzhongdata =====
const fundUrl = 'https://fund.eastmoney.com/pingzhongdata/027730.js'
const res = await fetch(fundUrl, { headers: { Referer: 'https://fund.eastmoney.com/' } })
if (!res.ok) throw new Error(`027730 抓取失败 ${res.status}`)
const text = await res.text()
const m = text.match(/Data_netWorthTrend\s*=\s*(\[.*?\]);/)
if (!m) throw new Error('027730 Data_netWorthTrend 未找到')
const trend = JSON.parse(m[1])
const fmt = ts => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(ts))
const fund = trend
  .map(p => ({ date: fmt(p.x), nav: Number(p.y) }))
  .filter(p => p.date >= ETF_BASE_DATE && Number.isFinite(p.nav) && p.nav > 0)
  .sort((a, b) => a.date.localeCompare(b.date))
fs.writeFileSync(path.join(outDir, 'fund_027730.json'), JSON.stringify(fund, null, 2))
console.log(`027730：${fund.length} 条，${fund[0]?.date} → ${fund.at(-1)?.date}`)
