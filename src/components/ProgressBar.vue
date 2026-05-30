<script setup lang="ts">
defineProps<{
  current: number
  total: number
  color?: string
}>()

const percent = (current: number, total: number) => {
  if (total === 0) return 0
  return Math.round((current / total) * 100)
}
</script>

<template>
  <div class="progress-container">
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{
          width: percent(current, total) + '%',
          background: color || 'linear-gradient(90deg, #4F6EF7, #6366F1)'
        }"
      />
    </div>
    <span class="progress-text">{{ current }}/{{ total }}</span>
  </div>
</template>

<style scoped>
.progress-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progress-track {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s var(--ease-out);
}

.progress-text {
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  min-width: 3rem;
  text-align: right;
}
</style>