import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import type { Settings } from '@/types/vocab'

const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 30,
  newWordsPerDay: 15,
  reviewMode: 'flashcard',
  autoPlay: true,
  darkMode: false,
  fontSize: 'medium',
  showExampleFirst: false,
  keyboardShortcuts: true,
  notificationReminder: '09:00',
  theme: 'default',
  dataExportFormat: 'json',
  youdaoProxyUrl: '',
  enabledBookIds: [],
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = useLocalStorage<Settings>('vocab-settings', DEFAULT_SETTINGS)
  const streakDays = useLocalStorage<number>('vocab-streak-days', 0)
  const lastStudyDate = useLocalStorage<string | null>('vocab-last-study', null)

  const todayGreeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning!'
    if (hour < 18) return 'Good Afternoon!'
    return 'Good Evening!'
  })

  function applyTheme() {
    if (settings.value.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  function toggleDarkMode() {
    settings.value.darkMode = !settings.value.darkMode
    applyTheme()
  }

  function updateStreak() {
    const today = new Date().toISOString().split('T')[0]
    if (lastStudyDate.value === today) return

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (lastStudyDate.value === yesterdayStr) {
      streakDays.value++
    } else {
      streakDays.value = 1
    }
    lastStudyDate.value = today

    // Check streak-based achievements
    import('@/stores/vocabStore').then(({ useVocabStore }) => {
      useVocabStore().checkAchievements()
    })
  }

  function toggleBookEnabled(bookId: string) {
    const idx = settings.value.enabledBookIds.indexOf(bookId)
    if (idx > -1) {
      settings.value.enabledBookIds.splice(idx, 1)
    } else {
      settings.value.enabledBookIds.push(bookId)
    }
  }

  // Apply theme on init
  applyTheme()

  return {
    settings,
    streakDays,
    lastStudyDate,
    todayGreeting,
    toggleDarkMode,
    toggleBookEnabled,
    applyTheme,
    updateStreak,
  }
})
