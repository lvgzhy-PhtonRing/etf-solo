<template>
  <div class="page poker-page">
    <div class="page-header">
      <span class="page-title">德州战绩<span class="title-en">Poker</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 筛选 -->
    <div class="filter-tabs">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="filter-btn"
        :class="{ 'filter-btn--on': filter === f.key }"
        @click="filter = f.key"
      >{{ f.label }}</button>
    </div>

    <!-- 汇总 -->
    <div class="section-card poker-sum">
      <div class="ps-item">
        <span class="ps-label">总收入</span>
        <span class="ps-value num-mono rise">{{ formatMoney(summary.income) }}</span>
      </div>
      <div class="ps-item">
        <span class="ps-label">总支出</span>
        <span class="ps-value num-mono fall">{{ formatMoney(summary.expense) }}</span>
      </div>
      <div class="ps-item">
        <span class="ps-label">净盈亏</span>
        <span class="ps-value num-mono" :class="summary.pnl >= 0 ? 'rise' : 'fall'">
          {{ summary.pnl >= 0 ? '+' : '' }}{{ formatMoney(summary.pnl) }}
        </span>
      </div>
    </div>

    <!-- 周期 -->
    <div class="kline-tabs">
      <button
        v-for="m in MODES"
        :key="m.key"
        class="kline-btn"
        :class="{ 'kline-btn--on': mode === m.key }"
        @click="mode = m.key"
      >{{ m.label }}</button>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="3" />

    <template v-else>
      <div v-if="!bars.length" class="empty-tip">暂无德州记录</div>
      <div v-else class="section-card">
        <!-- 柱状图 -->
        <div class="bar-chart">
          <div v-for="(b, i) in bars" :key="b.key" class="bar-col">
            <div class="bar-area">
              <div
                class="bar"
                :class="b.pnl >= 0 ? 'bar--up' : 'bar--down'"
                :style="{ height: heightOf(b.pnl) }"
              ></div>
            </div>
            <span class="bar-label">{{ showLabel(i) ? shortLabel(b.key) : '' }}</span>
          </div>
        </div>

        <!-- 明细 -->
        <div class="bar-list">
          <div v-for="b in barsDesc" :key="b.key" class="bar-row">
            <div class="br-left">
              <span class="br-key">{{ longLabel(b.key) }}</span>
              <span class="br-meta">{{ b.count }} 笔 · 收 {{ formatMoney(b.income) }} / 支 {{ formatMoney(b.expense) }}</span>
            </div>
            <span class="br-pnl num-mono" :class="b.pnl >= 0 ? 'rise' : 'fall'">
              {{ b.pnl >= 0 ? '+' : '' }}{{ formatMoney(b.pnl) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { buildPokerBars, pokerPeriodKey } from '@/utils/assetPoker'
import { formatMoney } from '@/utils/formatters'

const store = useAssetStore()

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: '线上', label: '线上' },
  { key: '线下', label: '线下' }
]
const MODES = [
  { key: 'day', label: '按日' },
  { key: 'week', label: '按周' },
  { key: 'month', label: '按月' }
]

const filter = ref('all')
const mode = ref('week')

const bars = computed(() => buildPokerBars(store.flows, mode.value, filter.value))
const barsDesc = computed(() => bars.value.slice().reverse())

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

const maxAbs = computed(() => Math.max(1, ...bars.value.map(b => Math.abs(b.pnl))))

// 柱子过多时抽稀标签，避免 375px 下重叠
function showLabel(i) {
  const n = bars.value.length
  if (n <= 10) return true
  const step = Math.ceil(n / 8)
  return i % step === 0
}

function heightOf(pnl) {
  const pct = Math.min(100, (Math.abs(pnl) / maxAbs.value) * 100)
  return Math.max(4, pct) + '%'
}

function shortLabel(key) {
  if (mode.value === 'month') return key.slice(2).replace('-', '/')
  const d = new Date(key + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function longLabel(key) {
  if (mode.value === 'month') return key.replace('-', '年') + '月'
  if (mode.value === 'day') return key
  const start = new Date(key + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const f = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${key.slice(0, 4)} ${f(start)}-${f(end)}`
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.filter-tabs {
  display: flex; gap: 4px; padding: 3px;
  background: var(--bg-hover);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
}
.filter-btn {
  flex: 1; padding: 6px 0;
  border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary);
  font-size: 12px; font-family: inherit; cursor: pointer;
}
.filter-btn--on { background: var(--bg-card); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 4px rgba(120,100,75,.12); }

.poker-sum { display: flex; justify-content: space-between; gap: 8px; }
.ps-item { display: flex; flex-direction: column; gap: 3px; }
.ps-label { font-size: 10px; color: var(--text-muted); }
.ps-value { font-size: 15px; font-weight: 700; }

.kline-tabs {
  display: flex; gap: 4px; padding: 3px;
  background: var(--bg-hover);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
}
.kline-btn {
  flex: 1; padding: 6px 0;
  border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary);
  font-size: 12px; font-family: inherit; cursor: pointer;
}
.kline-btn--on { background: var(--bg-card); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 4px rgba(120,100,75,.12); }

.empty-tip { text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px; }

.bar-chart {
  display: flex; align-items: flex-end; gap: 4px;
  height: 130px;
  padding: 6px 0 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-soft);
}
.bar-col { flex: 1; min-width: 14px; display: flex; flex-direction: column; align-items: center; height: 100%; }
.bar-area { flex: 1; display: flex; align-items: flex-end; justify-content: center; width: 100%; }
.bar { width: 70%; max-width: 18px; border-radius: 3px 3px 0 0; }
.bar--up { background: var(--color-rise); }
.bar--down { background: var(--color-fall); }
.bar-label { font-size: 9px; color: var(--text-muted); margin-top: 4px; white-space: nowrap; }

.bar-list { display: flex; flex-direction: column; margin-top: 10px; }
.bar-row {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 8px 2px;
  border-bottom: 1px solid var(--border-soft);
}
.bar-row:last-child { border-bottom: none; }
.br-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.br-key { font-size: 12px; font-weight: 500; }
.br-meta { font-size: 10px; color: var(--text-muted); }
.br-pnl { font-size: 13px; font-weight: 600; flex-shrink: 0; }
</style>
