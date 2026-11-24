<template>
  <div class="page ledger-page">
    <div class="page-header">
      <span class="page-title">收支账本<span class="page-sub">实际出入帐记录</span></span>
      <button class="add-btn" @click="openAdd">＋ 记一笔</button>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 合计 / 差额 -->
    <div class="section-card sum-card">
      <div class="sum-row">
        <span class="sum-label">流水合计</span>
        <span class="sum-value num-mono">{{ formatMoney(ledgerTotal) }}</span>
      </div>
      <div class="sum-row">
        <span class="sum-label">实际可支配</span>
        <span class="sum-value num-mono">{{ formatMoney(store.totals.finalVal) }}</span>
      </div>
      <div class="sum-row sum-row--diff">
        <span class="sum-label">差额（实际 − 流水）</span>
        <span class="sum-value num-mono" :class="diff >= 0 ? 'rise' : 'fall'">
          {{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}
        </span>
      </div>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="4" />

    <template v-else>
      <div v-if="!store.flows.length" class="empty-tip">暂无记录</div>
      <div v-for="group in grouped" :key="group.month" class="month-group">
        <div class="month-head">
          <span>{{ group.label }}</span>
          <span class="month-sum" :class="group.sum >= 0 ? 'rise' : 'fall'">
            {{ group.sum >= 0 ? '+' : '' }}{{ formatMoney(group.sum) }}
          </span>
        </div>
        <van-swipe-cell v-for="f in group.items" :key="f.id" class="flow-cell">
          <div class="flow-item" @click="openEdit(f)">
            <div class="flow-left">
              <span class="flow-title">{{ f.note || f.category }}</span>
              <span class="flow-meta">
                {{ f.date.slice(5) }} · {{ f.category }}
                <template v-if="f.account"> · {{ f.account }}</template>
                <template v-if="f.dz_mode"> · {{ f.dz_mode }}</template>
              </span>
            </div>
            <span class="flow-amount num-mono" :class="f.amount >= 0 ? 'rise' : 'fall'">
              {{ f.amount >= 0 ? '+' : '' }}{{ formatMoney(f.amount) }}
            </span>
          </div>
          <template #right>
            <button class="swipe-act swipe-act--del" @click="onDelete(f)">删除</button>
          </template>
        </van-swipe-cell>
      </div>
    </template>

    <!-- 新增/编辑 -->
    <van-popup v-model:show="formShow" position="bottom" round :style="{ maxHeight: '86%' }">
      <div class="form-panel">
        <div class="form-title">{{ editing ? '编辑记录' : '记一笔' }}</div>

        <div class="type-switch">
          <button
            class="type-btn"
            :class="{ 'type-btn--on type-btn--expense': form.type === 'expense' }"
            @click="setType('expense')"
          >支出</button>
          <button
            class="type-btn"
            :class="{ 'type-btn--on type-btn--income': form.type === 'income' }"
            @click="setType('income')"
          >收入</button>
        </div>

        <label class="fld">
          <span>金额</span>
          <input v-model="form.amount" class="fld-input num-mono" type="text" inputmode="decimal" placeholder="0.00" />
        </label>

        <div class="fld-row">
          <label class="fld">
            <span>日期</span>
            <input v-model="form.date" class="fld-input" type="date" />
          </label>
          <label class="fld">
            <span>分类</span>
            <select v-model="form.category" class="fld-input">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
        </div>

        <label class="fld">
          <span>标题 / 备注</span>
          <input v-model="form.note" class="fld-input" type="text" placeholder="如：午餐、月付订阅" />
        </label>

        <div class="fld-row">
          <label class="fld">
            <span>账户</span>
            <select v-model="form.account" class="fld-input">
              <option v-for="a in ACCOUNTS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
          <label v-if="isDz" class="fld">
            <span>德州模式</span>
            <select v-model="form.dz_mode" class="fld-input">
              <option v-for="m in DZ_MODES" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
        </div>

        <div v-if="formError" class="form-err">{{ formError }}</div>

        <div class="form-actions">
          <button class="btn-ghost" @click="formShow = false">取消</button>
          <button class="btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { formatMoney } from '@/utils/formatters'
import { ACCOUNTS, DZ_MODES, categoriesOf } from '@/utils/assetCategories'

const store = useAssetStore()

const ledgerTotal = computed(() =>
  Math.round(store.flows.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100
)
const diff = computed(() => Math.round((store.totals.finalVal - ledgerTotal.value) * 100) / 100)

const grouped = computed(() => {
  const map = new Map()
  for (const f of store.flows) {
    const month = String(f.date).slice(0, 7)
    if (!map.has(month)) map.set(month, { month, label: month.replace('-', '年') + '月', sum: 0, items: [] })
    const g = map.get(month)
    g.items.push(f)
    g.sum += Number(f.amount) || 0
  }
  return [...map.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(g => ({ ...g, sum: Math.round(g.sum * 100) / 100 }))
})

// ===== 表单 =====
const formShow = ref(false)
const saving = ref(false)
const formError = ref('')
const editing = ref(null)

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const form = reactive({
  type: 'expense',
  amount: '',
  date: today(),
  category: '生活购物',
  note: '',
  account: '微信支付',
  dz_mode: '线上'
})

const categories = computed(() => categoriesOf(form.type))
const isDz = computed(() => form.category === '德州入账' || form.category === '德州出账')

function setType(type) {
  form.type = type
  const list = categoriesOf(type)
  if (!list.includes(form.category)) form.category = list[0]
}

function openAdd() {
  editing.value = null
  formError.value = ''
  Object.assign(form, {
    type: 'expense', amount: '', date: today(),
    category: '生活购物', note: '', account: '微信支付', dz_mode: '线上'
  })
  formShow.value = true
}

function openEdit(f) {
  editing.value = f
  formError.value = ''
  Object.assign(form, {
    type: f.type,
    amount: String(Math.abs(f.amount)),
    date: f.date,
    category: f.category,
    note: f.note || '',
    account: f.account || '微信支付',
    dz_mode: f.dz_mode || '线上'
  })
  formShow.value = true
}

async function onSave() {
  formError.value = ''
  const amt = parseFloat(form.amount)
  if (!(amt > 0)) { formError.value = '请输入大于 0 的金额'; return }
  if (!form.date) { formError.value = '请选择日期'; return }
  const signed = Math.round((form.type === 'expense' ? -amt : amt) * 100) / 100
  const row = {
    date: form.date,
    type: form.type,
    category: form.category,
    amount: signed,
    note: form.note.trim() || null,
    account: form.account,
    dz_mode: isDz.value ? form.dz_mode : null
  }
  saving.value = true
  try {
    if (editing.value) await store.editFlow(editing.value.id, row)
    else await store.addFlow(row)
    formShow.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function onDelete(f) {
  if (!confirm(`删除「${f.note || f.category}」${formatMoney(f.amount)}？`)) return
  try {
    await store.removeFlow(f.id)
  } catch (e) {
    alert('删除失败：' + e.message)
  }
}

onMounted(() => {
  if (!store.loaded) store.loadAll()
})
</script>

<style scoped>
.page-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }
.add-btn {
  border: none; border-radius: var(--radius-round);
  padding: 6px 14px;
  background: var(--bg-accent); color: #fff;
  font-size: 12px; font-family: inherit; cursor: pointer;
}

.sum-card { display: flex; flex-direction: column; gap: 8px; }
.sum-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
.sum-label { color: var(--text-secondary); }
.sum-value { font-size: 14px; font-weight: 600; }
.sum-row--diff { padding-top: 8px; border-top: 1px solid var(--border-soft); }

.empty-tip { text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px; }
.month-group { margin-bottom: 12px; }
.month-head {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 6px 4px; font-size: 12px; font-weight: 600; color: var(--text-secondary);
}
.month-sum { font-family: var(--font-number); }
.flow-cell { border-radius: var(--radius-md); overflow: hidden; margin-bottom: 6px; }
.flow-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 11px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}
.flow-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.flow-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-meta { font-size: 10px; color: var(--text-muted); }
.flow-amount { font-size: 14px; font-weight: 600; flex-shrink: 0; }
.swipe-act { height: 100%; border: none; color: #fff; font-size: 13px; padding: 0 18px; }
.swipe-act--del { background: var(--color-rise); }

.form-panel { padding: 18px 16px 24px; }
.form-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
.type-switch { display: flex; gap: 8px; margin-bottom: 14px; }
.type-btn {
  flex: 1; padding: 9px; border-radius: var(--radius-md);
  border: 1px solid var(--border-soft); background: var(--bg-hover);
  color: var(--text-secondary); font-size: 13px; font-family: inherit; cursor: pointer;
}
.type-btn--on.type-btn--expense { background: rgba(214,69,69,.12); color: var(--color-rise); border-color: rgba(214,69,69,.4); font-weight: 600; }
.type-btn--on.type-btn--income { background: rgba(46,139,87,.12); color: var(--color-fall); border-color: rgba(46,139,87,.4); font-weight: 600; }

.fld { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; flex: 1; min-width: 0; }
.fld > span { font-size: 11px; color: var(--text-muted); }
.fld-input {
  width: 100%; box-sizing: border-box;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 9px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}
.fld-input:focus { border-color: var(--bg-accent); background: var(--bg-card); }
.fld-row { display: flex; gap: 10px; }
.form-err { font-size: 12px; color: var(--color-rise); margin-bottom: 10px; }
.form-actions { display: flex; gap: 10px; margin-top: 6px; }
.btn-ghost, .btn-primary {
  flex: 1; padding: 11px; border-radius: var(--radius-md);
  font-size: 14px; font-family: inherit; cursor: pointer; border: none;
}
.btn-ghost { background: var(--bg-hover); color: var(--text-secondary); }
.btn-primary { background: var(--bg-accent); color: #fff; }
.btn-primary:disabled { opacity: .6; }
</style>
