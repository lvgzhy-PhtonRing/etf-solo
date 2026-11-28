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
        <line :x1="xOf(NAV_BASE_DATE)" :x2="xOf(NAV_BASE_DATE)" :y1="PAD.top" :y2="H - PAD.bottom" class="nav-base-date" />
        <text :x="xOf(NAV_BASE_DATE)" :y="H - 6" text-anchor="middle" class="nav-base-label">{{ baseShortLabel }}</text>
        <text v-for="t in yTicks" :key="'t' + t" :x="PAD.left - 6" :y="yOf(t) + 3" text-anchor="end" class="nav-tick">{{ t }}</text>
        <polyline v-for="s in series" :key="s.key" :points="pathOf(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <!-- 起始点 = 同心圆（同 ETF 版）；账户线标在基准日 7/29（线段中间），其余线标在各自首个数据点 -->
        <template v-for="s in series" :key="'st' + s.key">
          <circle :cx="markX(s)" :cy="markY(s)" r="5" fill="none" :stroke="s.color" stroke-width="1.5" />
          <circle :cx="markX(s)" :cy="markY(s)" r="2.6" :fill="s.color" stroke="var(--bg-card)" stroke-width="1.2" />
        </template>
        <circle v-for="s in series" :key="'d' + s.key" :cx="lastX(s)" :cy="lastY(s)" r="2.6" :fill="s.color" />
      </svg>
      <div class="nav-axis">
        <span>{{ NAV_CHART_START.slice(5) }}</span>
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
import { NAV_BASE_DATE, NAV_BASE_ASSET, NAV_BASE_LABEL, NAV_CHART_START } from '@/utils/navBase'
import { fetchEtfNav } from '@/utils/etfNav'

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
  if (!soloPoints.some(p => p.date === NAV_BASE_DATE)) {
    soloPoints.push({ date: NAV_BASE_DATE, nav: 1 })
    soloPoints.sort((a, b) => a.date.localeCompare(b.date))
  }
  const etfPoints = etf.value.map(p => ({ date: p.date, nav: p.nav }))
  const fundPoints = fund.value.map(p => ({ date: p.date, nav: p.nav }))
  return [
    { key: 'solo', name: '账户净值', color: '#bf6b3f', points: soloPoints, desc: `${NAV_BASE_DATE} = 1.0000` },
    { key: 'etf', name: '金枪不倒', color: '#ff4d6d', points: etfPoints, desc: `ETF 组合 · 7/29 = 1.0000 · 至 ${mmdd(etfPoints.at(-1)?.date || '')}` },
    { key: 'fund', name: '027730 沪深300增C', color: '#4d9fff', points: fundPoints, desc: `基金净值 · ${mmdd(fundPoints[0]?.date || '')} 起` }
  ].filter(s => s.points.length).map(s => ({
    ...s,
    navText: (s.points.at(-1)?.nav ?? 0).toFixed(4)
  }))
})

const tMin = Date.parse(NAV_CHART_START + 'T00:00:00')
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
// 圆圈标记点：账户线标在基准日（7/29，线段中间）；其他线标在各自首个数据点
function markPoint(s) {
  if (s.key === 'solo') {
    return s.points.find(p => p.date >= NAV_BASE_DATE) || s.points[0]
  }
  return s.points[0]
}
function markX(s) {
  return xOf(markPoint(s).date)
}
function markY(s) {
  return yOf(markPoint(s).nav * 100)
}

const baseShortLabel = computed(() => {
  const [, m, d] = NAV_BASE_DATE.split('-')
  return `${Number(m)}/${Number(d)}`
})

const axisEnd = computed(() => {
  const d = new Date(tMax.value)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

async function loadEtfPoints() {
  const base = import.meta.env.BASE_URL
  const live = await fetchEtfNav({
    url: import.meta.env.VITE_ETF_SUPABASE_URL,
    key: import.meta.env.VITE_ETF_SUPABASE_ANON_KEY
  })
  if (live) return live
  return fetch(`${base}compare/etf_jinqiang.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
}

onMounted(async () => {
  const base = import.meta.env.BASE_URL
  try {
    const [snaps, etfRes, fundRes] = await Promise.all([
      fetchPositionSnapshots(500),
      loadEtfPoints(),
      fetch(`${base}compare/fund_027730.json?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
    ])
    solo.value = (snaps || []).filter(s => s.date >= NAV_CHART_START)
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
.nav-base-date { stroke: var(--color-warn); stroke-width: 1; stroke-dasharray: 3 3; opacity: .55; }
.nav-base-label { font-size: 9px; fill: var(--color-warn); font-family: var(--font-number); }
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
