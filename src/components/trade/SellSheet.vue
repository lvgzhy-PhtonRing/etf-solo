<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :close-on-click-overlay="false"
    :style="{ height: '70%' }"
  >
    <div class="trade-sheet">
      <div class="sheet-head">
        <div class="sheet-title">
          <span>录入卖出</span>
        </div>
        <button class="sheet-close" @click="visible = false">✕</button>
      </div>

      <div class="sheet-body">
        <div class="section-card preset-section edge-fall">
          <div class="preset-name">{{ stockName }} <span class="preset-code">{{ stockCode }}</span></div>
          <div class="preset-info">
            <span>现价 {{ formatPrice(currentPrice) }}</span>
            <span>总持仓 {{ sellHoldingQty }} 股</span>
          </div>
        </div>

        <div class="section-card edge-fall">
          <div class="sell-price-row">
            <label class="spr-label">卖出单价</label>
            <input v-model.number="sellPrice" type="number" inputmode="decimal" step="0.01" class="spr-price-input num-mono" />
            <span class="spr-unit">元</span>
          </div>
          <div class="sell-total-row">
            <div class="stl-header">
              <span class="stl-label">卖出数量</span>
              <span class="stl-val num-mono">{{ sellQty }} 股</span>
            </div>
            <input type="range" :min="0" :max="sellHoldingQty" :step="100" v-model.number="sellQty" class="sell-slider" />
            <div class="stl-estimate" v-if="sellQty > 0">≈ {{ formatMoney(sellQty * sellPrice) }}</div>
          </div>
          <div class="sell-date-row">
            <label class="sdr-label">成交日期</label>
            <input v-model="sellDate" type="date" class="sdr-input" />
          </div>
          <div class="sell-fee-row" v-if="sellQty > 0">
            <div class="sfr-item"><span>预估总金额</span><span class="num-mono">{{ formatMoney(sellQty * sellPrice) }}</span></div>
            <div class="sfr-item"><span>手续费</span><span class="num-mono">{{ formatMoney(sellFee) }}</span></div>
            <div class="sfr-item"><span>实际到账</span><span class="num-mono rise">{{ formatMoney(sellQty * sellPrice - sellFee) }}</span></div>
          </div>
          <div style="margin: 16px 0">
            <van-button round block type="primary"
              :color="sellValid ? 'var(--color-fall)' : 'var(--text-muted)'"
              :disabled="!sellValid || submitting"
              :loading="submitting"
              @click="submitSell">
              📝 录入卖出（{{ sellQty }} 股）
            </van-button>
          </div>
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcSellFee, calcSellActual } from '@/utils/feeCalculator'
import { upsertHolding, deleteHolding, insertCapitalLog, fetchTransactionsByStock } from '@/api/supabase'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  stock: { type: Object, default: () => ({ code: '', name: '', price: 0 }) }
})
const emit = defineEmits(['update:modelValue', 'changed'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const txStore = useTransactionStore()
const holdingStore = useHoldingStore()
const fundStore = useFundStore()

const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const formError = ref('')
const submitting = ref(false)

const sellDate = ref(new Date().toISOString().split('T')[0])
const sellQty = ref(0)
const sellPrice = ref(0)

const sellHoldingQty = computed(() => {
  const h = holdingStore.holdings.find(x => x.stock_code === stockCode.value)
  return h?.quantity || 0
})
const sellFee = computed(() => {
  const amt = sellQty.value * sellPrice.value
  return amt > 0 ? calcSellFee(amt) : 0
})
const sellValid = computed(() => sellQty.value > 0 && sellQty.value <= sellHoldingQty.value && sellQty.value % 100 === 0)

async function submitSell() {
  formError.value = ''
  if (!sellValid.value) return
  submitting.value = true
  try {
    const amount = Math.round(sellQty.value * sellPrice.value * 100) / 100
    const { fee, actualAmount } = calcSellActual(amount)
    const tx = {
      stock_code: stockCode.value,
      stock_name: stockName.value,
      type: 'sell',
      quantity: sellQty.value,
      price: sellPrice.value,
      amount,
      fee,
      trade_date: sellDate.value,
      note: `卖出 ${stockCode.value}`,
      created_by: 'solo'
    }
    await txStore.addTransaction(tx)
    const existing = holdingStore.holdings.find(h => h.stock_code === stockCode.value)
    const remaining = (existing?.quantity || 0) - sellQty.value
    if (remaining <= 0) {
      await deleteHolding(stockCode.value)
    } else {
      // 券商移动平均法：剩余成本 = (买入总支出 − 卖出总收入) / 剩余股数
      const allTxs = await fetchTransactionsByStock(stockCode.value)
      const buyTotal = allTxs.filter(t => t.type === 'buy').reduce((s, t) => s + t.amount + (t.fee || 0), 0)
      const sellTotal = allTxs.filter(t => t.type === 'sell').reduce((s, t) => s + t.amount - (t.fee || 0), 0)
      const newCost = parseFloat(((buyTotal - sellTotal) / remaining).toFixed(6))
      await upsertHolding({
        stock_code: stockCode.value,
        stock_name: existing?.stock_name || stockName.value,
        quantity: remaining,
        cost_price: Math.max(newCost, 0)
      })
    }
    await insertCapitalLog({ type: 'add', amount: actualAmount, note: `卖出 ${stockCode.value}`, category: 'trade', created_by: 'solo' })
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    sellQty.value = 0; sellPrice.value = 0; formError.value = ''
    visible.value = false
    emit('changed')
  } catch (e) {
    console.error('Sell error:', e)
    formError.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

watch(() => props.modelValue, async v => {
  if (!v) return
  stockCode.value = props.stock.code || ''
  stockName.value = props.stock.name || ''
  currentPrice.value = parseFloat(props.stock.price) || 0
  sellQty.value = 0
  sellPrice.value = currentPrice.value
  formError.value = ''
  submitting.value = false
  try {
    await Promise.all([fundStore.loadCapitalLogs(), txStore.loadTransactions(), holdingStore.loadHoldings()])
  } catch (e) {}
})
</script>

<style scoped>
.trade-sheet { display: flex; flex-direction: column; height: 100%; }
.sheet-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.sheet-title { flex: 1; }
.sheet-title > :first-child { font-size: 16px; font-weight: 700; }
.sheet-close {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-close:active { background: var(--bg-subtle); }
.sheet-body { flex: 1; overflow-y: auto; padding: 16px; }

.section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 0 0 10px; }
.preset-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.preset-code { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
.preset-info { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); }
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 8px; }

.sell-price-row { display: flex; align-items: center; gap: 8px; padding: 0 0 12px; }
.spr-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.spr-price-input { flex: 1; background: var(--bg-hover); border: 1px solid var(--border-soft); border-radius: 4px; color: var(--text-primary); font-size: 16px; padding: 6px 10px; text-align: right; outline: none; }
.spr-price-input:focus { border-color: var(--color-fall); }
.spr-unit { font-size: 13px; color: var(--text-secondary); }
.sell-total-row { padding: 8px 0 16px; border-bottom: 1px solid var(--border-soft); margin-bottom: 12px; }
.stl-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.stl-label { font-size: 14px; font-weight: 700; }
.stl-val { font-size: 20px; color: var(--color-rise); }
.stl-estimate { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-align: right; }
.sell-slider { width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: var(--bg-subtle); border-radius: 3px; outline: none; }
.sell-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--color-fall); cursor: pointer; border: 2px solid #fff; }
.sell-date-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.sdr-label { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.sdr-input { flex: 1; padding: 8px 10px; background: var(--bg-hover); border: 1px solid var(--border-soft); border-radius: 4px; color: var(--text-primary); font-size: 14px; outline: none; }
.sell-fee-row { padding: 8px 10px; background: var(--bg-hover); border-radius: var(--radius-md); margin-top: 8px; }
.sfr-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: var(--text-secondary); }
.sfr-item .num-mono { font-size: 12px; }
.sfr-item .num-mono.rise { color: var(--color-rise); font-weight: 600; }
</style>
