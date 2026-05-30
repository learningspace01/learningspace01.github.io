<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import GlassCard from '@/components/GlassCard.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import Confetti from '@/components/Confetti.vue'
import { Play, Volume2 } from 'lucide-vue-next'
import { getTestQueue } from '@/core/scheduler'

const vocabStore = useVocabStore()

// 0 = choice, 1 = dictation
const mode = ref<'choice' | 'dictation'>('choice')

// --- Choice Test ---
const choiceQuestions = computed(() => {
  const source = vocabStore.enabledWords
  const queue = getTestQueue(source, { count: 10, mode: 'choice' })
  if (queue.length < 4) return []

  return queue.map((word) => {
    const others = source.filter((w) => w.id !== word.id)
    const distractors = others.sort(() => Math.random() - 0.5).slice(0, 3)
    const options = [
      { text: word.definitions[0]?.meaning || word.word, correct: true },
      ...distractors.map((d) => ({
        text: d.definitions[0]?.meaning || d.word,
        correct: false,
      })),
    ].sort(() => Math.random() - 0.5)
    return { word, options }
  })
})

const choiceIndex = ref(0)
const choiceSelected = ref<number | null>(null)
const choiceAnswered = ref(false)
const choiceCorrect = ref(0)
const choiceTotal = ref(0)
const choiceSeconds = ref(0)
let choiceTimer: ReturnType<typeof setInterval> | null = null

const currentChoice = computed(() => choiceQuestions.value[choiceIndex.value] || null)
const choiceProgress = computed(() => ({
  current: choiceIndex.value + (choiceAnswered.value ? 1 : 0),
  total: choiceQuestions.value.length,
}))
const choiceFinished = computed(
  () => choiceQuestions.value.length > 0 && choiceIndex.value >= choiceQuestions.value.length
)

function selectChoice(idx: number) {
  if (choiceAnswered.value) return
  choiceAnswered.value = true
  choiceSelected.value = idx
  choiceTotal.value++
  const isCorrect = currentChoice.value?.options[idx].correct ?? false
  if (isCorrect) choiceCorrect.value++

  // SRS feedback based on correctness
  if (currentChoice.value) {
    const quality = isCorrect ? 3 : 1
    vocabStore.updateWordProgress(currentChoice.value.word.id, quality)
  }
}

function nextChoice() {
  choiceIndex.value++
  choiceSelected.value = null
  choiceAnswered.value = false
}

function restartChoice() {
  choiceIndex.value = 0
  choiceSelected.value = null
  choiceAnswered.value = false
  choiceCorrect.value = 0
  choiceTotal.value = 0
  choiceSeconds.value = 0
  showConfetti.value = false
  sessionStartTime.value = new Date().toISOString()
  startChoiceTimer()
}

function startChoiceTimer() {
  if (choiceTimer) clearInterval(choiceTimer)
  choiceTimer = setInterval(() => choiceSeconds.value++, 1000)
}

// --- Dictation ---
const dictationWords = computed(() => {
  const src = vocabStore.enabledWords
  return getTestQueue(src, { count: 15, mode: 'dictation' })
})
const dictIndex = ref(0)
const dictInput = ref('')
const dictSubmitted = ref(false)
const dictCorrect = ref(false)
const dictTotalCorrect = ref(0)
const dictTotal = ref(0)
const dictPlayCount = ref(0)

const currentDictWord = computed(() => dictationWords.value[dictIndex.value] || null)
const dictProgress = computed(() => ({
  current: dictIndex.value + 1,
  total: dictationWords.value.length,
}))
const dictFinished = computed(
  () => dictationWords.value.length > 0 && dictIndex.value >= dictationWords.value.length
)

const showConfetti = ref(false)
const sessionStartTime = ref(new Date().toISOString())

watch([choiceFinished, dictFinished], ([c, d]) => {
  if (c || d) {
    showConfetti.value = true
    const type = c ? 'choice' : 'dictation'
    const total = type === 'choice' ? choiceTotal.value : dictTotal.value
    const correct = type === 'choice' ? choiceCorrect.value : dictTotalCorrect.value
    vocabStore.addSession({
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: 'test',
      bookId: vocabStore.currentBookId,
      startTime: sessionStartTime.value,
      endTime: new Date().toISOString(),
      duration: Math.round((Date.now() - new Date(sessionStartTime.value).getTime()) / 1000),
      totalWords: total,
      completedWords: total,
      correctCount: correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      newWordsLearned: 0,
      wordsReviewed: 0,
      wordsMastered: 0,
    })
  }
})

