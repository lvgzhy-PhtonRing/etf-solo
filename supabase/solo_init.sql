-- ============================================================
-- 我的股票账本（单账户）建表脚本
-- 目标项目：goofish-board (efysjvbbaxwalhbbjxdc)
-- 说明：全部表 solo_ 前缀，与现有其他表互不干扰；无分池概念
-- 执行：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- 1. 持仓（单账户，股票代码唯一）
CREATE TABLE IF NOT EXISTS solo_holdings (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  stock_code  VARCHAR(6) NOT NULL UNIQUE,
  stock_name  VARCHAR(30),
  quantity    INT NOT NULL DEFAULT 0,
  cost_price  DECIMAL(15,6) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 交易记录（即录即生效，无 status / actual_amount）
CREATE TABLE IF NOT EXISTS solo_transactions (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  stock_code  VARCHAR(6) NOT NULL,
  stock_name  VARCHAR(30),
  type        VARCHAR(4) NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity    INT NOT NULL,
  price       DECIMAL(10,3) NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  fee         DECIMAL(10,2) DEFAULT 0,
  trade_date  DATE NOT NULL,
  note        TEXT,
  created_by  VARCHAR(20) NOT NULL DEFAULT 'solo',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_solo_transactions_stock ON solo_transactions(stock_code);
CREATE INDEX IF NOT EXISTS idx_solo_transactions_date ON solo_transactions(trade_date);

-- 3. 资金流水
--    category: capital=外部入金/出金/初始，trade=买卖现金流，adjust=红利/利息/逆回购/税费
CREATE TABLE IF NOT EXISTS solo_capital_log (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('add', 'remove')),
  amount      DECIMAL(15,2) NOT NULL,
  note        TEXT,
  category    VARCHAR(10) NOT NULL DEFAULT 'capital' CHECK (category IN ('capital', 'trade', 'adjust')),
  created_by  VARCHAR(20) NOT NULL DEFAULT 'solo',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_solo_capital_log_created ON solo_capital_log(created_at);

-- 4. 行情缓存
CREATE TABLE IF NOT EXISTS solo_stock_cache (
  stock_code  VARCHAR(6) PRIMARY KEY,
  stock_name  VARCHAR(30),
  price       DECIMAL(10,3),
  change_pct  DECIMAL(6,2),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 配置与仓位快照（pos_snap:日期）
CREATE TABLE IF NOT EXISTS solo_app_config (
  key    VARCHAR(50) PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ============================================================
-- RLS：个人自用，anon 全放行（与应用“无登录”设计一致）
-- ============================================================
ALTER TABLE solo_holdings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE solo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE solo_capital_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE solo_stock_cache  ENABLE ROW LEVEL SECURITY;
ALTER TABLE solo_app_config   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_holdings_all"     ON solo_holdings     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "solo_transactions_all" ON solo_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "solo_capital_log_all"  ON solo_capital_log  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "solo_stock_cache_all"  ON solo_stock_cache  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "solo_app_config_all"   ON solo_app_config   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
