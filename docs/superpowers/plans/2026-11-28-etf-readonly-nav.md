# ETF-Solo 只读自动读取 ETF 金枪不倒净值 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 ETF-Solo 通过 mqdx 的只读 RPC 自动读取 ETF 的 `pos_snap`（日期 + 资产），失败时回退静态 JSON。

**Architecture:** 在 ETF（mqdx）建 `get_etf_pos_snaps()` 只读 RPC；ETF-Solo 运行时调用该 RPC，按 `asset / 848405` 归一化后交给现有图表，失败回退 `public/compare/etf_jinqiang.json`。单向只读，不写 mqdx。

**Tech Stack:** PostgreSQL 17 / Supabase PostgREST、Vue 3、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-11-28-etf-readonly-nav-design.md`

## Global Constraints

- 只读：不向 mqdx 写任何数据；RPC 仅 `grant execute to anon`，无 insert/update/delete 授权。
- 只暴露 `pos_snap` 的 `date` 与 `asset`；不得返回 `password_hash`、`pool_amounts`、交易、资金。
- 归一化基准：`ETF_NAV_BASE_DATE = '2026-07-29'`、`ETF_NAV_BASE_ASSET = 848405`。
- 回退：RPC 未配置、失败、空数据时，必须回退现有静态 JSON，图表不得空白。
- 版本：`package.json` 与 `src/pages/SettingsPage.vue` 同步升 **1.5.0**。
- 最小动刀：只改本计划列出的文件；不重构无关代码。
- 环境变量名固定：`VITE_ETF_SUPABASE_URL`、`VITE_ETF_SUPABASE_ANON_KEY`。

## Review Focus

- 非数组/缺字段/`asset` 为 0 或非数字：`mapEtfPosSnaps` 应过滤而不是抛错。
- `asset` 以字符串或数字返回：`Number()` 后应得到相同净值。
- 日期早于 `2026-07-29`：应被过滤。
- ETF 环境变量缺失或 RPC 返回非 2xx / 网络异常：应静默回退静态 JSON。
- RPC 返回空数组：应回退，不能显示空图例。

---

### Task 1: 在 mqdx 建立只读 RPC 并验证

**Files:**
- Create: `D:\Projects\ETF\supabase\create_pos_snaps_rpc.sql`
- Modify: mqdx 数据库（通过 Supabase MCP `apply_migration`）

**Interfaces:**
- Produces: `public.get_etf_pos_snaps()` → `table(date text, asset numeric)`，只读，`anon` 可执行。

- [ ] **Step 1: 写迁移 SQL 文件**

创建 `D:\Projects\ETF\supabase\create_pos_snaps_rpc.sql`：

```sql
-- 只读 RPC：仅返回 ETF 仓位快照的日期与资产，供 ETF-Solo 单向读取
create or replace function public.get_etf_pos_snaps()
returns table (date text, asset numeric)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select
    replace(a.key, 'pos_snap:', '') as date,
    (a.value::jsonb ->> 'asset')::numeric as asset
  from app_config a
  where a.key like 'pos_snap:%'
    and case
      when pg_input_is_valid(a.value, 'jsonb')
        then (a.value::jsonb ->> 'asset') ~ '^[0-9]+(\.[0-9]+)?$'
      else false
    end
  order by a.key;
end;
$$;

revoke all on function public.get_etf_pos_snaps() from public, anon, authenticated;
grant execute on function public.get_etf_pos_snaps() to anon;
```

- [ ] **Step 2: 应用迁移到 mqdx**

通过 Supabase MCP 对 mqdx 项目执行 `apply_migration`，`name` 用 `create_etf_pos_snaps_readonly_rpc`，`query` 为上面的 SQL。

- [ ] **Step 3: 用 ETF anon key 验证返回**

在 PowerShell 执行（从 ETF 本地环境读取 URL/key，避免打印密钥）：

```powershell
$lines = Get-Content "D:\Projects\ETF\src\.env"
$url = ($lines | Where-Object { $_ -match '^VITE_SUPABASE_URL=' }) -replace '^VITE_SUPABASE_URL=',''
$key = ($lines | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' }) -replace '^VITE_SUPABASE_ANON_KEY=',''
$resp = curl.exe -s -X POST "$url/rest/v1/rpc/get_etf_pos_snaps" -H "apikey: $key" -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d "{}"
$resp | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const a=JSON.parse(s);console.log('rows',a.length,'first',JSON.stringify(a[0]),'last',JSON.stringify(a.at(-1)));console.log('keys',Object.keys(a[0]||{}).join(','))})"
```

Expected: `rows 73`，`keys date,asset`，最后一条 `{"date":"2026-11-27","asset":787626}`（资产数值以当日实际为准）。

- [ ] **Step 4: 验证不能直读 app_config**

```powershell
curl.exe -s "$url/rest/v1/app_config?select=key&limit=1" -H "apikey: $key" -H "Authorization: Bearer $key"
```

Expected: `[]`（RLS 拦截 anon 直读）。

- [ ] **Step 5: 提交 SQL 到 ETF 仓库（仅本地提交，不推送）**

```bash
cd D:/Projects/ETF
git add supabase/create_pos_snaps_rpc.sql
git commit -m "feat: 新增只读 RPC get_etf_pos_snaps 供 ETF-Solo 读取"
```

---

### Task 2: 新增 `src/utils/etfNav.js` 与单测

**Files:**
- Create: `src/utils/etfNav.js`
- Test: `tests/etfNav.test.js`

**Interfaces:**
- Produces:
  - `ETF_NAV_BASE_DATE: string = '2026-07-29'`
  - `ETF_NAV_BASE_ASSET: number = 848405`
  - `mapEtfPosSnaps(rows: unknown): Array<{ date: string, nav: number }>`
  - `fetchEtfNav(opts?: { url?: string, key?: string, fetchImpl?: typeof fetch }): Promise<Array<{ date: string, nav: number }> | null>`

- [ ] **Step 1: 写失败测试**

创建 `tests/etfNav.test.js`：

```js
import { describe, it, expect, vi } from 'vitest'
import {
  ETF_NAV_BASE_DATE,
  ETF_NAV_BASE_ASSET,
  mapEtfPosSnaps,
  fetchEtfNav
} from '../src/utils/etfNav'

