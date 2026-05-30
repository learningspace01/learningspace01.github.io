<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import Confetti from '@/components/Confetti.vue'
import { useSwipeGesture } from '@/composables/useSwipeGesture'
import { Volume2, Edit3, SkipForward, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const vocabStore = useVocabStore()
const currentIndex = ref(0)
const showDefinition = ref(false)
const sessionCorrect = ref(0)
const sessionTotal = ref(0)
const isFinished = ref(false)
const showConfetti = ref(false)
const cardAreaRef = ref<HTMLElement | null>(null)
const sessionStartTime = ref(new Date().toISOString())
const sessionReviewedWords = ref(0)

watch(isFinished, (val) => {
  if (val) {
    showConfetti.value = true
    vocabStore.addSession({
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: 'review',
      bookId: vocabStore.currentBookId,
      startTime: sessionStartTime.value,
      endTime: new Date().toISOString(),
      duration: Math.round((Date.now() - new Date(sessionStartTime.value).getTime()) / 1000),
      totalWords: sessionTotal.value,
      completedWords: sessionTotal.value,
      correctCount: sessionCorrect.value,
      accuracy: sessionTotal.value ? Math.round((sessionCorrect.value / sessionTotal.value) * 100) : 0,
      newWordsLearned: 0,
      wordsReviewed: sessionReviewedWords.value,
      wordsMastered: 0,
    })
  }
})

const { attach, detach } = useSwipeGesture(cardAreaRef, {
  threshold: 40,
  onSwipeLeft: () => skipWord(),
  onSwipeRight: () => prevWord(),
})

const queue = computed(() => vocabStore.reviewQueue)
const currentWord = computed(() => queue.value[currentIndex.value] || null)

const progress = computed(() => {
  if (queue.value.length === 0) return { current: 0, total: 0, pct: 0 }
  return {
    current: currentIndex.value + 1,
    total: queue.value.length,
    pct: Math.round(((currentIndex.value + 1) / queue.value.length) * 100),
  }
})

const isFirst = computed(() => currentIndex.value <= 0)
const isLast = computed(() => currentIndex.value >= queue.value.length - 1)

function toggleDefinition() {
  showDefinition.value = !showDefinition.value
}

function rateWord(quality: number) {
  if (!currentWord.value) return

  vocabStore.updateWordProgress(currentWord.value.id, quality)
  sessionTotal.value++
  if (quality >= 3) sessionCorrect.value++
  sessionReviewedWords.value++

  showDefinition.value = false

  if (isLast.value) {
    isFinished.value = true
  } else {
    setTimeout(() => {
      currentIndex.value++
    }, 200)
  }
}

function skipWord() {
  if (isLast.value) {
    isFinished.value = true
  } else {
    currentIndex.value++
    showDefinition.value = false
  }
}

function prevWord() {
  if (!isFirst.value) {
    currentIndex.value--
    showDefinition.value = false
  }
}

function restartSession() {
  currentIndex.value = 0
  showDefinition.value = false
  sessionCorrect.value = 0
  sessionTotal.value = 0
  sessionReviewedWords.value = 0
  sessionStartTime.value = new Date().toISOString()
  isFinished.value = false
  showConfetti.value = false
}

function speak(text: string) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.8
    window.speechSynthesis.speak(u)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (isFinished.value) return
  if (e.key === ' ') {
    e.preventDefault()
    toggleDefinition()
    return
  }
  if (e.key === 'ArrowLeft') { prevWord(); return }
  if (e.key === 'ArrowRight') { skipWord(); return }
  if (showDefinition.value) {
    const q = parseInt(e.key)
    if (q >= 1 && q <= 5) rateWord(q)
  }
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
  <div class="review-page">
    <!-- Session Complete -->
    <div v-if="isFinished" class="session-complete">
      <Confetti v-if="showConfetti" />
      <div class="complete-icon">🎉</div>
      <h2>本轮复习完成！</h2>
      <div class="session-stats">
        <div class="session-stat">
          <span class="stat-val">{{ sessionTotal }}</span>
          <span class="stat-lbl">复习单词</span>
        </div>
        <div class="session-stat">
          <span class="stat-val">{{ sessionCorrect }}</span>
          <span class="stat-lbl">掌握</span>
        </div>
        <div class="session-stat">
          <span class="stat-val">
            {{ sessionTotal ? Math.round((sessionCorrect / sessionTotal) * 100) : 0 }}%
          </span>
          <span class="stat-lbl">正确率</span>
        </div>
      </div>
      <p class="session-note">复习进度已自动保存，明天记得继续哦</p>
      <button class="primary-btn" @click="restartSession">再来一轮</button>
    </div>

    <!-- Empty queue -->
    <div v-else-if="queue.length === 0" class="empty-state">
      <div class="empty-icon">✅</div>
      <h2>暂无待复习单词</h2>
      <p>所有单词都已按时复习，去学点新词吧</p>
    </div>

    <!-- Review Session -->
    <template v-else-if="currentWord">
      <!-- Header -->
      <div class="review-header">
        <div class="header-info">
          <span class="session-label">智能复习</span>
          <span class="header-divider">|</span>
          <span class="session-count">
            待复习: {{ queue.length }}词 |
            已完成: {{ currentIndex }}/{{ queue.length }}
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress.pct + '%' }" />
        </div>
      </div>

      <!-- Card Area -->
      <div ref="cardAreaRef" class="card-area">
        <button class="nav-btn prev" :disabled="isFirst" @click="prevWord">
          <ChevronLeft :size="24" />
        </button>

        <div class="review-card glass-card" @click="toggleDefinition">
          <!-- Front -->
          <template v-if="!showDefinition">
            <h2 class="card-word">{{ currentWord.word }}</h2>
            <p class="card-phonetic">{{ currentWord.phonetic }}</p>
            <button class="audio-btn" @click.stop="speak(currentWord.word)">
              <Volume2 :size="18" />
            </button>
            <p class="review-info">
              第 {{ currentWord.srs.repetitions + 1 }} 次复习 ·
              上次: {{ currentWord.srs.lastReview || '首次' }}
            </p>
            <p class="flip-hint">按空格或点击卡片翻转</p>
          </template>

          <!-- Back -->
          <template v-else>
            <h3 class="back-word">{{ currentWord.word }}</h3>
            <p class="back-phonetic">{{ currentWord.phonetic }}</p>
            <div class="divider" />

            <div class="definitions">
              <div
                v-for="(def, i) in currentWord.definitions"
                :key="i"
                class="definition-item"
              >
                <span class="pos">{{ def.pos }}.</span>
                <span class="meaning">{{ def.meaning }}</span>
              </div>
            </div>

            <div v-if="currentWord.examples.length" class="examples">
              <div
                v-for="(ex, i) in currentWord.examples"
                :key="i"
                class="example-item"
              >
                <p class="example-en">{{ ex.en }}</p>
                <p class="example-cn">{{ ex.cn }}</p>
              </div>
            </div>

            <div v-if="currentWord.etymology" class="etymology-block">
              <p><strong>词根:</strong> {{ currentWord.etymology }}</p>
            </div>
          </template>
        </div>

        <button class="nav-btn next" :disabled="isLast" @click="skipWord">
          <ChevronRight :size="24" />
        </button>
      </div>

      <!-- Rating Bar -->
      <div v-if="showDefinition" class="rating-section">
        <p class="rating-prompt">你对这个词的掌握程度？</p>
        <div class="rating-bar">
          <button class="rate-btn rate-0" @click="rateWord(1)">
            <span class="emoji">😵</span>
            <span class="label">不认识</span>
            <span class="srs-hint">1天后</span>
          </button>
          <button class="rate-btn rate-1" @click="rateWord(2)">
            <span class="emoji">😟</span>
            <span class="label">模糊</span>
            <span class="srs-hint">1天后</span>
          </button>
          <button class="rate-btn rate-2" @click="rateWord(3)">
            <span class="emoji">🤔</span>
            <span class="label">想想能想起</span>
            <span class="srs-hint">3天后</span>
          </button>
          <button class="rate-btn rate-3" @click="rateWord(4)">
            <span class="emoji">😊</span>
            <span class="label">比较熟悉</span>
            <span class="srs-hint">14天后</span>
          </button>
          <button class="rate-btn rate-4" @click="rateWord(5)">
            <span class="emoji">🎯</span>
            <span class="label">完全掌握</span>
            <span class="srs-hint">30天后</span>
          </button>
        </div>
      </div>

      <!-- Keyboard hints -->
      <div class="kb-hints">
        <span><kbd>Space</kbd> 翻转</span>
        <span><kbd>1</kbd>-<kbd>5</kbd> 评级</span>
        <span><kbd>←</kbd><kbd>→</kbd> 切换</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-page {
  animation: fadeInUp 0.3s var(--ease-out);
  max-width: 700px;
  margin: 0 auto;
}

