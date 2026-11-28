<!-- src/components/trade/RecentTrades.vue — 最近 N 笔交易（做 T 价格参考） -->
<template>
  <div class="recent-trades">
    <div v-for="(t, i) in rows" :key="i" class="rt-row">
      <span class="rt-date num-mono">{{ t.date }}</span>
      <span class="rt-side" :class="t.side === 'buy' ? 'rise' : 'fall'">{{ t.side === 'buy' ? '买入' : '卖出' }}</span>
      <span class="rt-qty num-mono">{{ formatQuantity(t.qty) }}股</span>
      <span class="rt-price num-mono">@{{ Number(t.price).toFixed(2) }}</span>
    </div>
    <div v-if="!rows.length" class="rt-empty">暂无交易记录</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { recentTrades } from '@/utils/recentTrades'
import { formatQuantity } from '@/utils/formatters'

const props = defineProps({
  stockCode: { type: String, required: true },
  transactions: { type: Array, default: () => [] },
  count: { type: Number, default: 3 }
})

const rows = computed(() => recentTrades(props.transactions, props.stockCode, props.count))
</script>

<style scoped>
.recent-trades {
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rt-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
}
.rt-date { color: var(--text-muted); flex-shrink: 0; }
.rt-side { font-weight: 600; flex-shrink: 0; }
.rt-side.rise { color: var(--color-rise); }
.rt-side.fall { color: var(--color-fall); }
.rt-qty { color: var(--text-secondary); }
.rt-price { color: var(--text-primary); font-weight: 600; margin-left: auto; }
.rt-empty { font-size: 11px; color: var(--text-muted); text-align: center; padding: 2px 0; }
</style>
