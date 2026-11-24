<template>
  <div class="page ledger-page">
    <div class="page-header">
      <span class="page-title">账目流水<span class="page-sub">账面出入账记录</span></span>
    </div>

    <LoadErrorTip v-if="store.error" :message="store.error" @retry="store.loadAll()" />

    <!-- 账面资产总数 -->
    <div class="hero-card">
      <div class="hero-label">账面资产总数 (元)</div>
      <div class="hero-value num-mono">{{ formatMoney(ledgerTotal) }}</div>
      <div class="hero-foot">
        <span>收支记录平衡</span>
        <span>差异: <span class="num-mono" :class="diff >= 0 ? 'warn' : 'fall'">{{ diff >= 0 ? '+' : '' }}{{ formatMoney(diff) }}</span></span>
      </div>
    </div>

    <!-- 记一笔（内联表单，与源程序一致） -->
    <div class="add-card" :class="form.type === 'income' ? 'add-card--income' : 'add-card--expense'">
      <div v-if="editing" class="editing-tip">✏️ 正在编辑第 {{ editing.id }} 条 <button class="edit-cancel" @click="cancelEdit">取消</button></div>
      <input
        v-model="form.note"
        class="add-input add-input--full"
        type="text"
        placeholder="事项说明不能为空"
      />
      <div class="add-row">
        <button class="pick" :class="form.type === 'expense' ? 'pick--expense' : 'pick--idle'" @click="setType('expense')">支出</button>
        <button class="pick" :class="form.type === 'income' ? 'pick--income' : 'pick--idle'" @click="setType('income')">收入</button>
      </div>
      <div class="add-row">
        <select v-model="form.category" class="add-input" @change="onCategoryChange">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="form.account" class="add-input">
          <option v-for="a in ACCOUNT_OPTIONS" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <div v-if="isDz" class="add-row">
        <button class="pick" :class="form.dz_mode === '线上' ? 'pick--online' : 'pick--idle'" @click="form.dz_mode = '线上'">线上</button>
        <button class="pick" :class="form.dz_mode === '线下' ? 'pick--offline' : 'pick--idle'" @click="form.dz_mode = '线下'">线下</button>
      </div>
      <div class="add-row">
        <input v-model="form.date" class="add-input" type="date" />
        <input
          class="add-input num-mono"
          type="text"
          inputmode="decimal"
          :placeholder="form.type === 'expense' ? '支出金额' : '收入金额'"
          :value="form.amount"
          @input="onAmountInput"
        />
        <button class="add-submit" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : (editing ? '保存修改' : '记一笔') }}</button>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import LoadErrorTip from '@/components/common/LoadErrorTip.vue'
import LoadingSkeleton from '@/components/common/LoadingSkeleton.vue'
import { useAssetStore } from '@/stores/assets'
import { formatMoney } from '@/utils/formatters'
import { TYPE_OPTIONS, ACCOUNT_OPTIONS, optionsOf, categoriesOf } from '@/utils/assetCategories'
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

// 分类徽标配色（源程序 getCategoryBadge）
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

// ===== 内联表单 =====
const saving = ref(false)
const editing = ref(null)

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const form = reactive({
  type: 'expense',
  amount: '',
  date: today(),
  category: '德州出账',
  note: '',
  account: '微信支付',
  dz_mode: '线上'
})

const options = computed(() => optionsOf(form.type))
const isDz = computed(() => form.category === '德州入账' || form.category === '德州出账')

function setType(type) {
  form.type = type
  const list = categoriesOf(type)
  if (!list.includes(form.category)) form.category = list[0]
}

function onCategoryChange() {}

function onAmountInput(e) {
  form.amount = filterDecimal(e.target.value)
  e.target.value = form.amount
}

function resetForm() {
  form.note = ''
  form.amount = ''
  form.dz_mode = '线上'
}

function cancelEdit() {
  editing.value = null
  resetForm()
}

