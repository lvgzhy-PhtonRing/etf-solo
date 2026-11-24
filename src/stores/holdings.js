// src/stores/holdings.js — 单账户持仓
import { defineStore } from 'pinia'
import { fetchHoldings } from '@/api/supabase'

export const useHoldingStore = defineStore('holdings', {
  state: () => ({
    holdings: [],
    loading: false,
    error: null
  }),
  getters: {
    stockCodes: (state) => {
      return [...new Set(state.holdings.map(h => h.stock_code))]
    }
  },
  actions: {
    async loadHoldings() {
      this.loading = true
      this.error = null
      try {
        this.holdings = await fetchHoldings({ strict: true })
      } catch (e) {
        this.error = e.message
        console.error('Load holdings error:', e)
      } finally {
        this.loading = false
      }
    }
  }
})
