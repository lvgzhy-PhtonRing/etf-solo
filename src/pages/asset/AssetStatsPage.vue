<template>
  <div class="page stats-page">
    <div class="page-header">
      <span class="page-title">统计报表<span class="page-sub">按分类统计支出与收入</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 周期切换 -->
    <div class="mode-card">
      <div class="period-nav">
        <button class="nav-btn" @click="offset--">‹</button>
        <span class="period-label">{{ periodLabel }}</span>
        <button class="nav-btn" :disabled="offset >= 0" @click="offset++">›</button>
      </div>
      <div class="mode-tabs">
        <button
          v-for="m in STATS_MODES"
          :key="m.key"
          class="mode-btn"
          :class="{ 'mode-btn--on': mode === m.key }"
          @click="setMode(m.key)"
        >{{ m.label }}</button>
      </div>
      <div v-if="mode === 'custom'" class="custom-row">
        <input v-model="customStart" class="c-input" type="date" />
        <span class="c-sep">至</span>
        <input v-model="customEnd" class="c-input" type="date" />
        <button class="c-ok" @click="refresh">确定</button>
      </div>
    </div>

    <!-- 三卡汇总 -->
    <div class="sum-grid">
      <div class="sum-box">
        <div class="sb-label">总收入</div>
        <div class="sb-value rise num-mono">{{ formatMoney(totalIncome) }}</div>
      </div>
      <div class="sum-box">
        <div class="sb-label">总支出</div>
        <div class="sb-value fall num-mono">{{ formatMoney(totalExpense) }}</div>
      </div>
      <div class="sum-box">
        <div class="sb-label">净结余</div>
        <div class="sb-value num-mono" :class="net >= 0 ? 'rise' : 'fall'">
          {{ net >= 0 ? '+' : '' }}{{ formatMoney(net) }}
        </div>
      </div>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="3" />

    <template v-else>
      <!-- 支出分类 -->
      <div class="section-card">
        <div class="cat-head">
          <span class="dot dot--expense"></span>
          <span class="cat-title">支出分类</span>
        </div>
        <div v-if="!expense.items.length" class="cat-empty">暂无记录</div>
        <div v-else class="cat-list">
          <div v-for="it in expense.items" :key="it.category" class="cat-item" @click="openDetail('expense', it.category)">
            <div class="cat-line">
              <span class="cat-name">{{ it.category }}</span>
              <span class="cat-amt num-mono">{{ formatMoney(it.amount) }}</span>
              <span class="cat-pct">{{ it.pct }}%</span>
            </div>
            <div class="cat-track">
              <div class="cat-fill cat-fill--expense" :style="{ width: barWidth(it.amount, expense.items) + '%' }"></div>
            </div>
            <div v-if="detail.type === 'expense' && detail.category === it.category" class="cat-detail">
              <div v-for="f in detail.flows" :key="f.id" class="cd-row">
                <span class="cd-title">{{ f.note || f.category }}</span>
                <span class="cd-meta">{{ f.date.slice(5) }} · {{ f.account || '—' }}</span>
                <span class="cd-amt num-mono fall">-{{ formatMoney(Math.abs(f.amount)) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 收入分类 -->
      <div class="section-card">
        <div class="cat-head">
          <span class="dot dot--income"></span>
          <span class="cat-title">收入分类</span>
        </div>
        <div v-if="!income.items.length" class="cat-empty">暂无记录</div>
        <div v-else class="cat-list">
          <div v-for="it in income.items" :key="it.category" class="cat-item" @click="openDetail('income', it.category)">
            <div class="cat-line">
              <span class="cat-name">{{ it.category }}</span>
              <span class="cat-amt num-mono">{{ formatMoney(it.amount) }}</span>
              <span class="cat-pct">{{ it.pct }}%</span>
            </div>
            <div class="cat-track">
              <div class="cat-fill cat-fill--income" :style="{ width: barWidth(it.amount, income.items) + '%' }"></div>
            </div>
            <div v-if="detail.type === 'income' && detail.category === it.category" class="cat-detail">
              <div v-for="f in detail.flows" :key="f.id" class="cd-row">
                <span class="cd-title">{{ f.note || f.category }}</span>
                <span class="cd-meta">{{ f.date.slice(5) }} · {{ f.account || '—' }}</span>
                <span class="cd-amt num-mono rise">+{{ formatMoney(Math.abs(f.amount)) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-hint">德州入账/出账不计入统计（与源程序一致）</div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { STATS_MODES, statsWindow, flowsInWindow, aggregateByCategory, excludePoker } from '@/utils/assetStats'
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

// 统计口径排除德州
const scoped = computed(() => excludePoker(store.flows))
const inWindow = computed(() => flowsInWindow(scoped.value, win.value))

const expense = computed(() => aggregateByCategory(inWindow.value, 'expense'))
const income = computed(() => aggregateByCategory(inWindow.value, 'income'))
const totalIncome = computed(() => income.value.total)
const totalExpense = computed(() => expense.value.total)
const net = computed(() => Math.round((totalIncome.value - totalExpense.value) * 100) / 100)

const periodLabel = computed(() => {
  const w = win.value
  if (!w) return '请选择日期'
  if (mode.value === 'custom') return `${w.start} 至 ${w.end.slice(0, 10)}`
  return `${w.start} ~ ${w.end.slice(0, 10)}`
})

function barWidth(amount, items) {
  const max = items[0]?.amount || 1
  return Math.max(2, (amount / max) * 100)
}

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

const detail = reactive({ type: '', category: '', flows: [] })

function openDetail(type, category) {
  if (detail.type === type && detail.category === category) {
    detail.type = ''
    detail.category = ''
    detail.flows = []
    return
  }
  detail.type = type
  detail.category = category
  detail.flows = inWindow.value
    .filter(f => f.type === type && f.category === category)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.page-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }

.mode-card { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-lg); padding: 10px 12px; margin-bottom: 10px; box-shadow: var(--shadow-card); }
.period-nav { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
.nav-btn {
  width: 26px; height: 26px; border-radius: 50%;
  border: none; background: var(--bg-hover); color: var(--text-secondary);
  font-size: 14px; cursor: pointer; line-height: 1;
}
.nav-btn:disabled { opacity: .35; }
.period-label { font-size: 12px; font-weight: 600; color: var(--text-primary); min-width: 170px; text-align: center; }

.mode-tabs { display: flex; gap: 2px; padding: 2px; background: var(--bg-hover); border-radius: var(--radius-md); }
.mode-btn {
  flex: 1; padding: 5px 0; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted);
  font-size: 11px; font-family: inherit; cursor: pointer;
}
.mode-btn--on { background: var(--bg-card); color: var(--bg-accent); font-weight: 600; box-shadow: 0 1px 3px rgba(120,100,75,.12); }

.custom-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.c-input {
  flex: 1; min-width: 0; background: var(--bg-hover);
  border: 1px solid transparent; border-radius: var(--radius-md);
  padding: 6px 8px; font-size: 11px; font-family: inherit; color: var(--text-primary);
}
.c-sep { font-size: 11px; color: var(--text-muted); }
.c-ok {
  border: none; border-radius: var(--radius-md); padding: 6px 12px;
  background: var(--bg-accent); color: #fff; font-size: 11px; cursor: pointer;
}

.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.sum-box {
  background: var(--bg-card); border: 1px solid var(--border-soft);
  border-radius: var(--radius-md); padding: 8px 4px; text-align: center;
  box-shadow: var(--shadow-card);
}
.sb-label { font-size: 10px; color: var(--text-muted); margin-bottom: 2px; }
.sb-value { font-size: 14px; font-weight: 700; }

.cat-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot--expense { background: var(--color-fall); }
.dot--income { background: var(--color-rise); }
.cat-title { font-size: 13px; font-weight: 600; }
.cat-empty { text-align: center; padding: 14px 0; font-size: 12px; color: var(--text-muted); }
.cat-list { display: flex; flex-direction: column; gap: 12px; }
.cat-item { cursor: pointer; }
.cat-line { display: flex; align-items: baseline; gap: 8px; font-size: 12px; }
.cat-name { flex: 1; font-weight: 500; }
.cat-amt { font-weight: 600; }
.cat-pct { width: 44px; text-align: right; font-size: 10px; color: var(--text-muted); }
.cat-track { height: 6px; border-radius: 3px; background: var(--bg-hover); margin-top: 5px; overflow: hidden; }
.cat-fill { height: 100%; border-radius: 3px; }
.cat-fill--expense { background: var(--color-rise); opacity: .8; }
.cat-fill--income { background: var(--color-fall); opacity: .8; }

.cat-detail { margin-top: 8px; padding: 8px 10px; background: var(--bg-hover); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 6px; }
.cd-row { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
.cd-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.cd-meta { font-size: 10px; color: var(--text-muted); }
.cd-amt { font-weight: 700; font-family: var(--font-number); }

.stat-hint { text-align: center; font-size: 10px; color: var(--text-muted); padding: 4px 0 8px; }
</style>
