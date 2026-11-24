<template>
  <div class="capital-log-list">
    <div class="log-header">
      <span class="log-title">资本流水</span>
      <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
    </div>
    <div v-if="!logs.length"><EmptyState icon="💰" text="暂无资金变动记录" /></div>
    <div v-else class="trade-log-list">
      <div v-for="log in logs" :key="log.id" class="trade-log-item">
        <div class="tli-body">
          <div class="tli-header">
            <span class="tli-action" :class="log.type === 'add' ? 'rise' : 'fall'">{{ labelOf(log) }}</span>
            <span class="tli-amount num-mono" :class="log.type === 'add' ? 'rise' : 'fall'">
              {{ log.type === 'add' ? '+' : '-' }}{{ formatMoney(log.amount) }}
            </span>
          </div>
          <div v-if="noteText(log)" class="tli-note">{{ noteText(log) }}</div>
          <div class="tli-meta">
            <span>{{ formatDateString(log.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'
import { ADJUST_LABELS, parseAdjustNote } from '@/utils/adjustItems'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps({ logs: { type: Array, default: () => [] } })

function labelOf(log) {
  if (log.category === 'trade') return log.type === 'add' ? '卖出' : '买入'
  if (log.category === 'adjust') return '调整'
  return log.type === 'add' ? '增资' : '减资'
}

function noteText(log) {
  if (log.category === 'adjust') {
    const data = parseAdjustNote(log.note)
    if (data?.items?.length) {
      return data.items
        .map(it => `${ADJUST_LABELS[it.category] || it.category}${it.stockName ? '(' + it.stockName + ')' : ''} ${(it.signedAmount / 100).toFixed(2)}`)
        .join(' · ')
    }
    return data?.note || log.note || ''
  }
  if (log.category === 'capital' && log.note === '初始') return '初始入金'
  return log.note || ''
}

function formatDateString(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.log-header { display: flex; align-items: center; gap: 8px; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); margin-left: auto; }

.trade-log-list { display: flex; flex-direction: column; gap: 2px; }
.trade-log-item { padding: 12px 14px; background: var(--bg-hover); display: flex; gap: 8px; align-items: center; border-radius: var(--radius-md); }
.tli-body { flex: 1; min-width: 0; }
.tli-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.tli-action { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
.tli-action.rise { color: var(--color-rise); }
.tli-action.fall { color: var(--color-fall); }
.tli-amount { font-size: 14px; font-weight: 700; font-family: var(--font-number); }
.tli-amount.rise { color: var(--color-rise); }
.tli-amount.fall { color: var(--color-fall); }
.tli-note { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; line-height: 1.5; }
.tli-meta { font-size: 11px; color: var(--text-muted); }
</style>
