<script setup lang="ts">
defineProps<{
  disabledKeys?: string[]
  showEnter?: boolean
}>()

const emit = defineEmits<{
  keypress: [key: string]
  backspace: []
  enter: []
}>()

const rows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

function onKey(k: string) {
  emit('keypress', k)
}
</script>

<template>
  <div class="keyboard">
    <div v-for="(row, ri) in rows" :key="ri" class="keyboard-row">
      <button
        v-for="key in row"
        :key="key"
        class="kbd-key"
        :class="{ disabled: disabledKeys?.includes(key) }"
        :disabled="disabledKeys?.includes(key)"
        @click="onKey(key)"
      >
        {{ key }}
      </button>
      <button v-if="ri === 1 && !showEnter" class="kbd-key backspace" @click="emit('backspace')">
        ⌫
      </button>
      <button v-if="ri === 2" class="kbd-key enter" @click="emit('enter')">
        ✓
      </button>
      <button v-if="ri === 2 && showEnter" class="kbd-key backspace" @click="emit('backspace')">
        ⌫
      </button>
    </div>
  </div>
</template>

<style scoped>
.keyboard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
  margin: 0 auto;
  user-select: none;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.kbd-key {
  width: 42px;
  height: 46px;
  border-radius: var(--radius-sm);
  background: white;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--text-primary);
  text-transform: uppercase;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: all 80ms var(--ease-out);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kbd-key:active:not(:disabled) {
  transform: scale(0.92);
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

.kbd-key.backspace {
  width: 52px;
  font-size: var(--text-base);
}

.kbd-key.enter {
  width: 52px;
  font-size: var(--text-lg);
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.kbd-key.enter:active {
  background: var(--accent-hover);
}

.kbd-key.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .kbd-key {
    width: 32px;
    height: 40px;
    font-size: var(--text-base);
  }
  .kbd-key.backspace,
  .kbd-key.enter {
    width: 42px;
  }
}
</style>
