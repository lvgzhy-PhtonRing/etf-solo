<template>
  <div class="page settings-page" :class="{ 'in-drawer': inDrawer }">
    <div class="page-header" v-if="!inDrawer">
      <span class="page-title">软件设置</span>
    </div>
    <div class="settings-section">
      <div class="settings-group">
        <div class="group-title">自动备份</div>
        <div class="settings-item" @click="triggerAutoBackup">
          <div class="item-left"><span class="item-icon">⏰</span><span>立即备份</span></div>
          <span class="item-arrow">{{ autoBacking ? '备份中…' : '▶' }}</span>
        </div>
        <div class="settings-item" @click="showBackupList = true">
          <div class="item-left"><span class="item-icon">📋</span><span>备份列表</span></div>
          <span class="item-arrow">→</span>
        </div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">🔄</span><span>自动备份</span></div>
          <span class="item-status sync-ok">每日 11:00</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="group-title">数据备份</div>
        <div class="settings-item" @click="exportData">
          <div class="item-left"><span class="item-icon">📤</span><span>导出数据</span></div>
          <span class="item-arrow">{{ exporting ? '导出中…' : '↓' }}</span>
        </div>
        <label class="settings-item" for="import-file">
          <div class="item-left"><span class="item-icon">📥</span><span>导入数据</span></div>
          <span class="item-arrow">↑</span>
        </label>
        <input id="import-file" ref="fileInput" type="file" accept=".json,application/json,text/plain,text/json" style="display:none" @change="onFileSelected" />
      </div>

      <div class="settings-group">
        <div class="group-title">关于</div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">ℹ️</span><span>版本</span></div>
          <span class="item-value">v1.1.0</span>
        </div>
        <div class="settings-item">
          <div class="item-left"><span class="item-icon">🏛️</span><span>数据存储</span></div>
          <span class="item-value">Supabase</span>
        </div>
      </div>
    </div>

    <!-- 导入确认弹窗 -->
    <van-dialog v-model:show="showImportConfirm" :title="exportedBeforeImport ? '确认导入' : '导入前请先导出'" :message="exportedBeforeImport ? '导出完成，确认导入？导入将覆盖现有数据。' : '导入将覆盖现有数据。请先导出当前数据到本地，确认导出成功后再导入。'" show-cancel-button @confirm="doImport">
      <div class="import-dialog-actions" v-if="!exportedBeforeImport">
        <van-button size="small" plain color="#d64545" :loading="exporting" @click="exportThenConfirm">📤 先导出当前数据</van-button>
      </div>
      <div class="import-dialog-actions" v-else>
        <span class="import-dialog-hint">✅ 已导出备份文件</span>
      </div>
    </van-dialog>

    <!-- 备份列表弹窗 -->
    <van-popup v-model:show="showBackupList" position="bottom" :style="{ height: '60%' }" round @opened="loadBackupList">
      <div class="backup-list-popup">
        <div class="popup-header">
          <span>自动备份列表</span>
          <span class="popup-close" @click="showBackupList = false">✕</span>
        </div>
        <div v-if="loadingBackups" class="popup-loading">加载中…</div>
        <div v-else-if="!backups.length" class="popup-empty">暂无备份</div>
        <div v-else class="backup-list">
          <div v-for="b in backups" :key="b.filename" class="backup-item">
            <div class="backup-info">
              <div class="backup-date">{{ formatDate(b.created_at) }}</div>
              <div class="backup-size">{{ formatSize(b.size) }}</div>
            </div>
            <van-button size="small" plain color="#d64545" :loading="restoring === b.filename" @click="restoreBackup(b.filename)">恢复</van-button>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '@/api/supabase'
import { validateImportData, TABLE_KEYS } from '@/utils/importValidation'

defineProps({
  inDrawer: { type: Boolean, default: false }
})

const exporting = ref(false)
const showImportConfirm = ref(false)
const exportedBeforeImport = ref(false)
const showBackupList = ref(false)
const autoBacking = ref(false)
const loadingBackups = ref(false)
const backups = ref([])
const restoring = ref(null)
let pendingImportData = null

const TABLES = TABLE_KEYS

// ========== 导出 ==========
async function exportData() {
  exporting.value = true
  try {
    const backup = { _export_at: new Date().toISOString(), _version: 1 }
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw new Error(`${table}: ${error.message}`)
      backup[table] = data || []
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-ledger-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch (e) {
    console.error('Export error:', e)
    return false
  } finally {
    exporting.value = false
  }
}

// ========== 自动备份（Edge Function） ==========
async function triggerAutoBackup() {
  autoBacking.value = true
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      }
    })
    const data = await res.json()
    if (data.success) {
      alert(`✅ 备份成功\n文件: ${data.filename}\n清理旧备份: ${data.deleted_old} 个`)
    } else {
      alert('❌ 备份失败: ' + (data.error || '未知错误'))
    }
  } catch (e) {
    alert('❌ 备份失败: ' + e.message)
  } finally {
    autoBacking.value = false
  }
}

