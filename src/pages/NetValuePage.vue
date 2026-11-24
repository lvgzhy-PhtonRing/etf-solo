<template>
  <div class="page netvalue-page">
    <div class="page-header">
      <span class="page-title">净值走势<span class="title-en">NAV Trend</span></span>
    </div>
    <LoadErrorTip v-if="loadError" :message="loadError" @retry="retryLoad" />

    <div class="section-card nav-hero">
      <NavOverview />
    </div>

    <div class="section-card edge-accent nav-card">
      <SoloNavChart />
    </div>
  </div>
</template>

<script setup>
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import NavOverview from '@/components/fund/NavOverview.vue'
import SoloNavChart from '@/components/fund/SoloNavChart.vue'
import { useFundStore } from '@/stores/funds'

const fundStore = useFundStore()
const loadError = computed(() => fundStore.error || '')
function retryLoad() { location.reload() }

</script>

<style scoped>
/* 基金档案：同 Dashboard 首卡渐变底 + 描边，无标题、无左侧色带 */
.nav-hero {
  padding: 12px 16px;
  background: linear-gradient(150deg, rgba(191,107,63,.08), rgba(214,69,69,.05) 60%, #ffffff);
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-card);
}
/* 净值比较：留白对齐趋势页模块（16 / 14 / 18） */
.nav-card {
  padding: 16px 14px 18px;
}
</style>
