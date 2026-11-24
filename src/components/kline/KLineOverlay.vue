<!-- src/components/kline/KLineOverlay.vue -->
<template>
  <div class="kline-overlay">
    <div class="kline-header">
      <button class="kline-close" @click="close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="5" x2="19" y2="19"></line>
          <line x1="19" y1="5" x2="5" y2="19"></line>
        </svg>
      </button>
      <div class="kline-title">
        <span class="kline-name">{{ stock.stock_name }}</span>
        <span class="kline-code">{{ stock.stock_code }}</span>
        <span class="kline-cost" v-if="costLabel">摊薄成本{{ costLabel }}元</span>
        <span class="kline-price" v-if="priceLabel" :style="{ background: priceBg }">现价{{ priceLabel }}元</span>
      </div>
      <div class="kline-tabs">
        <button
          v-for="p in PERIODS"
          :key="p.key"
          class="kline-tab"
          :class="{ active: period === p.key }"
          @click="switchPeriod(p.key)"
        >{{ p.label }}</button>
      </div>
    </div>
    <div class="kline-legend">
      <span class="lg-item"><span class="lg-badge" style="background:#d64545">B</span>买入</span>
      <span class="lg-item"><span class="lg-badge" style="background:#2e8b57">S</span>卖出</span>
      <span class="lg-item"><span class="lg-badge" style="background:#c98a2c">T</span>当日买卖</span>
    </div>
    <div ref="chartRef" class="kline-chart"></div>
    <div v-if="loading" class="kline-mask">
      <div class="kline-mask-inner">K线加载中…</div>
    </div>
    <div v-else-if="error" class="kline-mask">
      <div class="kline-mask-inner">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { init, dispose, registerOverlay } from 'klinecharts'
import { fetchKLine, refreshStockPrice } from '@/api/stock'
import { fetchAllTransactions } from '@/api/supabase'

const PERIODS = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' }
]

const props = defineProps({
  stock: { type: Object, required: true }
})
const emit = defineEmits(['close'])

// 交易标记：B=买入(画在K线下方) S=卖出(上方) T=当日既有买又有卖(上方)
const TRADE_MARKS = {
  B: { label: 'B', color: '#d64545', dir: 'down' },
  S: { label: 'S', color: '#2e8b57', dir: 'up' },
  T: { label: 'T', color: '#c98a2c', dir: 'up' }
}

// 自定义 overlay：色块字母 + 下方/上方的操作日期
// 色块宽度跟随单根蜡烛宽度（chart.getBarSpace().gapBar 口径，见 klinecharts 8080 行）
registerOverlay({
  name: 'tradePoint',
  totalStep: 1,
  createPointFigures({ chart, overlay, coordinates }) {
    const meta = overlay.extendData || {}
    const color = meta.color || '#bf6b3f'
    const cx = coordinates[0].x
    const cy = coordinates[0].y
    const oy = meta.dir === 'up' ? -1 : 1

    const { gapBar } = chart.getBarSpace()
    const candleW = Math.max(1, Math.floor((gapBar || 1) / 2) * 2)
    // 圆形色块基准宽度跟随蜡烛宽，再整体放大 20%
    const base = Math.max(8, Math.min(20, candleW))
    const w = Math.round(base * 1.2)
    const h = Math.round((base + 4) * 1.2)
    const fs = Math.round(Math.max(7, Math.min(11, base - 3)) * 1.2)
    const r = w / 2

    const edge = cy + oy * 12
    const blockY = edge + oy * (h / 2)
    return [
      {
        type: 'line',
        attrs: { coordinates: [{ x: cx, y: cy + oy * 2 }, { x: cx, y: blockY - oy * r }] },
        styles: { style: 'solid', size: 1, color },
        ignoreEvent: true
      },
      {
        type: 'circle',
        attrs: { x: cx, y: blockY, r },
        styles: { style: 'fill', color, borderSize: 0, borderColor: 'transparent' },
        ignoreEvent: true
      },
      {
        type: 'text',
        attrs: { x: cx, y: blockY, text: meta.label || '', align: 'center', baseline: 'middle' },
        styles: { color: '#fff', size: fs, weight: 'bold', backgroundColor: 'transparent', borderSize: 0, borderColor: 'transparent' },
        ignoreEvent: true
      },
      {
        type: 'text',
        attrs: { x: cx, y: edge + oy * (h + 8), text: meta.date || '', align: 'center', baseline: 'middle' },
        styles: { color, size: 9, weight: 'bold', backgroundColor: 'transparent', borderSize: 0, borderColor: 'transparent' },
        ignoreEvent: true
      }
    ]
  }
})