.review-header {
  margin-bottom: var(--space-6);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.session-label {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.book-badge {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--accent-light);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.header-divider {
  color: var(--border);
}

.session-count {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.progress-track {
  height: 6px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4F6EF7, #6366F1);
  border-radius: var(--radius-full);
  transition: width 0.4s var(--ease-out);
}

.card-area {
  display: flex;
  align-items: center;
  gap: var(--space-4);
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
  flex-shrink: 0;
  transition: all var(--duration-fast) var(--ease-out);
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

.review-card {
  flex: 1;
  min-height: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-8);
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  transition: transform 0.15s, box-shadow 0.15s;
}

.review-card:active {
  transform: scale(0.985);
}

.card-word {
  font-family: var(--font-serif);
  font-size: 2.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.card-phonetic {
  font-family: var(--font-mono);
  font-size: 1.1rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-5);
}

.audio-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--accent-light);
  color: var(--accent);
  margin-bottom: var(--space-5);
  transition: all var(--duration-fast) var(--ease-out);
}

.audio-btn:hover {
  background: var(--accent);
  color: white;
}

.review-info {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.flip-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.back-word {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.back-phonetic {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.divider {
  width: 40px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  margin: var(--space-4) auto;
  opacity: 0.6;
}

.definitions { margin-bottom: var(--space-4); }
.definition-item { margin-bottom: var(--space-2); }

.pos {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--accent);
  font-weight: 500;
  margin-right: var(--space-2);
}

.meaning {
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
}

.examples { width: 100%; margin-bottom: var(--space-4); }
.example-item {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--accent);
  margin-bottom: var(--space-3);
  text-align: left;
}

.example-en {
  font-family: var(--font-en);
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.example-cn {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.etymology-block {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: left;
  width: 100%;
  padding: var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

/* Rating */
.rating-section {
  margin-top: var(--space-6);
  text-align: center;
}

.rating-prompt {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.rating-bar {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
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
  min-width: 90px;
}

.rate-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.rate-btn .emoji { font-size: 1.5rem; }
.rate-btn .label { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; }
.srs-hint { font-size: 0.65rem; color: var(--text-tertiary); }

.rate-0:hover { border-color: #EF4444; background: #FEF2F2; }
.rate-1:hover { border-color: #F59E0B; background: #FFFBEB; }
.rate-2:hover { border-color: #F59E0B; background: #FFFBEB; }
.rate-3:hover { border-color: #10B981; background: #ECFDF5; }
.rate-4:hover { border-color: #4F6EF7; background: #EEF1FE; }

.kb-hints {
  display: flex;
  justify-content: center;
  gap: var(--space-5);
  margin-top: var(--space-5);
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

/* Session Complete */
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
  margin-bottom: var(--space-6);
}

.session-stat { display: flex; flex-direction: column; align-items: center; }
.stat-val {
  font-family: var(--font-en);
  font-size: var(--text-4xl);
  font-weight: 700;
  color: var(--accent);
}
.stat-lbl { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: var(--space-1); }

.session-note { color: var(--text-tertiary); margin-bottom: var(--space-6); }

.primary-btn {
  padding: var(--space-3) var(--space-8);
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  transition: all var(--duration-fast) var(--ease-out);
}

.primary-btn:hover {
  background: var(--accent-hover);
}

.empty-state {
  text-align: center;
  padding: var(--space-20) var(--space-8);
  color: var(--text-secondary);
}

.empty-icon { font-size: 3rem; margin-bottom: var(--space-4); }
.empty-state h2 {
  font-size: var(--text-2xl);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

@media (max-width: 768px) {
  .card-area {
    flex-direction: column;
  }
  .nav-btn { display: none; }
  .rating-bar {
    flex-wrap: wrap;
  }
  .rate-btn {
    min-width: 70px;
    padding: var(--space-2) var(--space-3);
  }
}
</style>
