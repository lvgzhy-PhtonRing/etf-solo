<template>
  <div class="kline-chart-wrap" :class="{ 'kline-chart-wrap--fs': fullscreen }" ref="wrap">
    <div class="kline-chart" :class="{ 'kline-chart--fs': fullscreen }">
      <div v-for="it in chart.items" :key="it.key" class="kline-bar-group">
        <div class="kline-candle-area">
          <div class="kline-candle" :class="it.isUp ? 'up' : 'down'" :style="candleStyle(it)"></div>
          <div class="kline-wick" :class="it.isUp ? 'up' : 'down'" :style="wickStyle(it)"></div>
          <div class="kline-wick" :class="it.isUp ? 'up' : 'down'" :style="capStyle(it)"></div>
        </div>
        <div class="kline-vol" :class="it.isUp ? 'up' : 'down'">
          {{ it.net >= 0 ? '+' : '' }}{{ fmt(it.net) }}
        </div>
        <div v-if="fullscreen" class="kline-fs-detail">
          <span class="kfs-in">收 {{ fmt(it.income) }}</span>
          <span class="kfs-out">支 {{ fmt(it.expense) }}</span>
        </div>
        <div class="kline-label">{{ labelOf(it.key) }}</div>
      </div>
    </div>
    <div v-if="!chart.items.length" class="kline-empty">暂无德州记录</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { pokerChart, pokerDayLabel, pokerWeekLabel } from '@/utils/assetPoker'
import { formatMoney } from '@/utils/formatters'

const props = defineProps({
  bars: { type: Array, default: () => [] },
  mode: { type: String, default: 'week' },
  fullscreen: { type: Boolean, default: false }
})

const wrap = ref(null)
const chart = computed(() => pokerChart(props.bars))

function candleStyle(it) {
  return {
    top: `${it.candleTop}px`,
    height: `${it.candleBottom - it.candleTop}px`
  }
}

function wickStyle(it) {
  return {
    top: `${it.wickTop}px`,
    height: `${it.wickBottom - it.wickTop}px`
  }
}

function capStyle(it) {
  return { top: `${it.capTop}px`, height: '2px' }
}

function fmt(n) {
  return formatMoney(n)
}

function labelOf(key) {
  if (props.mode === 'month') return key.slice(2).replace('-', '/')
  if (props.mode === 'week') return pokerWeekLabel(key)
  return pokerDayLabel(key)
}

function scrollToEnd() {
  nextTick(() => {
    if (wrap.value) wrap.value.scrollLeft = wrap.value.scrollWidth
  })
}

onMounted(scrollToEnd)
watch(() => props.bars, scrollToEnd)
</script>

<style scoped>
.kline-chart-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0 4px;
  position: relative;
}
.kline-chart-wrap--fs { flex: 1; min-height: 150px; overflow-y: visible; }
.kline-chart {
  display: flex;
  align-items: stretch;
  min-width: max-content;
  height: 200px;
  padding: 0 8px;
}
.kline-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  flex-shrink: 0;
}
.kline-candle-area {
  position: relative;
  flex: 1;
  width: 100%;
}
.kline-candle {
  width: 10px;
  border-radius: 1px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.kline-wick {
  width: 2px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.kline-candle.up, .kline-wick.up { background: var(--color-rise); }
.kline-candle.down, .kline-wick.down { background: var(--color-fall); }
.kline-vol {
  font-size: 8px;
  line-height: 1;
  margin-bottom: 1px;
  white-space: nowrap;
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kline-vol.up { color: var(--color-rise); }
.kline-vol.down { color: var(--color-fall); }
.kline-label {
  font-size: 8px;
  color: var(--text-muted);
  text-align: center;
  white-space: nowrap;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 48px;
}
.kline-empty { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px 0; }

/* 全屏模式：每根蜡烛下显示 收/支 明细 */
.kline-fs-detail {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  font-size: 10px; line-height: 1.2;
  margin-top: 4px; white-space: nowrap;
}
.kfs-in { color: var(--color-rise); }
.kfs-out { color: var(--color-fall); }

/* 全屏模式尺寸沿用旧版：竖屏紧凑，横屏放大 */
.kline-chart--fs { height: 172px; }
.kline-chart--fs .kline-bar-group { width: 24px; }
.kline-chart--fs .kline-candle { width: 6px; }
.kline-chart--fs .kline-wick { width: 1px; }
.kline-chart--fs .kline-label {
  font-size: 5px; max-width: 32px;
  white-space: nowrap; overflow: visible; text-overflow: clip;
}
.kline-chart--fs .kline-vol {
  font-size: 5px; max-width: 32px; font-weight: 600;
  white-space: nowrap; overflow: visible; text-overflow: clip;
}
.kline-chart--fs .kline-fs-detail {
  gap: 1px; margin-top: 2px; width: 100%;
}
.kline-chart--fs .kfs-in,
.kline-chart--fs .kfs-out {
  font-size: 4px; line-height: 1.2; max-width: 32px;
  white-space: nowrap; overflow: visible; text-overflow: clip;
}

@media (orientation: landscape) {
  .kline-chart--fs { height: calc(100dvh - 120px); min-height: 200px; }
  .kline-chart--fs .kline-bar-group { width: 100px; }
  .kline-chart--fs .kline-candle { width: 28px; }
  .kline-chart--fs .kline-wick { width: 4px; }
  .kline-chart--fs .kline-label {
    font-size: 14px; max-width: 96px;
    font-weight: 600; color: #374151;
  }
  .kline-chart--fs .kline-vol {
    font-size: 13px; max-width: 96px; font-weight: 700;
  }
  .kline-chart--fs .kfs-in,
  .kline-chart--fs .kfs-out {
    font-size: 12px; max-width: 96px; font-weight: 500;
  }
}
</style>
