<template>
  <div class="page placeholder-page">
    <div class="page-header">
      <span class="page-title">{{ title }}<span class="title-en">{{ en }}</span></span>
    </div>
    <div class="section-card placeholder-card">
      <div class="placeholder-emoji">🚧</div>
      <div class="placeholder-text">建设中</div>
      <div class="placeholder-sub">{{ title }}将在第二期接入</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta.title || '资产')
const en = computed(() => route.meta.en || '')
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; padding: 4px 2px 12px; }
.page-title { font-size: 20px; font-weight: 700; }
.title-en { font-size: 11px; color: var(--text-muted); margin-left: 8px; font-weight: 400; }
.placeholder-card { padding: 44px 16px; text-align: center; }
.placeholder-emoji { font-size: 34px; }
.placeholder-text { margin-top: 10px; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.placeholder-sub { margin-top: 6px; font-size: 12px; color: var(--text-muted); }
</style>
