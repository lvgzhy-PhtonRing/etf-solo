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
              :class="{ 'acct-input--neg': isNeg(adj.id) }"
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

    <!-- 快照回顾：全屏双栏（与源程序一致） -->
    <van-popup v-model:show="snapShow" position="top" :style="{ height: '100%', width: '100%' }">
      <div class="snap-overlay">
        <div class="snap-header">
          <button class="snap-back" @click="snapShow = false">‹ 返回</button>
          <span class="snap-title">快照回顾</span>
          <span class="snap-spacer"></span>
        </div>

        <div class="snap-body">
          <!-- 左：快照列表 -->
          <div class="snap-list">
            <div v-if="!snaps.length" class="snap-empty">暂无快照</div>
            <div
              v-for="s in snaps"
              :key="s.date + '-' + s.idx"
              class="snap-item"
              :class="{ 'snap-item--on': isSelected(s) }"
              @click="toggleSelect(s)"
            >
              <div class="si-top">
                <span class="si-check">{{ isSelected(s) ? '☑' : '☐' }}</span>
                <span class="si-time">{{ s.date.slice(5) }} {{ timeOf(s.timestamp) }}</span>
              </div>
              <div class="si-val num-mono">{{ formatMoney(s.actualVal) }}</div>
              <div class="si-meta">
                实际 <span class="num-mono">{{ formatMoney(s.actualVal) }}</span>
                差异 <span class="num-mono" :class="s.diff >= 0 ? 'warn' : 'fall'">{{ s.diff >= 0 ? '+' : '' }}{{ formatMoney(s.diff) }}</span>
              </div>
              <button class="si-del" @click.stop="onDeleteSnapshot(s)">×</button>
            </div>
          </div>

          <!-- 右：对比区 -->
          <div class="snap-content">
            <div class="sc-head">
              <span class="sc-count">已选 {{ selected.length }} 个</span>
              <div class="sc-tabs">
                <button class="sc-tab" :class="{ 'sc-tab--on': view === 'data' }" @click="view = 'data'">数据</button>
                <button class="sc-tab" :class="{ 'sc-tab--on': view === 'logs' }" @click="view = 'logs'">收支</button>
                <button class="sc-clear" @click="selected = []">清空</button>
              </div>
            </div>

            <!-- 数据对比 -->
            <template v-if="view === 'data'">
              <div v-if="selected.length < 2" class="sc-empty">请选择2个快照对比数据</div>
              <div v-else-if="!compare.rows.length" class="sc-empty">所选快照之间无变化</div>
              <div v-else class="cmp-list">
                <div class="cmp-cols">
                  <span>{{ compare.cols[0] }}</span>
                  <span>{{ compare.cols[1] }}</span>
                </div>
                <div v-for="r in compare.rows" :key="r.label" class="cmp-row">
                  <div class="cr-left">
                    <div class="cr-label" :class="{ 'cr-label--core': r.core }">{{ r.label }}</div>
                    <div class="cr-detail">
                      <span class="num-mono">{{ formatMoney(r.v1) }}</span>
                      →
                      <span class="num-mono">{{ formatMoney(r.v2) }}</span>
                    </div>
                  </div>
                  <div class="cr-right num-mono" :class="r.dir === 'up' ? 'rise' : 'fall'">
                    {{ r.change > 0 ? '+' : '' }}{{ formatMoney(r.change) }} {{ r.dir === 'up' ? '↑' : '↓' }}
                  </div>
                </div>
              </div>
            </template>

            <!-- 收支对比 -->
            <template v-else>
              <div v-if="selected.length < 2" class="sc-empty">请选择 2 个快照对比收支</div>
              <template v-else>
                <div v-if="!logDiff.added.length && !logDiff.removed.length" class="sc-empty">收支明细无变化</div>
                <template v-else>
                  <div v-if="logDiff.added.length" class="diff-block">
                    <div class="diff-title diff-title--add">▼ 相比新增 ({{ logDiff.added.length }}条)</div>
                    <div v-for="(l, i) in logDiff.added" :key="'a' + i" class="diff-row diff-row--add">
                      <span class="dr-name">{{ l.date.slice(5) }} {{ l.title || l.note }}</span>
                      <span class="dr-amt num-mono" :class="l.amount >= 0 ? 'rise' : 'fall'">
                        {{ l.amount > 0 ? '+' : '' }}{{ formatMoney(l.amount) }}
                      </span>
                    </div>
                  </div>
                  <div v-if="logDiff.removed.length" class="diff-block">
                    <div class="diff-title diff-title--del">▼ 相比删除 ({{ logDiff.removed.length }}条)</div>
                    <div v-for="(l, i) in logDiff.removed" :key="'r' + i" class="diff-row diff-row--del">
                      <span class="dr-name">{{ l.date.slice(5) }} {{ l.title || l.note }}</span>
                      <span class="dr-amt num-mono muted">{{ l.amount > 0 ? '+' : '' }}{{ formatMoney(l.amount) }}</span>
                    </div>
                  </div>
                </template>
              </template>
            </template>
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
import {
  createSnapshot, flatList, deleteSnapshot, timeOf,
  buildCompare, buildLogDiff
} from '@/utils/assetSnapshots'
import { filterDecimal, applySignToggle } from '@/utils/decimalInput'

