<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle, X } from 'lucide-vue-next'

export interface ToastMessage {
  id: number
  title: string
  description: string
  icon: string
  color: string
}

let nextId = 0
const toasts = ref<ToastMessage[]>([])

function show(title: string, description: string, icon = '🎉', color = '#4F6EF7', duration = 4000) {
  const id = nextId++
  toasts.value.push({ id, title, description, icon, color })
  setTimeout(() => dismiss(id), duration)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

defineExpose({ show, dismiss })
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :style="{ borderLeftColor: toast.color }"
        >
          <span class="toast-icon">{{ toast.icon }}</span>
          <div class="toast-body">
            <span class="toast-title">{{ toast.title }}</span>
            <span class="toast-desc">{{ toast.description }}</span>
          </div>
          <button class="toast-close" @click="dismiss(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 360px;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-left: 4px solid;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.toast-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.toast-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.toast-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.toast-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: 2px;
}

.toast-close {
  padding: 2px;
  color: var(--text-tertiary);
  border-radius: 4px;
  flex-shrink: 0;
}

.toast-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.toast-enter-active {
  transition: all 0.35s var(--ease-out);
}
.toast-leave-active {
  transition: all 0.25s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
</style>