const STYLES = {
  grid: {
    show: true,
    horizontal: { show: true, size: 1, color: 'rgba(46,42,36,0.08)', style: 'dashed', dashedValue: [2, 2] },
    vertical: { show: true, size: 1, color: 'rgba(46,42,36,0.05)', style: 'dashed', dashedValue: [2, 2] }
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'previous_close',
      upColor: '#d64545',
      downColor: '#2e8b57',
      noChangeColor: '#a89f91',
      upBorderColor: '#d64545',
      downBorderColor: '#2e8b57',
      noChangeBorderColor: '#a89f91',
      upWickColor: '#d64545',
      downWickColor: '#2e8b57',
      noChangeWickColor: '#a89f91'
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#7a7266', textSize: 11, textOffset: 5 },
      low: { show: true, color: '#7a7266', textSize: 11, textOffset: 5 },
      last: {
        show: true,
        compareRule: 'previous_close',
        upColor: '#d64545',
        downColor: '#2e8b57',
        noChangeColor: '#7a7266',
        line: { show: false, size: 1, style: 'dashed', dashedValue: [4, 4] },
        text: {
          show: true,
          style: 'fill',
          color: '#fff',
          size: 11,
          weight: 'bold',
          borderColor: '#bf6b3f',
          borderRadius: 4,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3
        },
        extendTexts: []
      }
    },
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      title: { show: true, color: '#7a7266', size: 11, marginLeft: 0, marginTop: 0, marginRight: 0, marginBottom: 0 },
      legend: { color: '#7a7266', size: 11, marginLeft: 0, marginRight: 8, marginTop: 2, marginBottom: 2 }
    }
  },
  indicator: {
    bars: [{
      upColor: 'rgba(214,69,69,0.7)',
      downColor: 'rgba(46,139,87,0.7)',
      noChangeColor: 'rgba(168,159,145,0.7)'
    }],
    lines: [
      { style: 'solid', size: 1, color: '#c98a2c', smooth: false },
      { style: 'solid', size: 1, color: '#7a5bd6', smooth: false },
      { style: 'solid', size: 1, color: '#4d9fff', smooth: false },
      { style: 'solid', size: 1, color: '#ff7a45', smooth: false }
    ],
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      title: { show: true, color: '#7a7266', size: 11, showName: true, showParams: true, marginLeft: 0, marginTop: 0, marginRight: 0, marginBottom: 0 },
      legend: { color: '#7a7266', size: 11, marginLeft: 0, marginRight: 8, marginTop: 2, marginBottom: 2 }
    }
  },
  xAxis: {
    show: true,
    size: 22,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#7a7266', size: 11, marginStart: 6, marginEnd: 6 }
  },
  yAxis: {
    show: true,
    size: 50,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#7a7266', size: 11, marginStart: 6, marginEnd: 6 }
  },
  separator: {
    size: 1,
    color: 'rgba(120,100,75,0.14)',
    fill: true
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, size: 1, color: 'rgba(191,107,63,0.45)', style: 'dashed', dashedValue: [4, 4] },
      text: {
        show: true,
        style: 'fill',
        color: '#fff',
        size: 11,
        weight: 'bold',
        backgroundColor: '#bf6b3f',
        borderColor: '#bf6b3f',
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3
      }
    },
    vertical: {
      show: true,
      line: { show: true, size: 1, color: 'rgba(191,107,63,0.45)', style: 'dashed', dashedValue: [4, 4] },
      text: {
        show: true,
        style: 'fill',
        color: '#fff',
        size: 11,
        weight: 'bold',
        backgroundColor: '#bf6b3f',
        borderColor: '#bf6b3f',
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 3,
        paddingBottom: 3
      }
    }
  }
}

