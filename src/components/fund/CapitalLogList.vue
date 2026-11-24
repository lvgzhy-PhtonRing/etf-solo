<template>
  <div class="capital-log-list">
    <div class="log-header">
      <span class="log-title">{{ title }}</span>
      <span class="swipe-hint" v-if="hasEditable">◀ 左滑编辑</span>
      <span class="log-count" v-if="logs.length">共 {{ logs.length }} 条</span>
    </div>
    <div v-if="!logs.length"><EmptyState icon="💰" text="暂无资金变动记录" /></div>
    <div v-else class="trade-log-list">
      <van-swipe-cell v-for="log in logs" :key="log.id" :right-width="editable(log) ? 140 : 0">
        <div class="trade-log-item" :class="{ 'is-expandable': hasItems(log) }" @click="toggle(log)">
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
              <span v-if="showRunning && log.running !== undefined"> · 余额 {{ formatMoney(log.running) }}</span>
            </div>
            <div v-if="expandedIds.includes(log.id)" class="detail-breakdown">
              <div v-for="(item, i) in itemsOf(log)" :key="i" class="detail-breakdown-row">
                <span>
                  {{ ADJUST_LABELS[item.category] || item.category }}
                  <span v-if="item.stockName" class="detail-stock-name">{{ item.stockName }}</span>
                </span>
                <span class="num-mono" :class="item.signedAmount < 0 ? 'fall' : 'rise'">{{ formatSignedCents(item.signedAmount) }}</span>
              </div>
            </div>
          </div>
          <span class="tli-arrow" v-if="hasItems(log)">{{ expandedIds.includes(log.id) ? '⌄' : '›' }}</span>
          <span class="tli-arrow" v-else-if="editable(log)">›</span>
        </div>
        <template #right>
          <div class="swipe-actions" v-if="editable(log)">
            <button class="swipe-edit-btn" @click.stop="startEdit(log)">编辑</button>
            <button class="swipe-del-btn" @click.stop="confirmDelete(log)">删除</button>
          </div>
        </template>
      </van-swipe-cell>
    </div>

    <teleport to="body">
      <div v-if="editing" class="overlay" @click.self="editing = null">
        <div class="dialog">
          <div class="dlg-title">编辑记录</div>
          <div class="dlg-field">
            <label class="dlg-label">类型</label>
            <span class="dlg-value">{{ labelOf(editing) }}</span>
          </div>
          <div class="dlg-field">
            <label class="dlg-label">金额（元）</label>
            <input v-model="editAmount" type="number" inputmode="decimal" class="dlg-input num-mono" />
          </div>
          <div class="dlg-field">
            <label class="dlg-label">日期</label>
            <input v-model="editDate" type="date" class="dlg-input" />
          </div>
          <div class="dlg-field" v-if="!itemized">
            <label class="dlg-label">备注</label>
            <input v-model="editNote" type="text" class="dlg-input" placeholder="备注" />
          </div>
          <div class="dlg-info" v-else>调整类备注由分项管理，保存时同步金额</div>
          <div class="dlg-error" v-if="error">{{ error }}</div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="editing = null">取消</button>
            <button class="d-ok" @click="saveEdit">✅ 保存</button>
          </div>
        </div>
      </div>

      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="dialog">
          <div class="dlg-title">确认删除</div>
          <div class="dlg-info">确定删除此条记录？</div>
          <div class="dlg-rows">
            <div class="dlg-row">
              <span>{{ labelOf(deleting) }}</span>
              <span class="num-mono">{{ formatMoney(deleting.amount) }}</span>
            </div>
            <div class="dlg-row" v-if="noteText(deleting)">
              <span>备注</span>
              <span>{{ noteText(deleting) }}</span>
            </div>
            <div class="dlg-warn">⚠️ 删除后可用资金与总资产同步变化，不可恢复</div>
          </div>
          <div class="dlg-btns">
            <button class="d-cancel" @click="deleting = null">取消</button>
            <button class="d-ok del" @click="doDelete">🗑️ 确认删除</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney, isoWithDate } from '@/utils/formatters'
import { ADJUST_LABELS, parseAdjustNote, updateAdjustAmount } from '@/utils/adjustItems'
import { marketDate } from '@/utils/historicalSnapshotLedger'
import { useFundStore } from '@/stores/funds'
import EmptyState from '@/components/common/EmptyState.vue'

const props = defineProps({
  logs: { type: Array, default: () => [] },
  title: { type: String, default: '资本流水' },
  showRunning: { type: Boolean, default: false }
})

const fundStore = useFundStore()
const editing = ref(null)
const editAmount = ref('')
const editNote = ref('')
const editDate = ref('')
const deleting = ref(null)
const error = ref('')
const expandedIds = ref([])

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// 交易流水与交易记录联动，请到「交易记录」改；期初结转是净值基准
function editable(log) {
  return log.category !== 'trade' && !String(log.note || '').startsWith('期初结转')
}

const hasEditable = computed(() => props.logs.some(editable))

