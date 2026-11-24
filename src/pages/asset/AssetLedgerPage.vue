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
        <span class="sum-label">账面资产（流水合计）</span>
        <span class="sum-value num-mono">{{ formatMoney(ledgerTotal) }}</span>
      </div>
      <div class="sum-row">
        <span class="sum-label">实际可支配</span>
        <span class="sum-value num-mono">{{ formatMoney(store.totals.finalVal) }}</span>
      </div>
      <div class="sum-row sum-row--diff">
        <span class="sum-label">差异</span>
        <span class="sum-value num-mono" :class="diff >= 0 ? 'warn' : 'fall'">
          {{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}
        </span>
      </div>
    </div>

    <!-- 收支记录 + 视图切换 -->
    <div class="list-head">
      <div class="lh-left">
        <span class="lh-title">收支记录</span>
        <span class="swipe-hint">←左滑编辑</span>
      </div>
      <div class="view-tabs">
        <button class="view-btn" :class="{ 'view-btn--on': viewMode === 'month' }" @click="viewMode = 'month'">按月</button>
        <button class="view-btn" :class="{ 'view-btn--on': viewMode === 'week' }" @click="viewMode = 'week'">按周</button>
      </div>
    </div>

    <LoadingSkeleton v-if="store.loading && !store.loaded" :count="4" />

    <template v-else>
      <div v-if="!groups.length" class="empty-tip">暂无记录</div>

      <div v-for="g in groups" :key="g.key" class="group-item">
        <div class="group-header" @click="toggleGroup(g.key)">
          <div class="gh-left">
            <svg class="gh-arrow" :class="{ 'gh-arrow--open': isCollapsed(g) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span class="gh-label">{{ g.label }}</span>
          </div>
          <div class="gh-right">
            <span class="gh-income">收 {{ formatMoney(g.income) }}</span>
            <span class="gh-expense">支 {{ formatMoney(g.expense) }}</span>
            <span class="gh-total" :class="g.total >= 0 ? 'rise' : 'fall'">
              {{ g.total >= 0 ? '+' : '' }}{{ formatMoney(g.total) }}
            </span>
          </div>
        </div>

        <div v-show="!isCollapsed(g)" class="group-content">
          <van-swipe-cell v-for="f in g.items" :key="f.id" class="flow-cell">
            <div class="flow-item">
              <div class="flow-left">
                <span class="flow-title">{{ f.note || f.category }}</span>
                <span class="flow-meta">
                  {{ f.date.slice(5) }} · {{ f.account || '—' }}<template v-if="f.dz_mode"> · {{ f.dz_mode }}</template>
                </span>
              </div>
              <div class="flow-right">
                <span class="badge" :class="badgeClass(f.category)">{{ f.category || '其他' }}</span>
                <span v-if="f.dz_mode" class="badge" :class="f.dz_mode === '线上' ? 'badge--blue' : 'badge--green'">{{ f.dz_mode }}</span>
                <span class="flow-amount num-mono" :class="f.amount >= 0 ? 'rise' : 'fall'">
                  {{ f.amount > 0 ? '+' : '' }}{{ formatMoney(f.amount) }}
                </span>
              </div>
            </div>
            <template #right>
              <button class="swipe-act swipe-act--edit" @click="openEdit(f)">编辑</button>
              <button class="swipe-act swipe-act--del" @click="onDelete(f)">删除</button>
            </template>
          </van-swipe-cell>
        </div>
      </div>
    </template>

    <!-- 新增/编辑 -->
    <van-popup v-model:show="formShow" position="bottom" round :style="{ maxHeight: '88%' }">
      <div class="form-panel">
        <div class="form-title">{{ editing ? '编辑记录' : '记一笔' }}</div>

        <div class="type-switch">
          <button class="type-btn" :class="{ 'type-btn--on type-btn--expense': form.type === 'expense' }" @click="setType('expense')">支出</button>
          <button class="type-btn" :class="{ 'type-btn--on type-btn--income': form.type === 'income' }" @click="setType('income')">收入</button>
        </div>

        <div class="fld-row">
          <label class="fld">
            <span>分类</span>
            <select v-model="form.category" class="fld-input">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="fld">
            <span>账户</span>
            <select v-model="form.account" class="fld-input">
              <option v-for="a in ACCOUNTS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
        </div>

        <div v-if="isDz" class="fld">
          <span>德州模式</span>
          <div class="dz-switch">
            <button
              v-for="m in DZ_MODES"
              :key="m"
              class="dz-btn"
              :class="form.dz_mode === m ? (m === '线上' ? 'dz-btn--on-line' : 'dz-btn--on-offline') : ''"
              @click="form.dz_mode = m"
            >{{ m }}</button>
          </div>
        </div>

        <div class="fld-row">
          <label class="fld">
            <span>日期</span>
            <input v-model="form.date" class="fld-input" type="date" />
          </label>
          <label class="fld">
            <span>金额</span>
            <input
              class="fld-input num-mono"
              type="text"
              inputmode="decimal"
              :placeholder="form.type === 'expense' ? '支出金额' : '收入金额'"
              :value="form.amount"
              @input="onAmountInput"
            />
          </label>
        </div>

        <label class="fld">
          <span>标题</span>
          <input v-model="form.note" class="fld-input" type="text" placeholder="如：午餐、月付订阅" />
        </label>

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
import { ref, reactive, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { formatMoney } from '@/utils/formatters'
import { ACCOUNTS, DZ_MODES, categoriesOf } from '@/utils/assetCategories'
import { groupFlows } from '@/utils/assetLedger'
import { filterDecimal } from '@/utils/decimalInput'

const store = useAssetStore()

const viewMode = ref('month')
const collapsed = reactive({})

const ledgerTotal = computed(() =>
  Math.round(store.flows.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100
)
const diff = computed(() => Math.round((store.totals.finalVal - ledgerTotal.value) * 100) / 100)
const groups = computed(() => groupFlows(store.flows, viewMode.value))

function isCollapsed(g) {
  const key = `${viewMode.value}:${g.key}`
  return collapsed[key] ?? g.isOld
}

function toggleGroup(key) {
  const k = `${viewMode.value}:${key}`
  const current = collapsed[k]
  const group = groups.value.find(x => x.key === key)
  collapsed[k] = current === undefined ? !group.isOld : !current
}

// 分类徽标配色（沿用源程序 getCategoryBadge）
const BADGE = {
  德州出账: 'badge--red',
  德州入账: 'badge--red',
  数字服务: 'badge--blue',
  差旅交通: 'badge--yellow',
  生活购物: 'badge--green',
  归还A队: 'badge--purple',
  初始资金: 'badge--amber',
  公款转入: 'badge--orange'
}
function badgeClass(cat) {
  return BADGE[cat] || 'badge--gray'
}

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

function onAmountInput(e) {
  form.amount = filterDecimal(e.target.value)
  e.target.value = form.amount
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
.warn { color: var(--color-warn); }
.muted { color: var(--text-muted); }

.list-head { display: flex; justify-content: space-between; align-items: center; margin: 12px 2px 8px; }
.lh-left { display: flex; align-items: center; gap: 8px; }
.lh-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.swipe-hint {
  font-size: 10px; font-weight: 500;
  color: #7c3aed; background: #f3e8ff;
  padding: 2px 8px; border-radius: var(--radius-round);
}
.view-tabs { display: flex; gap: 2px; padding: 2px; background: var(--bg-hover); border-radius: var(--radius-md); }
.view-btn {
  padding: 4px 10px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted);
  font-size: 11px; font-family: inherit; cursor: pointer;
}
.view-btn--on { background: var(--bg-card); color: var(--bg-accent); font-weight: 600; box-shadow: 0 1px 3px rgba(120,100,75,.12); }

.empty-tip { text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px; }

.group-item { margin-bottom: 10px; }
.group-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.gh-left { display: flex; align-items: center; gap: 6px; }
.gh-arrow { width: 14px; height: 14px; color: var(--text-muted); transition: transform .18s; }
.gh-arrow--open { transform: rotate(180deg); }
.gh-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.gh-right { display: flex; align-items: baseline; gap: 10px; font-size: 11px; }
.gh-income { color: var(--color-rise); }
.gh-expense { color: var(--color-fall); }
.gh-total { font-weight: 700; font-family: var(--font-number); }

.group-content { margin-top: 6px; padding-left: 6px; display: flex; flex-direction: column; gap: 6px; }
.flow-cell { border-radius: var(--radius-md); overflow: hidden; }
.flow-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}
.flow-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.flow-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-meta { font-size: 10px; color: var(--text-muted); }
.flow-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.flow-amount { font-size: 13px; font-weight: 700; font-family: var(--font-number); }

.badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: var(--radius-round);
  white-space: nowrap;
}
.badge--red { background: #fee2e2; color: #b91c1c; }
.badge--blue { background: #dbeafe; color: #1d4ed8; }
.badge--yellow { background: #fef3c7; color: #b45309; }
.badge--green { background: #dcfce7; color: #15803d; }
.badge--purple { background: #ede9fe; color: #6d28d9; }
.badge--amber { background: #fef3c7; color: #92400e; }
.badge--orange { background: #ffedd5; color: #c2410c; }
.badge--gray { background: var(--bg-subtle); color: var(--text-secondary); }

.swipe-act { height: 100%; border: none; color: #fff; font-size: 13px; padding: 0 16px; }
.swipe-act--edit { background: #6366f1; }
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

.dz-switch { display: flex; gap: 8px; }
.dz-btn {
  flex: 1; padding: 9px; border-radius: var(--radius-md);
  border: 1px solid var(--border-soft); background: var(--bg-hover);
  color: var(--text-muted); font-size: 13px; font-family: inherit; cursor: pointer;
}
.dz-btn--on-line { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; font-weight: 600; }
.dz-btn--on-offline { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; font-weight: 600; }

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