function speakWord(text: string) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.75
    u.pitch = 1
    window.speechSynthesis.speak(u)
  }
}

function playDictWord() {
  if (!currentDictWord.value) return
  dictPlayCount.value++
  speakWord(currentDictWord.value.word)
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length; const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function isFuzzyMatch(answer: string, target: string): boolean {
  const a = answer.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (a === t) return true
  const maxDist = Math.min(2, Math.max(1, Math.floor(t.length / 5)))
  return levenshteinDistance(a, t) <= maxDist
}

const dictFuzzyCorrect = ref(false)

function submitDictation() {
  if (!currentDictWord.value || dictSubmitted.value) return
  dictSubmitted.value = true
  dictTotal.value++
  const answer = dictInput.value.trim().toLowerCase()
  const target = currentDictWord.value.word.toLowerCase()

  const exactMatch = answer === target
  const fuzzyMatch = !exactMatch && isFuzzyMatch(answer, target)

  dictCorrect.value = exactMatch || fuzzyMatch
  dictFuzzyCorrect.value = fuzzyMatch
  if (dictCorrect.value) dictTotalCorrect.value++

  // SRS feedback: quality based on effort + accuracy
  let quality = 1
  if (exactMatch) {
    quality = dictPlayCount.value <= 1 ? 5 : 4
  } else if (fuzzyMatch) {
    quality = dictPlayCount.value <= 1 ? 4 : 3
  }
  vocabStore.updateWordProgress(currentDictWord.value.id, quality)
}

function nextDictation() {
  dictIndex.value++
  dictInput.value = ''
  dictSubmitted.value = false
  dictCorrect.value = false
  dictPlayCount.value = 0
}

function restartDictation() {
  dictIndex.value = 0
  dictInput.value = ''
  dictSubmitted.value = false
  dictCorrect.value = false
  dictTotalCorrect.value = 0
  dictTotal.value = 0
  dictPlayCount.value = 0
  showConfetti.value = false
  sessionStartTime.value = new Date().toISOString()
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function handleKeyDown(e: KeyboardEvent) {
  if (mode.value === 'choice' && !choiceAnswered.value) {
    if (['1', '2', '3', '4'].includes(e.key)) {
      selectChoice(parseInt(e.key) - 1)
    }
  }
  if (mode.value === 'dictation' && !dictSubmitted.value) {
    if (e.key === 'Enter') {
      submitDictation()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  startChoiceTimer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (choiceTimer) clearInterval(choiceTimer)
})

watch(mode, () => {
  if (mode.value === 'choice') startChoiceTimer()
  else {
    if (choiceTimer) clearInterval(choiceTimer)
  }
})
</script>

<template>
  <div class="test-page">
    <!-- Mode Selector -->
    <div class="mode-tabs">
      <button class="mode-btn" :class="{ active: mode === 'choice' }" @click="mode = 'choice'">
        选择测试
      </button>
      <button class="mode-btn" :class="{ active: mode === 'dictation' }" @click="mode = 'dictation'">
        听写模式
      </button>
    </div>

    <!-- ============ CHOICE TEST ============ -->
    <template v-if="mode === 'choice'">
      <div v-if="choiceFinished" class="session-complete">
        <Confetti v-if="showConfetti" />
        <div class="complete-icon">📝</div>
        <h2>测试完成！</h2>
        <div class="session-stats">
          <div class="session-stat">
            <span class="stat-val">{{ choiceCorrect }}/{{ choiceTotal }}</span>
            <span class="stat-lbl">正确率</span>
          </div>
          <div class="session-stat">
            <span class="stat-val">{{ formatTime(choiceSeconds) }}</span>
            <span class="stat-lbl">用时</span>
          </div>
        </div>
        <button class="primary-btn" @click="restartChoice">再来一轮</button>
      </div>

      <div v-else-if="choiceQuestions.length < 4" class="empty-state">
        <p>需要至少4个已学习的单词才能进行选择测试</p>
      </div>

      <template v-else-if="currentChoice">
        <div class="choice-header">
          <div class="header-left">
            <span class="test-label">选择测试</span>
            <span class="timer">⏱ {{ formatTime(choiceSeconds) }}</span>
          </div>
          <ProgressBar :current="choiceProgress.current" :total="choiceProgress.total" />
        </div>

        <div class="question-card">
          <p class="question-text">
            "{{ currentChoice.word.word }}" 的意思是？
          </p>

          <div class="options-list">
            <button
              v-for="(opt, i) in currentChoice.options"
              :key="i"
              class="option-btn"
              :class="{
                correct: choiceAnswered && opt.correct,
                wrong: choiceAnswered && choiceSelected === i && !opt.correct,
                selected: choiceSelected === i,
                revealed: choiceAnswered,
              }"
              :disabled="choiceAnswered"
              @click="selectChoice(i)"
            >
              <span class="opt-letter">{{ 'ABCD'[i] }}.</span>
              <span class="opt-text">{{ opt.text }}</span>
              <span v-if="choiceAnswered && opt.correct" class="opt-mark">✓</span>
              <span v-else-if="choiceAnswered && choiceSelected === i && !opt.correct" class="opt-mark">✗</span>
            </button>
          </div>

          <div v-if="choiceAnswered" class="answer-detail">
            <div class="detail-row">
              <span class="detail-word">{{ currentChoice.word.word }}</span>
              <span class="detail-phonetic">{{ currentChoice.word.phonetic }}</span>
            </div>
            <button class="next-btn" @click="nextChoice">
              下一题 →
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- ============ DICTATION ============ -->
    <template v-if="mode === 'dictation'">
      <div v-if="dictFinished" class="session-complete">
        <Confetti v-if="showConfetti" />
        <div class="complete-icon">🎧</div>
        <h2>听写完成！</h2>
        <div class="session-stats">
          <div class="session-stat">
            <span class="stat-val">{{ dictTotalCorrect }}/{{ dictTotal }}</span>
            <span class="stat-lbl">正确率</span>
          </div>
        </div>
        <button class="primary-btn" @click="restartDictation">再来一轮</button>
      </div>

      <div v-else-if="dictationWords.length === 0" class="empty-state">
        <p>暂无单词可进行听写测试</p>
      </div>

      <template v-else-if="currentDictWord">
        <div class="dict-header">
          <span class="test-label">听写模式</span>
          <ProgressBar :current="dictProgress.current" :total="dictProgress.total" />
        </div>

        <div class="dict-card">
          <!-- Play Area -->
          <div class="play-area">
            <button class="play-btn" @click="playDictWord">
              <Volume2 :size="32" />
            </button>
            <p class="play-hint">
              {{ dictPlayCount === 0 ? '点击播放发音' : `已播放 ${dictPlayCount} 次 — 可重复播放` }}
            </p>
          </div>

          <!-- Hint -->
          <div class="dict-hint" v-if="currentDictWord.definitions[0]">
            <span class="hint-label">释义提示：</span>
            <span>{{ currentDictWord.definitions[0].meaning }}</span>
          </div>

          <!-- Input -->
          <div class="dict-input-area">
            <input
              v-model="dictInput"
              type="text"
              class="dict-input"
              :class="{ correct: dictSubmitted && dictCorrect, wrong: dictSubmitted && !dictCorrect }"
              placeholder="输入你听到的单词..."
              :disabled="dictSubmitted"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              @keydown.enter="submitDictation"
            />
          </div>

          <!-- Actions -->
          <div class="dict-actions">
            <button class="dict-action-btn" @click="playDictWord">🔄 再听一次</button>
            <button
              class="dict-action-btn primary"
              :disabled="!dictInput.trim() || dictSubmitted"
              @click="submitDictation"
            >
              ✓ 确认
            </button>
            <button class="dict-action-btn" @click="nextDictation">⏭ 跳过</button>
          </div>

          <!-- Result -->
          <div v-if="dictSubmitted" class="dict-result">
            <div v-if="dictCorrect && !dictFuzzyCorrect" class="result-correct">✓ 正确！</div>
            <div v-else-if="dictFuzzyCorrect" class="result-fuzzy">
              <span>✓ 接近正确！</span>
              <span class="fuzzy-detail">（正确答案：<strong>{{ currentDictWord.word }}</strong>）</span>
            </div>
            <div v-else class="result-wrong">
              <span>✗ 正确答案：</span>
              <strong>{{ currentDictWord.word }}</strong>
              <span class="result-phonetic"> / {{ currentDictWord.phonetic }} /</span>
            </div>
            <button class="continue-btn" @click="nextDictation">继续 →</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.test-page {
  animation: fadeInUp 0.3s var(--ease-out);
  max-width: 640px;
  margin: 0 auto;
}

.mode-tabs {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.mode-btn {
  padding: var(--space-3) var(--space-5);
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

/* Choice Header */
.choice-header, .dict-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.test-label {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.timer {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

/* Question Card */
.question-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.question-text {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: var(--space-8);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.option-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: white;
  border: 1px solid var(--border);
  text-align: left;
  font-size: var(--text-base);
  transition: all var(--duration-fast) var(--ease-out);
}

.option-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-light);
}

.option-btn.revealed { cursor: default; }
.option-btn.selected { border-color: var(--accent); background: var(--accent-light); }
.option-btn.correct { border-color: var(--success); background: #ECFDF5; color: var(--success); }
.option-btn.wrong { border-color: var(--danger); background: #FEF2F2; color: var(--danger); }

.opt-letter {
  font-family: var(--font-mono);
  font-weight: 600;
  width: 24px;
}

.opt-text { flex: 1; }
.opt-mark { font-weight: 700; }

.answer-detail {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
  text-align: center;
}

.detail-row {
  margin-bottom: var(--space-4);
}

.detail-word {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.detail-phonetic {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-left: var(--space-3);
}

.next-btn {
  padding: var(--space-3) var(--space-6);
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  transition: all var(--duration-fast) var(--ease-out);
}

.next-btn:hover { background: var(--accent-hover); }

/* Dictation */
.dict-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.play-area {
  padding: var(--space-8) 0;
}

.play-btn {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  background: var(--accent-light);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
  box-shadow: 0 4px 16px rgba(79, 110, 247, 0.2);
  transition: all var(--duration-fast) var(--ease-out);
}

.play-btn:hover {
  transform: scale(1.05);
  background: var(--accent);
  color: white;
}

.play-btn:active { transform: scale(0.95); }

.play-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.dict-hint {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-5);
}

.hint-label {
  color: var(--text-tertiary);
}

.dict-input-area {
  margin-bottom: var(--space-5);
}

.dict-input {
  width: 100%;
  padding: var(--space-4) var(--space-5);
  font-family: var(--font-mono);
  font-size: 1.3rem;
  text-align: center;
  letter-spacing: 2px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

.dict-input:focus {
  border-color: var(--accent);
}

.dict-input.correct {
  border-color: var(--success);
  background: #ECFDF5;
  color: var(--success);
}

.dict-input.wrong {
  border-color: var(--danger);
  background: #FEF2F2;
  color: var(--danger);
}

.dict-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.dict-action-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.dict-action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dict-action-btn.primary {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.dict-action-btn.primary:hover:not(:disabled) {
  background: var(--accent);
  color: white;
}

.dict-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dict-result {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.result-correct {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--success);
}

.result-fuzzy {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--warning);
}

.fuzzy-detail {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-left: var(--space-2);
}

.fuzzy-detail strong {
  font-family: var(--font-serif);
}

.result-wrong {
  font-size: var(--text-base);
  color: var(--danger);
}

.result-wrong strong {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  margin: 0 var(--space-1);
}

.result-phonetic {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.continue-btn {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--accent);
  color: white;
  transition: all var(--duration-fast) var(--ease-out);
}

.continue-btn:hover { background: var(--accent-hover); }

/* Shared */
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

.stat-lbl {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.primary-btn {
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
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .question-card, .dict-card {
    padding: var(--space-5);
  }
  .question-text {
    font-size: 1.3rem;
  }
}
</style>
