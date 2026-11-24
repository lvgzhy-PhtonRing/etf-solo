<template>
  <div class="page asset-page">
    <div class="page-header">
      <span class="page-title">资产概览<span class="title-en">Assets Overview</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 顶部：实际可支配 -->
    <div class="hero-card">
      <div class="hero-label">实际可支配 (元)</div>
      <div class="hero-value num-mono" :class="{ 'hero-value--neg': totals.finalVal < 0 }">
        {{ formatMoney(totals.finalVal) }}
      </div>
      <div class="hero-foot">
        <span>总资产: <span class="num-mono">{{ formatMoney(totals.totalAssets) }}</span></span>
        <span>调整项: <span class="num-mono">{{ totals.adjustment >= 0 ? '+' : '' }}{{ formatMoney(totals.adjustment) }}</span></span>
      </div>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="3" />

    <template v-else>
      <!-- 一、零钱资产 -->
      <div class="section-label">
        <span class="label-bar label-bar--green"></span>一、零钱资产
      </div>

      <div
        v-for="g in groups"
        :key="g.key"
        class="section-card group-card"
        :class="'group-card--' + g.theme"
      >
        <div class="group-head">
          <span class="group-name">{{ g.label }}</span>
          <span class="group-sub">小计: <span class="num-mono">{{ formatMoney(g.total) }}</span></span>
        </div>
        <div class="acct-inputs" :class="{ 'acct-inputs--grid': g.accounts.length > 1 }">
          <label v-for="a in g.accounts" :key="a.id" class="acct-field">
            <span class="acct-label">{{ a.label }}</span>
            <input
              class="acct-input num-mono"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              :value="inputs[a.id] ?? ''"
              @input="onInput(a.id, $event.target.value)"
              @change="commit(a.id)"
            />
          </label>
        </div>
      </div>

      <div class="total-bar">
        <span>零钱资产总计</span>
        <span class="num-mono">{{ formatMoney(totals.totalAssets) }}</span>
      </div>

      <!-- 二、调整项 -->
      <div class="section-label">
        <span class="label-bar label-bar--warn"></span>二、调整项
      </div>
      <div class="section-card adjust-card">
        <div v-for="adj in ADJUSTMENTS" :key="adj.id" class="adj-row">
          <span class="adj-label">{{ adj.label }} {{ adj.hint }}</span>
          <div class="adj-input-wrap">
            <input
              class="acct-input num-mono"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              :value="inputs[adj.id] ?? ''"
              @input="onInput(adj.id, $event.target.value)"
              @change="commit(adj.id)"
            />
            <button class="adj-sign" @click="toggleSign(adj.id)">±</button>
          </div>
        </div>
      </div>

      <!-- 三、数据管理 -->
      <div class="section-card snap-actions">
        <button class="snap-btn snap-btn--gen" @click="onCreateSnapshot">📌 生成快照</button>
        <button class="snap-btn snap-btn--list" @click="openSnapshots">📋 快照回顾</button>
      </div>
    </template>

    <van-popup
      v-model:show="snapShow"
      position="bottom"
      round
      :style="{ maxHeight: '72%' }"
    >
      <div class="snap-panel">
        <div class="snap-title">快照回顾<span class="snap-hint">本地保存 · 仅保留 7 天</span></div>
        <div v-if="!snaps.length" class="snap-empty">暂无快照<br /><span>点击「生成快照」保存当前状态</span></div>
        <div v-else class="snap-list">
          <div v-for="s in snaps" :key="s.date + '-' + s.idx" class="snap-item">
            <div class="snap-main">
              <span class="snap-date">{{ s.date }} {{ timeOf(s.timestamp) }}</span>
              <span class="snap-val num-mono">{{ formatMoney(s.finalVal) }}</span>
            </div>
            <div class="snap-meta">
              <span>零钱资产 {{ formatMoney(s.totalAssets) }}</span>
              <span>流水合计 {{ formatMoney(s.ledgerTotal) }}</span>
              <span>差额 {{ s.diff >= 0 ? '+' : '' }}{{ formatMoney(s.diff) }}</span>
            </div>
            <button class="snap-del" @click="onDeleteSnapshot(s)">删除</button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { ACCOUNT_GROUPS, ADJUSTMENTS, calcAssets } from '@/utils/assetCalc'
import { formatMoney } from '@/utils/formatters'
import { createSnapshot, flatList, deleteSnapshot } from '@/utils/assetSnapshots'

const store = useAssetStore()

const inputs = reactive({})
const groups = ACCOUNT_GROUPS
// 直接按输入值计算，键入即刻反映，无需等 debounce 落库
const totals = computed(() => calcAssets(inputs, inputs))

watch(
  () => [store.accounts, store.adjustments],
  () => {
    Object.assign(inputs, store.accounts, store.adjustments)
  },
  { immediate: true, deep: true }
)

const timers = {}
function onInput(id, raw) {
  inputs[id] = raw
  clearTimeout(timers[id])
  timers[id] = setTimeout(() => commit(id), 500)
}

