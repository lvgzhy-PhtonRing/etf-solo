<template>
  <div class="page positions-page">
    <div class="page-header">
      <span class="page-title">仓位分析<span class="title-en">Position Analysis</span></span>
    </div>
    <LoadErrorTip v-if="loadError" :message="loadError" @retry="retryLoad" />

    <LoadingSkeleton v-if="loading" :count="2" />

    <template v-else>
      <!-- 股票仓位：总仓位 + 股票比例合并在同一模块 -->
      <div class="section-card edge-accent">
        <div class="section-title">
          <span class="title-accent title-accent--accent"></span>股票仓位
        </div>
        <DonutChart
          :segments="chartSegments"
          :total-percent="totalPositionRatio"
          :size="donutSize"
        />
        <div class="total-ratio-detail">
          <span class="trd-label">总市值</span>
          <span class="trd-value num-mono">{{ formatMoney(totalMarketValue) }}</span>
          <span class="trd-sep">/</span>
          <span class="trd-label">总资产</span>
          <span class="trd-value num-mono">{{ formatMoney(totalAsset) }}</span>
        </div>

        <div v-if="stockShares.length === 0" class="stock-empty">暂无持仓</div>
        <template v-else>
          <div class="stock-bar">
            <div v-for="s in stockShares" :key="s.code" class="stock-bar-seg"
              :style="{ width: s.percent + '%', background: s.color }"></div>
          </div>
          <div class="stock-list">
            <div v-for="s in stockShares" :key="s.code" class="stock-item">
              <span class="stock-dot" :style="{ background: s.color }"></span>
              <span class="stock-name">{{ s.name }}</span>
              <span class="stock-qty num-mono">{{ s.quantity }}股</span>
              <span class="stock-mv num-mono">{{ formatMoney(s.marketValue) }}</span>
              <span class="stock-pct num-mono">{{ s.percent.toFixed(1) }}%</span>
            </div>
          </div>
          <div class="stock-sum">
            <span class="stock-sum-label">合计</span>
            <span class="stock-sum-value num-mono">{{ totalPositionRatio.toFixed(1) }}%</span>
            <span class="stock-sum-hint">= 股票仓位</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import { ref, computed, onMounted } from 'vue'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { formatMoney } from '@/utils/formatters'
import { useFundStore } from '@/stores/funds'
import DonutChart from '@/components/positions/DonutChart.vue'
const loadError = computed(() => holdingStore.error || fundStore.error || priceStore.error || '')
function retryLoad() { location.reload() }


const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const loading = ref(true)
const donutSize = 160

const totalMarketValue = computed(() => {
  return holdingStore.holdings.reduce((s, h) => {
    const price = priceStore.prices[h.stock_code]?.price || 0
    return s + price * h.quantity
  }, 0)
})

const totalAvailable = computed(() => fundStore.totalAvailable)
// 总资产 = 总市值 + 总可用资金
const totalAsset = computed(() => totalMarketValue.value + totalAvailable.value)

const totalPositionRatio = computed(() => {
  return totalAsset.value > 0 ? (totalMarketValue.value / totalAsset.value) * 100 : 0
})

const chartRadius = donutSize / 2 - 20

// ===== 股票比例（各股票市值占总资产，合计 = 总体仓位） =====
const stockColorList = ['#d64545', '#2e8b57', '#4a6fa5', '#c98a2c', '#7a5bd6', '#ff6b35', '#3aa6a6', '#a34a8c']

const stockShares = computed(() => {
  const grouped = {}
  for (const h of holdingStore.holdings) {
    const code = h.stock_code
    if (!grouped[code]) {
      grouped[code] = {
        code,
        name: priceStore.prices[code]?.stock_name || h.stock_name || code,
        quantity: 0,
        marketValue: 0
      }
    }
    grouped[code].quantity += h.quantity
    const price = priceStore.prices[code]?.price || 0
    grouped[code].marketValue += price * h.quantity
  }
  const list = Object.values(grouped)
    .map(s => ({ ...s, percent: totalAsset.value > 0 ? (s.marketValue / totalAsset.value) * 100 : 0 }))
    .sort((a, b) => b.percent - a.percent)
  return list.map((s, i) => ({ ...s, color: stockColorList[i % stockColorList.length] }))
})

const chartSegments = computed(() => {
  let offset = 0
  const circ = 2 * Math.PI * chartRadius
  return stockShares.value.map(s => {
    const arcLength = (s.percent / 100) * circ
    const seg = { color: s.color, arcLength, offset: -offset }
    offset += arcLength
    return seg
  })
})

onMounted(async () => {
  try {
    await Promise.all([
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Positions load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 4px 2px 12px;
}
.page-title { font-size: 17px; font-weight: 700; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
.section-card { padding: 14px 16px; margin-bottom: 10px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding-bottom: 10px; }
.title-accent { width: 3px; height: 13px; border-radius: 2px; }
.title-accent--accent { background: var(--bg-accent); }
.total-ratio-detail {
  display: flex; align-items: baseline; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary); margin-top: 4px;
}
.trd-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.trd-sep { color: var(--text-muted); }

.stock-empty { text-align: center; padding: 16px 0; font-size: 13px; color: var(--text-muted); }
.stock-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--bg-subtle); margin: 14px 0 10px; }
.stock-bar-seg { height: 100%; }
.stock-list { display: flex; flex-direction: column; gap: 8px; }
.stock-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.stock-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stock-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.stock-qty { font-size: 11px; color: var(--text-muted); }
.stock-mv { font-size: 12px; font-weight: 600; }
.stock-pct { font-size: 12px; color: var(--text-secondary); width: 48px; text-align: right; }
.stock-sum { display: flex; align-items: baseline; justify-content: flex-end; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border-soft); margin-top: 10px; }
.stock-sum-label { font-size: 12px; color: var(--text-secondary); }
.stock-sum-value { font-size: 14px; font-weight: 700; }
.stock-sum-hint { font-size: 11px; color: var(--text-muted); }
</style>
