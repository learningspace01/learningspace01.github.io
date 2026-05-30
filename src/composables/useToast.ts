import { ref } from 'vue'

export interface ToastMsg {
  id: number
  title: string
  description: string
  icon: string
  color: string
}

let nextId = 0
const toasts = ref<ToastMsg[]>([])

export function useToast() {
  function show(title: string, description: string, icon = '🎉', color = '#4F6EF7', duration = 4000) {
    const id = nextId++
    toasts.value.push({ id, title, description, icon, color })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, show, dismiss }
}
