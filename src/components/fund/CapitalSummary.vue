<template>
  <div class="capital-summary edge-accent">
    <div class="cs-header">
      <span class="title-accent title-accent--accent"></span>
      <span class="cs-title">资本总览</span>
    </div>
    <div class="cs-row">
      <span class="cs-label">资本总投入</span>
      <span class="cs-amount num-mono">{{ formatMoney(totalCapital) }}</span>
    </div>
    <div class="cs-grid">
      <div class="cs-item">
        <span class="cs-item-label">总可用资金</span>
        <span class="cs-item-value num-mono">{{ formatMoney(totalAvailable) }}</span>
      </div>
      <div class="cs-item">
        <span class="cs-item-label">总资产</span>
        <span class="cs-item-value num-mono">{{ formatMoney(totalAsset) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/formatters'

defineProps({
  totalCapital: { type: Number, default: 0 },
  totalAvailable: { type: Number, default: 0 },
  totalAsset: { type: Number, default: 0 }
})
</script>

<style scoped>
.capital-summary {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-soft);
  border-right: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cs-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cs-title {
  font-size: 15px;
  font-weight: 700;
}
.cs-row { display: flex; justify-content: space-between; align-items: baseline; }
.cs-label { font-size: 13px; color: var(--text-secondary); }
.cs-amount { font-size: 22px; font-weight: 700; font-family: var(--font-number); }
.cs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cs-item { background: var(--bg-hover); border-radius: var(--radius-md); padding: 8px 10px; display: flex; flex-direction: column; }
.cs-item-label { font-size: 11px; color: var(--text-secondary); }
.cs-item-value { font-size: 14px; font-weight: 600; font-family: var(--font-number); }
</style>
