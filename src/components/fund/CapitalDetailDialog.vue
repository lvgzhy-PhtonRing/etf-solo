<template>
  <teleport to="body">
    <div v-if="show" class="overlay" @click.self="close">
      <div class="dialog">
        <div class="dlg-head">
          <span class="dlg-title">资本明细</span>
          <button class="dlg-close" @click="close">✕</button>
        </div>

        <div class="amount-row">
          <input v-model="deltaAmount" type="number" inputmode="decimal" placeholder="输入金额（元）" class="big-input num-mono" />
        </div>
        <div class="action-row">
          <button class="act-btn add" :disabled="!deltaValid || submitting" @click="submit('add')">增资</button>
          <button class="act-btn remove" :disabled="!deltaValid || submitting" @click="submit('remove')">减资</button>
        </div>
        <div class="dlg-field">
          <label class="dlg-label">备注</label>
          <input v-model="note" type="text" class="dlg-input" placeholder="选填，如银证转入" />
        </div>
        <div v-if="error" class="dlg-error">{{ error }}</div>

        <div class="divider"></div>
        <div class="dlg-list">
          <CapitalLogList :logs="timeline" title="资本变动记录" show-running />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { buildCapitalTimeline } from '@/utils/capitalTimeline'
import { useFundStore } from '@/stores/funds'
import CapitalLogList from './CapitalLogList.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:show'])

const fundStore = useFundStore()
const deltaAmount = ref('')
const note = ref('')
const submitting = ref(false)
const error = ref('')

const deltaValid = computed(() => parseFloat(deltaAmount.value) > 0)
const timeline = computed(() => buildCapitalTimeline(props.logs))

function close() {
  emit('update:show', false)
  deltaAmount.value = ''
  note.value = ''
  error.value = ''
}

async function submit(type) {
  const amount = parseFloat(deltaAmount.value)
  if (!(amount > 0)) return
  submitting.value = true
  error.value = ''
  try {
    await fundStore.addCapitalLog({
      type,
      amount: Math.round(amount * 100) / 100,
      category: 'capital',
      note: note.value || (type === 'add' ? '增资' : '减资'),
      created_by: 'solo'
    })
    await fundStore.loadCapitalLogs()
    deltaAmount.value = ''
    note.value = ''
  } catch (e) {
    error.value = '保存失败：' + e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(46,42,36,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.dialog { background: var(--bg-card); border-radius: var(--radius-lg); padding: 18px 16px; width: 100%; max-width: 420px; max-height: 82vh; display: flex; flex-direction: column; }
.dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.dlg-title { font-size: 17px; font-weight: 700; }
.dlg-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; padding: 0 2px; }

.amount-row { display: flex; align-items: center; margin-bottom: 10px; }
.big-input { flex: 1; min-width: 0; width: 100%; background: var(--bg-hover); border: 1px solid var(--border-soft); border-radius: var(--radius-md); color: var(--text-primary); font-size: 18px; padding: 10px 12px; text-align: center; outline: none; font-family: var(--font-number); box-sizing: border-box; }
.big-input:focus { border-color: var(--bg-accent); }
.action-row { display: flex; gap: 10px; }
.act-btn { flex: 1; padding: 11px; border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; cursor: pointer; color: #fff; }
.act-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.act-btn.add { background: var(--color-rise); }
.act-btn.remove { background: var(--color-fall); }

.dlg-field { margin-top: 10px; }
.dlg-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.dlg-input { width: 100%; padding: 9px 11px; border: 1px solid var(--border-soft); border-radius: var(--radius-md); background: var(--bg-hover); color: var(--text-primary); font-size: 14px; outline: none; box-sizing: border-box; }
.dlg-input:focus { border-color: var(--bg-accent); }
.dlg-error { color: var(--color-fall); font-size: 12px; margin-top: 8px; text-align: center; }
.divider { height: 1px; background: var(--border-soft); margin: 14px 0 10px; }
.dlg-list { flex: 1; overflow-y: auto; min-height: 0; }
</style>
