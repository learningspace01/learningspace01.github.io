<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import FlashCard from '@/components/FlashCard.vue'
import SpellingView from './SpellingView.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import Confetti from '@/components/Confetti.vue'
import { useSwipeGesture } from '@/composables/useSwipeGesture'
import { getLearnQueue } from '@/core/scheduler'
import type { Word } from '@/types/vocab'
import { ChevronLeft, ChevronRight, FileText, Pencil, Shuffle, ListOrdered } from 'lucide-vue-next'

const vocabStore = useVocabStore()
const settingsStore = useSettingsStore()

const learnMode = ref<'flashcard' | 'spelling'>('flashcard')

const currentIndex = ref(0)
const sessionTotal = ref(0)
const sessionCorrect = ref(0)
const cardAreaRef = ref<HTMLElement | null>(null)
const randomMode = ref(false)
const sessionStartTime = ref(new Date().toISOString())
const sessionNewWords = ref(0)
const sessionReviewedWords = ref(0)
const cardFlipped = ref(false)
const flashCardRef = ref<InstanceType<typeof FlashCard> | null>(null)

const { attach, detach } = useSwipeGesture(cardAreaRef, {
  threshold: 40,
  onSwipeLeft: () => goToNext(),
  onSwipeRight: () => goToPrev(),
})

const wordList = computed(() => {
  const source = vocabStore.enabledWords
  return getLearnQueue(source, {
    dailyNewLimit: settingsStore.settings.newWordsPerDay,
    randomize: randomMode.value,
    excludeMastered: true,
    interleaveReviews: true,
    reviewRatio: 4,
  })
})
const currentWord = computed<Word | null>(() => {
  if (wordList.value.length === 0) return null
  return wordList.value[currentIndex.value] || null
})

const progress = computed(() => ({
  current: currentIndex.value + 1,
  total: wordList.value.length,
}))

const isLastWord = computed(() => currentIndex.value >= wordList.value.length - 1)
const isFirstWord = computed(() => currentIndex.value <= 0)
const showConfetti = ref(false)
const isFinished = computed(() => currentIndex.value >= wordList.value.length)

watch(isFinished, (val) => {
  if (val) {
    showConfetti.value = true
    vocabStore.addSession({
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: 'learn',
      bookId: vocabStore.currentBookId,
      startTime: sessionStartTime.value,
      endTime: new Date().toISOString(),
      duration: Math.round((Date.now() - new Date(sessionStartTime.value).getTime()) / 1000),
      totalWords: sessionTotal.value,
      completedWords: sessionTotal.value,
      correctCount: sessionCorrect.value,
      accuracy: sessionTotal.value ? Math.round((sessionCorrect.value / sessionTotal.value) * 100) : 0,
      newWordsLearned: sessionNewWords.value,
      wordsReviewed: sessionReviewedWords.value,
      wordsMastered: 0,
    })
  }
})

function goToNext() {
  if (isLastWord.value) {
    currentIndex.value = wordList.value.length
  } else {
    currentIndex.value++
  }
}

function goToPrev() {
  if (!isFirstWord.value) {
    currentIndex.value--
  }
}

function onCardFlipped(val: boolean) {
  cardFlipped.value = val
}

function handleRate(quality: number) {
  if (!currentWord.value) return
  const wasNew = currentWord.value.srs.status === 'new'
  vocabStore.updateWordProgress(currentWord.value.id, quality)
  sessionTotal.value++
  if (quality >= 3) sessionCorrect.value++
  if (wasNew) sessionNewWords.value++
  else sessionReviewedWords.value++

  const today = new Date().toISOString().split('T')[0]
  if (settingsStore.lastStudyDate !== today) {
    settingsStore.streakDays++
    settingsStore.lastStudyDate = today
  }

  cardFlipped.value = false
  setTimeout(() => goToNext(), 300)
}

function handleKeyDown(e: KeyboardEvent) {
  if (!settingsStore.settings.keyboardShortcuts) return
  if (isFinished.value && learnMode.value === 'flashcard') return

  switch (e.key) {
    case 'ArrowLeft': goToPrev(); break
    case 'ArrowRight': goToNext(); break
    case ' ': e.preventDefault(); flashCardRef.value?.toggleFlip(); break
    case '1': handleRate(1); break
    case '2': handleRate(2); break
    case '3': handleRate(3); break
    case '4': handleRate(4); break
  }
}

function restartSession() {
  currentIndex.value = 0
  sessionTotal.value = 0
  sessionCorrect.value = 0
  sessionNewWords.value = 0
  sessionReviewedWords.value = 0
  sessionStartTime.value = new Date().toISOString()
  showConfetti.value = false
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  setTimeout(() => attach(), 200)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  detach()
})
</script>

