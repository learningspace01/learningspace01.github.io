<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Word } from '@/types/vocab'
import { Volume2 } from 'lucide-vue-next'

const props = defineProps<{
  word: Word
}>()

const emit = defineEmits<{
  flip: [flipped: boolean]
}>()

const flipped = ref(false)

const frontContent = computed(() => ({
  word: props.word.word,
  phonetic: props.word.phonetic,
}))

const backContent = computed(() => ({
  definitions: props.word.definitions,
}))

function toggleFlip() {
  flipped.value = !flipped.value
  emit('flip', flipped.value)
}

function playAudio() {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(props.word.word)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }
}

function resetFlip() {
  flipped.value = false
}

defineExpose({ resetFlip, toggleFlip })
</script>

<template>
  <div class="flashcard-container">
    <div
      class="flashcard"
      :class="{ flipped }"
      @click="toggleFlip"
    >
      <!-- Front -->
      <div class="flashcard-face front">
        <div class="word-section">
          <h2 class="word">{{ frontContent.word }}</h2>
          <p class="phonetic">{{ frontContent.phonetic }}</p>
        </div>
        <button class="audio-btn" @click.stop="playAudio">
          <Volume2 :size="20" />
          <span>播放发音</span>
        </button>
        <p class="flip-hint">点击翻转查看释义</p>
      </div>

      <!-- Back -->
      <div class="flashcard-face back">
        <div class="back-content">
          <div class="word-section-mini">
            <h3 class="word-mini">{{ word.word }}</h3>
            <p class="phonetic-mini">{{ word.phonetic }}</p>
          </div>
          <div class="divider" />
          <div class="definitions">
            <div
              v-for="(def, i) in backContent.definitions"
              :key="i"
              class="definition-item"
            >
              <span class="pos">{{ def.pos }}.</span>
              <span class="meaning">{{ def.meaning }}</span>
            </div>
          </div>

          <!-- Examples -->
          <div v-if="word.examples.length" class="back-section">
            <span class="back-section-label">例句</span>
            <div v-for="(ex, i) in word.examples" :key="i" class="example-item">
              <p class="ex-en">{{ ex.en }}</p>
              <p v-if="ex.cn" class="ex-cn">{{ ex.cn }}</p>
            </div>
          </div>

          <!-- Synonyms -->
          <div v-if="word.synonyms?.length" class="back-section">
            <span class="back-section-label">同义词</span>
            <div class="synonym-tags">
              <span v-for="syn in word.synonyms" :key="syn" class="synonym-tag">{{ syn }}</span>
            </div>
          </div>

          <!-- Etymology + Mnemonic -->
          <div v-if="word.etymology || word.mnemonic" class="chips-row">
            <div v-if="word.etymology" class="chip">
              <span class="chip-label">词根</span>
              <span class="chip-text">{{ word.etymology }}</span>
            </div>
            <div v-if="word.mnemonic" class="chip">
              <span class="chip-label">助记</span>
              <span class="chip-text">{{ word.mnemonic }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flashcard-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  perspective: 1000px;
  max-width: 520px;
  width: 100%;
}

.flashcard {
  width: 100%;
  min-height: 360px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s var(--ease-out);
  cursor: pointer;
}

.flashcard.flipped {
  transform: rotateY(180deg);
}

.flashcard-face {
  backface-visibility: hidden;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-6);
}

.front {
  position: absolute;
  inset: 0;
  justify-content: center;
  z-index: 2;
  padding: var(--space-10) var(--space-6);
}

.back {
  position: relative;
  transform: rotateY(180deg);
  justify-content: flex-start;
  padding: var(--space-5) var(--space-6);
}

.back-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.word-section {
  text-align: center;
  margin-bottom: var(--space-4);
}

.word {
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.phonetic {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.audio-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  background: var(--accent-light);
  color: var(--accent);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  margin-bottom: var(--space-5);
  transition: all var(--duration-fast) var(--ease-out);
}

.audio-btn:hover {
  background: var(--accent);
  color: white;
}

.flip-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* Back side */
.word-section-mini {
  text-align: center;
  margin-bottom: var(--space-1);
}

.word-mini {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
}

.phonetic-mini {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.divider {
  width: 28px;
  height: 1.5px;
  background: var(--accent);
  border-radius: 1px;
  margin: var(--space-1) auto;
  opacity: 0.4;
}

.definitions {
  text-align: center;
  margin-bottom: var(--space-1);
}

.definition-item {
  margin-bottom: var(--space-1);
}

.pos {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--accent);
  font-weight: 500;
  margin-right: var(--space-1);
}

.meaning {
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: var(--leading-normal);
}

/* Back extras */
.back-section {
  width: 100%;
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border);
}

.back-section-label {
  display: block;
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.example-item {
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent);
  margin-bottom: var(--space-1);
}

.ex-en {
  font-family: var(--font-en);
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--text-secondary);
  margin-bottom: 1px;
}

.ex-cn {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.synonym-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.synonym-tag {
  padding: 1px var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border);
  width: 100%;
}

.chip {
  display: inline-flex;
  gap: var(--space-1);
  padding: 1px var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.chip-label {
  font-weight: 600;
  color: var(--text-primary);
}


@media (max-width: 768px) {
  .flashcard {
    min-height: 45vh;
  }

  .flashcard-face {
    padding: var(--space-5) var(--space-4);
    border-radius: var(--radius-lg);
  }

  .word {
    font-size: 2rem;
  }

}
</style>