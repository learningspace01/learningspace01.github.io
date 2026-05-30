import { onUnmounted, type Ref } from 'vue'

interface SwipeOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export function useSwipeGesture(elRef: Ref<HTMLElement | null>, options: SwipeOptions) {
  const threshold = options.threshold ?? 50

  let startX = 0
  let startY = 0
  let tracking = false

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    tracking = true
  }

  function onTouchEnd(e: TouchEvent) {
    if (!tracking) return
    tracking = false

    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (Math.max(absDx, absDy) < threshold) return

    if (absDx > absDy) {
      if (dx > 0) options.onSwipeRight?.()
      else options.onSwipeLeft?.()
    } else {
      if (dy > 0) options.onSwipeDown?.()
      else options.onSwipeUp?.()
    }
  }

  function attach() {
    const el = elRef.value
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  }

  function detach() {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
  }

  return { attach, detach }
}
