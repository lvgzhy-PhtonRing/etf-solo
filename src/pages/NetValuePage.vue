<template>
  <div class="page netvalue-page">
    <div class="page-header">
      <span class="page-title">净值<span class="title-en">Net Value</span></span>
    </div>
    <LoadErrorTip v-if="loadError" :message="loadError" @retry="retryLoad" />

    <LoadingSkeleton v-if="loading" :count="2" />
    <template v-else>
      <div class="section-card nav-hero">
        <NavOverview />
      </div>
      <div class="section-card edge-accent">
        <AccountNavChart />
      </div>
    </template>
  </div>
</template>

<script setup>
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import NavOverview from '@/components/fund/NavOverview.vue'
import AccountNavChart from '@/components/fund/AccountNavChart.vue'
import { ref, computed, onMounted } from 'vue'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'

const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const loading = ref(true)
const loadError = computed(() => holdingStore.error || fundStore.error || priceStore.error || '')
function retryLoad() { location.reload() }

onMounted(async () => {
  try {
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('NetValue load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 2px 12px; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
.section-card { padding: 14px 16px; margin-bottom: 10px; }
.nav-hero {
  padding: 12px 16px;
  background: linear-gradient(150deg, rgba(191,107,63,.08), rgba(214,69,69,.05) 60%, #ffffff);
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-card);
}
</style>
