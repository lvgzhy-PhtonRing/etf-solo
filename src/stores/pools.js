// src/stores/pools.js — 兼容层空实现（迁移期间保留，Task 11 删除）
import { defineStore } from 'pinia'

export const usePoolStore = defineStore('pools', {
  state: () => ({
    pools: [],
    currentPoolId: null,
    loading: false,
    error: null
  }),
  getters: {
    currentPool: () => null,
    allPools: () => []
  },
  actions: {
    async loadPools() { /* no-op */ },
    setCurrentPool() { /* no-op */ }
  }
})
