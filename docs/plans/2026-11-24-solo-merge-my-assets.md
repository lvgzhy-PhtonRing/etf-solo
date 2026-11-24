# Solo 版（我的股票账本）合并 my-assets 两期计划

> 项目：`D:\Projects\ETF-Solo`（Solo 版单账户股票账本）
> 合并对象：`D:\Projects\my-assets\my_assets_v4.html` v0.42（资产账本 PRO）
> 线上：https://lvgzhy-phtonring.github.io/etf-solo/
> 数据库：Supabase goofish（`efysjvbbaxwalhbbjxdc`）
> 创建：2026-11-24

---

## 一、核心前提（陛下裁决，不得违反）

| # | 裁决 | 含义 |
|---|------|------|
| 1 | 股票现金/资产 与 my-assets **完全无关**，以后也无关联 | 两个独立账本共处一个 App；资产模块**不读**持仓/资金；股票模块**不读**资产数据；任何"总净值"都不跨模块相加 |
| 2 | 备份重新设计 | 原 `user_id` 登录云备份作废；采用**方案 A：仅本地快照 + 导出/导入** |
| 3 | 年 K 线只在 my-assets 德州 tab | Solo 版趋势页**没有** K 线（只有：本月盈亏 / 周盈亏 / 资产走势） |
| 4 | 分两期 | 第一期纯导航重构并上线；第二期资产功能 |

## 二、命名规则

> 两个程序本无关联，各自沿用原名，不做统一术语。底部 tab 用短名，页面标题用原程序全称。

| 大段 | 子 tab（短名） | 页面内标题 | 来源 |
|------|----------------|------------|------|
| **资产**（在前，默认） | 概览 | 资产概览 | my-assets |
| | 账本 | 收支账本（备注：实际出入帐记录） | my-assets |
| | 统计 | 统计报表（备注：按分类统计支出与收入） | my-assets |
| | 德州 | 德州战绩 | my-assets |
| **股票**（在后） | 持仓 | 持仓总览 | Solo 版 |
| | 仓位 | 仓位分析（下方：净值走势） | Solo 版 |
| | 趋势 | 趋势看板（下方：盈亏榜单） | Solo 版 |
| | 资本 | 资本管理 | Solo 版 |

页面内文案也沿用原文：
- 资产概览顶部大字：**「实际可支配 (元)」**
- 其下：**「总资产」**、**「调整项」**、**「零钱资产总计」**

## 三、导航架构

```
┌──────────────────────────────┐
│  [ 资产 ⏐ 股票 ]   ← 顶部大分段（常驻）  │
├──────────────────────────────┤
│        当前 tab 内容          │
├──────────────────────────────┤
│ 概览 账本 统计 德州   ← 底部子 tab      │
└──────────────────────────────┘
```

| 状态 | 底部子 tab | 默认落点 |
|------|-----------|----------|
| 资产 | 概览 · 账本 · 统计 · 德州 | 概览 |
| 股票 | 持仓 · 仓位 · 趋势 · 资本 | 持仓 |

**App 打开默认**：资产 / 概览。

### 路由设计

| 路由 | 页面 | 说明 |
|------|------|------|
| `/asset/overview` | 资产概览 | 默认入口 |
| `/asset/ledger` | 收支账本 | |
| `/asset/stats` | 统计报表 | |
| `/asset/poker` | 德州战绩 | |
| `/stock/holdings` | 持仓总览 | 原 `/dashboard` |
| `/stock/positions` | 仓位分析（含净值走势） | 原 `/positions` + `/netvalue` |
| `/stock/trends` | 趋势看板（含盈亏榜单） | 原 `/trend` + `/trends` |
| `/stock/capital` | 资本管理 | 原 `/fund` |

旧路由 `/dashboard`、`/positions`、`/netvalue`、`/trends`、`/trend`、`/fund` 全部重定向到新路由。

### 组件设计

| 文件 | 职责 |
|------|------|
| `src/components/common/TopSegment.vue` | 顶部「资产 ⏐ 股票」大分段 |
| `src/components/common/MainLayout.vue` | 底部子 nav，按当前大段渲染 4 项 |
| `src/router/index.js` | 两级路由 + 旧路由重定向 |
| `src/utils/nav.js` | 大段判定 / 默认页映射（纯函数，可测） |

## 四、第一期：导航重构（不含资产业务）

### T1 两级导航壳 + 路由重构

- 新建 `TopSegment.vue`，置于 `MainLayout` 顶部
- 改造 `MainLayout.vue`：底部 tab 由路由前缀决定渲染哪 4 项
- 路由重构为 `/asset/*` + `/stock/*`，旧路由重定向
- 默认 `/` → `/asset/overview`

**测试**：`src/utils/nav.js` 纯函数（`sectionOf(path)`、`tabsOf(section)`、`defaultPathOf(section)`）。

**验收**：375px 与桌面下切换正常，底部 4 项随段变化，刷新保持当前段。

### T2 仓位页合并净值

- `/stock/positions`：上=仓位分析原内容，下=`NavOverview` + `SoloNavChart`
- 整页竖向滚动，移动端优先
- `/netvalue` 重定向到 `/stock/positions`

**验收**：环形图与净值卡同页可滚动；375px 无横向溢出；净值数据与改前一致。

### T3 趋势页合并榜单

- `/stock/trends`：上=原趋势页 3 模块，下=原榜单页 3 块
- `/trend`、`/trends` 重定向到 `/stock/trends`

**验收**：4+3 模块依次排列，数据与改前一致。

### T4 资产态 4 个占位页

