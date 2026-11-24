<template>
  <div class="load-error-tip">
    <span class="let-text">⚠️ 数据加载失败：{{ message }}</span>
    <button class="let-retry" @click="$emit('retry')">重试</button>
  </div>
</template>

<script setup>
defineProps({ message: { type: String, default: '' } })
defineEmits(['retry'])
</script>

<style scoped>
.load-error-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: var(--radius-md);
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.28);
}
.let-text { font-size: 12px; color: var(--color-rise); line-height: 1.5; }
.let-retry {
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-rise);
  color: #fff;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
