<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  end: number
  duration?: number
  suffix?: string
}>()

const display = ref(0)

onMounted(() => animate())

watch(() => props.end, () => animate())

function animate() {
  const start = display.value
  const diff = props.end - start
  const duration = props.duration || 800
  const startTime = performance.now()

  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    display.value = start + diff * eased

    if (progress < 1) {
      requestAnimationFrame(step)
    } else {
      display.value = props.end
    }
  }

  requestAnimationFrame(step)
}
</script>

<template>
  <span>{{ Math.round(display) }}{{ suffix || '' }}</span>
</template>
