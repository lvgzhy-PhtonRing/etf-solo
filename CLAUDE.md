# 我的股票账本（ETF-Solo）— 项目指令

## 项目简介

单账户股票交易记录 SPA。与 D:\Projects\ETF（5 人合伙版）**完全独立**：代码、数据库、部署互不共享。无分池、无登录、无强制校对。

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Vue 3 (`<script setup>`) + Vant 4 + Pinia |
| 构建 | Vite 5 |
| 路由 | vue-router (Hash) |
| 数据库 | Supabase（goofish 项目 `efysjvbbaxwalhbbjxdc`，表前缀 `solo_`） |
| 部署 | GitHub Pages（私有仓库 `etf-solo`） |
| 行情 | Edge Function `stock-proxy` → 新浪 API |

## 核心规则

- **单账户**：不存在子池/分池概念，任何代码不得出现 pool 字段
- **交易即录即生效**：无 `status`/`actual_amount`，无校对步骤
- **capital_log 分类**：`capital`（外部入金/出金/初始）、`trade`（买卖现金流）、`adjust`（红利/利息/逆回购/税费，note 存分项 JSON）
- **资金口径**：`totalCapital = Σcapital`；`totalAvailable = Σcapital + Σadjust + Σtrade入 − Σtrade出`；`totalAsset = 市值 + totalAvailable`
- **调整无 UI**：红利/利息等由 AI 通过 `scripts/ledger-write.mjs` 直接写库
- **浅色主题**：米白暖色底（`--bg-page:#faf7f2`），涨红跌绿（`--color-rise:#d64545` / `--color-fall:#2e8b57`）
- **先升版后推送**：`package.json` 与 `SettingsPage.vue` 版本一致；bug 修复升小版，新功能升大版

## 关键路径

| 需求 | 位置 |
|------|------|
| 建表 SQL | `supabase/solo_init.sql` |
| 账号 API | `src/api/supabase.js` |
| 资金口径 | `src/stores/funds.js` |
| 盈亏榜单 | `src/utils/rankings.js` |
| 仓位快照 | `src/utils/positionSnapshot.js` |
| AI 写库脚本 | `scripts/ledger-write.mjs` |
| 部署说明 | `README-DEPLOY.md` |

## 构建

```bash
npm run dev      # 本地开发 0.0.0.0:5173
npm run build    # 生产构建
npm test         # vitest
```

## 安全

- `src/.env` 不入 git；anon key 可写全库（个人自用取舍）
- 禁止引用/写入 mqdx 项目（`mqdxmbsaddebxlallgos`），那是合伙版生产库；唯一例外：ETF-Solo 经只读 RPC `get_etf_pos_snaps` 单向读取金枪不倒仓位快照（spec 2026-11-28 授权），严禁任何写操作
