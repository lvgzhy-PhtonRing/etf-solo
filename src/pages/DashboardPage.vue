<!-- src/pages/DashboardPage.vue -->
<template>
  <div class="page dashboard-page">
    <div class="page-header">
      <span class="page-title">持仓总览<span class="title-en">Holdings Overview</span></span>
    </div>

    <!-- 账户总资产模块 -->
    <div class="section-card account-hero edge-accent">
      <LoadingSkeleton v-if="loading" :count="1" />
      <AccountSummary
        v-else
        :total-asset="summary.totalAsset"
        :market-value="summary.totalMarketValue"
        :available="summary.totalAvailable"
        :position-ratio="summary.positionRatio"
        :float-pnl="summary.floatPnl"
        :daily-pnl="summary.dailyPnl"
        :total-profit="summary.totalProfit"
        :profit-rate="summary.profitRate"
        :price-update-time="priceTimeText"
      />
    </div>

    <!-- 快捷入口 -->
    <div class="action-bar">
      <button class="act-btn" @click="showBuySheet = true">买入股票</button>
      <button class="act-btn" @click="showRecordsSheet = true">交易记录</button>
    </div>

    <!-- 持仓模块 -->
    <div class="section-card holdings-module edge-accent">
      <div class="section-title">
        <span class="section-title-left">
          <span class="title-accent title-accent--accent"></span>
          <span>持仓股票</span>
          <span class="swipe-hint">◀ 左滑卖出</span>
          <button v-if="displayHoldings.length" class="kline-hint" @click="openKLine(displayHoldings[0])">⛶ 点看K线</button>
        </span>
        <span class="stock-count">{{ displayHoldings.length }} 只</span>
      </div>

      <LoadingSkeleton v-if="loading" :count="3" />

      <EmptyState
        v-else-if="!displayHoldings.length"
        icon="&#x1F4ED;"
        text="暂无持仓"
      />

      <template v-else>
        <HoldingCard
          v-for="h in displayHoldings"
          :key="h.stock_code"
          :stock="h"
          @tap="openKLine(h)"
          @sell="onSellStock"
        />
      </template>
    </div>

    <KLineOverlay
      v-if="klineStock"
      :stock="klineStock"
      @close="klineStock = null"
    />

    <BuySheet v-model="showBuySheet" @changed="onTradeChanged" />
    <SellSheet v-model="showSellSheet" :stock="sellStock" @changed="onTradeChanged" />
    <TradeRecordsSheet v-model="showRecordsSheet" @changed="onTradeChanged" />
  </div>

</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'
import { calcProfit, calcPositionRatio } from '@/utils/calculators'
import AccountSummary from '@/components/dashboard/AccountSummary.vue'
import HoldingCard from '@/components/dashboard/HoldingCard.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import KLineOverlay from '@/components/kline/KLineOverlay.vue'
import BuySheet from '@/components/trade/BuySheet.vue'
import SellSheet from '@/components/trade/SellSheet.vue'
import TradeRecordsSheet from '@/components/trade/TradeRecordsSheet.vue'

const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()
const loading = ref(true)
const klineStock = ref(null)
const showBuySheet = ref(false)
const showSellSheet = ref(false)
const showRecordsSheet = ref(false)
const sellStock = ref(null)

onMounted(async () => {
  try {
    await Promise.all([
      holdingStore.loadHoldings(),
      fundStore.loadCapitalLogs()
    ])
    const codes = holdingStore.stockCodes
    if (codes.length) {
      await priceStore.loadPrices(codes)
    } else {
      await priceStore.loadFromCache()
    }
  } catch (e) {
    console.error('Dashboard load error:', e)
  } finally {
    loading.value = false
  }
})

