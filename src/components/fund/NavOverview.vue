<!-- src/components/fund/NavOverview.vue — 单账户净值档案 -->
<template>
  <div class="nav-overview">
    <div class="ov-meta">
      <span class="ov-meta-title">
        <span class="ov-dot"></span>
        <span class="ov-meta-name">
          <span class="ov-meta-code">我的账户</span>
          <span class="ov-meta-short">单位净值</span>
        </span>
      </span>
      <span class="ov-date num-mono">{{ navDate }}</span>
    </div>

    <div class="ov-headline">
      <span class="ov-nav num-mono">{{ navText }}</span>
      <span v-if="dailyChange !== null" class="ov-change num-mono"
        :class="dailyChange >= 0 ? 'text-rise' : 'text-fall'">
        {{ pct(dailyChange) }}
      </span>
    </div>

    <div class="ov-info">
      <div class="ov-info-item">
        <div class="ov-info-label">起始快照</div>
        <div class="ov-info-value ov-info-value--date">{{ inceptionText }}</div>
      </div>
      <div class="ov-info-item">
        <div class="ov-info-label">累计投入</div>
        <div class="ov-info-value num-mono">{{ scaleText }}</div>
      </div>
    </div>

    <div class="ov-periods">
      <div class="ov-period" v-for="p in periodReturns" :key="p.label">
        <div class="ov-period-label">{{ p.label }}</div>
        <div class="ov-period-value num-mono"
          :class="p.value === null ? 'ov-na' : (p.value >= 0 ? 'text-rise' : 'text-fall')">
          {{ pct(p.value) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatMoney } from '@/utils/formatters'
import { fetchPositionSnapshots } from '@/api/supabase'
import { marketDate } from '@/utils/historicalSnapshotLedger'
import { snapshotOnOrBefore } from '@/utils/snapshotLookup'
import { useHoldingStore } from '@/stores/holdings'
import { usePriceStore } from '@/stores/prices'
import { useFundStore } from '@/stores/funds'

const PERIODS = [
  { label: '近1月', months: 1 },
  { label: '近3月', months: 3 },
  { label: '近6月', months: 6 },
  { label: '近1年', months: 12 }
]

const snapshots = ref([])
const holdingStore = useHoldingStore()
const priceStore = usePriceStore()
const fundStore = useFundStore()

const latest = computed(() =>
  snapshots.value.length ? snapshots.value[snapshots.value.length - 1] : null)

// 当前总资产：无持仓=纯现金；有持仓且行情齐全=市值+现金；缺行情回退最新快照
const currentAsset = computed(() => {
  const holdings = holdingStore.holdings
  if (!holdings.length) return fundStore.totalAvailable
  const pricesReady = holdings.every(h => priceStore.prices[h.stock_code]?.price > 0)
  if (!pricesReady) return latest.value ? latest.value.asset : fundStore.totalAvailable
  const mv = holdings.reduce((s, h) => s + priceStore.prices[h.stock_code].price * h.quantity, 0)
  return mv + fundStore.totalAvailable
})

// 某日为止的累计外部投入（category=capital）
function investedAt(date) {
  return fundStore.capitalLogs
    .filter(l => l.category === 'capital' && marketDate(l.created_at || '') <= date)
    .reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0)
}

// 当日单位净值 = 总资产 / 累计投入
const currentNav = computed(() => {
  const inv = investedAt(marketDate())
  return inv > 0 && currentAsset.value > 0 ? currentAsset.value / inv : null
})

const navDate = computed(() => currentNav.value !== null ? marketDate() : (latest.value ? latest.value.date : '—'))

const navText = computed(() => (currentNav.value === null ? '—' : currentNav.value.toFixed(4)))

const inceptionText = computed(() => {
  if (!snapshots.value.length) return '—'
  const d = snapshots.value[0].date
  return `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`
})

const scaleText = computed(() => formatMoney(fundStore.totalCapital))

// 当日涨跌 = Σ(现价-昨收)×股数 / 总资产
const dailyChange = computed(() => {
  const asset = currentAsset.value
  if (!asset) return null
  let pnl = 0
  let hasPrice = false
  for (const h of holdingStore.holdings) {
    const p = priceStore.prices[h.stock_code]
    if (!p || !p.price) continue
    hasPrice = true
    const prev = p.prev_close > 0 ? p.prev_close : p.price / (1 + (p.change_pct || 0) / 100)
    pnl += (p.price - prev) * h.quantity
  }
  if (!hasPrice) return null
  return (pnl / asset) * 100
})

function toStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function shiftMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() - months)
  return toStr(d)
}

const periodReturns = computed(() => {
  const last = latest.value
  const navNow = currentNav.value
  if (!last || navNow === null) return PERIODS.map(it => ({ ...it, value: null }))
  return PERIODS.map(it => {
    const target = shiftMonths(last.date, it.months)
    const past = snapshotOnOrBefore(snapshots.value, target)
    if (!past) return { ...it, value: null }
    const inv = investedAt(past.date)
    if (!(inv > 0)) return { ...it, value: null }
    const pastNav = past.asset / inv
    return { ...it, value: (navNow / pastNav - 1) * 100 }
  })
})

function pct(v) {
  return v === null || v === undefined ? '—' : `${Number(v).toFixed(2)}%`
}

onMounted(async () => {
  try {
    snapshots.value = await fetchPositionSnapshots(500)
  } catch (e) {
    console.warn('NavOverview load error:', e)
  }
})
</script>

<style scoped>
.nav-overview { padding: 0 0 4px; }
.ov-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ov-meta-title { display: flex; align-items: center; gap: 8px; }
.ov-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-rise); }
.ov-meta-name { display: flex; align-items: baseline; gap: 6px; }
.ov-meta-code { font-size: 13px; font-weight: 600; }
.ov-meta-short { font-size: 11px; color: var(--text-secondary); }
.ov-date { font-size: 11px; color: var(--text-muted); }
.ov-headline { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.ov-nav { font-size: 34px; font-weight: 700; line-height: 1.1; letter-spacing: -1px; }
.ov-change { font-size: 14px; font-weight: 600; }
.text-rise { color: var(--color-rise); }
.text-fall { color: var(--color-fall); }
.ov-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.ov-info-item { background: var(--bg-hover); border-radius: var(--radius-md); padding: 8px 10px; }
.ov-info-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.ov-info-value { font-size: 13px; font-weight: 600; }
.ov-info-value--date { font-size: 12px; }
.ov-periods { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.ov-period { text-align: center; background: var(--bg-hover); border-radius: var(--radius-md); padding: 6px 2px; }
.ov-period-label { font-size: 10px; color: var(--text-muted); margin-bottom: 2px; }
.ov-period-value { font-size: 12px; font-weight: 600; }
.ov-na { color: var(--text-muted); }
</style>
