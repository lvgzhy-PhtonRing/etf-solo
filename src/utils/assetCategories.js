// src/utils/assetCategories.js — 分类字典（沿用 my-assets 原值）

export const EXPENSE_CATEGORIES = ['生活购物', '数字服务', '差旅交通', '德州出账', '归还A队', '其他']
export const INCOME_CATEGORIES = ['德州入账', '公款转入', '初始资金', '生活购物', '其他']
export const ACCOUNTS = ['微信支付', '支付宝', '银行卡']
export const DZ_MODES = ['线上', '线下']

export const CATEGORY_COLORS = {
  生活购物: '#c98a2c',
  数字服务: '#5b8def',
  差旅交通: '#2e8b57',
  德州入账: '#d64545',
  德州出账: '#b5482f',
  公款转入: '#7a5cd6',
  归还A队: '#8a8f98',
  初始资金: '#bf6b3f',
  其他: '#a89f91'
}

export function categoriesOf(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function categoriesFor(type, category) {
  const base = categoriesOf(type)
  return base.includes(category) ? base : [category, ...base].filter(Boolean)
}
