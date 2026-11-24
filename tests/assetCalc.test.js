import { describe, it, expect } from 'vitest'
import { ACCOUNT_GROUPS, ADJUSTMENTS, calcAssets, flatAccounts } from '../src/utils/assetCalc'

describe('assetCalc（资产概览计算）', () => {
  const accounts = {
    wx_lq: '0', wx_lqt: '2766', wx_lct: '4000',
    ali_ye: '3035', ali_yeb: '687', ali_ylb: '234', ali_lc: '',
    bank_jt: '4168'
  }
  const adjustments = { adj_lend: '2000', adj_shop: '-1016', adj_family: '0' }

  it('三组账户结构：微信/支付宝/银行卡，共 8 个账户', () => {
    expect(ACCOUNT_GROUPS.map(g => g.label)).toEqual(['微信支付', '支付宝', '银行卡'])
    expect(flatAccounts()).toHaveLength(8)
  })

  it('调整项 3 条，符号 +1/-1/-1', () => {
    expect(ADJUSTMENTS.map(a => a.id)).toEqual(['adj_lend', 'adj_shop', 'adj_family'])
    expect(ADJUSTMENTS.map(a => a.sign)).toEqual([1, -1, -1])
  })

  it('分组小计与总计', () => {
    const r = calcAssets(accounts, adjustments)
    expect(r.groups.map(g => g.total)).toEqual([6766, 3956, 4168])
    expect(r.totalAssets).toBe(14890)
  })

  it('调整项 = 借出(+) − 闲鱼店 − 家庭（值按原样参与，可为负）', () => {
    const r = calcAssets(accounts, adjustments)
    expect(r.adjustment).toBe(3016)
  })

  it('实际可支配 = 零钱资产总计 + 调整项', () => {
    const r = calcAssets(accounts, adjustments)
    expect(r.finalVal).toBe(17906)
  })

  it('空/非法输入按 0 处理', () => {
    const r = calcAssets({}, {})
    expect(r.totalAssets).toBe(0)
    expect(r.adjustment).toBe(0)
    expect(r.finalVal).toBe(0)
    const r2 = calcAssets({ wx_lq: 'abc' }, { adj_lend: null })
    expect(r2.groups[0].total).toBe(0)
    expect(r2.adjustment).toBe(0)
  })
})
