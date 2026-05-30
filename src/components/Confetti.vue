<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref<HTMLCanvasElement>()
let animId = 0

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; rotation: number; rotSpeed: number
  opacity: number; decay: number
}

onMounted(() => {
  if (!canvas.value) return
  const ctx = canvas.value.getContext('2d')!
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight

  const colors = ['#4F6EF7', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6']
  const particles: Particle[] = []

  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.value.width,
      y: Math.random() * canvas.value.height * -0.5,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 4 + 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.005,
    })
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
    let alive = false

    for (const p of particles) {
      if (p.opacity <= 0) continue
      alive = true

      p.x += p.vx
      p.vy += 0.2
      p.y += p.vy
      p.rotation += p.rotSpeed
      p.opacity -= p.decay

      ctx.save()
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }

    if (alive) animId = requestAnimationFrame(animate)
  }

  animId = requestAnimationFrame(animate)
})

onUnmounted(() => cancelAnimationFrame(animId))
</script>

<template>
  <canvas ref="canvas" class="confetti-canvas" />
</template>

<style scoped>
.confetti-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}
</style>