<template>
  <div class="learn-page" :key="learnMode">
    <!-- Mode Toggle + Header Info -->
    <div class="mode-tabs">
      <div class="mode-tabs-left">
        <button
          class="mode-btn"
          :class="{ active: learnMode === 'flashcard' }"
          @click="learnMode = 'flashcard'"
        >
          <FileText :size="16" />
          <span>卡片浏览</span>
        </button>
        <button
          class="mode-btn"
          :class="{ active: learnMode === 'spelling' }"
          @click="learnMode = 'spelling'"
        >
          <Pencil :size="16" />
          <span>拼写练习</span>
        </button>
      </div>
      <div v-if="learnMode === 'flashcard' && wordList.length > 0 && currentWord" class="mode-tabs-right">
        <div class="book-info">
          <span v-if="vocabStore.currentBook">{{ vocabStore.currentBook.icon }}</span>
          <span class="book-name">{{ vocabStore.currentBook?.name || '全部词库' }}</span>
        </div>
        <button class="order-toggle" :title="randomMode ? '点击切换为顺序' : '点击切换为随机'" @click="randomMode = !randomMode">
          <Shuffle v-if="randomMode" :size="16" />
          <ListOrdered v-else :size="16" />
        </button>
        <div class="header-progress">
          <ProgressBar :current="progress.current" :total="progress.total" />
        </div>
        <span class="count-label">{{ progress.current }}/{{ progress.total }} 词</span>
      </div>
    </div>

    <!-- Flashcard Mode -->
    <template v-if="learnMode === 'flashcard'">
      <div v-if="isFinished" class="session-complete">
        <Confetti v-if="showConfetti" />
        <div class="complete-icon">🎉</div>
        <h2>本轮完成！</h2>
        <div class="session-stats">
          <div class="session-stat">
            <span class="s-val">{{ sessionTotal }}</span>
            <span class="s-lbl">学习单词</span>
          </div>
          <div class="session-stat">
            <span class="s-val">{{ sessionCorrect }}</span>
            <span class="s-lbl">已掌握</span>
          </div>
          <div class="session-stat">
            <span class="s-val">
              {{ sessionTotal ? Math.round((sessionCorrect / sessionTotal) * 100) : 0 }}%
            </span>
            <span class="s-lbl">正确率</span>
          </div>
        </div>
        <button class="primary-btn" @click="restartSession">再来一轮</button>
      </div>

      <template v-else-if="wordList.length > 0 && currentWord">


        <div ref="cardAreaRef" class="flashcard-area">
          <div class="card-row">
            <button class="nav-btn prev" :disabled="isFirstWord" @click="goToPrev">
              <ChevronLeft :size="24" />
            </button>
            <FlashCard ref="flashCardRef" :key="currentWord.id + currentIndex" :word="currentWord" @flip="onCardFlipped" />
            <button class="nav-btn next" :disabled="isLastWord" @click="goToNext">
              <ChevronRight :size="24" />
            </button>
          </div>


          <div v-if="cardFlipped" class="rating-row">
            <button class="rate-btn rate-1" @click="handleRate(1)">
              <span class="rate-emoji">😵</span>
              <span class="rate-label">不认识</span>
            </button>
            <button class="rate-btn rate-2" @click="handleRate(2)">
              <span class="rate-emoji">😐</span>
              <span class="rate-label">有印象</span>
            </button>
            <button class="rate-btn rate-3" @click="handleRate(3)">
              <span class="rate-emoji">😊</span>
              <span class="rate-label">已掌握</span>
            </button>
            <button class="rate-btn rate-4" @click="handleRate(4)">
              <span class="rate-emoji">🎯</span>
              <span class="rate-label">太简单</span>
            </button>
          </div>
        </div>

        <div class="keyboard-hints">
          <span class="hint"><kbd>←</kbd><kbd>→</kbd> 切换</span>
          <span class="hint"><kbd>Space</kbd> 翻转</span>
          <span class="hint"><kbd>1</kbd>-<kbd>4</kbd> 评级</span>
        </div>
      </template>

      <div v-else class="empty-state">
        <p>暂无单词，请先导入词库</p>
      </div>
    </template>

    <!-- Spelling Mode -->
    <SpellingView v-else />
  </div>
</template>

<style scoped>
.learn-page {
  animation: fadeInUp 0.3s var(--ease-out);
}

.mode-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.mode-tabs-left {
  display: flex;
  gap: var(--space-3);
}

.mode-tabs-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: white;
  border: 1px solid var(--border);
  transition: all var(--duration-fast) var(--ease-out);
}

.mode-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.mode-btn.active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}

.book-info {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
}

.count-label {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.header-progress {
  width: 80px;
}

.order-toggle {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.order-toggle:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.flashcard-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  flex-shrink: 0;
  width: 100%;
}

.nav-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--accent);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}



/* Rating row */
.rating-row {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  width: 100%;
  max-width: 520px;
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
}

.rate-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: white;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-out);
  min-width: 80px;
  cursor: pointer;
}

.rate-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.rate-emoji {
  font-size: 1.5rem;
}

.rate-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
}

.rate-1:hover { border-color: var(--danger); background: #FEF2F2; }
.rate-2:hover { border-color: var(--warning); background: #FFFBEB; }
.rate-3:hover { border-color: var(--success); background: #ECFDF5; }
.rate-4:hover { border-color: var(--accent); background: var(--accent-light); }

.keyboard-hints {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.session-complete {
  text-align: center;
  padding: var(--space-16) var(--space-8);
}

.complete-icon { font-size: 4rem; margin-bottom: var(--space-4); }
.session-complete h2 {
  font-size: var(--text-3xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-8);
}

.session-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-10);
  margin-bottom: var(--space-8);
}

.session-stat { display: flex; flex-direction: column; align-items: center; }

.s-val {
  font-family: var(--font-en);
  font-size: var(--text-4xl);
  font-weight: 700;
  color: var(--accent);
}

.s-lbl { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: var(--space-1); }

.primary-btn {
  display: inline-flex;
  align-items: center;
  padding: var(--space-3) var(--space-8);
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  transition: all var(--duration-fast) var(--ease-out);
}

.primary-btn:hover { background: var(--accent-hover); }

.empty-state {
  text-align: center;
  padding: var(--space-20) var(--space-8);
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .mode-tabs { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
  .mode-tabs-right { width: 100%; justify-content: flex-end; }
  .card-row { flex-direction: column; gap: var(--space-3); }
  .nav-btn { display: none; }
  .rating-row { flex-wrap: wrap; gap: var(--space-2); }
  .rate-btn { min-width: 70px; padding: var(--space-2) var(--space-3); }
}
</style>
