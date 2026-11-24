<!-- src/components/fund/AccountNavChart.vue — 账户净值对比（账户 / ETF 金枪不倒 / 027730） -->
<template>
  <div class="account-nav">
    <div class="nav-head">
      <span class="nav-title">净值对比</span>
      <span class="nav-hint">{{ NAV_BASE_LABEL }}</span>
    </div>

    <div v-if="!loaded" class="nav-empty">加载中…</div>
    <div v-else-if="!series.length" class="nav-empty">暂无净值数据</div>
    <template v-else>
      <svg :viewBox="`0 0 ${W} ${H}`" class="nav-svg" preserveAspectRatio="none">
        <line v-for="t in yTicks" :key="'g' + t" :x1="PAD.left" :x2="W - PAD.right" :y1="yOf(t)" :y2="yOf(t)" class="nav-grid" />
        <line :x1="PAD.left" :x2="W - PAD.right" :y1="yOf(100)" :y2="yOf(100)" class="nav-base" />
        <text v-for="t in yTicks" :key="'t' + t" :x="PAD.left - 6" :y="yOf(t) + 3" text-anchor="end" class="nav-tick">{{ t }}</text>
        <polyline v-for="s in series" :key="s.key" :points="pathOf(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle v-for="s in series" :key="'d' + s.key" :cx="lastX(s)" :cy="lastY(s)" r="2.6" :fill="s.color" />
      </svg>
      <div class="nav-axis">
        <span>{{ NAV_BASE_DATE.slice(5) }}</span>
        <span>{{ axisEnd }}</span>
      </div>
    </template>

    <div class="nav-legend" v-if="series.length">
      <div v-for="s in series" :key="'l' + s.key" class="legend-item">
        <div class="legend-main">
          <span class="legend-dot" :style="{ background: s.color }"></span>
          <span class="legend-name">{{ s.name }}</span>
          <span class="legend-nav num-mono">{{ s.navText }}</span>
        </div>
        <div class="legend-desc">{{ s.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchPositionSnapshots } from '@/api/supabase'
import { NAV_BASE_DATE, NAV_BASE_ASSET, NAV_BASE_LABEL } from '@/utils/navBase'

const W = 420
const H = 220
const PAD = { top: 16, right: 16, bottom: 22, left: 36 }

const loaded = ref(false)
const solo = ref([])
const etf = ref([])
const fund = ref([])

const series = computed(() => {
  const mmdd = d => d.slice(5).replace('-', '/')
  const soloPoints = solo.value.map(p => ({ date: p.date, nav: p.asset / NAV_BASE_ASSET }))
  const etfPoints = etf.value.map(p => ({ date: p.date, nav: p.nav }))
  const fundPoints = fund.value.map(p => ({ date: p.date, nav: p.nav }))
  return [
    { key: 'solo', name: '账户净值', color: '#bf6b3f', points: soloPoints, desc: `${NAV_BASE_DATE} = 1.0000` },
    { key: 'etf', name: '金枪不倒', color: '#ff4d6d', points: etfPoints, desc: `ETF 组合 · 至 ${mmdd(etfPoints.at(-1)?.date || '')}` },
    { key: 'fund', name: '027730 沪深300增C', color: '#4d9fff', points: fundPoints, desc: `基金净值 · ${mmdd(fundPoints[0]?.date || '')} 起` }
  ].filter(s => s.points.length).map(s => ({
    ...s,
    navText: (s.points.at(-1)?.nav ?? 0).toFixed(4)
  }))
})

const tMin = Date.parse(NAV_BASE_DATE + 'T00:00:00')
const tMax = computed(() => {
  let max = tMin
  for (const s of series.value) {
    const last = s.points.at(-1)
    if (last) max = Math.max(max, Date.parse(last.date + 'T00:00:00'))
  }
  return max
})

const yMin = computed(() => {
  const vals = series.value.flatMap(s => s.points.map(p => p.nav * 100))
  if (!vals.length) return 95
  const lo = Math.min(...vals, 100)
  return Math.floor(lo - 2)
})
const yMax = computed(() => {
  const vals = series.value.flatMap(s => s.points.map(p => p.nav * 100))
  if (!vals.length) return 105
  const hi = Math.max(...vals, 100)
  return Math.ceil(hi + 2)
})

function xOf(date) {
  const ts = Date.parse(date + 'T00:00:00')
  const span = tMax.value - tMin
  if (span <= 0) return PAD.left
  return PAD.left + ((ts - tMin) / span) * (W - PAD.left - PAD.right)
}
function yOf(pct) {
  const span = yMax.value - yMin.value
  if (span <= 0) return PAD.top + (H - PAD.top - PAD.bottom) / 2
  return PAD.top + (H - PAD.top - PAD.bottom) * (1 - (pct - yMin.value) / span)
}

const yTicks = computed(() => {
  const lo = yMin.value
  const hi = yMax.value
  const step = (hi - lo) / 4
  return [0, 1, 2, 3, 4].map(i => Math.round((lo + step * i) * 10) / 10)
})

function pathOf(s) {
  return s.points.map(p => `${xOf(p.date).toFixed(1)},${yOf(p.nav * 100).toFixed(1)}`).join(' ')
}
function lastX(s) {
  return xOf(s.points.at(-1).date)
}
function lastY(s) {
  return yOf(s.points.at(-1).nav * 100)
}

const axisEnd = computed(() => {
  const d = new Date(tMax.value)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

onMounted(async () => {
  const base = import.meta.env.BASE_URL
  try {
    const [snaps, etfRes, fundRes] = await Promise.all([
      fetchPositionSnapshots(500),
      fetch(`${base}compare/etf_jinqiang.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${base}compare/fund_027730.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
    ])
    solo.value = (snaps || []).filter(s => s.date >= NAV_BASE_DATE)
    etf.value = Array.isArray(etfRes) ? etfRes : []
    fund.value = Array.isArray(fundRes) ? fundRes : []
  } catch (e) {
    console.warn('AccountNavChart load error:', e)
  } finally {
    loaded.value = true
  }
})
</script>

<style scoped>
.account-nav { width: 100%; }
.nav-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.nav-title { font-size: 13px; font-weight: 600; }
.nav-hint { font-size: 10px; color: var(--text-muted); }
.nav-svg { width: 100%; height: 220px; }
.nav-grid { stroke: var(--border-soft); stroke-width: 1; }
.nav-base { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 4 4; opacity: .5; }
.nav-tick { font-size: 9px; fill: var(--text-muted); font-family: var(--font-number); }
.nav-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); padding: 0 2px; }
.nav-empty { text-align: center; padding: 30px 0; font-size: 12px; color: var(--text-muted); }

.nav-legend { margin-top: 10px; display: flex; flex-direction: column; gap: 2px; }
.legend-item { padding: 8px 2px; border-bottom: 1px solid var(--border-soft); }
.legend-item:last-child { border-bottom: none; }
.legend-main { display: flex; align-items: baseline; gap: 8px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend-name { font-size: 12px; font-weight: 600; flex: 1; min-width: 0; }
.legend-nav { font-size: 14px; font-weight: 700; }
.legend-desc { font-size: 10px; color: var(--text-muted); padding-left: 16px; margin-top: 2px; }
</style>