async function loadBackupList() {
  loadingBackups.value = true
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup/list`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      }
    })
    const data = await res.json()
    backups.value = data.backups || []
  } catch (e) {
    console.error('Load backup list error:', e)
    backups.value = []
  } finally {
    loadingBackups.value = false
  }
}

async function restoreBackup(filename) {
  restoring.value = filename
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/backup/restore?file=${encodeURIComponent(filename)}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      }
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    pendingImportData = data
    exportedBeforeImport.value = false
    showBackupList.value = false
    showImportConfirm.value = true
  } catch (e) {
    alert('❌ 获取备份失败: ' + e.message)
  } finally {
    restoring.value = null
  }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

// ========== 导入 ==========
function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      pendingImportData = JSON.parse(ev.target.result)
      exportedBeforeImport.value = false
      showImportConfirm.value = true
    } catch {
      alert('文件格式错误，请选择正确的备份JSON文件')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function exportThenConfirm() {
  const ok = await exportData()
  if (ok) {
    exportedBeforeImport.value = true
  } else {
    alert('导出失败，请检查网络后重试。未导出的数据导入后将丢失！')
  }
}

function rowsOf(rows) {
  return rows.map(({ id, ...clean }) => clean)
}

async function snapshotTables() {
  const backup = {}
  for (const table of TABLE_KEYS) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`${table} 读取失败：${error.message}`)
    backup[table] = data || []
  }
  return backup
}

async function replaceAll(rows, { stripSource = false } = {}) {
  const deleteOrder = [
    ['solo_capital_log', 'id', 0],
    ['solo_transactions', 'id', 0],
    ['solo_holdings', 'id', 0],
    ['solo_stock_cache', 'stock_code', ''],
    ['solo_app_config', 'key', '']
  ]
  for (const [table, keyField, emptyVal] of deleteOrder) {
    const { error } = await supabase.from(table).delete().neq(keyField, emptyVal)
    if (error) throw new Error(`${table} 清空失败：${error.message}`)
  }
  for (const table of TABLE_KEYS) {
    const list = rowsOf(rows[table] || []).map(row => {
      if (!stripSource) return row
      const { source_tx_id, ...rest } = row
      return rest
    })
    if (list.length) {
      const { error } = await supabase.from(table).insert(list)
      if (error) throw new Error(`${table} 插入失败：${error.message}`)
    }
  }
}

async function doImport() {
  if (!pendingImportData) return
  const check = validateImportData(pendingImportData)
  if (!check.ok) {
    alert('❌ 文件校验未通过，未改动任何数据：' + check.error)
    pendingImportData = null
    showImportConfirm.value = false
    return
  }
  let backup = null
  try {
    backup = await snapshotTables()
    await replaceAll(check.rows)
    alert('✅ 数据导入成功！请刷新页面查看')
  } catch (e) {
    console.error('Import error:', e)
    if (backup) {
      try {
        await replaceAll(backup, { stripSource: true })
        alert('❌ 导入失败，已恢复导入前数据：' + e.message)
      } catch (restoreErr) {
        console.error('Restore error:', restoreErr)
        alert('❌ 导入失败且自动恢复失败，请用刚才导出的备份文件恢复：' + restoreErr.message)
      }
    } else {
      alert('❌ 导入失败：' + e.message)
    }
  } finally {
    pendingImportData = null
    showImportConfirm.value = false
  }
}
</script>

<style scoped>
.settings-section { padding: 0; }
.settings-group { margin-bottom: 20px; }
.group-title { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; padding-left: 4px; }
.settings-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 12px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 2px; cursor: pointer; }
.item-left { display: flex; align-items: center; gap: 10px; }
.item-icon { font-size: 16px; }
.item-arrow { color: var(--text-muted); font-size: 14px; }
.item-value { color: var(--text-secondary); font-size: 13px; }
.item-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.item-status.sync-ok { background: rgba(46,139,87,0.10); color: var(--color-fall); }
.import-dialog-actions { padding: 0 16px 12px; text-align: center; }
.import-dialog-hint { font-size: 13px; color: var(--color-fall); }
.in-drawer { padding: 56px 0 0; }
.backup-list-popup { padding: 16px; display: flex; flex-direction: column; height: 100%; }
.popup-header { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.popup-close { cursor: pointer; color: var(--text-muted); font-size: 16px; }
.popup-loading, .popup-empty { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px; }
.backup-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.backup-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card); border-radius: var(--radius-md); }
.backup-info { display: flex; flex-direction: column; gap: 2px; }
.backup-date { font-size: 13px; font-weight: 600; }
.backup-size { font-size: 11px; color: var(--text-muted); }
</style>
