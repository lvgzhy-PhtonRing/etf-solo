<template>
  <div class="top-segment">
    <button
      v-for="s in sections"
      :key="s.key"
      class="seg-btn"
      :class="{ 'seg-btn--active': s.key === current }"
      @click="switchTo(s.key)"
    >{{ s.label }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SECTIONS, sectionOf, defaultPathOf } from '@/utils/nav'

const route = useRoute()
const router = useRouter()

const LABELS = { asset: '资产', stock: '股票' }
const sections = SECTIONS.map(key => ({ key, label: LABELS[key] }))

const current = computed(() => sectionOf(route.path))

function switchTo(section) {
  if (section === current.value) return
  router.push(defaultPathOf(section))
}
</script>

<style scoped>
.top-segment {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 12px;
  background: var(--bg-hover);
  border: 1px solid var(--border-soft);
}
.seg-btn {
  min-width: 56px;
  padding: 5px 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background .18s, color .18s;
}
.seg-btn--active {
  background: var(--bg-card);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(120, 100, 75, .14);
}
</style>
