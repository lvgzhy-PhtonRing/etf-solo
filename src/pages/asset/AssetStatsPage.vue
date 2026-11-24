<template>
  <div class="page stats-page">
    <div class="page-header">
      <span class="page-title">统计报表<span class="page-sub">按分类统计支出与收入</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 周期切换 -->
    <div class="mode-tabs">
      <button
        v-for="m in STATS_MODES"
        :key="m.key"
        class="mode-btn"
        :class="{ 'mode-btn--on': mode === m.key }"
        @click="setMode(m.key)"
      >{{ m.label }}</button>
    </div>

    <!-- 自定义区间 -->
    <div v-if="mode === 'custom'" class="section-card custom-card">
      <input v-model="customStart" class="c-input" type="date" @change="refresh" />
      <span class="c-sep">至</span>
      <input v-model="customEnd" class="c-input" type="date" @change="refresh" />
    </div>

    <!-- 区间导航 -->
    <div v-else class="period-nav">
      <button class="nav-btn" @click="offset--">‹</button>
      <span class="period-label">{{ label }}</span>
      <button class="nav-btn" :disabled="offset >= 0" @click="offset++">›</button>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="3" />

    <template v-else>
      <!-- 支出 -->
      <div class="section-card">
        <div class="agg-head">
          <span class="agg-title agg-title--expense">支出</span>
          <span class="agg-total num-mono">{{ formatMoney(expense.total) }}</span>
        </div>
        <div v-if="!expense.items.length" class="agg-empty">本区间无支出</div>
        <div v-else class="agg-list">
          <div v-for="it in expense.items" :key="it.category" class="agg-item" @click="openDetail('expense', it.category)">
            <div class="agg-line">
              <span class="agg-cat">{{ it.category }}</span>
              <span class="agg-pct">{{ it.pct }}%</span>
              <span class="agg-amt num-mono">{{ formatMoney(it.amount) }}</span>
            </div>
            <div class="agg-track">
              <div class="agg-fill agg-fill--expense" :style="{ width: it.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 收入 -->
      <div class="section-card">
        <div class="agg-head">
          <span class="agg-title agg-title--income">收入</span>
          <span class="agg-total num-mono">{{ formatMoney(income.total) }}</span>
        </div>
        <div v-if="!income.items.length" class="agg-empty">本区间无收入</div>
        <div v-else class="agg-list">
          <div v-for="it in income.items" :key="it.category" class="agg-item" @click="openDetail('income', it.category)">
            <div class="agg-line">
              <span class="agg-cat">{{ it.category }}</span>
              <span class="agg-pct">{{ it.pct }}%</span>
              <span class="agg-amt num-mono">{{ formatMoney(it.amount) }}</span>
            </div>
            <div class="agg-track">
              <div class="agg-fill agg-fill--income" :style="{ width: it.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="net-tip">
        区间净额 <span class="num-mono" :class="net >= 0 ? 'rise' : 'fall'">{{ net >= 0 ? '+' : '' }}{{ formatMoney(net) }}</span>
      </div>
    </template>

    <!-- 分类明细 -->
    <van-popup v-model:show="detailShow" position="bottom" round :style="{ maxHeight: '74%' }">
      <div class="detail-panel">
        <div class="detail-title">{{ detailCategory }}<span class="detail-sub">{{ detailFlows.length }} 笔</span></div>
        <div class="detail-list">
          <div v-for="f in detailFlows" :key="f.id" class="detail-item">
            <div class="di-left">
              <span class="di-title">{{ f.note || f.category }}</span>
              <span class="di-date">{{ f.date }}<template v-if="f.account"> · {{ f.account }}</template></span>
            </div>
            <span class="di-amt num-mono" :class="f.amount >= 0 ? 'rise' : 'fall'">
              {{ f.amount >= 0 ? '+' : '' }}{{ formatMoney(f.amount) }}
            </span>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { STATS_MODES, statsWindow, flowsInWindow, aggregateByCategory } from '@/utils/assetStats'
import { formatMoney } from '@/utils/formatters'

