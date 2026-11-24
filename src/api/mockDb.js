// src/api/mockDb.js — 兼容层空实现（迁移期间保留，Task 11 删除）
export function isMockMode() { return false }
export function getTable() { return [] }
export function setTable() { /* no-op */ }
export function getConfigValue() { return null }
export function setConfigValue() { /* no-op */ }
export function insertRow() { return {} }
export function updateRows() { return null }
export function deleteRows() { /* no-op */ }
export function getDB() { return { tables: {}, config: {} } }
export async function loadBackup() { return null }
export async function seedFromBackup() { return false }