// 真实行情更新时间（价格拉取完成时刻）
const priceTimeText = computed(() => {
  if (!priceStore.lastUpdated) return ''
  const d = new Date(priceStore.lastUpdated)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

function openKLine(h) {
  const priceData = priceStore.prices[h.stock_code] || {}
  klineStock.value = {
    ...h,
    cost_price: h.cost_price || 0,
    currentPrice: priceData.price || h.currentPrice || 0,
    changePct: priceData.change_pct || h.changePct || 0
  }
}

function onSellStock(stock) {
  sellStock.value = {
    code: stock.stock_code,
    name: stock.stock_name,
    price: stock.currentPrice || stock.cost_price
  }
  showSellSheet.value = true
}

async function onTradeChanged() {
  try {
    const { refreshHistoricalSnapshots } = await import('@/utils/historicalSnapshots')
    refreshHistoricalSnapshots({ afterLedgerChange: true }).catch(e => console.warn('历史快照暂未更新：', e))
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    const codes = holdingStore.stockCodes
    if (codes.length) {
      await priceStore.loadPrices(codes)
    } else {
      await priceStore.loadFromCache()
    }
    const { saveCurrentPositionSnapshot } = await import('@/utils/positionSnapshot')
    await saveCurrentPositionSnapshot().catch(e => console.error('Snapshot:', e))
  } catch (e) {
    console.error('Trade changed refresh error:', e)
  }
}

const displayHoldings = computed(() => {
  return holdingStore.holdings.map(h => {
    const priceData = priceStore.prices[h.stock_code] || {}
    const currentPrice = priceData.price || h.cost_price || 0
    const stockName = priceData.stock_name || h.stock_name || ''
    return {
      ...h,
      stock_name: stockName,
      currentPrice,
      changePct: priceData.change_pct || 0,
      marketValue: currentPrice * h.quantity,
      profit: calcProfit(currentPrice, h.cost_price, h.quantity)
    }
  }).sort((a, b) => b.marketValue - a.marketValue)
})

const summary = computed(() => {
  const holdings = displayHoldings.value
  const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.cost_price * h.quantity, 0)
  const floatPnl = totalMarketValue - totalCost
  const totalAvailable = fundStore.totalAvailable
  const totalAsset = totalMarketValue + totalAvailable
  const totalCapital = fundStore.totalCapital
  const totalProfit = totalAsset - totalCapital
  return {
    totalAsset,
    totalMarketValue,
    totalAvailable,
    positionRatio: calcPositionRatio(totalMarketValue, totalAsset),
    floatPnl,
    dailyPnl: holdings.reduce((s, h) => {
      const priceData = priceStore.prices[h.stock_code] || {}
      const pct = parseFloat(priceData.change_pct) || 0
      const price = priceData.price || h.currentPrice || 0
      const prevClose = priceData.prev_close > 0 ? priceData.prev_close : (pct !== -100 ? price / (1 + pct / 100) : price)
      return s + (price - prevClose) * h.quantity
    }, 0),
    totalProfit,
    profitRate: totalCapital > 0 ? (totalProfit / totalCapital) * 100 : 0
  }
})
</script>

<style scoped>
.account-hero {
  padding: 12px 16px;
  background: linear-gradient(150deg, rgba(191,107,63,.08), rgba(214,69,69,.05) 60%, #ffffff);
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-card);
}
.action-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.act-btn {
  flex: 1;
  height: 36px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.act-btn:active {
  background: var(--bg-subtle);
}
.section-title {
  display: flex; justify-content: space-between;
  padding: 8px 0 6px; font-size: 13px; font-weight: 600;
}
.section-title-left { display: flex; align-items: center; gap: 8px; }
.stock-count { font-size: 12px; color: var(--text-secondary); font-weight: 400; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, var(--color-rise), #ff8a9a);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
  animation: hint-pulse 2s ease-in-out infinite;
}
@keyframes hint-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.kline-hint {
  font-size: 11px;
  font-family: inherit;
  line-height: 1.2;
  color: #7a5bd6;
  background: rgba(111,77,255,0.08);
  border: 1px solid rgba(111,77,255,0.28);
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.kline-hint:active {
  background: rgba(111,77,255,0.18);
}
</style>