describe('etfNav 常量', () => {
  it('基准日期与基准资产与 ETF 口径一致', () => {
    expect(ETF_NAV_BASE_DATE).toBe('2026-07-29')
    expect(ETF_NAV_BASE_ASSET).toBe(848405)
  })
})

describe('mapEtfPosSnaps', () => {
  it('过滤基准日之前与非正资产', () => {
    const out = mapEtfPosSnaps([
      { date: '2026-07-28', asset: 900000 },
      { date: '2026-07-29', asset: 848405 },
      { date: '2026-08-01', asset: 0 },
      { date: '2026-08-02', asset: -1 }
    ])
    expect(out.map(p => p.date)).toEqual(['2026-07-29'])
  })

  it('按 asset/848405 归一化并按日期升序', () => {
    const out = mapEtfPosSnaps([
      { date: '2026-08-02', asset: 900000 },
      { date: '2026-07-29', asset: 848405 }
    ])
    expect(out).toEqual([
      { date: '2026-07-29', nav: 1 },
      { date: '2026-08-02', nav: 900000 / 848405 }
    ])
  })

  it('接受字符串 asset', () => {
    expect(mapEtfPosSnaps([{ date: '2026-07-29', asset: '848405' }])).toEqual([
      { date: '2026-07-29', nav: 1 }
    ])
  })

  it('非数组输入返回空数组', () => {
    expect(mapEtfPosSnaps(null)).toEqual([])
    expect(mapEtfPosSnaps({})).toEqual([])
  })
})

describe('fetchEtfNav', () => {
  it('缺少 url 或 key 时返回 null 且不发起请求', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchEtfNav({ url: '', key: 'k', fetchImpl })).toBeNull()
    expect(await fetchEtfNav({ url: 'https://x', key: '', fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POST RPC 并返回归一化后的点', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-07-29', asset: 848405 }]
    })
    const out = await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://x/rest/v1/rpc/get_etf_pos_snaps',
      expect.objectContaining({ method: 'POST' })
    )
    expect(out).toEqual([{ date: '2026-07-29', nav: 1 }])
  })

  it('非 2xx 返回 null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => [] })
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })

  it('网络异常返回 null', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })

  it('返回空数据时返回 null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    expect(await fetchEtfNav({ url: 'https://x', key: 'k', fetchImpl })).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/etfNav.test.js`
Expected: FAIL，提示无法从 `../src/utils/etfNav` 导入（模块不存在）。

- [ ] **Step 3: 实现 `src/utils/etfNav.js`**

```js
// src/utils/etfNav.js — ETF 金枪不倒净值（只读 RPC）
export const ETF_NAV_BASE_DATE = '2026-07-29'
export const ETF_NAV_BASE_ASSET = 848405

export function mapEtfPosSnaps(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => r && typeof r.date === 'string' && r.date >= ETF_NAV_BASE_DATE && Number(r.asset) > 0)
    .map(r => ({ date: r.date, nav: Number(r.asset) / ETF_NAV_BASE_ASSET }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchEtfNav({ url, key, fetchImpl = fetch } = {}) {
  if (!url || !key) return null
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/get_etf_pos_snaps`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    })
    if (!res.ok) return null
    const points = mapEtfPosSnaps(await res.json())
    return points.length ? points : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/etfNav.test.js`
Expected: PASS，全部用例通过。

- [ ] **Step 5: 提交**

```bash
git add src/utils/etfNav.js tests/etfNav.test.js
git commit -m "feat: 新增 ETF 只读净值抓取与归一化工具"
```

---

### Task 3: `AccountNavChart.vue` 接入 RPC 并保留静态回退

**Files:**
- Modify: `src/components/fund/AccountNavChart.vue`

**Interfaces:**
- Consumes: `fetchEtfNav({ url, key })`、`ETF_NAV_BASE_DATE`、`ETF_NAV_BASE_ASSET` from Task 2.

- [ ] **Step 1: 修改导入**

在 `AccountNavChart.vue` 的 `<script setup>` 顶部加入：

```js
import { fetchEtfNav } from '@/utils/etfNav'
```

- [ ] **Step 2: 抽出 ETF 数据加载函数**

在 `onMounted` 前加入：

```js
async function loadEtfPoints() {
  const base = import.meta.env.BASE_URL
  const live = await fetchEtfNav({
    url: import.meta.env.VITE_ETF_SUPABASE_URL,
    key: import.meta.env.VITE_ETF_SUPABASE_ANON_KEY
  })
  if (live) return live
  return fetch(`${base}compare/etf_jinqiang.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
}
```

- [ ] **Step 3: 替换 `onMounted` 中的 ETF 请求**

把原 `Promise.all` 中的静态 ETF 请求改为调用 `loadEtfPoints()`：

```js
const [snaps, etfRes, fundRes] = await Promise.all([
  fetchPositionSnapshots(500),
  loadEtfPoints(),
  fetch(`${base}compare/fund_027730.json?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
])
```

保持 `etf.value = Array.isArray(etfRes) ? etfRes : []` 不变。

- [ ] **Step 4: 运行全量测试**

Run: `npm test -- --run`
Expected: 全部测试通过，无新增失败。

- [ ] **Step 5: 提交**

```bash
git add src/components/fund/AccountNavChart.vue
git commit -m "feat: 净值对比优先读取 ETF 只读 RPC，失败回退静态 JSON"
```

---

### Task 4: 环境变量、部署工作流与版本号

**Files:**
- Modify: `.env`（本地，不提交）
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`
- Modify: `src/pages/SettingsPage.vue`