const itemized = computed(() => Boolean(parseAdjustNote(editing.value?.note)?.items?.length))

function labelOf(log) {
  if (log.category === 'trade') return log.type === 'add' ? '卖出' : '买入'
  if (log.category === 'adjust') {
    const items = itemsOf(log)
    if (items.length === 1) return ADJUST_LABELS[items[0].category] || '调整'
    return '调整'
  }
  if (String(log.note || '').startsWith('期初结转')) return '基准'
  if (log.note === '银证转入') return '转入'
  if (log.note === '银证转出') return '转出'
  return log.type === 'add' ? '增资' : '减资'
}

function itemsOf(log) {
  return parseAdjustNote(log?.note)?.items || []
}

function hasItems(log) {
  return log.category === 'adjust' && itemsOf(log).length > 0
}

function toggle(log) {
  if (!hasItems(log)) return
  expandedIds.value = expandedIds.value.includes(log.id)
    ? expandedIds.value.filter(id => id !== log.id)
    : [...expandedIds.value, log.id]
}

function formatSignedCents(cents) {
  const value = (Number(cents) || 0) / 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
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
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function startEdit(log) {
  if (!editable(log)) return
  editing.value = log
  editAmount.value = String(log.amount)
  editDate.value = marketDate(log.created_at)
  const data = parseAdjustNote(log.note)
  editNote.value = data ? (data.note || '') : (log.note || '')
  error.value = ''
}

async function saveEdit() {
  if (!editing.value) return
  const amount = parseFloat(editAmount.value)
  if (!(amount > 0)) { error.value = '请输入正数金额'; return }
  const log = editing.value
  const updates = { amount: round2(amount) }
  if (log.category === 'adjust') {
    const next = updateAdjustAmount(log.note, amount)
    if (next === null) { error.value = '多分项记录不支持改金额'; return }
    updates.note = next
  } else {
    updates.note = editNote.value || ''
  }
  if (editDate.value && editDate.value !== marketDate(log.created_at)) {
    updates.created_at = isoWithDate(log.created_at, editDate.value)
  }
  try {
    await fundStore.editCapitalLog(log.id, updates)
    await fundStore.loadCapitalLogs()
    editing.value = null
  } catch (e) {
    error.value = '保存失败：' + e.message
  }
}

function confirmDelete(log) {
  if (!editable(log)) return
  deleting.value = log
}

async function doDelete() {
  if (!deleting.value) return
  try {
    await fundStore.removeCapitalLog(deleting.value.id)
    await fundStore.loadCapitalLogs()
    deleting.value = null
  } catch (e) {
    error.value = '删除失败：' + e.message
  }
}
</script>

<style scoped>
.log-header { display: flex; align-items: center; gap: 8px; padding: 0 0 8px; }
.log-title { font-size: 14px; font-weight: 600; }
.log-count { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
.swipe-hint {
  font-size: 11px;
  background: linear-gradient(135deg, var(--color-rise), #ff8a9a);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}

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
.tli-arrow { font-size: 16px; color: var(--text-muted); opacity: 0.3; flex-shrink: 0; }
.trade-log-item.is-expandable { cursor: pointer; }
.detail-breakdown { padding: 6px 0 0 16px; display: grid; gap: 3px; }
.detail-breakdown-row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-secondary); line-height: 1.35; }
.detail-stock-name { margin-left: 5px; color: var(--text-muted); }
.detail-breakdown-row .rise { color: var(--color-rise); }
.detail-breakdown-row .fall { color: var(--color-fall); }

.swipe-actions { display: flex; height: 100%; }
.swipe-edit-btn { width: 70px; border: none; background: var(--bg-accent); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }
.swipe-del-btn { width: 70px; border: none; background: var(--color-fall); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; }

.overlay { position: fixed; inset: 0; background: rgba(46,42,36,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.dialog { background: var(--bg-card); border-radius: var(--radius-lg); padding: 20px; width: 100%; max-width: 360px; }
.dlg-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
.dlg-field { margin-bottom: 12px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-value { font-size: 14px; color: var(--text-primary); }
.dlg-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-soft); border-radius: var(--radius-md); background: var(--bg-hover); color: var(--text-primary); font-size: 15px; outline: none; box-sizing: border-box; }
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-input.num-mono { font-family: var(--font-number); }
.dlg-info { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.dlg-error { font-size: 12px; color: var(--color-fall); text-align: center; margin-bottom: 8px; }
.dlg-btns { display: flex; gap: 10px; margin-top: 16px; }
.d-cancel { flex: 1; padding: 10px; border: 1px solid var(--border-soft); border-radius: var(--radius-md); background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
.d-ok { flex: 2; padding: 10px; border: none; border-radius: var(--radius-md); background: var(--bg-accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.d-ok.del { background: var(--color-fall); }
.dlg-rows { margin-bottom: 8px; }
.dlg-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 13px; border-bottom: 1px solid var(--border-soft); }
.dlg-warn { font-size: 11px; color: var(--color-warn); padding: 6px 0; text-align: center; }
</style>
