<template>
  <div class="page poker-page">
    <div class="page-header">
      <span class="page-title">德州战绩<span class="page-sub">德州扑克出入账统计</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 筛选 -->
    <div class="seg-tabs">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="seg-btn"
        :class="{ 'seg-btn--on': filter === f.key }"
        @click="filter = f.key"
      >{{ f.label }}</button>
    </div>

    <!-- K 线周期 -->
    <div class="seg-tabs">
      <button
        v-for="m in MODES"
        :key="m.key"
        class="seg-btn"
        :class="{ 'seg-btn--on': mode === m.key }"
        @click="mode = m.key"
      >{{ m.label }}</button>
    </div>

    <!-- 三卡 -->
    <div class="sum-grid">
      <div class="sum-box">
        <div class="sb-label">德州入账</div>
        <div class="sb-value rise num-mono">{{ formatMoney(summary.income) }}</div>
      </div>
      <div class="sum-box">
        <div class="sb-label">德州出账</div>
        <div class="sb-value fall num-mono">{{ formatMoney(summary.expense) }}</div>
      </div>
      <div class="sum-box">
        <div class="sb-label">德州净盈亏</div>
        <div class="sb-value num-mono" :class="summary.pnl >= 0 ? 'rise' : 'fall'">
          {{ summary.pnl >= 0 ? '+' : '' }}{{ formatMoney(summary.pnl) }}
        </div>
      </div>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="3" />

    <template v-else>
      <!-- 图表卡 -->
      <div class="section-card chart-card">
        <div class="chart-head">
          <span class="chart-title"><span class="dot"></span>各期趋势</span>
          <button class="fs-btn" @click="fsOpen = true">⛶ 全屏</button>
        </div>

        <div class="chart-info">
          <span>周期: <b>{{ chart.stats.periods }}</b></span>
          <span>盈利: <b class="rise">{{ chart.stats.wins }}次</b></span>
          <span>亏损: <b class="fall">{{ chart.stats.losses }}次</b></span>
          <span>场均: <b>{{ chart.stats.avgNet >= 0 ? '+' : '' }}{{ formatMoney(chart.stats.avgNet) }}</b></span>
        </div>

        <PokerChart :bars="bars" :mode="mode" />
      </div>

      <!-- 明细（倒序；月K按周分组） -->
      <div class="detail-list">
        <div v-for="d in detailsDesc" :key="d.key" class="section-card detail-card">
          <div class="dc-head">
            <span class="dc-label">{{ d.label }}</span>
            <span class="dc-net num-mono" :class="d.net >= 0 ? 'rise' : 'fall'">
              {{ d.net >= 0 ? '+' : '' }}{{ formatMoney(d.net) }}
            </span>
          </div>

          <!-- 月K：按周分组 -->
          <template v-if="mode === 'month'">
            <div v-for="w in d.weeks" :key="w.key" class="week-block">
              <div class="week-head">
                <span class="week-label">{{ w.label }}</span>
                <span class="week-net num-mono" :class="w.net >= 0 ? 'rise' : 'fall'">
                  {{ w.net >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(w.net)) }}
                </span>
              </div>
              <div class="item-list">
                <div v-for="f in w.items" :key="f.id" class="item-row item-row--sub">
                  <div class="ir-left">
                    <span class="ir-title">{{ f.note || f.category }}</span>
                    <span class="ir-meta">{{ f.date.slice(5) }} · {{ f.account || '—' }}</span>
                  </div>
                  <span class="ir-amt num-mono" :class="f.amount >= 0 ? 'rise' : 'fall'">
                    {{ f.amount >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(f.amount)) }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- 日/周K：平铺 -->
          <div v-else class="item-list">
            <div v-for="f in d.items" :key="f.id" class="item-row">
              <div class="ir-left">
                <span class="ir-title">{{ f.note || f.category }}</span>
                <span class="ir-meta">{{ f.date.slice(5) }} · {{ f.account || '—' }}</span>
              </div>
              <span class="ir-amt num-mono" :class="f.amount >= 0 ? 'rise' : 'fall'">
                {{ f.amount >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(f.amount)) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 全屏 -->
    <div v-if="fsOpen" class="fs-overlay">
      <div class="fs-header">
        <span class="fs-title">德州战绩 · {{ modeLabel }}</span>
        <button class="fs-close" @click="fsOpen = false">✕</button>
      </div>
      <div class="fs-body">
        <div class="chart-info chart-info--fs">
          <span>周期: <b>{{ chart.stats.periods }}</b></span>
          <span>盈利: <b class="rise">{{ chart.stats.wins }}次</b></span>
          <span>亏损: <b class="fall">{{ chart.stats.losses }}次</b></span>
          <span>场均: <b>{{ chart.stats.avgNet >= 0 ? '+' : '' }}{{ formatMoney(chart.stats.avgNet) }}</b></span>
        </div>
        <PokerChart :bars="bars" :mode="mode" fullscreen />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import PokerChart from '@/components/asset/PokerChart.vue'
import { useAssetStore } from '@/stores/assets'
import { buildPokerBars, pokerChart, pokerFlows, pokerPeriodKey } from '@/utils/assetPoker'
import { weekKey, weekLabel } from '@/utils/assetLedger'
import { formatMoney } from '@/utils/formatters'

const store = useAssetStore()

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: '线上', label: '线上' },
  { key: '线下', label: '线下' }
]
const MODES = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' }
]

