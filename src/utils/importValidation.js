// src/utils/importValidation.js — 导入文件结构校验（清空数据前必须先通过）
export const TABLE_KEYS = [
  'solo_holdings',
  'solo_transactions',
  'solo_capital_log',
  'solo_stock_cache',
  'solo_app_config'
]

const REQUIRED_COLUMNS = {
  solo_holdings: ['stock_code', 'quantity', 'cost_price'],
  solo_transactions: ['stock_code', 'type', 'quantity', 'amount', 'trade_date'],
  solo_capital_log: ['type', 'amount', 'category'],
  solo_stock_cache: ['stock_code'],
  solo_app_config: ['key', 'value']
}

/**
 * @param {object} data 读取的 JSON
 * @returns {{ok: true, rows: Record<string, object[]>} | {ok: false, error: string}}
 */
export function validateImportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: '文件不是有效的导出对象' }
  }
  const rows = {}
  for (const table of TABLE_KEYS) {
    // 兼容旧导出：无 solo_ 前缀时读同名短键
    const short = table.replace('solo_', '')
    const value = data[table] !== undefined ? data[table] : data[short]
    if (value === undefined) return { ok: false, error: `缺少数据表：${table}` }
    if (!Array.isArray(value)) return { ok: false, error: `${table} 不是数组` }
    rows[table] = value
  }
  for (const table of TABLE_KEYS) {
    const cols = REQUIRED_COLUMNS[table]
    for (const row of rows[table]) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return { ok: false, error: `${table} 存在无效行` }
      }
      for (const col of cols) {
        if (row[col] === undefined || row[col] === null) {
          return { ok: false, error: `${table} 缺少必要列：${col}` }
        }
      }
    }
  }
  return { ok: true, rows }
}