- `/asset/overview`、`/asset/ledger`、`/asset/stats`、`/asset/poker`
- 用现有 `EmptyState` 风格显示「建设中」

**验收**：4 个路由可访问，不报错，样式一致。

### T5 视觉验收 + 发布

- 375px：资产/股票切换、8 个 tab 逐一截图
- 桌面：同上
- 无深色残留、无对比度过低
- 版本升 `1.1.0`
- `npm test` + `npm run build` + 推送部署

## 五、第二期：资产功能接入

### T6 建表（goofish，浏览器会话执行）

> 完全独立于 `solo_*`，独立前缀避免误读。

```sql
CREATE TABLE IF NOT EXISTS asset_accounts (
  id          TEXT PRIMARY KEY,          -- wx_lq / wx_lqt / wx_lct / ali_ye / ali_yeb / ali_ylb / ali_lc / bank_jt
  group_name  TEXT NOT NULL,             -- wx / ali / bank
  label       TEXT NOT NULL,             -- 零钱 / 零钱通 / ...
  balance     NUMERIC(15,2) DEFAULT 0,
  sort        INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_flows (
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date        DATE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('expense','income')),
  category    TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_adjustments (
  id     TEXT PRIMARY KEY,               -- adj_lend / adj_shop / adj_family
  label  TEXT NOT NULL,
  amount NUMERIC(15,2) DEFAULT 0,
  sign   SMALLINT NOT NULL DEFAULT 1     -- +1 / -1
);
```

RLS：同 `solo_*` 模式（anon 全放行）。

### T7 资产-概览

- 3 组账户卡片（微信 / 支付宝 / 银行卡），每卡含输入框 + 小计
- 「零钱资产总计」绿色条
- 「调整项」橙卡：借出(+) / 闲鱼店(−) / 家庭(−)，含 ± 切换
- 「实际可支配 (元)」顶部大字 = 总计 + 调整
- 负数红字高亮
- 快照入口按钮（📋 快照回顾）
- 输入 debounce 300ms 写 DB

**验收**：8 个输入框修改后刷新不丢；四层数字与原程序一致；负数显示红色。

### T8 资产-账本

- 新增：类型（支出/收入）、分类、金额、备注、日期
- 列表：按月分组、组内按日期倒序
- 左滑编辑/删除
- 视图切换：按月 / 自定义
- 流水合计 + 与概览的差额提示

**验收**：增删改后列表与统计同步刷新；分组顺序正确；差额计算正确。

### T9 资产-统计

- 4 种周期：按月 / 前90天 / 前半年 / 前一年（+ 自定义）
- 周期标签显示实际日期区间
- 支出/收入分类统计（金额 + 占比）
- 分类可点开明细
- 日期解析用 `new Date(date + 'T00:00:00')`（避免 UTC 偏差）

**验收**：4 种周期切换数字正确；点分类能看明细；自定义起止日生效。

### T10 资产-德州

- **开工前必须先读原程序 `renderDezhouSummary()`（约 1788–1968 行）+ 数据来源**，确认真实结构
- 已知：`dzFilter`（线上/线下等）、`dzKlineMode`（day/week/month）、全屏模式
- 若数据结构不明，向陛下索取一条真实记录样本

### T11 快照（方案 A）

- 本地 `localStorage`（key `asset_snapshots_solo_v1`）
- 内容：`{timestamp, actualVal, ledgerTotal, diff, assets, logs}`
- 保留 7 天滚动清理
- 快照回顾：列表 + 勾选两个 + 对比（data / chart）
- 设置页导出/导入纳入快照

**验收**：生成快照 → 刷新 → 仍在；选两个快照能看差异。

### T12 旧数据迁移

- 输入：my-assets `exportData()` 导出的 JSON
- 脚本 `scripts/migrate-assets.mjs`：
  - 读 JSON → 校验 4 个 key
  - `asset_accounts` 8 条 upsert
  - `asset_adjustments` 3 条 upsert
  - `asset_flows` 清空后批量插入
- 支持 `--dry-run`

**验收**：迁移后概览四层数字与原程序一致；账本条数与合计一致。

### T13 验收 + 发布

- 全部页面 375px / 桌面截图
- 双账本互不干扰验证
- 版本升 `1.2.0` → 推送部署

## 六、风险清单

| 风险 | 影响 | 对策 |
|------|------|------|
| 德州数据结构未知 | T10 可能返工 | 开工前先读代码 + 要样本 |
| 账户余额不随流水联动（原程序即如此） | 用户可能误以为记一笔支出余额自动减 | 保留原行为，界面不暗示联动；差额提示保留 |
| 顶部大分段 + 标题 + 底 nav 占高 | 小屏内容区仅约 420px | 375px 实测；必要时压缩标题区 |
| 快照内嵌整份流水 | localStorage 可能超限 | 限制快照条数（如最多 20 条）+ 7 天清理 |
| 旧路由重定向遗漏 | 收藏夹链接 404 | 全部旧路由登记重定向 |
| 两套账本误加总 | 用户认知混乱 | 任何页面不出现跨模块合计 |

## 七、验收总标准

- [ ] 顶部「资产 / 股票」切换正常，刷新保持当前段
- [ ] 资产态 4 tab、股票态 4 tab 均可用
- [ ] 仓位页含净值走势（竖向）
- [ ] 趋势页含盈亏榜单（竖向）
- [ ] 资产四页功能与原 my-assets v0.42 对齐
- [ ] 两个账本数据互不影响
- [ ] `npm test` 全绿、`npm run build` 通过
- [ ] 375px 与桌面视觉验收通过
- [ ] 线上部署可访问
