import { describe, it, expect } from 'vitest'
import { filterDecimal, applySignToggle } from '../src/utils/decimalInput'

describe('decimalInput（输入过滤与正负号）', () => {
  it('只保留数字与第一个小数点', () => {
    expect(filterDecimal('12.3.4')).toBe('12.34')
    expect(filterDecimal('1a2b')).toBe('12')
    expect(filterDecimal('1,234.5')).toBe('1234.5')
  })

  it('小数点后最多 2 位', () => {
    expect(filterDecimal('12.3456')).toBe('12.34')
  })

  it('整数部分最多 5 位', () => {
    expect(filterDecimal('123456789')).toBe('12345')
  })

  it('上限 99999.99', () => {
    expect(filterDecimal('999999')).toBe('99999')
    expect(filterDecimal('99999.999')).toBe('99999.99')
  })

  it('默认不允许负号', () => {
    expect(filterDecimal('-12')).toBe('12')
  })

  it('允许负号时，负号只在首位且值为 0 时不保留', () => {
    expect(filterDecimal('-12.5', { allowNegative: true })).toBe('-12.5')
    expect(filterDecimal('12-5', { allowNegative: true })).toBe('125')
    expect(filterDecimal('-0', { allowNegative: true })).toBe('0')
  })

  it('± 按钮：0 变 -，非 0 取反', () => {
    expect(applySignToggle('')).toBe('-')
    expect(applySignToggle('0')).toBe('-')
    expect(applySignToggle('12.5')).toBe('-12.5')
    expect(applySignToggle('-12.5')).toBe('12.5')
  })
})
