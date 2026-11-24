# 券商数据转入股票大 Tab 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把券商 2026 流水与最终持仓写入 ETF-Solo，并以 2026-01-05 为净值基准日，使股票大 Tab 的持仓/交易/资本/净值与券商一致。

**Architecture:** 新增一次性导入脚本 `scripts/import-broker.mjs`（解析 GB18030 流水、补期初建仓、写 Supabase）；同时修正费率与卖出成本算法，使后续交易与券商 APP 一致。资产模块不动。

**Tech Stack:** Node 18+、Vue 3、Vitest、Supabase PostgREST。

**Spec:** `docs/superpowers/specs/2026-11-24-broker-data-import-design.md`

## Global Constraints

- 基准日固定 2026-01-05；期初资本 92,955.55；当日净值 = 1.0000。
- 期末 5 只持仓数量/成本严格按截图；期末现金 36,408.03。
- 历史交易费用用流水实际值；新交易费率用近 3 个月：佣金 1.5846‰、印花税 0.5‰（股票卖出）、沪市过户费 0.01‰、最低 5 元、ETF 卖出免印花税。
- 卖出成本用当前持仓成本的摊薄算法，不再从全部流水重算。
- 不修改资产模块；不写入 mqdx；不提交券商原始文件。

## Review Focus

- 卖出 ETF（如 513500）不得收印花税。
- 卖出部分持仓时，亏损卖出会让剩余成本上升，盈利卖出会让剩余成本下降；清仓返回 0。
- 导入后 1/5 现金 44,864.55、持仓 4 只、净值 1.0000。
- 3/3～3/17 银证往返不得让净值异常跳变。
- 重复执行导入必须可重置，不产生重复流水。

---

### Task 1: 费率对齐券商近 3 个月

**Files:**
- Modify: `src/utils/feeCalculator.js`
- Modify: `src/components/trade/BuySheet.vue`
- Modify: `src/components/trade/SellSheet.vue`
- Modify: `src/components/trade/TradeForm.vue`
- Modify: `src/components/trade/TradeRecordsSheet.vue`
- Test: `tests/feeCalculator.test.js`

**Interfaces:**
- `calcBuyFee(amount: number, stockCode?: string): number`
- `calcSellFee(amount: number, stockCode?: string): number`
- `calcBuyActual(amount: number, stockCode?: string): { fee: number, actualAmount: number }`
- `calcSellActual(amount: number, stockCode?: string): { fee: number, actualAmount: number }`

- [ ] **Step 1: Write failing tests** — 中恒买 15,600→24.72；特变买 9,540→15.22；东方财富卖 18,000→37.52；特变卖 11,382→23.85；标普500 卖 5,420→8.65（无印花税）；1,000 元最低 5 元；金额 0 返回 0。
- [ ] **Step 2: Run `npm test -- tests/feeCalculator.test.js`** — 预期失败。
- [ ] **Step 3: Implement** — 佣金 `0.0015846`；印花税 `0.0005` 仅非基金卖出；沪市 `/^[569]/` 加过户费 `0.0000108`；基金 `/^(5|15|16|18)/` 卖出免印花税；最低 5。
- [ ] **Step 4: Pass stockCode through callers** — BuySheet/SellSheet/TradeForm/TradeRecordsSheet。
- [ ] **Step 5: Re-run focused tests** — 全绿。

### Task 2: 卖出成本改为券商摊薄算法

**Files:**
- Modify: `src/utils/calculators.js`
- Modify: `src/components/trade/SellSheet.vue`
- Modify: `tests/cost.test.js`

**Interfaces:**
- `calcCostAfterSell(currentCostPrice: number, currentQuantity: number, sellQuantity: number, netProceeds: number): number`

- [ ] **Step 1: Write failing tests** — 100 股@10 卖 50 净到账 600 → 8；净到账 400 → 12；清仓 → 0；净到账超过成本 → 0；特变 900@26.726 卖 100 净到账 1,835.95 → ≈27.7718。
- [ ] **Step 2: Run `npm test -- tests/cost.test.js`** — 预期失败。
- [ ] **Step 3: Implement `calcCostAfterSell`** — 剩余 ≤0 返回 0；否则 `(成本总额 − 净到账) / 剩余`，下限 0。
- [ ] **Step 4: Update SellSheet** — 删除 `fetchTransactionsByStock` 重算逻辑，改用 `existing.cost_price` + `actualAmount`；保留 6 位小数；清仓删除持仓。
- [ ] **Step 5: Re-run focused tests** — 全绿。

### Task 3: 导入脚本与 dry-run

**Files:**
- Create: `scripts/import-broker.mjs`
- Modify: `src/api/supabase.js`（`fetchTransactions` 默认 200 条）

**Interfaces:**
- `node scripts/import-broker.mjs --dry-run` 打印清单不写库。
- `node scripts/import-broker.mjs --write --reset` 清空股票三表 + `pos_snap:*` 后写入。
- 默认目录 `~/Documents`，文件名 `01.txt`…`06.txt`；`--dir` 可覆盖。

- [ ] **Step 1: Implement parser** — GB18030 解码；68 行；首笔前现金 44,864.55；末笔余额 36,408.03；区分买卖/转账/红利/利息/税。
- [ ] **Step 2: Build opening data** — 倒推 4 只期初持仓；取 1/5 收盘价；生成 4 笔期初建仓 + 1 条期初资本 92,955.55。
- [ ] **Step 3: Build rows** — 59 交易、73 条资金流水、5 持仓；`source_tx_id` 关联；红利/利息/税写 `[校对分项]` JSON。
- [ ] **Step 4: Dry-run** — 核对：期初现金 44,864.55、期初市值 48,091、期末现金 36,408.03、累计投入 142,955.55、5 持仓成本 115,925.50。
- [ ] **Step 5: Write with `--write --reset`** — 逐笔插入交易拿 ID，再批量插入流水；删除 0 值 `pos_snap:2026-11-24`。

### Task 4: 写库后验证

**Files:**
- Create: `scripts/verify-broker-import.mjs`（临时验证也可）

- [ ] **Step 1: 查询计数** — holdings=5、transactions=59、capital_log=73。
- [ ] **Step 2: 查询金额** — 期末现金 36,408.03、累计投入 142,955.55、5 持仓成本 115,925.50。
- [ ] **Step 3: 验证 1/5** — 现金 44,864.55；持仓 4 只；按收盘价市值 48,091；净值 1。
- [ ] **Step 4: 验证历史** — 用 `buildSnapshotInputs` 跑 1/5～11/21，确认无负持仓、1/5 输入正确。
- [ ] **Step 5: 浏览器抽查** — 打开线上股票 Tab，持仓/资本与预期一致。

### Task 5: 版本、测试、发布

**Files:**
- Modify: `package.json`、`src/pages/SettingsPage.vue`

- [ ] **Step 1: 版本升 1.3.2** — 两处一致。
- [ ] **Step 2: `npm test`** — 全绿。
- [ ] **Step 3: `npm run build`** — 成功。
- [ ] **Step 4: 提交并推送** — 数据已在库；代码发布后未来费率/成本生效。
- [ ] **Step 5: 线上核对** — GitHub Pages 部署成功，股票 Tab 数据正常。
