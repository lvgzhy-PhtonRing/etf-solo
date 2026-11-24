<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :close-on-click-overlay="false"
    :style="{ height: '62%' }"
  >
    <div class="trade-sheet">
      <div class="sheet-head">
        <button v-if="step === 'form'" class="sheet-back" @click="step = 'search'">←</button>
        <div class="sheet-title">
          <span v-if="step === 'search'">买入股票</span>
          <template v-else>
            <span>📈 买入 {{ stockName || stockCode }}</span>
            <span class="st-price num-mono" v-if="currentPrice">{{ formatPrice(currentPrice) }}</span>
          </template>
        </div>
        <button class="sheet-close" @click="visible = false">✕</button>
      </div>

      <div class="sheet-body">
        <template v-if="step === 'search'">
          <StockSearch @stock-selected="onStockSelected" @buy-clicked="onBuyClicked" />
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </template>
        <template v-else>
          <TradeForm
            :key="session"
            :is-buy="true"
            :stock-price="currentPrice"
            :stock-code="stockCode"
            :submitting="submitting"
            @submit="onBuySubmit"
          />
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </template>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatMoney, formatPrice } from '@/utils/formatters'
import { calcBuyActual } from '@/utils/feeCalculator'
import { calcNewCostPrice } from '@/utils/calculators'
import { insertCapitalLog, upsertHolding, deleteCapitalLog, deleteTransaction, deleteHolding } from '@/api/supabase'
import { useTransactionStore } from '@/stores/transactions'
import { useHoldingStore } from '@/stores/holdings'
import { useFundStore } from '@/stores/funds'
import StockSearch from '@/components/trade/StockSearch.vue'
import TradeForm from '@/components/trade/TradeForm.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'changed'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const txStore = useTransactionStore()
const holdingStore = useHoldingStore()
const fundStore = useFundStore()

const step = ref('search')
const session = ref(0)
const currentPrice = ref(0)
const stockCode = ref('')
const stockName = ref('')
const formError = ref('')
const submitting = ref(false)

async function onBuySubmit(data) {
  formError.value = ''
  if (!stockCode.value) { formError.value = '请先搜索并选择股票代码'; return }
  const amount = parseFloat(data.amount)
  const qty = data.quantity
  const price = data.price
  const { fee, actualAmount } = calcBuyActual(amount, stockCode.value)
  if (actualAmount > fundStore.totalAvailable) {
    formError.value = `可用资金不足！剩余 ${formatMoney(fundStore.totalAvailable)}，本次需 ${formatMoney(actualAmount)}`
    return
  }
  submitting.value = true
  const existing = holdingStore.holdings.find(h => h.stock_code === stockCode.value)
  let createdTx = null
  let holdingChanged = false
  let capLog = null
  try {
    const tx = {
      stock_code: stockCode.value,
      stock_name: stockName.value,
      type: 'buy',
      quantity: qty,
      price,
      amount,
      fee,
      trade_date: data.trade_date,
      note: data.note || `买入 ${stockCode.value}`,
      created_by: 'solo'
    }
    createdTx = await txStore.addTransaction(tx)
    const newCost = calcNewCostPrice(actualAmount, qty, existing?.quantity || 0, existing?.cost_price || 0)
    await upsertHolding({
      stock_code: stockCode.value,
      stock_name: stockName.value,
      quantity: (existing?.quantity || 0) + qty,
      cost_price: newCost
    })
    holdingChanged = true
    capLog = await insertCapitalLog({
      type: 'remove',
      amount: actualAmount,
      note: `买入 ${stockCode.value}`,
      category: 'trade',
      created_by: 'solo',
      source_tx_id: createdTx?.id ?? null
    })
    await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    stockCode.value = ''; stockName.value = ''; currentPrice.value = 0; formError.value = ''; step.value = 'search'; visible.value = false
    emit('changed')
  } catch (e) {
    console.error('Buy error:', e)
    // 补偿回滚：流水 → 持仓 → 交易
    try {
      if (capLog?.id) await deleteCapitalLog(capLog.id)
      if (holdingChanged) {
        if (existing) {
          await upsertHolding({
            stock_code: existing.stock_code,
            stock_name: existing.stock_name,
            quantity: existing.quantity,
            cost_price: existing.cost_price
          })
        } else {
          await deleteHolding(stockCode.value)
        }
      }
      if (createdTx?.id) await deleteTransaction(createdTx.id)
      await Promise.all([holdingStore.loadHoldings(), fundStore.loadCapitalLogs()])
    } catch (rollbackErr) {
      console.error('Buy rollback error:', rollbackErr)
    }
    formError.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

function onStockSelected(stock) {
  currentPrice.value = stock.price
  stockCode.value = stock.stock_code
  stockName.value = stock.stock_name || ''
}

function onBuyClicked(stock) {
  onStockSelected(stock)
  formError.value = ''
  step.value = 'form'
}

watch(() => props.modelValue, async v => {
  if (!v) return
  step.value = 'search'
  stockCode.value = ''; stockName.value = ''; currentPrice.value = 0
  formError.value = ''; submitting.value = false
  session.value++
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
.sheet-title { flex: 1; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sheet-title > :first-child { font-size: 16px; font-weight: 700; }
.st-price { font-size: 17px; font-weight: 700; color: var(--color-rise); }
.sheet-back {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-back:active { background: var(--bg-subtle); }
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
.form-err { color: var(--color-fall); font-size: 13px; text-align: center; margin-top: 12px; }
</style>
