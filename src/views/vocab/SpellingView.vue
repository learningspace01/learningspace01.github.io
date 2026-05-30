<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import VirtualKeyboard from '@/components/VirtualKeyboard.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { Eye, Lightbulb, SkipForward, Volume2 } from 'lucide-vue-next'

const vocabStore = useVocabStore()

const words = computed(() => vocabStore.enabledWords)
const currentIndex = ref(0)
const userInput = ref('')
const showAnswer = ref(false)
const sessionCorrect = ref(0)
const sessionTotal = ref(0)

const currentWord = computed(() => words.value[currentIndex.value] || null)
const progress = computed(() => ({
  current: currentIndex.value + 1,
  total: words.value.length,
}))
const isFinished = computed(() => currentIndex.value >= words.value.length)
const isFirst = computed(() => currentIndex.value <= 0)

const firstLetter = computed(() => {
  if (!currentWord.value) return ''
  return currentWord.value.word.charAt(0)
})

const maskedExample = computed(() => {
  if (!currentWord.value?.examples[0]) return ''
  const regex = new RegExp(currentWord.value.word, 'gi')
  return currentWord.value.examples[0].en.replace(regex, '_'.repeat(currentWord.value.word.length))
})

function onKeyboardKey(key: string) {
  if (showAnswer.value) return
  userInput.value += key
}

function onBackspace() {
  if (showAnswer.value) return
  userInput.value = userInput.value.slice(0, -1)
}

function onEnter() {
  checkAnswer()
}

function handlePhysicalKey(e: KeyboardEvent) {
  if (showAnswer.value) {
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      goNext()
    }
    return
  }
  if (e.key === 'Enter') {
    checkAnswer()
    return
  }
  if (e.key === 'Backspace') {
    onBackspace()
    return
  }
  if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
    userInput.value += e.key.toLowerCase()
  }
}

function checkAnswer() {
  if (!currentWord.value || !userInput.value.trim() || showAnswer.value) return
  showAnswer.value = true
  sessionTotal.value++
  if (userInput.value.trim().toLowerCase() === currentWord.value.word.toLowerCase()) {
    sessionCorrect.value++
  }
}

function revealAnswer() {
  showAnswer.value = true
}

function skipWord() {
  goNext()
}

function goNext() {
  if (currentIndex.value < words.value.length) {
    currentIndex.value++
    userInput.value = ''
    showAnswer.value = false
  }
}

function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    userInput.value = ''
    showAnswer.value = false
  }
}

function restartSession() {
  currentIndex.value = 0
  userInput.value = ''
  showAnswer.value = false
  sessionCorrect.value = 0
  sessionTotal.value = 0
}

function speak(text: string) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.8
    window.speechSynthesis.speak(u)
  }
}

onMounted(() => window.addEventListener('keydown', handlePhysicalKey))
onUnmounted(() => window.removeEventListener('keydown', handlePhysicalKey))
</script>

