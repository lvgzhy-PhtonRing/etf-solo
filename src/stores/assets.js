// src/stores/assets.js — 资产账本状态（与股票账本完全独立）
import { defineStore } from 'pinia'
import {
  fetchAssetAccounts, updateAssetAccount,
  fetchAssetAdjustments, updateAssetAdjustment,
  fetchAssetFlows, insertAssetFlow, updateAssetFlow, deleteAssetFlow
} from '@/api/assets'
import { calcAssets } from '@/utils/assetCalc'

export const useAssetStore = defineStore('assets', {
  state: () => ({
    accounts: {},      // { wx_lq: 0, ... }
    adjustments: {},   // { adj_lend: 0, ... }
    flows: [],
    loading: false,
    error: null,
    loaded: false
  }),
  getters: {
    totals: (state) => calcAssets(state.accounts, state.adjustments),
    hasData: (state) => Object.keys(state.accounts).length > 0
  },
  actions: {
    async loadAll() {
      this.loading = true
      this.error = null
      try {
        const [accounts, adjustments, flows] = await Promise.all([
          fetchAssetAccounts(),
          fetchAssetAdjustments(),
          fetchAssetFlows()
        ])
        this.accounts = Object.fromEntries(accounts.map(a => [a.id, Number(a.balance) || 0]))
        this.adjustments = Object.fromEntries(adjustments.map(a => [a.id, Number(a.amount) || 0]))
        this.flows = flows.map(f => ({ ...f, amount: Number(f.amount) || 0 }))
        this.loaded = true
      } catch (e) {
        this.error = e.message
        console.error('Asset load error:', e)
      } finally {
        this.loading = false
      }
    },

    async setAccount(id, value) {
      const num = Number(value) || 0
      const prev = this.accounts[id]
      this.accounts = { ...this.accounts, [id]: num }
      try {
        await updateAssetAccount(id, num)
      } catch (e) {
        this.accounts = { ...this.accounts, [id]: prev }
        this.error = e.message
        throw e
      }
    },

    async setAdjustment(id, value) {
      const num = Number(value) || 0
      const prev = this.adjustments[id]
      this.adjustments = { ...this.adjustments, [id]: num }
      try {
        await updateAssetAdjustment(id, num)
      } catch (e) {
        this.adjustments = { ...this.adjustments, [id]: prev }
        this.error = e.message
        throw e
      }
    },

    async addFlow(row) {
      const saved = await insertAssetFlow(row)
      const withNum = { ...saved, amount: Number(saved.amount) || 0 }
      this.flows = [withNum, ...this.flows].sort((a, b) =>
        a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1
      )
      return withNum
    },

    async editFlow(id, patch) {
      await updateAssetFlow(id, patch)
      this.flows = this.flows
        .map(f => (f.id === id ? { ...f, ...patch, amount: Number(patch.amount ?? f.amount) } : f))
        .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
    },

    async removeFlow(id) {
      await deleteAssetFlow(id)
      this.flows = this.flows.filter(f => f.id !== id)
    }
  }
})
