import { describe, it, expect } from 'vitest'
import {
  SECTIONS,
  TABS,
  sectionOf,
  tabsOf,
  defaultPathOf,
  tabIndex,
  legacyRedirect
} from '../src/utils/nav'

describe('navigation（资产/股票两级导航）', () => {
  it('大段顺序为 资产 → 股票', () => {
    expect(SECTIONS).toEqual(['asset', 'stock'])
  })

  it('资产态 4 tab：概览/账本/统计/德州', () => {
    expect(TABS.asset.map(t => t.label)).toEqual(['概览', '账本', '统计', '德州'])
  })

  it('股票态 5 tab：持仓/仓位/净值/趋势/资本', () => {
    expect(TABS.stock.map(t => t.label)).toEqual(['持仓', '仓位', '净值', '趋势', '资本'])
  })

  it('sectionOf 按路径前缀判定大段', () => {
    expect(sectionOf('/asset/overview')).toBe('asset')
    expect(sectionOf('/asset/poker')).toBe('asset')
    expect(sectionOf('/stock/holdings')).toBe('stock')
    expect(sectionOf('/stock/capital')).toBe('stock')
  })

  it('sectionOf 未知路径回退资产段', () => {
    expect(sectionOf('/settings')).toBe('asset')
    expect(sectionOf('')).toBe('asset')
  })

  it('tabsOf 返回该段 tab 列表', () => {
    expect(tabsOf('stock')).toEqual(TABS.stock)
    expect(tabsOf('asset')).toEqual(TABS.asset)
    expect(tabsOf('unknown')).toEqual(TABS.asset)
  })

  it('defaultPathOf 默认页：资产→概览，股票→持仓', () => {
    expect(defaultPathOf('asset')).toBe('/asset/overview')
    expect(defaultPathOf('stock')).toBe('/stock/holdings')
  })

  it('tabIndex 定位当前 tab', () => {
    expect(tabIndex('stock', '/stock/positions')).toBe(1)
    expect(tabIndex('stock', '/stock/netvalue')).toBe(2)
    expect(tabIndex('asset', '/asset/ledger')).toBe(1)
    expect(tabIndex('asset', '/nope')).toBe(-1)
  })

  it('旧路由重定向到新路由', () => {
    expect(legacyRedirect('/dashboard')).toBe('/stock/holdings')
    expect(legacyRedirect('/positions')).toBe('/stock/positions')
    expect(legacyRedirect('/netvalue')).toBe('/stock/netvalue')
    expect(legacyRedirect('/trend')).toBe('/stock/trends')
    expect(legacyRedirect('/trends')).toBe('/stock/trends')
    expect(legacyRedirect('/fund')).toBe('/stock/capital')
  })

  it('非旧路由不重定向', () => {
    expect(legacyRedirect('/asset/overview')).toBe(null)
    expect(legacyRedirect('/stock/holdings')).toBe(null)
  })
})
