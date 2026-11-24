// src/stores/funds.js — 单账户资金口径
import { defineStore } from 'pinia'
import { fetchCapitalLogs, insertCapitalLog, updateCapitalLog } from '@/api/supabase'

export const useFundStore = defineStore('funds', {
  state: () => ({
    capitalLogs: [],
    loading: false,
    submitting: false,
    error: null
  }),
  getters: {
    // 外部总资本：仅 category=capital（入金/出金/初始）
    totalCapital: (state) => {
      return state.capitalLogs
        .filter(l => l.category === 'capital')
        .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
    },
    // 总可用资金 = 外部资本 + 调整净额 + 卖出到账 − 买入支出
    totalAvailable: (state) => {
      const capital = state.capitalLogs
        .filter(l => l.category === 'capital')
        .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
      const adjust = state.capitalLogs
        .filter(l => l.category === 'adjust')
        .reduce((sum, l) => sum + (l.type === 'add' ? l.amount : -l.amount), 0)
      const sellIn = state.capitalLogs
        .filter(l => l.category === 'trade' && l.type === 'add')
        .reduce((sum, l) => sum + l.amount, 0)
      const buyOut = state.capitalLogs
        .filter(l => l.category === 'trade' && l.type === 'remove')
        .reduce((sum, l) => sum + l.amount, 0)
      return capital + adjust + sellIn - buyOut
    }
  },
  actions: {
    async loadCapitalLogs() {
      this.loading = true
      this.error = null
      try {
        this.capitalLogs = await fetchCapitalLogs({ strict: true })
      } catch (e) {
        this.error = e.message
        console.error('Load capital logs error:', e)
      } finally {
        this.loading = false
      }
    },
    async addCapitalLog(log) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertCapitalLog(log)
        this.capitalLogs.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    },
    async editCapitalLog(id, updates) {
      this.submitting = true
      this.error = null
      try {
        await updateCapitalLog(id, updates)
        const idx = this.capitalLogs.findIndex(l => l.id === id)
        if (idx !== -1) Object.assign(this.capitalLogs[idx], updates)
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})