// 源程序默认筛选「线上」
const filter = ref('线上')
const mode = ref('week')
const fsOpen = ref(false)

const modeLabel = computed(() => MODES.find(m => m.key === mode.value)?.label || '')

const bars = computed(() => buildPokerBars(store.flows, mode.value, filter.value))
const chart = computed(() => pokerChart(bars.value))

const summary = computed(() => {
  const s = bars.value.reduce((acc, b) => ({
    income: acc.income + b.income,
    expense: acc.expense + b.expense
  }), { income: 0, expense: 0 })
  return {
    income: Math.round(s.income * 100) / 100,
    expense: Math.round(s.expense * 100) / 100,
    pnl: Math.round((s.income - s.expense) * 100) / 100
  }
})

// 明细：按周期分组，倒序；月K 下再按周分组
const detailsDesc = computed(() => {
  const flows = pokerFlows(store.flows, filter.value)
  const map = new Map()
  for (const f of flows) {
    const key = pokerPeriodKey(f.date, mode.value)
    if (!map.has(key)) map.set(key, { key, items: [] })
    map.get(key).items.push(f)
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(g => {
      const items = g.items.slice().sort((a, b) => {
        if (a.date !== b.date) return String(b.date).localeCompare(String(a.date))
        return (b.id || 0) - (a.id || 0)
      })
      const income = items.filter(f => f.amount >= 0).reduce((s, f) => s + f.amount, 0)
      const expense = items.filter(f => f.amount < 0).reduce((s, f) => s + Math.abs(f.amount), 0)
      const base = {
        key: g.key,
        label: modeLabelOf(g.key),
        net: Math.round((income - expense) * 100) / 100,
        items
      }
      if (mode.value !== 'month') return base

      const wk = new Map()
      for (const f of items) {
        const k = weekKey(f.date)
        if (!wk.has(k)) wk.set(k, { key: k, label: weekLabel(k), items: [] })
        wk.get(k).items.push(f)
      }
      base.weeks = [...wk.values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .map(w => {
          const wi = w.items.filter(f => f.amount >= 0).reduce((s, f) => s + f.amount, 0)
          const we = w.items.filter(f => f.amount < 0).reduce((s, f) => s + Math.abs(f.amount), 0)
          return { ...w, net: Math.round((wi - we) * 100) / 100 }
        })
      return base
    })
})

function modeLabelOf(key) {
  if (mode.value === 'month') return key.replace('-', '年') + '月'
  if (mode.value === 'week') {
    const y = key.slice(0, 4)
    return `${y} ${weekLabel(key)}`
  }
  return key
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.page-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }

.seg-tabs {
  display: flex; gap: 2px; padding: 3px;
  background: var(--bg-hover);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
}
.seg-btn {
  flex: 1; padding: 6px 0; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted);
  font-size: 12px; font-family: inherit; cursor: pointer;
}
.seg-btn--on { background: var(--bg-card); color: var(--bg-accent); font-weight: 600; box-shadow: 0 1px 4px rgba(120,100,75,.12); }

.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.sum-box {
  background: var(--bg-card); border: 1px solid var(--border-soft);
  border-radius: var(--radius-md); padding: 8px 4px; text-align: center;
  box-shadow: var(--shadow-card);
}
.sb-label { font-size: 10px; color: var(--text-muted); margin-bottom: 2px; }
.sb-value { font-size: 14px; font-weight: 700; }

.chart-card { padding: 12px 12px 6px; }
.chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chart-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bg-accent); }
.fs-btn {
  border: 1px solid var(--border-soft); background: var(--bg-card);
  color: var(--text-secondary); border-radius: var(--radius-round);
  font-size: 11px; padding: 3px 10px; cursor: pointer; font-family: inherit;
}

.chart-info {
  display: flex; gap: 14px; flex-wrap: wrap;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: 7px 10px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.chart-info b { color: var(--text-primary); font-weight: 600; }
.chart-info--fs { font-size: 12px; }

.detail-list { display: flex; flex-direction: column; gap: 8px; }
.detail-card { padding: 12px 14px; }
.dc-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.dc-label { font-size: 13px; font-weight: 700; }
.dc-net { font-size: 13px; font-weight: 700; }

.week-block { margin-bottom: 8px; }
.week-head { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
.week-net { font-weight: 700; font-family: var(--font-number); }

.item-list { display: flex; flex-direction: column; gap: 5px; }
.item-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.item-row--sub { padding-left: 10px; }
.ir-left { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.ir-title { font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ir-meta { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.ir-amt { font-size: 11px; font-weight: 700; font-family: var(--font-number); flex-shrink: 0; }

.fs-overlay {
  position: fixed; inset: 0; z-index: 3000;
  display: flex; flex-direction: column;
  background: var(--bg-primary);
}
.fs-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.fs-title { font-size: 15px; font-weight: 700; }
.fs-close {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: var(--bg-hover); color: var(--text-secondary);
  font-size: 14px; cursor: pointer;
}
.fs-body { flex: 1; overflow: auto; padding: 12px 12px 20px; }
</style>
