<template>
  <div class="page trends-page">
    <div class="page-header">
      <span class="page-title">盈亏榜单<span class="title-en">Profit Ranking</span></span>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" />

    <template v-else>
      <!-- 赚最多（默认前3，可展开全部） -->
      <div class="section-card rank-card edge-rise">
        <div class="section-title">
          <span class="title-accent title-accent--rise"></span>
          赚最多
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!gainRankings.length" class="rank-empty">暂无已清仓盈利股票</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in gainVisible" :key="item.stock_code" class="rank-item" @click="openStockDetail(item)">
            <span class="rank-badge" :class="idx < 3 ? 'rank-badge--' + (idx + 1) : 'rank-badge--n'">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit rise">{{ formatProfit(item.profit) }}</span>
            <span class="rank-arrow">›</span>
          </div>
        </div>
        <button v-if="gainRankings.length > 3" class="rank-toggle" @click="gainExpanded = !gainExpanded">
          {{ gainExpanded ? '收起' : `展开全部（${gainRankings.length}）` }}
        </button>
      </div>

      <!-- 亏最多（默认前3，可展开全部） -->
      <div class="section-card rank-card edge-fall">
        <div class="section-title">
          <span class="title-accent title-accent--fall"></span>
          亏最多
          <span class="subtitle">仅比较已清仓股票</span>
        </div>
        <div v-if="!lossRankings.length" class="rank-empty">暂无已清仓亏损股票</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in lossVisible" :key="item.stock_code" class="rank-item" @click="openStockDetail(item)">
            <span class="rank-badge" :class="idx < 3 ? 'rank-badge--' + (idx + 1) : 'rank-badge--n'">{{ idx + 1 }}</span>
            <span class="rank-stock-name">{{ item.stock_name }}</span>
            <span class="rank-profit fall">{{ formatProfit(item.profit) }}</span>
            <span class="rank-arrow">›</span>
          </div>
        </div>
        <button v-if="lossRankings.length > 3" class="rank-toggle" @click="lossExpanded = !lossExpanded">
          {{ lossExpanded ? '收起' : `展开全部（${lossRankings.length}）` }}
        </button>
      </div>

      <!-- 当前持仓盈亏 -->
      <div class="section-card rank-card edge-accent">
        <div class="section-title">
          <span class="title-accent title-accent--accent"></span>
          当前持仓盈亏
          <span class="subtitle">按浮盈排序</span>
        </div>
        <div v-if="!holdingProfits.length" class="rank-empty">暂无持仓</div>
        <div v-else class="rank-list">
          <div v-for="(item, idx) in holdingVisible" :key="item.stock_code" class="rank-item">
            <span class="rank-badge" :class="idx < 3 ? 'rank-badge--' + (idx + 1) : 'rank-badge--n'">{{ idx + 1 }}</span>
            <span class="rank-stock-name">
              {{ item.stock_name }}
              <span class="rank-qty">{{ item.quantity }}股 · {{ item.profitPct >= 0 ? '+' : '' }}{{ item.profitPct.toFixed(1) }}%</span>
            </span>
            <span class="rank-profit" :class="item.profit >= 0 ? 'rise' : 'fall'">{{ formatProfit(item.profit) }}</span>
          </div>
        </div>
        <button v-if="holdingProfits.length > 5" class="rank-toggle" @click="holdingExpanded = !holdingExpanded">
          {{ holdingExpanded ? '收起' : `展开全部（${holdingProfits.length}）` }}
        </button>
      </div>

      <!-- 已清仓股票详情弹窗 -->
      <van-popup
        v-model:show="detailShow"
        position="center"
        round
        :style="{ width: '86%', maxWidth: '360px' }"
        :close-on-click-overlay="true"
      >
        <div class="stock-detail-panel">
          <div class="sd-header">
            <span class="sd-name">{{ detail.stockName }}</span>
            <span class="sd-code">{{ detail.stockCode }}</span>
          </div>
          <div class="dp-divider"></div>
          <div class="sd-row sd-row--buy">
            <span class="sd-label">买入</span>
            <span class="sd-meta">{{ detail.buyRange }} · {{ detail.buyQty }}股</span>
            <span class="sd-avg num-mono">{{ detail.buyAvgPrice.toFixed(2) }}</span>
          </div>
          <div class="sd-row sd-row--sell">
            <span class="sd-label">卖出</span>
            <span class="sd-meta">{{ detail.sellRange }} · {{ detail.sellQty }}股</span>
            <span class="sd-avg num-mono">{{ detail.sellAvgPrice.toFixed(2) }}</span>
          </div>
          <div class="dp-divider"></div>
          <div class="sd-profit-row">
            <span class="sd-profit-label">净利</span>
            <span class="sd-profit num-mono" :class="detail.profit >= 0 ? 'sd-up' : 'sd-down'">
              {{ formatProfit(detail.profit) }}
            </span>
            <span class="sd-profit-pct" :class="detail.profit >= 0 ? 'sd-up' : 'sd-down'">
              ({{ detail.profitPct >= 0 ? '+' : '' }}{{ detail.profitPct.toFixed(1) }}%)
            </span>
          </div>
          <div v-if="detail.cycleCount > 1" class="sd-hint">
            共 {{ detail.cycleCount }} 笔交易，均价为加权合计
          </div>
        </div>
      </van-popup>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { fetchAllTransactions } from '@/api/supabase'