**Interfaces:**
- Consumes: `VITE_ETF_SUPABASE_URL`、`VITE_ETF_SUPABASE_ANON_KEY` used by Task 3.

- [ ] **Step 1: 本地 `.env` 增加两项**

在 `D:\Projects\ETF-Solo\.env` 追加（值为 ETF 项目实际 URL 与 anon key）：

```
VITE_ETF_SUPABASE_URL=https://mqdxmbsaddebxlallgos.supabase.co
VITE_ETF_SUPABASE_ANON_KEY=<ETF anon key>
```

- [ ] **Step 2: 部署工作流注入环境变量**

在 `.github/workflows/deploy.yml` 的 `npm run build` 的 `env:` 下增加：

```yaml
          VITE_ETF_SUPABASE_URL: ${{ secrets.ETF_SUPABASE_URL }}
          VITE_ETF_SUPABASE_ANON_KEY: ${{ secrets.ETF_SUPABASE_ANON_KEY }}
```

- [ ] **Step 3: 升版本到 1.5.0**

- `package.json`：`"version": "1.4.2"` → `"version": "1.5.0"`
- `src/pages/SettingsPage.vue`：`v1.4.2` → `v1.5.0`

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功；`dist/assets/*.js` 中存在 `mqdxmbsaddebxlallgos` 或 RPC 名称（证明环境变量已注入）。

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/deploy.yml package.json src/pages/SettingsPage.vue
git commit -m "feat: 接入 ETF 只读 RPC 配置并升版 1.5.0"
```

---

### Task 5: 端到端验证与部署

**Files:**
- No source changes.

**Interfaces:**
- Consumes: all previous tasks.

- [ ] **Step 1: 全量测试与构建**

Run: `npm test -- --run`
Run: `npm run build`
Expected: 均通过。

- [ ] **Step 2: 本地运行时验证**

Run: `npm run dev`（后台），打开净值页。
Expected: 图例「金枪不倒」显示「至 11/27」，净值 **0.9284**；浏览器 Network 中可见 `rpc/get_etf_pos_snaps` 请求 200。

- [ ] **Step 3: 回退验证**

临时清空 `VITE_ETF_SUPABASE_URL`（或断网），刷新页面。
Expected: 图表仍显示金枪不倒（来自静态 `etf_jinqiang.json`），无空白、无报错。

- [ ] **Step 4: 推送并部署**

```bash
git push origin main
```

- [ ] **Step 5: 线上核验**

待 GitHub Actions 完成后：

```bash
curl.exe -s "https://lvgzhy-phtonring.github.io/etf-solo/" | Select-String -Pattern "index-[A-Za-z0-9_-]+\.js"
```

Expected: 返回新入口文件名；页面可正常显示「至 11/27」。

- [ ] **Step 6: 记录到 FIX-NOTES（可选）**

在 `FIX-NOTES.md` 追加一条「ETF 金枪不倒改为只读 RPC 自动读取」，不提交到仓库则跳过。