<template>
  <div class="spelling-page">
    <!-- Finished -->
    <div v-if="isFinished" class="session-complete">
      <div class="complete-icon">✏️</div>
      <h2>拼写练习完成！</h2>
      <div class="session-stats">
        <div class="session-stat">
          <span class="stat-val">{{ sessionCorrect }}/{{ sessionTotal }}</span>
          <span class="stat-lbl">正确率</span>
        </div>
      </div>
      <button class="primary-btn" @click="restartSession">再来一轮</button>
    </div>

    <!-- Empty -->
    <div v-else-if="words.length === 0" class="empty-state">
      <p>暂无单词，请先导入词库</p>
    </div>

    <!-- Spelling Practice -->
    <template v-else-if="currentWord">
      <div class="spell-header">
        <span class="header-label">拼写练习</span>
        <ProgressBar :current="progress.current" :total="progress.total" />
      </div>

      <div class="spell-card">
        <!-- Prompt -->
        <div class="prompt-section">
          <p class="definition-prompt">{{ currentWord.definitions[0]?.meaning }}</p>
          <p class="phonetic-prompt">/{{ currentWord.phonetic }}/</p>
          <button class="audio-btn" @click="speak(currentWord.word)">
            <Volume2 :size="18" />
          </button>
        </div>

        <!-- Masked Example -->
        <div v-if="currentWord.examples[0]" class="masked-example">
          <p>{{ maskedExample }}</p>
        </div>

        <!-- Answer Display -->
        <div class="answer-row">
          <div
            v-for="(letter, i) in currentWord.word.split('')"
            :key="i"
            class="letter-box"
            :class="{
              filled: userInput[i],
              correct: showAnswer && userInput[i]?.toLowerCase() === letter.toLowerCase(),
              wrong: showAnswer && userInput[i]?.toLowerCase() !== letter.toLowerCase(),
            }"
          >
            <span v-if="userInput[i]">{{ userInput[i].toLowerCase() }}</span>
          </div>
        </div>

        <!-- Result -->
        <div v-if="showAnswer" class="result-section">
          <div v-if="userInput.toLowerCase() === currentWord.word.toLowerCase()" class="result-correct">
            ✓ 拼写正确！
          </div>
          <div v-else class="result-wrong">
            <span>正确答案：</span>
            <strong>{{ currentWord.word }}</strong>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="spell-actions">
          <button class="spell-action-btn" @click="revealAnswer">
            <Eye :size="16" />
            <span>偷看一眼</span>
          </button>
          <button class="spell-action-btn" @click="skipWord">
            <SkipForward :size="16" />
            <span>跳过</span>
          </button>
        </div>

        <!-- Next Button (after answer revealed) -->
        <div v-if="showAnswer" class="next-area">
          <button class="next-btn" @click="goNext">下一词 →</button>
        </div>
      </div>

      <!-- Virtual Keyboard -->
      <VirtualKeyboard
        :show-enter="false"
        @keypress="onKeyboardKey"
        @backspace="onBackspace"
        @enter="onEnter"
      />
    </template>
  </div>
</template>

<style scoped>
.spelling-page {
  animation: fadeInUp 0.3s var(--ease-out);
  max-width: 640px;
  margin: 0 auto;
}

.spell-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.header-label {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.spell-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
  margin-bottom: var(--space-6);
}

.prompt-section {
  margin-bottom: var(--space-5);
}

.definition-prompt {
  font-size: 1.2rem;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: var(--space-3);
}

.phonetic-prompt {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.audio-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--accent-light);
  color: var(--accent);
  transition: all var(--duration-fast) var(--ease-out);
}

.audio-btn:hover {
  background: var(--accent);
  color: white;
}

.masked-example {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-family: var(--font-en);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}

.answer-row {
  display: flex;
  justify-content: center;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.letter-box {
  width: 36px;
  height: 44px;
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  text-transform: lowercase;
}

.letter-box.filled {
  border-bottom-color: var(--accent);
}

.letter-box.correct {
  border-bottom-color: var(--success);
  color: var(--success);
}

.letter-box.wrong {
  border-bottom-color: var(--danger);
  color: var(--danger);
}

.result-section {
  margin-bottom: var(--space-4);
}

.result-correct {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--success);
}

.result-wrong {
  font-size: var(--text-base);
  color: var(--danger);
}

.result-wrong strong {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
}

.spell-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.spell-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.spell-action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.next-area {
  margin-top: var(--space-3);
}

.next-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--accent);
  color: white;
  transition: all var(--duration-fast) var(--ease-out);
}

.next-btn:hover { background: var(--accent-hover); }

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
.stat-lbl { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: var(--space-1); }

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

.empty-state { text-align: center; padding: var(--space-20) var(--space-8); color: var(--text-secondary); }

@media (max-width: 768px) {
  .spell-card { padding: var(--space-5); }
  .letter-box { width: 28px; height: 36px; font-size: var(--text-base); }
}
</style>