async function onSave() {
  const title = (form.note || '').trim()
  const amt = parseFloat(form.amount) || 0
  if (!title) { alert('⚠️ 请填写事项说明'); return }
  if (amt === 0) { alert('⚠️ 请填写金额'); return }
  if (!form.date) { alert('⚠️ 请选择日期'); return }

  const signed = Math.round((form.type === 'income' ? amt : -amt) * 100) / 100
  const row = {
    date: form.date,
    type: form.type,
    category: form.category,
    amount: signed,
    note: title,
    account: form.account,
    dz_mode: isDz.value ? form.dz_mode : null
  }
  saving.value = true
  try {
    if (editing.value) {
      await store.editFlow(editing.value.id, row)
      editing.value = null
    } else {
      await store.addFlow(row)
    }
    resetForm()
  } catch (e) {
    alert('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

function openEdit(f) {
  editing.value = f
  Object.assign(form, {
    type: f.type,
    amount: String(Math.abs(f.amount)),
    date: f.date,
    category: f.category,
    note: f.note || '',
    account: f.account || '微信支付',
    dz_mode: f.dz_mode || '线上'
  })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onDelete(f) {
  if (!confirm('确定删除？')) return
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

.hero-card {
  border-radius: var(--radius-lg);
  padding: 18px 18px 14px;
  background: linear-gradient(150deg, #4c3a8f, #3b2d73 60%, #322565);
  color: #fff;
  box-shadow: 0 6px 20px rgba(60, 48, 100, .22);
  margin-bottom: 14px;
}
.hero-label { font-size: 12px; color: rgba(255,255,255,.62); }
.hero-value { font-size: 30px; font-weight: 700; margin-top: 4px; letter-spacing: .5px; }
.hero-foot {
  display: flex; justify-content: space-between;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,.16);
  font-size: 11px; color: rgba(255,255,255,.66);
}
.warn { color: #fbbf24; }

/* 记一笔内联卡：支出绿底 / 收入红底（源程序同规则） */
.add-card {
  border-radius: var(--radius-lg);
  padding: 14px;
  margin-bottom: 14px;
  border: 1px solid rgba(46,139,87,.25);
  background: rgba(46,139,87,.07);
}
.add-card--income {
  border-color: rgba(214,69,69,.25);
  background: rgba(214,69,69,.07);
}
.editing-tip {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; color: var(--bg-accent); font-weight: 600;
  margin-bottom: 8px;
}
.edit-cancel { border: none; background: none; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.add-row { display: flex; gap: 8px; margin-bottom: 8px; }
.add-row:last-child { margin-bottom: 0; }
.add-input {
  flex: 1; min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}
.add-input--full { width: 100%; margin-bottom: 8px; }
.add-input:focus { border-color: var(--bg-accent); }

.pick {
  flex: 1; padding: 9px; border-radius: var(--radius-md);
  border: 1px solid var(--border-soft); background: var(--bg-hover);
  color: var(--text-muted); font-size: 13px; font-family: inherit; cursor: pointer;
}
/* 源程序：支出绿、收入红；线上蓝、线下绿 */
.pick--expense { background: rgba(46,139,87,.12); color: var(--color-fall); border-color: rgba(46,139,87,.4); font-weight: 600; }
.pick--income { background: rgba(214,69,69,.12); color: var(--color-rise); border-color: rgba(214,69,69,.4); font-weight: 600; }
.pick--online { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; font-weight: 600; }
.pick--offline { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; font-weight: 600; }

.add-submit {
  flex: 1.2;
  border: none; border-radius: var(--radius-md);
  background: #7c3aed; color: #fff;
  font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.add-submit:disabled { opacity: .6; }

.list-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 2px 8px; }
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
.view-btn--on { background: var(--bg-card); color: #7c3aed; font-weight: 600; box-shadow: 0 1px 3px rgba(120,100,75,.12); }

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
</style>
