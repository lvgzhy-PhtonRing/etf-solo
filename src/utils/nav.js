// src/utils/nav.js — 资产/股票两级导航（纯函数，便于测试）

// 大段顺序：资产在前，股票在后
export const SECTIONS = ['asset', 'stock']

export const TABS = {
  asset: [
    { name: 'asset-overview', path: '/asset/overview', label: '概览' },
    { name: 'asset-ledger', path: '/asset/ledger', label: '账本' },
    { name: 'asset-stats', path: '/asset/stats', label: '统计' },
    { name: 'asset-poker', path: '/asset/poker', label: '德州' }
  ],
  stock: [
    { name: 'stock-holdings', path: '/stock/holdings', label: '持仓' },
    { name: 'stock-positions', path: '/stock/positions', label: '仓位' },
    { name: 'stock-netvalue', path: '/stock/netvalue', label: '净值' },
    { name: 'stock-trends', path: '/stock/trends', label: '趋势' },
    { name: 'stock-capital', path: '/stock/capital', label: '资本' }
  ]
}

// 旧路由 → 新路由
const LEGACY = {
  '/dashboard': '/stock/holdings',
  '/positions': '/stock/positions',
  '/netvalue': '/stock/netvalue',
  '/trend': '/stock/trends',
  '/trends': '/stock/trends',
  '/fund': '/stock/capital'
}

export function sectionOf(path) {
  return String(path || '').startsWith('/stock') ? 'stock' : 'asset'
}

export function tabsOf(section) {
  return TABS[section] || TABS.asset
}

export function defaultPathOf(section) {
  return tabsOf(section)[0].path
}

export function tabIndex(section, path) {
  return tabsOf(section).findIndex(t => t.path === path)
}

export function legacyRedirect(path) {
  return LEGACY[path] || null
}
