# 部署手册 — 我的股票账本

## 1. 数据库（goofish 项目）

1. 打开 Supabase Dashboard，选择项目 **goofish-board**（ref `efysjvbbaxwalhbbjxdc`）
2. SQL Editor → 粘贴 `supabase/solo_init.sql` → Run
3. Settings → API → 复制 **Project URL** 与 **anon public key**，写入项目**根目录** `.env`（Vite 不读取 `src/.env`）：

```
VITE_SUPABASE_URL=https://efysjvbbaxwalhbbjxdc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

> 注意：不要使用 `mqdxmbsaddebxlallgos`（合伙版生产库）。

## 2. Edge Functions

```bash
npx supabase login
npx supabase functions deploy stock-proxy --project-ref efysjvbbaxwalhbbjxdc
npx supabase functions deploy backup      --project-ref efysjvbbaxwalhbbjxdc
```

`backup` 函数使用平台注入的 `SUPABASE_SERVICE_ROLE_KEY`，无需手动配置。

## 3. 备份桶与每日备份

1. Storage → New bucket → 名称 `solo-backups`（private）
2. SQL Editor 执行 `supabase/solo_backup_cron.sql`（需启用 `pg_cron`、`pg_net` 扩展）
3. 手动触发验证：`POST /functions/v1/backup`，然后 Storage 中应出现 `backup-*.json`

## 4. 前端部署（GitHub Pages）

线上地址：**https://lvgzhy-phtonring.github.io/etf-solo/**

仓库：`lvgzhy-PhtonRing/etf-solo`（公开仓库，免费账户 Pages 不支持私有仓库；代码无任何密钥）

1. 推送 main 自动触发 `.github/workflows/deploy.yml`
2. Settings → Secrets and variables → Actions：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Settings → Pages → Source 选 **GitHub Actions**
4. 推送后 Actions 自动构建发布

> `vite.config.js` 的 `base` 必须与仓库名一致：`/etf-solo/`。

## 5. AI 写库脚本

```bash
# 初始化入金（不计入 capitalChange）
node scripts/ledger-write.mjs --type add --amount 500000 --category capital --note 初始

# 红利/利息等调整（note 存分项 JSON，供资本页分类小计）
node scripts/ledger-write.mjs --type add --amount 123.45 --category adjust \
  --note '{"items":[{"category":"stock_dividend","stockName":"格林美","signedAmount":12345}]}'

# 预演不写入
node scripts/ledger-write.mjs --type add --amount 1 --category adjust --note 测试 --dry-run
```

分项 `category` 约定：`stock_dividend` 红利 / `interest` 利息 / `reverse_repo` 逆回购 / `dividend_tax` 红利税 / `fee_error` 费用误差。
`signedAmount` 单位为「分」。