const chartRef = ref(null)
const period = ref('day')
const loading = ref(false)
const error = ref('')
let chart = null
let priceOverlayId = null
let priceTimer = null

const costLabel = computed(() => {
  const c = Number(props.stock.cost_price)
  return c > 0 ? c.toFixed(3) : ''
})

const currentPrice = ref(Number(props.stock.currentPrice) || 0)
const changePct = ref(Number(props.stock.changePct) || 0)
const priceLabel = computed(() => currentPrice.value > 0 ? currentPrice.value.toFixed(2) : '')
const priceBg = computed(() => {
  if (changePct.value > 0) return 'var(--color-rise)'
  if (changePct.value < 0) return 'var(--color-fall)'
  return '#a89f91'
})

// 定时实时刷新现价（绕过行情缓存）
async function refreshPrice() {
  const d = await refreshStockPrice(props.stock.stock_code)
  if (d && d.price) {
    currentPrice.value = d.price
    changePct.value = Number(d.change_pct) || 0
    if (chart && priceOverlayId) {
      chart.overrideOverlay({ id: priceOverlayId, points: [{ dataIndex: 0, value: currentPrice.value }] })
    }
  }
}

function close() {
  emit('close')
}

function switchPeriod(p) {
  if (p === period.value || !chart) return
  period.value = p
  chart.setPeriod({ span: 1, type: p })
  chart.scrollToRealTime()
}

function resizeChart() {
  if (!chart) return
  chart.resize()
}

function enterFullscreen() {
  return new Promise(resolve => {
    const el = document.documentElement
    if (!el.requestFullscreen) return resolve()
    Promise.resolve(el.requestFullscreen())
      .then(() => {
        if (screen.orientation && screen.orientation.lock) {
          Promise.resolve(screen.orientation.lock('landscape')).catch(() => {})
        }
        resolve()
      })
      .catch(() => resolve())
  })
}

function exitFullscreen() {
  return new Promise(resolve => {
    if (screen.orientation && screen.orientation.unlock) {
      Promise.resolve(screen.orientation.unlock()).catch(() => {})
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      Promise.resolve(document.exitFullscreen()).then(resolve).catch(resolve)
    } else {
      resolve()
    }
  })
}

function initChart() {
  if (!chartRef.value) return
  chart = init(chartRef.value, { locale: 'zh-CN', styles: STYLES })
  chart.setSymbol({ ticker: props.stock.stock_code, pricePrecision: 3, volumePrecision: 0 })
  chart.setPeriod({ span: 1, type: period.value })
  chart.setDataLoader({
    getBars: async ({ type, symbol, period: kdPeriod, callback }) => {
      if (type !== 'init') {
        callback([])
        return
      }
      loading.value = true
      error.value = ''
      try {
        const data = await fetchKLine(symbol.ticker, kdPeriod.type)
        if (!chart) {
          callback([])
          return
        }
        if (!data.length) {
          error.value = '暂无K线数据'
          callback([])
          return
        }
        callback(data, false)
        chart.scrollToRealTime()
        if (currentPrice.value > 0) createPriceLine(currentPrice.value)
        createTradeMarks(data)
      } catch (e) {
        error.value = 'K线加载失败'
        callback([])
      } finally {
        loading.value = false
      }
    }
  })
  chart.createIndicator({ name: 'MA', paneId: 'candle_pane' }, true)
  chart.setOffsetRightDistance(60)
}

