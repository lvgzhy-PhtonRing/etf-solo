const chinaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' })

export function marketDate(value = new Date()) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? chinaDate.format(date) : ''
}

function cents(amount) {
  const value = Number(amount)
  if (amount == null || !Number.isFinite(value)) throw new Error('资金金额无效')
  return Math.round(value * 100)
}

function add(map, key, amount) {
  map.set(key, (map.get(key) || 0) + amount)
}

function collectFlows(transactions, capitalLogs) {
  const cashByDate = new Map()
  const capitalByDate = new Map()
  const tradesByDate = new Map()

  for (const log of capitalLogs) {
    const date = marketDate(log.created_at || '')
    if (!date || !['add', 'remove'].includes(log.type)) throw new Error('资金流水日期或类型无效')
    const amount = cents(log.amount) * (log.type === 'add' ? 1 : -1)
    add(cashByDate, date, amount)
    if (log.category === 'capital' && log.note !== '初始') add(capitalByDate, date, amount)
  }

  for (const tx of transactions) {
    const date = tx.trade_date
    const quantity = Number(tx.quantity)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['buy', 'sell'].includes(tx.type) ||
      !/^\d{6}$/.test(tx.stock_code) || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('交易缺少有效的成交信息')
    }
    const buy = tx.type === 'buy'
    if (!tradesByDate.has(date)) tradesByDate.set(date, new Map())
    add(tradesByDate.get(date), tx.stock_code, quantity * (buy ? 1 : -1))
  }

  return { cashByDate, capitalByDate, tradesByDate }
}

export function buildSnapshotInputs(dates, holdings, transactions, capitalLogs) {
  const { cashByDate, capitalByDate, tradesByDate } = collectFlows(transactions, capitalLogs)
  const positions = new Map()
  for (const h of holdings) {
    const quantity = Number(h.quantity)
    if (!/^\d{6}$/.test(h.stock_code) || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error('当前持仓数据无效')
    }
    add(positions, h.stock_code, quantity)
  }
  let cash = [...cashByDate.values()].reduce((sum, amount) => sum + amount, 0)
  const eventDates = [...new Set([...cashByDate.keys(), ...tradesByDate.keys()])].sort().reverse()
  let eventIndex = 0
  const inputs = []
  for (const date of [...new Set(dates)].sort().reverse()) {
    while (eventIndex < eventDates.length && eventDates[eventIndex] > date) {
      const eventDate = eventDates[eventIndex++]
      cash -= cashByDate.get(eventDate) || 0
      for (const [code, change] of tradesByDate.get(eventDate) || []) add(positions, code, -change)
    }
    const quantities = [...positions].filter(([, quantity]) => quantity !== 0).sort()
    if (quantities.some(([, quantity]) => quantity < 0)) continue
    const capitalChange = capitalByDate.get(date) || 0
    inputs.push({
      date, cash: cash / 100, positions: quantities, capitalChange: capitalChange / 100,
      basis: JSON.stringify([cash, capitalChange, quantities])
    })
  }
  return inputs.reverse()
}

export function hasSnapshotValues(snapshot) {
  return Number.isFinite(snapshot?.asset) && Number.isFinite(snapshot?.ratio)
}

export function planSnapshotBackfill(inputs, originals, cached) {
  const originalDates = new Set(originals.filter(hasSnapshotValues).map(snapshot => snapshot.date))
  const pending = []
  const reusable = []
  for (const input of inputs) {
    if (originalDates.has(input.date)) continue
    const saved = cached[input.date]
    if (hasSnapshotValues(saved) && saved.basis === input.basis) reusable.push(saved)
    else pending.push(input)
  }
  return { pending, reusable }
}

export function estimateSnapshot(input, closes) {
  let marketValue = 0
  for (const [code, quantity] of input.positions) {
    const close = closes[code]?.[input.date]
    if (!Number.isFinite(close) || close <= 0) return null
    marketValue += quantity * close
  }
  const asset = marketValue + input.cash
  return {
    date: input.date,
    asset: Math.round(asset),
    ratio: asset > 0 ? Number((marketValue / asset * 100).toFixed(1)) : 0,
    capitalChange: input.capitalChange,
    basis: input.basis,
    estimated: true
  }
}
