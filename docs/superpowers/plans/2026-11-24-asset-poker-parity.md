# 资产德州模块旧版一致性修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 ETF-Solo 资产德州页的日/周/月K线、逐笔明细、缺省场次筛选和红绿颜色与旧程序一致。

**Architecture:** 在资产德州工具中复刻旧程序周期键、标签和聚合缺省规则；图表按旧程序 180px 基准高度绘制，并保留旧版月度明细及全屏逐柱收支布局。以 `.asset-page` 隔离涨跌色样式，避免波及股票模块。

**Tech Stack:** Vue 3、Vitest、CSS、现有浏览器对照环境。

**Spec:** `docs/superpowers/specs/2026-11-24-asset-poker-parity-design.md`

## Global Constraints

- 以 `D:\Projects\my-assets\my_assets_v4.html` 德州模块为行为基准。
- 月K下方保留“月份→周汇总→逐笔流水”；全屏柱下显示收入/支出；不增加点柱弹窗。
- `dz_mode` 缺失/为空时按旧程序视作“线上”。
- 资产模块收入/正值红色、支出/负值绿色；不改变全局主题或股票模块。
- 旧程序周键结果须复刻，即使其边界受时区处理影响。

## Review Focus

- 空场次模式：线上默认统计该记录；见任务 1 测试。
- 周日与周一附近日期：周期键和日期范围必须遵循旧程序；见任务 1 测试。
- 零盈亏周期：按旧程序归为盈利周期且保留最小 2px 蜡烛；见任务 2 测试。
- 正负小额周期：蜡烛上下方向和影线/端帽必须正确；见任务 2 测试。
- 股票页面的 `.rise` / `.fall` 不得受资产颜色修复影响；见任务 3 浏览器检查。

---

### Task 1: 复刻德州筛选与周期口径

**Files:**
- Modify: `src/utils/assetPoker.js`
- Modify: `src/pages/asset/AssetPokerPage.vue`
- Test: `tests/assetPoker.test.js`

**Interfaces:**
- `pokerFlows(flows, filter)` 同时读取 `dz_mode` / `dzMode`；缺失模式按“线上”处理。
- 增加旧版等价的德州日期标签函数 `pokerDayLabel(dateStr)`、`pokerWeekLabel(weekKey)`；页面月K分组与周K/日K标签使用德州专用函数；不改变通用账本 `weekKey()`。

- [ ] **Step 1: Write failing tests**
  - 无 `dz_mode` 的德州记录在“线上”筛选时保留，在“线下”筛选时排除。
  - `dzMode` 旧字段也按相同规则处理。
  - 测试中临时调整并恢复 Node `TZ`；以旧版 `new Date(dateStr)` + `toISOString().slice(0, 10)` 算法断言周日 `2026-11-22` 在 `Asia/Shanghai` 的周键为 `2026-11-15`、标签为 `11/15-11/21`，并断言日K compact label 也跟随浏览器本地日期解析。
- [ ] **Step 2: Run the focused tests**
  - Run: `npm test -- tests/assetPoker.test.js`
  - Expected: 新增用例因筛选缺省值/周键不一致而失败。
- [ ] **Step 3: Implement the legacy-compatible helpers**
  - 仅在 `assetPoker.js` 添加德州专用周键和周标签；保持 `assetLedger.js` 的正确周一起始逻辑不变。
  - `AssetPokerPage.vue` 的月K明细分组与周K标签改用新 helper。
- [ ] **Step 4: Re-run focused tests**
  - Run: `npm test -- tests/assetPoker.test.js`
  - Expected: 全部通过。

### Task 2: 复刻旧版K线几何

**Files:**
- Modify: `src/utils/assetPoker.js`
- Modify: `src/components/asset/PokerChart.vue`
- Modify: `src/pages/asset/AssetPokerPage.vue`
- Test: `tests/assetPokerChart.test.js`

**Interfaces:**
- `pokerChart(bars)` 提供每周期净盈亏方向、180px 基准绘图区中的像素高度，以及旧版 25% 余量计算所需数据。
- `PokerChart.vue` 复用 Task 1 导出的 `pokerDayLabel(dateStr)` / `pokerWeekLabel(weekKey)` 绘制日/周标签，并用几何数据绘制蜡烛、影线及旧版屏幕/全屏尺寸。

- [ ] **Step 1: Write failing geometry tests**
  - 以旧版 `chartHeight=180`、`halfRange=maxAbs*1.25`、`pxPerUnit=chartHeight/(halfRange*2)` 断言正负柱高度。
  - 断言 `candleH=max(2, abs(net)*pxPerUnit)`、`wickH=min(candleH*0.3, 4)`；零值归入正方向；正柱影线在柱体上方并在零轴端有2px端帽，负柱影线在柱体下方并在零轴端有2px端帽。
- [ ] **Step 2: Run focused tests**
  - Run: `npm test -- tests/assetPokerChart.test.js`
  - Expected: 当前仅有 `heightPct` 的实现无法满足像素高度断言。
- [ ] **Step 3: Implement source-matched geometry and layout**
  - 普通图表恢复 200px 图表高度与 180px 蜡烛坐标区；零轴固定在坐标区中点，蜡烛高度、影线长度/方向和端帽按上方公式绘制。
  - 全屏复刻旧版：竖屏 172px 图表、6px 蜡烛/1px 影线；横屏图表高度 `calc(100dvh - 120px)` 且最小 200px、28px 蜡烛/4px 影线，柱体坐标仍按旧版 180px 数据坐标绘制。
  - 保留全屏柱下“收/支”明细和旧版标签/数值字号；全屏将标题、汇总统计、关闭按钮排在同一标题栏，K线区域不重复显示汇总。
- [ ] **Step 4: Re-run focused tests**
  - Run: `npm test -- tests/assetPokerChart.test.js`
  - Expected: 全部通过。

### Task 3: 恢复资产模块红绿方向并做截图复核

**Files:**
- Modify: `src/assets/styles/global.css`
- Modify: `src/pages/asset/AssetLedgerPage.vue`
- Modify: `src/pages/asset/AssetStatsPage.vue`
- Modify: `src/pages/asset/AssetPokerPage.vue`
- Verify: `src/pages/asset/AssetOverviewPage.vue` 已有 `asset-page` 根类；不改股票页面。

- [ ] **Step 1: Add asset-only rise/fall rules**
  - 在 `global.css` 添加 `.asset-page .rise` 红色、`.asset-page .fall` 绿色规则。
  - 为账本、统计、德州根元素添加 `asset-page`，概览根类保持原样。
- [ ] **Step 2: Run full automated verification**
  - Run: `npm test`
  - Expected: 全部测试通过。
  - Run: `npm run build`
  - Expected: Vite build 成功。
- [ ] **Step 3: Compare old/new screenshots using same data**
  - 月K主页面：核对 9 根月K、三项总汇、月→周→逐笔明细和红绿方向。
  - 月K全屏：核对 9 柱、场均/盈亏次数、逐柱收入/支出明细及柱体几何。
  - 确认股票页面涨跌颜色未变化。
- [ ] **Step 4: Report verification**
  - 总结源码/截图差异与测试结果；未经用户另行授权不推送部署。
- [ ] **Step 5: Commit the verified change on this isolated branch**
  - Include implementation, regression tests and this plan/spec; do not push or merge.
