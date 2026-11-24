// src/stores/transactions.js — 单账户交易（即录即生效）
import { defineStore } from 'pinia'
import { fetchTransactions, insertTransaction } from '@/api/supabase'

export const useTransactionStore = defineStore('transactions', {
  state: () => ({
    transactions: [],
    loading: false,
    submitting: false,
    error: null
  }),
  actions: {
    async loadTransactions() {
      this.loading = true
      this.error = null
      try {
        this.transactions = await fetchTransactions()
      } catch (e) {
        this.error = e.message
        console.error('Load transactions error:', e)
      } finally {
        this.loading = false
      }
    },
    async addTransaction(tx) {
      this.submitting = true
      this.error = null
      try {
        const result = await insertTransaction(tx)
        this.transactions.unshift(result)
        return result
      } catch (e) {
        this.error = e.message
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})
