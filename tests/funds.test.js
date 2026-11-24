import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../src/api/supabase', () => ({
  fetchCapitalLogs: vi.fn(async () => []),
  insertCapitalLog: vi.fn(async log => ({ id: 99, ...log })),
  updateCapitalLog: vi.fn(async () => {}),
  deleteCapitalLog: vi.fn(async () => {})
}))

import { useFundStore } from '../src/stores/funds'
import { deleteCapitalLog } from '../src/api/supabase'

const logs = [
  { id: 1, type: 'add', amount: 100000, category: 'capital', note: '初始' },
  { id: 2, type: 'remove', amount: 20000, category: 'capital', note: '取现' },
  { id: 3, type: 'remove', amount: 30000, category: 'trade', note: '买入 000001' },
  { id: 4, type: 'add', amount: 5000, category: 'trade', note: '卖出 000001' },
  { id: 5, type: 'add', amount: 800, category: 'adjust', note: '利息' }
]

describe('funds store 单账户口径', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('totalCapital 只计外部资金（category=capital），初始计入', () => {
    const store = useFundStore()
    store.capitalLogs = logs
    expect(store.totalCapital).toBe(80000)
  })

  it('totalAvailable = 外部资金 + 调整 + 卖出 − 买入', () => {
    const store = useFundStore()
    store.capitalLogs = logs
    expect(store.totalAvailable).toBe(55800)
  })

  it('removeCapitalLog 删除并从本地列表移除', async () => {
    const store = useFundStore()
    store.capitalLogs = [{ id: 7, type: 'add', amount: 100, category: 'capital' }]
    await store.removeCapitalLog(7)
    expect(deleteCapitalLog).toHaveBeenCalledWith(7)
    expect(store.capitalLogs.find(l => l.id === 7)).toBeUndefined()
  })
})
