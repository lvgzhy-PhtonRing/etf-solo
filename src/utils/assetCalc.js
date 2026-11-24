// src/utils/assetCalc.js — 资产概览计算（原名沿用 my-assets）

export const ACCOUNT_GROUPS = [
  {
    key: 'wx', label: '微信支付', theme: 'green',
    accounts: [
      { id: 'wx_lq', label: '零钱' },
      { id: 'wx_lqt', label: '零钱通' },
      { id: 'wx_lct', label: '理财通' }
    ]
  },
  {
    key: 'ali', label: '支付宝', theme: 'blue',
    accounts: [
      { id: 'ali_ye', label: '余额' },
      { id: 'ali_yeb', label: '余额宝' },
      { id: 'ali_ylb', label: '余利宝' },
      { id: 'ali_lc', label: '理财产品' }
    ]
  },
  {
    key: 'bank', label: '银行卡', theme: 'red',
    accounts: [
      { id: 'bank_jt', label: '交通银行' }
    ]
  }
]

// sign 参与运算：值按原样传入（允许负数，与原程序一致）
export const ADJUSTMENTS = [
  { id: 'adj_lend', label: '之前借出闲鱼店周转', hint: '(+)', sign: 1 },
  { id: 'adj_shop', label: '闲鱼店账户应有', hint: '(-)', sign: -1 },
  { id: 'adj_family', label: '家庭支出', hint: '(-)', sign: -1 }
]

function num(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function r2(n) {
  return Math.round(n * 100) / 100
}

export function flatAccounts() {
  return ACCOUNT_GROUPS.flatMap(g => g.accounts.map(a => ({ ...a, group: g.key })))
}

export function calcAssets(accounts = {}, adjustments = {}) {
  const groups = ACCOUNT_GROUPS.map(g => ({
    key: g.key,
    label: g.label,
    theme: g.theme,
    total: r2(g.accounts.reduce((s, a) => s + num(accounts[a.id]), 0))
  }))
  const totalAssets = r2(groups.reduce((s, g) => s + g.total, 0))
  const adjustment = r2(ADJUSTMENTS.reduce((s, a) => s + num(adjustments[a.id]) * a.sign, 0))
  return { groups, totalAssets, adjustment, finalVal: r2(totalAssets + adjustment) }
}
