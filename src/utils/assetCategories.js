// src/utils/assetCategories.js — 分类字典（沿用 my-assets 原值）

export const EXPENSE_CATEGORIES = ['生活购物', '数字服务', '差旅交通', '德州出账', '归还A队', '其他']
export const INCOME_CATEGORIES = ['德州入账', '公款转入', '初始资金', '生活购物', '其他']
export const ACCOUNTS = ['微信支付', '支付宝', '银行卡']
export const DZ_MODES = ['线上', '线下']

export const CATEGORY_COLORS = {
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

export function categoriesOf(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function categoriesFor(type, category) {
  const base = categoriesOf(type)
  return base.includes(category) ? base : [category, ...base].filter(Boolean)
}