const store = useAssetStore()

const mode = ref('month')
const offset = ref(0)
const customStart = ref('')
const customEnd = ref('')

const win = computed(() => statsWindow(mode.value, offset.value, {
  customStart: customStart.value,
  customEnd: customEnd.value
}))

const label = computed(() => {
  const w = win.value
  if (!w) return '—'
  return `${w.start} ~ ${w.end.slice(0, 10)}（不含）`
})

const inWindow = computed(() => flowsInWindow(store.flows, win.value))
const expense = computed(() => aggregateByCategory(inWindow.value, 'expense'))
const income = computed(() => aggregateByCategory(inWindow.value, 'income'))
const net = computed(() => Math.round((income.value.total - expense.value.total) * 100) / 100)

function setMode(m) {
  mode.value = m
  offset.value = 0
  if (m === 'custom' && !customStart.value) {
    const d = new Date()
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    customStart.value = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`
    customEnd.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
}

function refresh() {}

// ===== 明细 =====
const detailShow = ref(false)
const detailCategory = ref('')
const detailFlows = ref([])

function openDetail(type, category) {
  detailCategory.value = category
  detailFlows.value = inWindow.value
    .filter(f => f.type === type && f.category === category)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  detailShow.value = true
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.page-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }

.mode-tabs {
  display: flex; gap: 4px;
  padding: 3px;
  background: var(--bg-hover);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
}
.mode-btn {
  flex: 1; padding: 6px 2px;
  border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary);
  font-size: 11px; font-family: inherit; cursor: pointer;
}
.mode-btn--on { background: var(--bg-card); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 4px rgba(120,100,75,.12); }

.custom-card { display: flex; align-items: center; gap: 8px; }
.c-input {
  flex: 1; min-width: 0;
  background: var(--bg-hover); border: 1px solid transparent;
  border-radius: var(--radius-md); padding: 8px 10px;
  font-size: 12px; font-family: inherit; color: var(--text-primary);
}
.c-sep { font-size: 11px; color: var(--text-muted); }

.period-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 2px 10px;
}
.nav-btn {
  width: 30px; height: 30px;
  border: 1px solid var(--border-soft); border-radius: var(--radius-md);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 15px; cursor: pointer;
}
.nav-btn:disabled { opacity: .35; }
.period-label { font-size: 11px; color: var(--text-secondary); }

.agg-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.agg-title { font-size: 13px; font-weight: 600; }
.agg-title--expense { color: var(--color-rise); }
.agg-title--income { color: var(--color-fall); }
.agg-total { font-size: 16px; font-weight: 700; }
.agg-empty { text-align: center; padding: 14px 0; font-size: 12px; color: var(--text-muted); }
.agg-list { display: flex; flex-direction: column; gap: 12px; }
.agg-item { cursor: pointer; }
.agg-line { display: flex; align-items: baseline; gap: 8px; font-size: 12px; }
.agg-cat { flex: 1; font-weight: 500; }
.agg-pct { font-size: 10px; color: var(--text-muted); width: 42px; text-align: right; }
.agg-amt { font-weight: 600; width: 86px; text-align: right; }
.agg-track { height: 5px; border-radius: 3px; background: var(--bg-hover); margin-top: 5px; overflow: hidden; }
.agg-fill { height: 100%; border-radius: 3px; }
.agg-fill--expense { background: var(--color-rise); opacity: .75; }
.agg-fill--income { background: var(--color-fall); opacity: .75; }

.net-tip { text-align: center; font-size: 12px; color: var(--text-muted); padding: 6px 0 10px; }
.net-tip .num-mono { font-weight: 600; margin-left: 4px; }

.detail-panel { padding: 18px 16px 24px; }
.detail-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.detail-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }
.detail-list { display: flex; flex-direction: column; gap: 6px; max-height: 56vh; overflow-y: auto; }
.detail-item {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft); border-radius: var(--radius-md);
}
.di-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.di-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.di-date { font-size: 10px; color: var(--text-muted); }
.di-amt { font-size: 13px; font-weight: 600; }
</style>
