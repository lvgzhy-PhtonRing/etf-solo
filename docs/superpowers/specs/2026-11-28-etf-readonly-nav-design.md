# ETF-Solo 只读自动读取 ETF 金枪不倒净值

## 意图与范围

让 ETF-Solo 直接、自动、只读地读取 ETF（mqdx 合伙版）的 `app_config` 仓位快照（`pos_snap:*`），替代目前「ETF 手动导出备份 → 放到 Downloads → 运行 `gen-nav-compare.mjs`」的人工流程。

大王陛下已明确授权：在 mqdx 新增一个只读接口，ETF-Solo 单向引用，不回写任何数据。

## 目标

- ETF-Solo 页面打开即读取 ETF 最新 `pos_snap` 的 `date` 与 `asset`，无需人工导出。
- ETF 侧只暴露 `pos_snap` 的日期与资产，不暴露 `password_hash`、交易、资金等其他数据。
- 接口只读：仅授予 `anon` 执行权限，不授予任何写权限。
- 接口不可用时，前端自动回退到现有静态 `public/compare/etf_jinqiang.json`。
- 保留现有图表的基准口径：`2026-07-29`、基准资产 `848405`。

## 非目标

- 不做 ETF-Solo → ETF 的任何写入。
- 不做 Realtime 订阅、不做定时任务、不做每日提交。
- 不改变账户净值、027730 基金数据的现有逻辑。
- 不调整图表 UI、配色、标签。

## 约束与取舍

- ETF-Solo 的 `CLAUDE.md` 原写「禁止引用/写入 mqdx」；本次为大王陛下明确授权的**单向只读**例外。
- 采用运行时直读而非 GitHub Action 定时同步：页面打开即最新、无每日提交；代价是 ETF anon key 会出现在前端。anon key 本就是公开键，且 RPC 仅返回日期+资产，风险可控。
- 不做额外缓存层：`pos_snap` 仅约 73 行，响应极小。

## 方案

### ETF 侧：只读 RPC

在 mqdx（`mqdxmbsaddebxlallgos`）新建 `public.get_etf_pos_snaps()`：

```sql
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

- `security definer` 使函数可读受 RLS 保护的 `app_config`，但函数体只筛选 `pos_snap:`。
- `pg_input_is_valid` 防非法 JSON 导致整条查询报错（mqdx 为 PG17）。
- 只 `grant execute to anon`，无任何 insert/update/delete 授权。
- 迁移文件同时落盘到 ETF 仓库 `supabase/create_pos_snaps_rpc.sql` 以便追溯。

### ETF-Solo 侧：运行时读取 + 静态回退

新增 `src/utils/etfNav.js`：

```js
export const ETF_NAV_BASE_DATE = '2026-07-29'
export const ETF_NAV_BASE_ASSET = 848405

// 过滤非法行，按 asset/848405 归一化，按日期升序
export function mapEtfPosSnaps(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(r => r && r.date >= ETF_NAV_BASE_DATE && Number(r.asset) > 0)
    .map(r => ({ date: r.date, nav: Number(r.asset) / ETF_NAV_BASE_ASSET }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

`src/components/fund/AccountNavChart.vue` 的 ETF 数据加载改为：

1. 若配置了 `VITE_ETF_SUPABASE_URL` 与 `VITE_ETF_SUPABASE_ANON_KEY`，`POST {url}/rest/v1/rpc/get_etf_pos_snaps`（带 `apikey` / `Authorization`，body `{}`）。
2. 成功且有数据 → `mapEtfPosSnaps(rows)`。
3. 任一步失败 → 回退现有 `fetch(\`${base}compare/etf_jinqiang.json?v=...\`)`。

## 环境变量与部署

本地根目录 `.env` 新增：

```
VITE_ETF_SUPABASE_URL=https://mqdxmbsaddebxlallgos.supabase.co
VITE_ETF_SUPABASE_ANON_KEY=<ETF anon key>
```

`.github/workflows/deploy.yml` 增加：

```yaml
VITE_ETF_SUPABASE_URL: ${{ secrets.ETF_SUPABASE_URL }}
VITE_ETF_SUPABASE_ANON_KEY: ${{ secrets.ETF_SUPABASE_ANON_KEY }}
```

仓库 Settings → Secrets 新增 `ETF_SUPABASE_URL`、`ETF_SUPABASE_ANON_KEY`。

## 安全

- 仅新增 `get_etf_pos_snaps` 一个只读 RPC；`app_config` 直接 `select` 仍受 RLS 拦截（要求 `authenticated`）。
- 返回值不含 `password_hash`、`pool_amounts`、交易、资金。
- ETF-Solo 不持有 service_role key，不写 mqdx。

## 验证

- RPC：用 ETF anon key 调用，返回 73 行，字段仅 `date`/`asset`，最新 `2026-11-27`。
- 单测：`mapEtfPosSnaps` 覆盖过滤、归一化、排序、空输入。
- 本地：`npm run dev` 打开净值页，图例显示「至 11/27」、净值 0.9284。
- 回退：临时清空 ETF 环境变量，图表仍从静态 JSON 正常显示。
- 构建：`npm run build` 通过；版本升 **1.5.0**（新功能）。

## 待实现

- ETF 侧 SQL 迁移（MCP `apply_migration` + ETF 仓库落盘）。
- `src/utils/etfNav.js` 与单测。
- `AccountNavChart.vue` 读取逻辑。
- `.env`、`.github/workflows/deploy.yml`、版本号。
