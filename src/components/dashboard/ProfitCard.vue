<!-- src/components/dashboard/ProfitCard.vue -->
<template>
  <div class="profit-grid">
    <div class="profit-item" :class="floatPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">浮动盈亏 <span class="profit-unit">（市值-成本）</span></div>
      <div class="profit-value num-mono">{{ formatChange(floatPnl) }}</div>
    </div>
    <div class="profit-item" :class="dailyPnl >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">当日盈亏 <span class="profit-unit">（市值-前收）</span></div>
      <div class="profit-value num-mono">{{ formatChange(dailyPnl) }}</div>
    </div>
    <div class="profit-item" :class="totalProfit >= 0 ? 'rise' : 'fall'">
      <div class="profit-label">总收益 <span class="profit-unit">（资产-投入）</span></div>
      <div class="profit-value num-mono">
        {{ formatChange(totalProfit) }}
        <span class="profit-rate">{{ profitRate >= 0 ? '+' : '' }}{{ profitRate.toFixed(1) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatChange } from '@/utils/formatters'

defineProps({
  floatPnl: { type: Number, default: 0 },
  dailyPnl: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  profitRate: { type: Number, default: 0 }
})
</script>

<style scoped>
.profit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.profit-item {
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--radius-md);
}
.profit-item.fall {
  background: rgba(46,139,87,0.08);
}
.profit-item.rise {
  background: rgba(214,69,69,0.08);
}
.profit-unit { font-size: 10px; color: var(--text-muted); font-weight: 400; }
.profit-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}
.profit-value {
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-number);
}
.profit-rate {
  font-size: 11px;
  font-weight: 500;
  margin-left: 2px;
}
.fall .profit-value { color: var(--color-fall); }
.rise .profit-value { color: var(--color-rise); }
</style>
