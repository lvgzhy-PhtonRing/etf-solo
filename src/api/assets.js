// src/api/assets.js — 资产账本（完全独立于 solo_* 表）
import { supabase } from './supabase'

export async function fetchAssetAccounts() {
  const { data, error } = await supabase.from('asset_accounts').select('*').order('sort')
  if (error) throw new Error('读取资产账户失败：' + error.message)
  return data || []
}

export async function updateAssetAccount(id, balance) {
  const { error } = await supabase
    .from('asset_accounts')
    .update({ balance, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error('保存资产账户失败：' + error.message)
}

export async function fetchAssetAdjustments() {
  const { data, error } = await supabase.from('asset_adjustments').select('*')
  if (error) throw new Error('读取调整项失败：' + error.message)
  return data || []
}

export async function updateAssetAdjustment(id, amount) {
  const { error } = await supabase.from('asset_adjustments').update({ amount }).eq('id', id)
  if (error) throw new Error('保存调整项失败：' + error.message)
}

export async function fetchAssetFlows() {
  const { data, error } = await supabase
    .from('asset_flows')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw new Error('读取收支流水失败：' + error.message)
  return data || []
}

export async function insertAssetFlow(row) {
  const { data, error } = await supabase.from('asset_flows').insert(row).select().single()
  if (error) throw new Error('新增收支失败：' + error.message)
  return data
}

export async function updateAssetFlow(id, patch) {
  const { error } = await supabase.from('asset_flows').update(patch).eq('id', id)
  if (error) throw new Error('修改收支失败：' + error.message)
}

export async function deleteAssetFlow(id) {
  const { error } = await supabase.from('asset_flows').delete().eq('id', id)
  if (error) throw new Error('删除收支失败：' + error.message)
}

export async function replaceAssetFlows(rows) {
  const { error: delErr } = await supabase.from('asset_flows').delete().neq('id', 0)
  if (delErr) throw new Error('清空流水失败：' + delErr.message)
  if (!rows.length) return
  const { error } = await supabase.from('asset_flows').insert(rows)
  if (error) throw new Error('写入流水失败：' + error.message)
}