function createPriceLine(price) {
  // 切周期会重复触发 init，先删旧线避免叠加残影
  if (priceOverlayId) chart.removeOverlay(priceOverlayId)
  priceOverlayId = chart.createOverlay({
    name: 'simpleTag',
    paneId: 'candle_pane',
    points: [{ dataIndex: 0, value: price }],
    styles: {
      line: { style: 'dashed', size: 1, color: '#bf6b3f', dashedValue: [8, 4] },
      text: {
        style: 'fill',
        color: '#fff',
        size: 11,
        weight: 'bold',
        borderRadius: 4,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#bf6b3f'
      }
    }
  })
}

// K 线 bar 的 timestamp 是所属周期的最后一天，故取第一个 >= 交易日 的 bar
function barIndexFor(bars, dayMs) {
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].timestamp >= dayMs) return i
  }
  return bars.length - 1
}

// 把当日交易聚合到 K 线根上：只有买→B，只有卖→S，买卖都有→T
async function createTradeMarks(bars) {
  chart.removeOverlay({ name: 'tradePoint' })
  if (!bars.length) return

  const txs = await fetchAllTransactions()
  if (!chart) return
  const mine = txs.filter(t => t.stock_code === props.stock.stock_code && t.trade_date)
  if (!mine.length) return

  const byBar = new Map()
  for (const t of mine) {
    const dayMs = Date.parse(`${t.trade_date}T00:00:00+08:00`)
    if (isNaN(dayMs)) continue
    const idx = barIndexFor(bars, dayMs)
    const rec = byBar.get(idx) || { buy: false, sell: false, date: t.trade_date }
    if (t.type === 'buy') rec.buy = true
    else rec.sell = true
    if (t.trade_date < rec.date) rec.date = t.trade_date
    byBar.set(idx, rec)
  }

  for (const [idx, rec] of byBar) {
    const bar = bars[idx]
    if (!bar) continue
    const mark = rec.buy && rec.sell ? TRADE_MARKS.T : rec.buy ? TRADE_MARKS.B : TRADE_MARKS.S
    const value = mark.dir === 'up' ? bar.high : bar.low
    if (!(value > 0)) continue
    chart.createOverlay({
      name: 'tradePoint',
      paneId: 'candle_pane',
      points: [{ dataIndex: idx, value }],
      extendData: { label: mark.label, color: mark.color, dir: mark.dir, date: rec.date.slice(5) }
    })
  }
}

onMounted(async () => {
  await enterFullscreen()
  nextTick(() => {
    initChart()
    resizeChart()
  })
  refreshPrice()
  priceTimer = setInterval(refreshPrice, 30 * 1000)
  window.addEventListener('resize', resizeChart)
  window.addEventListener('orientationchange', resizeChart)
})

onBeforeUnmount(() => {
  if (priceTimer) {
    clearInterval(priceTimer)
    priceTimer = null
  }
  window.removeEventListener('resize', resizeChart)
  window.removeEventListener('orientationchange', resizeChart)
  if (chart) {
    dispose(chartRef.value)
    chart = null
  }
  priceOverlayId = null
  exitFullscreen()
})
</script>

<style scoped>
.kline-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.kline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.kline-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.kline-close:active {
  background: var(--bg-subtle);
}

.kline-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.kline-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.kline-code {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-number);
}

.kline-cost {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-number);
  padding: 4px 10px;
  background: var(--bg-accent);
  border: none;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.kline-price {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-number);
  padding: 4px 10px;
  border: none;
  border-radius: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.kline-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-hover);
  padding: 3px;
  border-radius: 8px;
  flex-shrink: 0;
}

.kline-tab {
  padding: 5px 14px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.kline-tab.active {
  background: var(--bg-accent);
  color: #fff;
}

.kline-legend {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.lg-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.lg-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 14px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.kline-chart {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.kline-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 247, 242, 0.85);
  z-index: 2;
}

.kline-mask-inner {
  color: var(--text-secondary);
  font-size: 14px;
  padding: 12px 22px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
}
</style>
