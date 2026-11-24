<!-- src/components/fund/SoloNavChart.vue — 单账户净值曲线（快照 / 累计投入） -->
<template>
  <div class="solo-nav">
    <div class="sn-header">
      <span class="sn-title">净值曲线</span>
      <span class="sn-hint">单位净值 = 总资产 / 累计投入</span>
    </div>
    <div v-if="!points.length" class="sn-empty">暂无快照数据</div>
    <template v-else>
      <svg :viewBox="`0 0 ${W} ${H}`" class="sn-svg" preserveAspectRatio="none">
        <line v-for="g in gridLines" :key="'g' + g" :x1="PAD.left" :x2="W - PAD.right" :y1="g" :y2="g" class="sn-grid" />
        <polyline :points="pathPoints" class="sn-line" />
        <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" r="2" class="sn-dot" />
        <text :x="W - PAD.right" :y="PAD.top + 4" class="sn-last" text-anchor="end">{{ lastValue.toFixed(4) }}</text>
      </svg>
      <div class="sn-axis">
        <span>{{ points[0].date.slice(5) }}</span>
        <span>{{ points[points.length - 1].date.slice(5) }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchPositionSnapshots } from '@/api/supabase'
import { useFundStore } from '@/stores/funds'
import { marketDate } from '@/utils/historicalSnapshotLedger'

const W = 420
const H = 200
const PAD = { top: 16, right: 46, bottom: 16, left: 10 }

const snapshots = ref([])
const fundStore = useFundStore()

// 某日累计外部投入（category=capital）
function investedAt(date) {
  return fundStore.capitalLogs
    .filter(l => l.category === 'capital' && l.created_at && marketDate(l.created_at) <= date)
    .reduce((s, l) => s + (l.type === 'add' ? l.amount : -l.amount), 0)
}

const values = computed(() => {
  return snapshots.value
    .map(s => {
      const inv = investedAt(s.date)
      return inv > 0 ? { date: s.date, value: s.asset / inv } : null
    })
    .filter(Boolean)
})

const points = computed(() => {
  const vals = values.value
  if (!vals.length) return []
  const min = Math.min(...vals.map(v => v.value))
  const max = Math.max(...vals.map(v => v.value))
  const range = max - min || 1
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom
  return vals.map((v, i) => ({
    date: v.date,
    value: v.value,
    x: PAD.left + (vals.length === 1 ? cw / 2 : (i / (vals.length - 1)) * cw),
    y: PAD.top + (1 - (v.value - min) / range) * ch
  }))
})

const pathPoints = computed(() => points.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const lastValue = computed(() => points.value.length ? points.value[points.value.length - 1].value : 0)
const gridLines = computed(() => [PAD.top, PAD.top + (H - PAD.top - PAD.bottom) / 2, H - PAD.bottom])

onMounted(async () => {
  try {
    await fundStore.loadCapitalLogs()
    snapshots.value = await fetchPositionSnapshots(500)
  } catch (e) {
    console.warn('SoloNavChart load error:', e)
  }
})
</script>

<style scoped>
.solo-nav { width: 100%; }
.sn-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.sn-title { font-size: 13px; font-weight: 600; }
.sn-hint { font-size: 10px; color: var(--text-muted); }
.sn-empty { text-align: center; padding: 30px 0; font-size: 12px; color: var(--text-muted); }
.sn-svg { width: 100%; height: 200px; }
.sn-grid { stroke: var(--border-soft); stroke-width: 1; }
.sn-line { fill: none; stroke: var(--color-rise); stroke-width: 2; }
.sn-dot { fill: var(--color-rise); opacity: 0.35; }
.sn-last { font-size: 10px; fill: var(--text-secondary); font-family: var(--font-number); }
.sn-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); padding: 0 2px; }
</style>