import { computeClearedRankings, computeHoldingProfits } from '@/utils/rankings'
import { formatMoney } from '@/utils/formatters'

const loading = ref(true)

const holdingStore = useHoldingStore()
const priceStore = usePriceStore()

const transactions = ref([])
const gainExpanded = ref(false)
const lossExpanded = ref(false)
const holdingExpanded = ref(false)

const cleared = computed(() => computeClearedRankings(transactions.value))
const gainRankings = computed(() => cleared.value.filter(s => s.profit > 0))
const lossRankings = computed(() => cleared.value.filter(s => s.profit < 0).slice().sort((a, b) => a.profit - b.profit))
const gainVisible = computed(() => gainExpanded.value ? gainRankings.value : gainRankings.value.slice(0, 3))
const lossVisible = computed(() => lossExpanded.value ? lossRankings.value : lossRankings.value.slice(0, 3))
const holdingProfits = computed(() => computeHoldingProfits(holdingStore.holdings, priceStore.prices))
const holdingVisible = computed(() => holdingExpanded.value ? holdingProfits.value : holdingProfits.value.slice(0, 5))

function formatProfit(v) {
  const sign = v > 0 ? '+' : ''
  return `${sign}${formatMoney(v)}`
}

const detailShow = ref(false)
const detail = ref({
  stockName: '', stockCode: '',
  buyRange: '', sellRange: '',
  buyQty: 0, sellQty: 0,
  buyAvgPrice: 0, sellAvgPrice: 0,
  profit: 0, profitPct: 0, cycleCount: 0
})

function openStockDetail(item) {
  detail.value = {
    stockName: item.stock_name,
    stockCode: item.stock_code,
    buyRange: item.buyRange,
    sellRange: item.sellRange,
    buyQty: item.buyQty,
    sellQty: item.sellQty,
    buyAvgPrice: item.buyAvgPrice,
    sellAvgPrice: item.sellAvgPrice,
    profit: item.profit,
    profitPct: item.profitPct,
    cycleCount: item.txs.length
  }
  detailShow.value = true
}

onMounted(async () => {
  try {
    await Promise.all([
      holdingStore.loadHoldings(),
      fetchAllTransactions().then(rows => { transactions.value = rows })
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) await priceStore.loadPrices(codes)
  } catch (e) {
    console.error('Trends load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 2px 12px; }
.page-title { font-size: 20px; font-weight: 700; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
.section-card { padding: 14px 16px; margin-bottom: 10px; }
.section-title { display: flex; align-items: baseline; gap: 6px; font-size: 13px; font-weight: 600; padding-bottom: 10px; }
.title-accent { width: 3px; height: 13px; border-radius: 2px; align-self: center; }
.title-accent--rise { background: var(--color-rise); }
.title-accent--fall { background: var(--color-fall); }
.title-accent--accent { background: var(--bg-accent); }
.subtitle { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 4px; }
.rank-empty { text-align: center; padding: 16px 0; font-size: 13px; color: var(--text-muted); }
.rank-list { display: flex; flex-direction: column; }
.rank-item { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--border-soft); cursor: pointer; }
.rank-item:last-child { border-bottom: none; }
.rank-badge {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; background: var(--bg-hover); color: var(--text-secondary);
}
.rank-badge--1 { background: #f5c542; color: #5b4300; }
.rank-badge--2 { background: #c9c9c9; color: #444; }
.rank-badge--3 { background: #d99a6c; color: #4a2a10; }
.rank-stock-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-qty { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }
.rank-profit { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.rank-profit.rise { color: var(--color-rise); }
.rank-profit.fall { color: var(--color-fall); }
.rank-arrow { font-size: 16px; color: var(--text-muted); opacity: 0.4; }
.rank-toggle { width: 100%; border: none; background: transparent; color: var(--text-secondary); font-size: 12px; padding: 10px 0 0; cursor: pointer; font-family: inherit; }

.stock-detail-panel { padding: 18px 16px; }
.sd-header { display: flex; align-items: baseline; gap: 8px; }
.sd-name { font-size: 17px; font-weight: 700; }
.sd-code { font-size: 12px; color: var(--text-secondary); }
.dp-divider { height: 1px; background: var(--border-soft); margin: 12px 0; }
.sd-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; font-size: 13px; }
.sd-label { font-weight: 600; }
.sd-row--buy .sd-label { color: var(--color-rise); }
.sd-row--sell .sd-label { color: var(--color-fall); }
.sd-meta { flex: 1; color: var(--text-secondary); font-size: 12px; }
.sd-avg { font-weight: 600; }
.sd-profit-row { display: flex; align-items: baseline; justify-content: center; gap: 8px; padding: 8px 0; }
.sd-profit-label { font-size: 13px; color: var(--text-secondary); }
.sd-profit { font-size: 20px; font-weight: 700; }
.sd-profit-pct { font-size: 12px; }
.sd-up { color: var(--color-rise); }
.sd-down { color: var(--color-fall); }
.sd-hint { text-align: center; font-size: 11px; color: var(--text-muted); padding-top: 4px; }
</style>
