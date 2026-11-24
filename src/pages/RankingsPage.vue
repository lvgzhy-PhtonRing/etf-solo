<template>
  <div class="page rankings-page">
    <div class="page-header">
      <span class="page-title">盈亏榜单<span class="title-en">Rankings</span></span>
    </div>
    <RankingsPanel />
  </div>
</template>

<script setup>
import RankingsPanel from '@/components/trend/RankingsPanel.vue'
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 2px 12px; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
</style>