const store = useAssetStore()

const inputs = reactive({})
// 直接按输入值计算，键入即刻反映，无需等 debounce 落库
const totals = computed(() => calcAssets(inputs, inputs))
const groups = computed(() => totals.value.groups)

watch(
  () => [store.accounts, store.adjustments],
  () => {
    // 保留未完成的负号输入（± 按钮 0 → '-'），其余字段回写服务端值
    for (const [k, v] of Object.entries({ ...store.accounts, ...store.adjustments })) {
      if (inputs[k] === '-') continue
      inputs[k] = v
    }
  },
  { immediate: true, deep: true }
)

const timers = {}
function onInput(id, raw) {
  const isAdj = ADJUSTMENTS.some(a => a.id === id)
  inputs[id] = filterDecimal(raw, { allowNegative: isAdj })
  clearTimeout(timers[id])
  timers[id] = setTimeout(() => commit(id), 500)
}

async function commit(id) {
  clearTimeout(timers[id])
  const raw = inputs[id]
  if (raw === '-' || raw === '') return
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
  const next = applySignToggle(inputs[id])
  inputs[id] = next
  if (next === '-') return
  await commit(id)
}

// 负数输入高亮（仅调整项，与原程序一致）
function isNeg(id) {
  return ADJUSTMENTS.some(a => a.id === id) && (parseFloat(inputs[id]) || 0) < 0
}

// ===== 快照 =====
const snapShow = ref(false)
const snaps = ref([])
const selected = ref([])
const view = ref('data')

