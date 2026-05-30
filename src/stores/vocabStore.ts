import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useHybridStorage } from '@/composables/useHybridStorage'
import { useToast } from '@/composables/useToast'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Word, WordBook, StudySession } from '@/types/vocab'
import type { Achievement } from '@/core/achievements'
import { calculateSRS } from '@/core/srs-engine'
import { getReviewQueue, getTodayStats } from '@/core/scheduler'
import { sampleBook, sampleWords } from '@/data/cet4-sample'

export const useVocabStore = defineStore('vocab', () => {
  const wordBooks = useLocalStorage<WordBook[]>('vocab-books', [sampleBook])
  const words = useHybridStorage<Word[]>('vocab-words', sampleWords)
  const sessions = useHybridStorage<StudySession[]>('vocab-sessions', [])

  const currentBookId = useLocalStorage<string | null>('vocab-current-book', null)
  const currentWordIndex = ref(0)

  const currentBook = computed(() =>
    wordBooks.value.find((b) => b.id === currentBookId.value) || null
  )

  const bookWords = computed(() =>
    words.value.filter((w) => w.bookId === currentBookId.value)
  )

  const enabledWords = computed(() => {
    const settingsStore = useSettingsStore()
    const ids = settingsStore.settings.enabledBookIds
    if (ids.length === 0) return words.value
    return words.value.filter((w) => ids.includes(w.bookId))
  })

  const totalLearned = computed(() =>
    words.value.filter((w) => w.srs.status !== 'new').length
  )

  const totalMastered = computed(() =>
    words.value.filter((w) => w.srs.status === 'mastered').length
  )

  const masteryRate = computed(() => {
    if (words.value.length === 0) return 0
    return Math.round((totalMastered.value / words.value.length) * 1000) / 10
  })

  const todayDueCount = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    const source = enabledWords.value
    return source.filter((w) => {
      if (w.srs.status === 'new') return false
      if (!w.srs.nextReview) return false
      return w.srs.nextReview <= today
    }).length
  })

  const reviewQueue = computed(() => getReviewQueue(enabledWords.value))

  const todayStats = computed(() => getTodayStats(words.value))

  const confusedWords = computed(() => {
    return [...words.value]
      .filter((w) => w.srs.wrongCount > 0)
      .sort((a, b) => b.srs.wrongCount - a.srs.wrongCount)
      .slice(0, 10)
  })

  const weeklyActivity = computed(() => {
    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }

    for (const word of words.value) {
      for (const h of word.srs.history) {
        if (h.date in days) {
          days[h.date]++
        }
      }
    }

    return Object.entries(days).map(([date, count]) => ({ date, count }))
  })

  // --- Enhanced Statistics ---
  const learningCurve = computed(() => {
    const last30: number[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      let accum = 0
      for (const word of words.value) {
        for (const h of word.srs.history) {
          if (h.date <= dateStr) accum++
        }
      }
      last30.push(accum)
    }
    return last30
  })

  const ratingDistribution = computed(() => {
    const dist = [0, 0, 0, 0, 0] // quality 1-5
    for (const word of words.value) {
      for (const h of word.srs.history) {
        if (h.quality >= 1 && h.quality <= 5) {
          dist[h.quality - 1]++
        }
      }
    }
    const total = dist.reduce((s, c) => s + c, 0) || 1
    return dist.map((c) => ({ count: c, pct: Math.round((c / total) * 100) }))
  })

  const statusDistribution = computed(() => {
    const dist: Record<string, number> = { new: 0, learning: 0, review: 0, familiar: 0, mastered: 0 }
    for (const word of words.value) {
      dist[word.srs.status] = (dist[word.srs.status] || 0) + 1
    }
    const total = words.value.length || 1
    return Object.entries(dist).map(([status, count]) => ({
      status,
      count,
      pct: Math.round((count / total) * 100),
      label: { new: '新词', learning: '学习中', review: '复习中', familiar: '已熟悉', mastered: '已掌握' }[status] || status,
      color: { new: '#94A3B8', learning: '#F59E0B', review: '#4F6EF7', familiar: '#10B981', mastered: '#6366F1' }[status] || '#94A3B8',
    }))
  })

  const reviewForecast = computed(() => {
    const forecast: Record<string, number> = {}
    const today = new Date()
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      forecast[d.toISOString().split('T')[0]] = 0
    }
    for (const word of words.value) {
      if (word.srs.nextReview) {
        if (word.srs.nextReview in forecast) {
          forecast[word.srs.nextReview]++
        }
      }
    }
    return Object.entries(forecast).map(([date, count]) => ({ date, count }))
  })

  const yearlyHeatmap = computed(() => {
    const cells: { date: string; count: number; week: number; day: number }[] = []
    const today = new Date()
    // Build 52-week × 7-day grid ending today
    const endDate = new Date(today)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 52 * 7 + 1)
    // Align start to Sunday (0)
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1)
    }

    const activityMap: Record<string, number> = {}
    for (const word of words.value) {
      for (const h of word.srs.history) {
        activityMap[h.date] = (activityMap[h.date] || 0) + 1
      }
    }

    for (let w = 0; w < 52; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + w * 7 + d)
        const dateStr = date.toISOString().split('T')[0]
        if (dateStr > today.toISOString().split('T')[0]) continue
        cells.push({
          date: dateStr,
          count: activityMap[dateStr] || 0,
          week: w,
          day: d,
        })
      }
    }
    return cells
  })

  const studyTimeDistribution = computed(() => {
    const hours = new Array(24).fill(0)
    for (const s of sessions.value) {
      if (s.startTime) {
        const h = new Date(s.startTime).getHours()
        hours[h]++
      }
    }
    const maxVal = Math.max(...hours, 1)
    return hours.map((count, hour) => ({ hour, count, pct: Math.round((count / maxVal) * 100) }))
  })

  // --- Achievements ---
  const unlockedAchievements = useLocalStorage<Record<string, string>>('vocab-achievements', {})

  const achievements = computed<Achievement[]>(() => {
    const settingsStore = useSettingsStore()
    const mastered = totalMastered.value
    const total = words.value.length
    const streak = settingsStore.streakDays
    const hasFinishedBook = wordBooks.value.some(
      (b) => b.wordCount > 0 && b.masteredCount >= b.wordCount
    )

    return [
      { id: 'first_import', name: '初次导入词库', description: '导入第一个词库', icon: '📥', unlocked: total > 0, unlockedAt: total > 0 ? 'auto' : null },
      { id: 'streak_7', name: '连续7天打卡', description: '连续学习7天', icon: '🔥', unlocked: streak >= 7, unlockedAt: null },
      { id: 'master_50', name: '掌握50词', description: '累积掌握50个单词', icon: '⭐', unlocked: mastered >= 50, unlockedAt: null },
      { id: 'master_100', name: '掌握100词', description: '累积掌握100个单词', icon: '🌟', unlocked: mastered >= 100, unlockedAt: null },
      { id: 'streak_30', name: '连续30天打卡', description: '连续学习30天', icon: '💎', unlocked: streak >= 30, unlockedAt: null },
      { id: 'finish_book', name: '完成一本词库', description: '掌握一本词库中的所有单词', icon: '🏆', unlocked: hasFinishedBook, unlockedAt: null },
    ]
  })

  function checkAchievements() {
    const { show: showToast } = useToast()
    const today = new Date().toISOString().split('T')[0]

    for (const ach of achievements.value) {
      if (ach.unlocked && !unlockedAchievements.value[ach.id]) {
        unlockedAchievements.value[ach.id] = today
        showToast('成就解锁！', ach.name, ach.icon, '#F59E0B', 5000)
      }
    }
  }

  function setCurrentBook(bookId: string) {
    currentBookId.value = bookId
    currentWordIndex.value = 0
  }

  function addWordBook(book: WordBook) {
    wordBooks.value.push(book)
  }

  function addWord(word: Word) {
    words.value.push(word)
    const book = wordBooks.value.find((b) => b.id === word.bookId)
    if (book) {
      book.wordCount++
      book.updatedAt = new Date().toISOString().split('T')[0]
    }
    checkAchievements()
  }

  function updateWordProgress(wordId: string, quality: number) {
    const idx = words.value.findIndex((w) => w.id === wordId)
    if (idx === -1) return
    const word = words.value[idx]

    const today = new Date().toISOString().split('T')[0]
    const result = calculateSRS(
      word.srs.easeFactor,
      word.srs.interval,
      word.srs.repetitions,
      quality
    )

    const updatedWord = {
      ...word,
      srs: {
        ...word.srs,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReview: result.nextReview.toISOString().split('T')[0],
        lastReview: today,
        status: result.status,
        totalReviews: word.srs.totalReviews + 1,
        correctCount: word.srs.correctCount + (quality >= 3 ? 1 : 0),
        wrongCount: word.srs.wrongCount + (quality < 3 ? 1 : 0),
        history: [...word.srs.history, { date: today, quality, interval: result.interval }],
      },
      updatedAt: new Date().toISOString(),
    }

    words.value[idx] = updatedWord

    const book = wordBooks.value.find((b) => b.id === word.bookId)
    if (book) {
      const oldMastered = book.masteredCount
      const wordsInBook = words.value.filter((w) => w.bookId === book.id)
      book.learnedCount = wordsInBook.filter((w) => w.srs.status !== 'new').length
      book.masteredCount = wordsInBook.filter((w) => w.srs.status === 'mastered').length
    }

    checkAchievements()
  }

  function addSession(session: StudySession) {
    sessions.value.push(session)
  }

  function getWordById(id: string): Word | undefined {
    return words.value.find((w) => w.id === id)
  }

  function resetBookProgress(bookId: string) {
    words.value
      .filter((w) => w.bookId === bookId)
      .forEach((w, i) => {
        const idx = words.value.indexOf(w)
        words.value[idx] = {
          ...w,
          srs: {
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReview: null,
            lastReview: null,
            status: 'new',
            totalReviews: 0,
            correctCount: 0,
            wrongCount: 0,
            avgResponseTime: 0,
            history: [],
          },
          updatedAt: new Date().toISOString(),
        }
      })

    const book = wordBooks.value.find((b) => b.id === bookId)
    if (book) {
      book.learnedCount = 0
      book.masteredCount = 0
    }
  }

  async function importPresetBook(
    presetBook: WordBook,
    presetWords: Word[],
    options?: { onProgress?: (current: number, total: number) => void }
  ) {
    // Check if already imported
    if (wordBooks.value.some((b) => b.id === presetBook.id)) {
      throw new Error(`词库「${presetBook.name}」已导入`)
    }
    // Add the book
    wordBooks.value.push({ ...presetBook, wordCount: 0 })

    const now = new Date().toISOString()
    const total = presetWords.length
    options?.onProgress?.(0, total)

    // Add words in batches, yielding to UI thread
    for (let i = 0; i < presetWords.length; i++) {
      const w = presetWords[i]
      words.value.push({
        ...w,
        id: `preset_${presetBook.id}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        createdAt: now,
        updatedAt: now,
      })
      options?.onProgress?.(i + 1, total)
      // Yield to UI every 20 words
      if (i % 20 === 0 && i < presetWords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    // Update book word count
    const book = wordBooks.value.find((b) => b.id === presetBook.id)
    if (book) {
      book.wordCount = presetWords.length
    }
    checkAchievements()
  }

  function updateWord(wordId: string, patch: Partial<Word>) {
    const idx = words.value.findIndex((w) => w.id === wordId)
    if (idx === -1) return
    words.value[idx] = {
      ...words.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
  }

  function deleteWord(wordId: string) {
    const word = words.value.find((w) => w.id === wordId)
    if (!word) return
    words.value = words.value.filter((w) => w.id !== wordId)
    const book = wordBooks.value.find((b) => b.id === word.bookId)
    if (book) {
      book.wordCount = Math.max(0, book.wordCount - 1)
      const wordsInBook = words.value.filter((w) => w.bookId === book.id)
      book.learnedCount = wordsInBook.filter((w) => w.srs.status !== 'new').length
      book.masteredCount = wordsInBook.filter((w) => w.srs.status === 'mastered').length
    }
  }

  function deleteWordBook(bookId: string) {
    const book = wordBooks.value.find((b) => b.id === bookId)
    if (!book) return
    wordBooks.value = wordBooks.value.filter((b) => b.id !== bookId)
    words.value = words.value.filter((w) => w.bookId !== bookId)
  }

  function exportData(): string {
    return JSON.stringify(
      {
        wordBooks: wordBooks.value,
        words: words.value,
        sessions: sessions.value,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
  }

  function importData(json: string) {
    const data = JSON.parse(json)
    if (data.wordBooks) wordBooks.value = data.wordBooks
    if (data.words) words.value = data.words
    if (data.sessions) sessions.value = data.sessions
  }

  return {
    wordBooks,
    words,
    sessions,
    currentBookId,
    currentWordIndex,
    currentBook,
    bookWords,
    enabledWords,
    totalLearned,
    totalMastered,
    masteryRate,
    todayDueCount,
    reviewQueue,
    todayStats,
    confusedWords,
    weeklyActivity,
    learningCurve,
    ratingDistribution,
    statusDistribution,
    reviewForecast,
    yearlyHeatmap,
    studyTimeDistribution,
    achievements,
    unlockedAchievements,
    checkAchievements,
    setCurrentBook,
    addWordBook,
    addWord,
    importPresetBook,
    deleteWordBook,
    updateWordProgress,
    addSession,
    getWordById,
    resetBookProgress,
    updateWord,
    deleteWord,
    exportData,
    importData,
  }
})