async function commit(id) {
  clearTimeout(timers[id])
  const raw = inputs[id]
  const num = parseFloat(raw) || 0
  const isAdj = ADJUSTMENTS.some(a => a.id === id)
  try {
    if (isAdj) await store.setAdjustment(id, num)
    else await store.setAccount(id, num)
  } catch (e) {
    alert('保存失败：' + e.message)
  }
}

async function toggleSign(id) {
  const cur = parseFloat(inputs[id]) || 0
  inputs[id] = String(-cur)
  await commit(id)
}

// ===== 快照 =====
const snapShow = ref(false)
const snaps = ref([])

function ledgerTotal() {
  return Math.round(store.flows.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100
}

function onCreateSnapshot() {
  const lt = ledgerTotal()
  createSnapshot({
    finalVal: totals.value.finalVal,
    totalAssets: totals.value.totalAssets,
    adjustment: totals.value.adjustment,
    ledgerTotal: lt,
    diff: Math.round((totals.value.finalVal - lt) * 100) / 100,
    accounts: { ...store.accounts },
    adjustments: { ...store.adjustments }
  })
  alert('快照已保存')
}

function openSnapshots() {
  snaps.value = flatList()
  snapShow.value = true
}

function onDeleteSnapshot(s) {
  deleteSnapshot(s.date, s.idx)
  snaps.value = flatList()
}

function timeOf(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.hero-card {
  border-radius: var(--radius-lg);
  padding: 18px 18px 14px;
  background: linear-gradient(150deg, #3d3730, #2e2a24 60%, #26221d);
  color: #fff;
  box-shadow: 0 6px 20px rgba(60, 48, 36, .22);
  margin-bottom: 14px;
}
.hero-label { font-size: 12px; color: rgba(255,255,255,.62); }
.hero-value { font-size: 30px; font-weight: 700; margin-top: 4px; letter-spacing: .5px; }
.hero-value--neg { color: #ff8b8b; }
.hero-foot {
  display: flex; justify-content: space-between;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,.14);
  font-size: 11px; color: rgba(255,255,255,.66);
}

.section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600;
  margin: 6px 2px 8px;
}
.label-bar { width: 3px; height: 13px; border-radius: 2px; }
.label-bar--green { background: var(--color-fall); }
.label-bar--warn { background: var(--color-warn); }

.group-card { border-top: 3px solid transparent; }
.group-card--green { border-top-color: rgba(46,139,87,.55); }
.group-card--blue { border-top-color: rgba(91,141,239,.55); }
.group-card--red { border-top-color: rgba(214,69,69,.55); }
.group-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.group-name { font-size: 14px; font-weight: 600; }
.group-sub { font-size: 11px; color: var(--text-muted); }

.acct-inputs { display: flex; flex-direction: column; gap: 10px; }
.acct-inputs--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.acct-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.acct-label { font-size: 11px; color: var(--text-muted); }
.acct-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.acct-input:focus { border-color: var(--bg-accent); background: var(--bg-card); }

.total-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin: 4px 0 16px;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-fall);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.total-bar .num-mono { font-size: 17px; }

.adjust-card { display: flex; flex-direction: column; gap: 12px; }
.adj-row { display: flex; align-items: center; gap: 12px; }
.adj-label { flex: 1; font-size: 12px; color: var(--text-secondary); }
.adj-input-wrap { display: flex; gap: 6px; align-items: center; width: 150px; flex-shrink: 0; }
.adj-sign {
  width: 34px; height: 34px; flex-shrink: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
}

.snap-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.snap-btn {
  padding: 10px 8px;
  border-radius: var(--radius-round);
  font-size: 12px;
  border: 1px solid var(--border-soft);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
}
.snap-btn--gen { color: var(--color-fall); border-color: rgba(46,139,87,.3); background: rgba(46,139,87,.06); }
.snap-btn--list { color: #5b8def; border-color: rgba(91,141,239,.3); background: rgba(91,141,239,.06); }

.snap-panel { padding: 18px 16px 24px; }
.snap-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.snap-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 8px; }
.snap-empty { text-align: center; padding: 30px 0; color: var(--text-muted); font-size: 13px; }
.snap-empty span { font-size: 11px; }
.snap-list { display: flex; flex-direction: column; gap: 8px; max-height: 52vh; overflow-y: auto; }
.snap-item {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  position: relative;
}
.snap-main { display: flex; justify-content: space-between; align-items: baseline; }
.snap-date { font-size: 12px; color: var(--text-secondary); }
.snap-val { font-size: 15px; font-weight: 600; }
.snap-meta { display: flex; gap: 12px; margin-top: 6px; font-size: 10px; color: var(--text-muted); flex-wrap: wrap; }
.snap-del {
  position: absolute; right: 10px; bottom: 8px;
  border: none; background: none; color: var(--color-rise);
  font-size: 11px; cursor: pointer;
}
</style>