function ledgerTotal() {
  return Math.round(store.flows.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100
}

function currentSnapshot() {
  const lt = ledgerTotal()
  return {
    timestamp: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    actualVal: totals.value.finalVal,
    totalAssets: totals.value.totalAssets,
    adjustment: totals.value.adjustment,
    ledgerTotal: lt,
    diff: Math.round((totals.value.finalVal - lt) * 100) / 100,
    assets: { ...store.accounts, ...store.adjustments },
    logs: store.flows
  }
}

function onCreateSnapshot() {
  const cur = currentSnapshot()
  createSnapshot({
    actualVal: cur.actualVal,
    totalAssets: cur.totalAssets,
    adjustment: cur.adjustment,
    ledgerTotal: cur.ledgerTotal,
    diff: cur.diff,
    assets: cur.assets,
    logs: cur.logs.map(f => ({ date: f.date, title: f.note, amount: f.amount }))
  })
  alert('快照已保存')
}

function openSnapshots() {
  snaps.value = flatList()
  selected.value = snaps.value.slice(0, 2)
  snapShow.value = true
}

function isSelected(s) {
  return selected.value.some(x => x.date === s.date && x.idx === s.idx)
}

function toggleSelect(s) {
  const i = selected.value.findIndex(x => x.date === s.date && x.idx === s.idx)
  if (i >= 0) selected.value.splice(i, 1)
  else if (selected.value.length < 2) selected.value.push(s)
}

function onDeleteSnapshot(s) {
  if (!confirm('确定删除此快照？')) return
  deleteSnapshot(s.date, s.idx)
  snaps.value = flatList()
  selected.value = selected.value.filter(x => !(x.date === s.date && x.idx === s.idx))
}

const compare = computed(() => buildCompare(selected.value, currentSnapshot()))
const logDiff = computed(() => {
  if (selected.value.length < 2) return { added: [], removed: [] }
  const sorted = [...selected.value].sort((a, b) => a.timestamp - b.timestamp)
  return buildLogDiff(sorted[0].logs || [], sorted[1].logs || [])
})

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
.acct-input--neg { color: var(--color-rise); font-weight: 700; }

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

/* ===== 快照全屏 ===== */
.snap-overlay { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
.snap-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.snap-back { border: none; background: none; color: var(--text-secondary); font-size: 13px; cursor: pointer; padding: 4px; }
.snap-title { font-size: 15px; font-weight: 700; }
.snap-spacer { width: 54px; }
.snap-body { flex: 1; display: flex; overflow: hidden; }

.snap-list {
  width: 38%;
  max-width: 180px;
  border-right: 1px solid var(--border-soft);
  background: var(--bg-hover);
  overflow-y: auto;
  padding: 8px;
  flex-shrink: 0;
}
.snap-empty { text-align: center; font-size: 11px; color: var(--text-muted); padding: 20px 0; }
.snap-item {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 8px 8px 22px;
  margin-bottom: 8px;
  cursor: pointer;
}
.snap-item--on { border-color: var(--bg-accent); box-shadow: 0 0 0 1px var(--bg-accent) inset; }
.si-top { display: flex; align-items: center; gap: 4px; }
.si-check { font-size: 11px; color: var(--bg-accent); }
.si-time { font-size: 10px; color: var(--text-secondary); }
.si-val { font-size: 13px; font-weight: 700; margin-top: 4px; }
.si-meta { font-size: 9px; color: var(--text-muted); margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; }
.si-del {
  position: absolute; right: 4px; bottom: 2px;
  border: none; background: none; color: var(--text-muted);
  font-size: 14px; cursor: pointer; padding: 2px 6px;
}

.snap-content { flex: 1; overflow-y: auto; padding: 10px 12px; }
.sc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sc-count { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.sc-tabs { display: flex; align-items: center; gap: 2px; background: var(--bg-hover); border-radius: var(--radius-md); padding: 2px; }
.sc-tab {
  border: none; background: transparent; color: var(--text-muted);
  font-size: 11px; padding: 4px 10px; border-radius: var(--radius-sm);
  font-family: inherit; cursor: pointer;
}
.sc-tab--on { background: var(--bg-card); color: var(--bg-accent); font-weight: 600; }
.sc-clear { border: none; background: none; color: var(--text-muted); font-size: 11px; padding: 2px 6px; cursor: pointer; }
.sc-empty { text-align: center; font-size: 12px; color: var(--text-muted); padding: 30px 0; }

.cmp-cols { display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); padding: 0 2px 6px; }
.cmp-list { display: flex; flex-direction: column; gap: 6px; }
.cmp-row {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 8px 10px;
}
.cr-label { font-size: 12px; color: var(--text-primary); }
.cr-label--core { font-weight: 700; }
.cr-detail { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
.cr-right { font-size: 13px; font-weight: 700; white-space: nowrap; }

.diff-block { margin-bottom: 12px; }
.diff-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
.diff-title--add { color: var(--color-rise); }
.diff-title--del { color: var(--text-secondary); }
.diff-row {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  border-radius: var(--radius-md); padding: 7px 10px; margin-bottom: 4px;
  font-size: 11px;
}
.diff-row--add { background: rgba(214,69,69,.08); }
.diff-row--del { background: var(--bg-hover); }
.dr-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dr-amt { font-weight: 700; }

.warn { color: var(--color-warn); }
.muted { color: var(--text-muted); }
</style>
