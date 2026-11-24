// src/utils/assetCategories.js — 分类/账户字典（与源程序 addLog 表单完全一致）

export const TYPE_OPTIONS = {
  expense: [
    { value: '德州出账', label: '🃏 德州出账' },
    { value: '数字服务', label: '🤖 数字服务' },
    { value: '差旅交通', label: '🚗 差旅交通' },
    { value: '生活购物', label: '🛒 生活购物' },
    { value: '归还A队', label: '🔙 归还A队' },
    { value: '其他', label: '📦 其他' }
  ],
  income: [
    { value: '德州入账', label: '🃏 德州入账' },
    { value: '初始资金', label: '💰 初始资金' },
    { value: '公款转入', label: '🏛️ 公款转入' },
    { value: '其他', label: '📦 其他' }
  ]
}

// 账本账户下拉（含「其他」）
export const ACCOUNT_OPTIONS = ['微信支付', '支付宝', '银行卡', '其他']

// 兼容旧引用
export const ACCOUNTS = ACCOUNT_OPTIONS
export const DZ_MODES = ['线上', '线下']

export function categoriesOf(type) {
  return (TYPE_OPTIONS[type] || TYPE_OPTIONS.expense).map(o => o.value)
}

export function optionsOf(type) {
  return TYPE_OPTIONS[type] || TYPE_OPTIONS.expense
}

export function categoriesFor(type, category) {
  const list = categoriesOf(type)
  return list.includes(category) ? list : [category, ...list].filter(Boolean)
}

// 分类色（源程序 getCategoryColor）
const CATEGORY_COLORS = {
  生活购物: '#22c55e',
  数字服务: '#3b82f6',
  差旅交通: '#eab308',
  德州入账: '#ef4444',
  德州出账: '#ef4444',
  公款转入: '#d97706',
  归还A队: '#a855f7',
  初始资金: '#f59e0b',
  其他: '#9ca3af'
}

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#9ca3af'
}
