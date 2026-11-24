// src/api/supabase.js — 单账户版
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not set.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// 表名映射（goofish 项目，solo_ 前缀）
const T = {
  holdings: 'solo_holdings',
  transactions: 'solo_transactions',
  capitalLogs: 'solo_capital_log',
  stockCache: 'solo_stock_cache',
  config: 'solo_app_config'
}

/* 获取持仓 */
export async function fetchHoldings({ strict = false } = {}) {
  const { data, error } = await supabase.from(T.holdings).select('*')
  if (error && strict) throw new Error(error.message)
  return error ? [] : data
}

/* 获取交易记录 */
export async function fetchTransactions(limit = 50) {
  const { data, error } = await supabase
    .from(T.transactions)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return error ? [] : data
}

/* 获取全部交易记录（清仓盈亏计算） */
export async function fetchAllTransactions() {
  const { data, error } = await supabase
    .from(T.transactions)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)
  return error ? [] : data
}

/* 获取资金流水 */
export async function fetchCapitalLogs({ strict = false } = {}) {
  const { data, error } = await supabase
    .from(T.capitalLogs)
    .select('*')
    .order('created_at', { ascending: false })
  if (error && strict) throw new Error(error.message)
  return error ? [] : data
}

/* 历史估值完整账本 */
export async function fetchHistoricalSnapshotLedger() {
  async function read(table, columns) {
    const rows = []
    const size = 500
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from(table).select(columns).order('id').range(offset, offset + size - 1)
      if (error) throw new Error(error.message)
      rows.push(...data)
      if (data.length < size) return rows
    }
  }
  const [holdings, transactions, capitalLogs] = await Promise.all([
    read(T.holdings, 'stock_code, quantity'),
    read(T.transactions, 'stock_code, type, quantity, amount, trade_date'),
    read(T.capitalLogs, 'type, amount, category, note, created_at')
  ])
  return { holdings, transactions, capitalLogs }
}

/* 查询单只股票全部交易（重算持仓成本） */
export async function fetchTransactionsByStock(stockCode) {
  const { data, error } = await supabase
    .from(T.transactions)
    .select('*')
    .eq('stock_code', stockCode)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

/* 录入交易 */
export async function insertTransaction(tx) {
  const { data, error } = await supabase
    .from(T.transactions)
    .insert([tx])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新交易 */
export async function updateTransaction(id, updates) {
  const { error } = await supabase
    .from(T.transactions)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除交易 */
export async function deleteTransaction(id) {
  const { error } = await supabase.from(T.transactions).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 插入资金流水 */
export async function insertCapitalLog(log) {
  const { data, error } = await supabase
    .from(T.capitalLogs)
    .insert([log])
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 更新资金流水（无 updated_at 列） */
export async function updateCapitalLog(id, updates) {
  const { error } = await supabase
    .from(T.capitalLogs)
    .update(updates)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/* 删除资金流水 */
export async function deleteCapitalLog(id) {
  const { error } = await supabase.from(T.capitalLogs).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* 更新持仓（单账户按股票代码唯一） */
export async function upsertHolding(holding) {
  const { data, error } = await supabase
    .from(T.holdings)
    .upsert(holding, { onConflict: 'stock_code' })
    .select()
  if (error) throw new Error(error.message)
  return data[0]
}

/* 删除持仓（清仓时） */
export async function deleteHolding(stockCode) {
  const { error } = await supabase
    .from(T.holdings)
    .delete()
    .eq('stock_code', stockCode)
  if (error) throw new Error(error.message)
}

/* 行情缓存 */
export async function fetchStockCache() {
  const { data, error } = await supabase.from(T.stockCache).select('*')
  return error ? [] : data
}

export async function upsertStockCache(cache) {
  const { error } = await supabase
    .from(T.stockCache)
    .upsert(cache, { onConflict: 'stock_code' })
  if (error) console.error('Cache update error:', error)
}

/* 仓位/资产快照 */
export async function savePositionSnapshot(date, data) {
  const payload = typeof data === 'object' ? data : { ratio: data }
  const { error } = await supabase
    .from(T.config)
    .upsert({ key: `pos_snap:${date}`, value: JSON.stringify(payload) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

export async function fetchPositionSnapshots(limit = 10, { strict = false } = {}) {
  const parseSnap = (d) => {
    const parsed = JSON.parse(d.value)
    return {
      date: d.key.replace('pos_snap:', ''),
      ratio: parsed.ratio,
      asset: parsed.asset,
      capitalChange: parsed.capitalChange || 0,
      updatedAt: parsed.updatedAt || null
    }
  }
  const { data, error } = await supabase
    .from(T.config)
    .select('key, value')
    .like('key', 'pos_snap:%')
    .order('key', { ascending: false })
    .limit(limit)
  if (error) {
    if (strict) throw new Error(error.message)
    return []
  }
  return data.map(parseSnap).reverse()
}

/* ============================================================
 * 兼容层：页面迁移期间保留，Task 11 统一删除
 * ============================================================ */

export async function fetchPools() { return [] }
export async function savePoolAllocation() { /* no-op */ }
export async function loadPoolAllocation() { return null }
export async function fetchTransactionsByPoolStock(_poolId, stockCode) { return fetchTransactionsByStock(stockCode) }
export async function verifyTransaction() { return true }
export async function verifyPassword() { return false }
export async function updatePassword() { return false }
export async function logDelete() { /* no-op */ }
export async function fetchAuditLogs() { return [] }
