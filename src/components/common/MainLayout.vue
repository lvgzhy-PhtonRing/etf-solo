<!-- src/components/common/MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="nav-header">
      <span class="nav-spacer"></span>
      <TopSegment />
      <button class="menu-btn" @click="showDrawer = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="main-content">
      <router-view />
    </div>
    <van-tabbar :model-value="active" :border="false">
      <van-tabbar-item
        v-for="tab in tabs"
        :key="tab.name"
        :icon="ICONS[tab.name]"
        @click="go(tab.path)"
      >{{ tab.label }}</van-tabbar-item>
    </van-tabbar>

    <van-popup
      v-model:show="showDrawer"
      position="right"
      :style="{ width: '100%', height: '100%', padding: '0' }"
      :close-on-click-overlay="true"
      closeable
      close-icon="cross"
      close-icon-position="top-left"
      :close-icon-color="'var(--text-muted)'"
    >
      <SettingsPage :in-drawer="true" @close="showDrawer = false" />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsPage from '@/pages/SettingsPage.vue'
import TopSegment from '@/components/common/TopSegment.vue'
import { sectionOf, tabsOf, tabIndex } from '@/utils/nav'
import { ensurePeriodicSnapshot } from '@/utils/positionSnapshot'
import { refreshHistoricalSnapshots } from '@/utils/historicalSnapshots'

const route = useRoute()
const router = useRouter()
const showDrawer = ref(false)

onMounted(() => {
  ensurePeriodicSnapshot().catch(e => console.error('ensurePeriodicSnapshot error:', e))
  refreshHistoricalSnapshots().catch(e => console.warn('历史快照暂未补齐：', e))
})

const ICONS = {
  'asset-overview': 'balance-o',
  'asset-ledger': 'orders-o',
  'asset-stats': 'bar-chart-o',
  'asset-poker': 'fire-o',
  'stock-holdings': 'apps-o',
  'stock-positions': 'pie-chart-o',
  'stock-trends': 'chart-trending-o',
  'stock-capital': 'gold-coin-o'
}

const section = computed(() => sectionOf(route.path))
const tabs = computed(() => tabsOf(section.value))
const active = computed(() => Math.max(0, tabIndex(section.value, route.path)))

function go(path) {
  if (path !== route.path) router.push(path)
}
</script>

<style scoped>
.main-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px 4px;
  flex-shrink: 0;
}
.nav-spacer {
  width: 36px;
  flex-shrink: 0;
}
.menu-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background .2s;
}
.menu-btn svg {
  width: 18px;
  height: 18px;
}
.menu-btn:active {
  background: var(--bg-hover);
}
.main-layout :deep(.van-popup) {
  background: var(--bg-primary);
  --van-popup-close-icon-size: 30px;
  --van-popup-close-icon-margin: 8px;
}
.main-layout :deep(.van-overlay) {
  background: rgba(0,0,0,.45);
}
/* 玻璃悬浮 dock tab 栏 */
.main-layout :deep(.van-tabbar) {
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 24px);
  height: 54px;
  border-radius: 20px;
  background: rgba(255,255,255,0.88);
  border: 1px solid var(--border-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(120,100,75,.16);
}
.main-layout :deep(.van-tabbar-item) {
  color: var(--text-secondary);
}
/* 图标容器强制 flex 居中：.van-badge 带 0 3px 内边距 + text-align:center，
   display:block 的子元素不受 text-align 影响，只能靠 flex 保证水平垂直都居中 */
.main-layout :deep(.van-tabbar-item__icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.main-layout :deep(.van-tabbar-item__icon svg) {
  display: block;
  margin: 0 auto;
}
.main-layout :deep(.van-tabbar-item--active) {
  color: var(--bg-accent);
  font-weight: 600;
}
</style>
