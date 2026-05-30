<script setup lang="ts">
defineProps<{
  padding?: string
}>()
</script>

<template>
  <div class="glass-card" :style="{ padding: padding || 'var(--space-6)' }">
    <slot />
  </div>
</template>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
</style>