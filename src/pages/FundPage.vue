<template>
  <div class="page fund-page">
    <div class="page-header">
      <span class="page-title">资本管理<span class="title-en">Capital Management</span></span>
    </div>
    <LoadErrorTip v-if="loadError" :message="loadError" @retry="retryLoad" />

    <CapitalSummary
      :total-capital="totalCapital"
      :total-available="totalAvailable"
      :total-asset="totalAsset"
      @open-detail="showCapitalDetail = true"
    />

    <LoadingSkeleton v-if="loading" :count="2" />
    <template v-else>
      <!-- 分类小计：只算调整（红利/利息/税等） -->
      <div class="section-card edge-accent">
        <div class="section-title">
          <span class="title-accent title-accent--accent"></span>分类小计
        </div>
        <div class="cat-grid">
          <div v-for="c in categories" :key="c.key" class="cat-item">
            <span class="cat-label">{{ c.label }}</span>
            <span class="cat-value num-mono" :class="c.value >= 0 ? 'rise' : 'fall'">{{ formatSigned(c.value) }}</span>
          </div>
        </div>
      </div>

      <CapitalLogList :logs="adjustLogs" />
    </template>

    <CapitalDetailDialog v-model:show="showCapitalDetail" :logs="capitalLogs" />
  </div>
</template>

<script setup>
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import { ref, computed, onMounted } from 'vue'
import { useFundStore } from '@/stores/funds'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'
import { computeAdjustCategories } from '@/utils/capitalCategories'
import CapitalSummary from '@/components/fund/CapitalSummary.vue'
import CapitalLogList from '@/components/fund/CapitalLogList.vue'
import CapitalDetailDialog from '@/components/fund/CapitalDetailDialog.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
const loadError = computed(() => holdingStore.error || fundStore.error || priceStore.error || '')
function retryLoad() { location.reload() }


const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const loading = ref(true)
const showCapitalDetail = ref(false)

// 资本总览明细：仅外部资本（基准 + 银证转入/转出）
const capitalLogs = computed(() => fundStore.capitalLogs.filter(l => l.category === 'capital'))
// 资本流水：仅红利/利息/税等调整；股票买卖看交易记录
const adjustLogs = computed(() => fundStore.capitalLogs.filter(l => l.category === 'adjust'))
const totalCapital = computed(() => fundStore.totalCapital)
const totalAvailable = computed(() => fundStore.totalAvailable)

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})
const totalAsset = computed(() => totalMarketValue.value + totalAvailable.value)

const categories = computed(() => computeAdjustCategories(adjustLogs.value))

function formatSigned(v) {
  return `${v > 0 ? '+' : ''}${formatMoney(v)}`
}

onMounted(async () => {
  try {
    await Promise.all([fundStore.loadCapitalLogs(), holdingStore.loadHoldings()])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Fund load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 2px 12px; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
.section-card { padding: 14px 16px; margin-bottom: 10px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding-bottom: 10px; }
.title-accent { width: 3px; height: 13px; border-radius: 2px; }
.title-accent--accent { background: var(--bg-accent); }
.cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.cat-item {
  display: flex; justify-content: space-between; align-items: baseline;
  background: var(--bg-hover); border-radius: var(--radius-md); padding: 8px 10px;
}
.cat-label { font-size: 12px; color: var(--text-secondary); }
.cat-value { font-size: 13px; font-weight: 600; font-family: var(--font-number); }
.cat-value.rise { color: var(--color-rise); }
.cat-value.fall { color: var(--color-fall); }
</style>
