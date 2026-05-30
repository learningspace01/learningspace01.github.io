<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useToast } from '@/composables/useToast'
import { useWordEnricher } from '@/composables/useWordEnricher'
import type { EnrichedWordData } from '@/composables/useWordEnricher'
import type { Word, WordBook } from '@/types/vocab'
import * as XLSX from 'xlsx'

defineEmits<{ switchTab: [tabId: string] }>()

const props = defineProps<{
  initialMode?: 'manual' | 'batch'
}>()

const vocabStore = useVocabStore()
const { show: showToast } = useToast()

const importMode = ref<'manual' | 'batch'>(props.initialMode || 'manual')

// --- Word Enricher ---
const { enrichWord, enrichBatch, loading: enrichLoading, progress: enrichProgress } = useWordEnricher()
const isEnriching = ref(false)
const manualEnriched = ref<EnrichedWordData | null>(null)

async function onSmartParse() {
  const word = form.value.word.trim()
  if (!word) return
  isEnriching.value = true
  try {
    const e = await enrichWord(word)
    if (!e) return
    manualEnriched.value = e
    // Fill ALL fields (overwrite with fresh enriched data)
    form.value.phonetic = e.phonetic || form.value.phonetic
    form.value.partOfSpeech = e.partOfSpeech[0] || form.value.partOfSpeech

    // Chinese translation first, then English definitions
    const defParts: string[] = []
    if (e.definitionsCn) defParts.push(e.definitionsCn)
    if (e.definitions.length) {
      defParts.push(e.definitions.map((d) => `${d.pos}. ${d.meaning}`).join('; '))
    }
    form.value.definitions = defParts.join(' | ') || form.value.definitions

    // Examples with Chinese
    if (e.examples[0]) {
      form.value.example = e.examples[0].en
      form.value.exampleCn = e.examples[0].cn || form.value.exampleCn
    }

    // Etymology
    if (e.etymology) {
      form.value.etymology = e.etymology
    }

    // Auto-tags (merge with any user-entered)
    const existingTags = form.value.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const mergedTags = [...new Set([...existingTags, ...e.tags])]
    form.value.tags = mergedTags.join(', ')

    // Difficulty
    form.value.difficulty = e.difficulty
  } finally {
    isEnriching.value = false
  }
}

// --- New book creation ---
const showNewBookForm = ref(false)
const newBookName = ref('')
const newBookNameRef = ref<HTMLInputElement | null>(null)

watch(showNewBookForm, (val) => {
  if (val) {
    nextTick(() => newBookNameRef.value?.focus())
  }
})

function createBook() {
  if (!newBookName.value.trim()) return
  const name = newBookName.value.trim()
  const id = `book_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  vocabStore.addWordBook({
    id, name, description: '', icon: '📚',
    wordCount: 0, learnedCount: 0, masteredCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    tags: [], isPreset: false, sortOrder: 0,
  })
  form.value.bookId = id
  batchBookId.value = id
  newBookName.value = ''
  showNewBookForm.value = false
  showToast('词库已创建', `「${name}」已创建并自动选中`, '✅', '#10B981')
}

function cancelNewBook() {
  showNewBookForm.value = false
  newBookName.value = ''
}

// --- Manual form ---
const form = ref({
  word: '', phonetic: '', definitions: '', partOfSpeech: 'n',
  example: '', exampleCn: '', etymology: '', mnemonic: '',
  tags: '', bookId: vocabStore.currentBookId || '', difficulty: 3,
})
const saved = ref(false)

function resetForm() {
  form.value = {
    word: '', phonetic: '', definitions: '', partOfSpeech: 'n',
    example: '', exampleCn: '', etymology: '', mnemonic: '',
    tags: '', bookId: vocabStore.currentBookId || '', difficulty: 3,
  }
  saved.value = false
  manualEnriched.value = null
}

function saveWord() {
  if (!form.value.word.trim() || !form.value.definitions.trim()) return
  if (!form.value.bookId && vocabStore.wordBooks.length > 0) {
    form.value.bookId = vocabStore.wordBooks[0].id
  }
  if (!form.value.bookId) return
  vocabStore.addWord(buildWord(form.value.word.trim(), form.value.definitions.trim(), '', '', '', manualEnriched.value || undefined))
  saved.value = true
}

function saveAndContinue() {
  saveWord()
  if (saved.value) resetForm()
}

function buildWord(word: string, definition: string, phonetic = '', example = '', exampleCn = '', enriched?: EnrichedWordData): Word {
  const now = new Date().toISOString()
  const defPos = enriched?.partOfSpeech?.[0] || form.value.partOfSpeech
  return {
    id: `word_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    bookId: form.value.bookId || vocabStore.wordBooks[0]?.id || '',
    word,
    phonetic: phonetic || enriched?.phonetic || form.value.phonetic.trim(),
    partOfSpeech: enriched?.partOfSpeech?.length ? enriched.partOfSpeech : [form.value.partOfSpeech],
    definitions: enriched?.definitionsCn
      ? [{ pos: '中译', meaning: enriched.definitionsCn }]
      : enriched?.definitions?.length
        ? enriched.definitions
        : [{ pos: defPos, meaning: definition }],
    examples: enriched?.examples?.length
      ? enriched.examples
      : (example || form.value.example.trim())
        ? [{ en: example || form.value.example.trim(), cn: exampleCn || form.value.exampleCn.trim() }]
        : [],
    etymology: enriched?.etymology || form.value.etymology.trim(),
    mnemonic: form.value.mnemonic.trim(),
    synonyms: enriched?.synonyms || [],
    antonyms: enriched?.antonyms || [],
    relatedWords: [],
    tags: enriched?.tags?.length
      ? enriched.tags
      : form.value.tags.split(',').map((t) => t.trim()).filter((t) => t),
    notes: '', difficulty: enriched?.difficulty || form.value.difficulty,
    srs: { easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: null, lastReview: null, status: 'new', totalReviews: 0, correctCount: 0, wrongCount: 0, avgResponseTime: 0, history: [] },
    createdAt: now, updatedAt: now,
  }
}

// --- Batch import ---
const batchText = ref('')
const batchPreview = ref<{ word: string; definition: string; phonetic?: string; example?: string; exampleCn?: string; error?: string }[]>([])
const batchParsed = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const batchBookId = ref(vocabStore.currentBookId || vocabStore.wordBooks[0]?.id || '')

function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

      if (rows.length === 0) return

      // Auto-detect column mapping
      const headers = Object.keys(rows[0])
      const colMap = {
        word: headers.find((h) => /word|单词|词汇|英文/i.test(h)) || headers[0],
        phonetic: headers.find((h) => /phonetic|音标|发音/i.test(h)) || '',
        definition: headers.find((h) => /def|释义|定义|中文|解释|meaning/i.test(h)) || headers[1] || '',
      }

      const results = rows.map((row) => ({
        word: (row[colMap.word] || '').toString().trim(),
        phonetic: colMap.phonetic ? (row[colMap.phonetic] || '').toString().trim() : '',
        definition: colMap.definition ? (row[colMap.definition] || '').toString().trim() : '',
      }))

      batchPreview.value = results
      batchParsed.value = true
    } catch {
      showToast('解析失败', '无法读取该文件，请确认是有效的 Excel 文件', '❌', '#EF4444')
    }
  }
  reader.readAsArrayBuffer(file)
}

function parseBatch() {
  const text = batchText.value.trim()
  if (!text) return

  batchParsed.value = true
  const results: typeof batchPreview.value = []

  // Try JSON first
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text)
      for (const item of arr) {
        results.push({
          word: item.word || '',
          definition: item.definition || item.meaning || item.definitions?.[0]?.meaning || '',
          phonetic: item.phonetic || item.phonetic || '',
        })
      }
      batchPreview.value = results
      return
    } catch { /* fall through */ }
  }

  const lines = text.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    const trimmed = line.trim()

    // Tab-separated
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t')
      results.push({ word: parts[0]?.trim() || '', phonetic: parts[1]?.trim() || '', definition: parts[2]?.trim() || parts[1]?.trim() || '' })
      continue
    }

    // CSV: word,definition (or just word)
    if (trimmed.includes(',') && !trimmed.startsWith('{')) {
      const parts = trimmed.split(',')
      results.push({ word: parts[0]?.trim() || '', definition: parts[1]?.trim() || '', phonetic: parts[2]?.trim() || '' })
      continue
    }

    // Per-line: just the word
    results.push({ word: trimmed, definition: '' })
  }

  batchPreview.value = results
}

function importBatch() {
  if (!batchPreview.value.length) return
  if (!batchBookId.value && vocabStore.wordBooks.length > 0) {
    batchBookId.value = vocabStore.wordBooks[0].id
  }
  if (!batchBookId.value) {
    showToast('请选择词库', '请先选择或创建一个目标词库', '⚠️', '#F59E0B')
    return
  }
  let count = 0
  for (const item of batchPreview.value) {
    if (!item.word || item.error) continue
    const enriched = batchEnrichedMap.value[item.word]
    const w = buildWord(item.word, item.definition, item.phonetic || '', item.example || '', item.exampleCn || '', enriched)
    w.bookId = batchBookId.value
    w.id = `word_${Date.now()}_${count}_${Math.random().toString(36).slice(2, 5)}`
    vocabStore.addWord(w)
    count++
  }
  showToast('导入完成', `成功导入 ${count} 个单词到目标词库`, '📥', '#10B981')
  batchText.value = ''
  batchPreview.value = []
  batchParsed.value = false
  batchEnrichedMap.value = {}
}

// --- Batch enrich ---
const isEnrichingBatch = ref(false)
const batchEnrichedMap = ref<Record<string, EnrichedWordData>>({})

async function startBatchEnrich() {
  isEnrichingBatch.value = true
  const words = batchPreview.value.map((item) => item.word).filter(Boolean)
  const enriched = await enrichBatch(words)

  for (let i = 0; i < batchPreview.value.length; i++) {
    const item = batchPreview.value[i]
    const e = enriched[i]
    if (!e || !item.word) continue

    batchEnrichedMap.value[item.word] = e

    // Fill preview fields from enriched data
    if (!item.phonetic && e.phonetic) item.phonetic = e.phonetic
    if (!item.definition) {
      const defParts: string[] = []
      if (e.definitionsCn) defParts.push(e.definitionsCn)
      if (e.definitions.length) {
        defParts.push(e.definitions.map((d) => `${d.pos}. ${d.meaning}`).join('; '))
      }
      item.definition = defParts.join(' | ') || item.definition
    }
    if (!item.example && e.examples[0]?.en) {
      item.example = e.examples[0].en
      item.exampleCn = e.examples[0].cn || ''
    }
  }

  isEnrichingBatch.value = false
  const filledCount = enriched.filter((e) => e.phonetic || e.definitions.length).length
  showToast('智能补全完成', `已为 ${filledCount}/${enriched.length} 个单词补全数据`, '🤖', '#4F6EF7')
}

</script>

<template>
  <div class="import-page">
    <!-- Mode tabs -->
    <div class="mode-tabs">
      <button v-for="m in [
        { id: 'manual' as const, label: '手动添加', icon: '✏️' },
        { id: 'batch' as const, label: '批量导入', icon: '📋' },
      ]" :key="m.id" class="mode-btn" :class="{ active: importMode === m.id }" @click="importMode = m.id">
        <span class="mode-icon">{{ m.icon }}</span>
        <span>{{ m.label }}</span>
      </button>
    </div>

    <!-- Usage Guide -->
    <details class="usage-guide">
      <summary class="usage-summary">使用说明</summary>
      <div class="usage-content">
        <div class="usage-section">
          <strong>手动添加</strong>
          <p>输入英文单词后点击「智能解析」按钮，系统自动调用有道词典 API 补全：音标、中英文释义、词性、例句（含中文翻译）、同义词/反义词、难度评级、标签。只需输入单词即可，无需手动填写其他字段。</p>
        </div>
        <div class="usage-section">
          <strong>批量导入</strong>
          <p>支持格式：每行一个单词 | Tab 分隔（单词 音标 释义）| 逗号分隔 | JSON 数组 | Excel (.xlsx/.xls) 文件。粘贴或上传后点击「预览解析」，然后点击「智能补全」自动为所有单词补全释义/例句/音标等数据。</p>
        </div>
        <div class="usage-section">
          <strong>Excel 导入</strong>
          <p>支持上传 .xlsx / .xls 文件，自动识别列名（单词/word、音标/phonetic、释义/definition）。如列名不匹配，请确保第一列是单词。</p>
        </div>
        <div class="usage-section">
          <strong>预设词库（导入到个人词库）</strong>
          <p>「导入」是指将预设词库中的单词<strong>复制</strong>到你的个人词库中。导入后，这些单词会出现在「学习」和「复习」页面，你可以按照艾宾浩斯记忆曲线进行系统化学习。每个预设词库只能导入一次，导入后仍可在预设列表中查看已导入的单词并进行管理。</p>
        </div>
      </div>
    </details>

    <!-- Manual Add Form -->
    <div v-if="importMode === 'manual'" class="manual-form">
      <div class="form-row">
        <div class="form-group col-span">
          <label>单词 <span class="required">*</span></label>
          <div class="word-input-wrapper">
            <input v-model="form.word" type="text" placeholder="elaborate" autocomplete="off" />
            <button
              class="smart-parse-btn"
              :disabled="!form.word.trim() || isEnriching"
              @click="onSmartParse"
            >
              <span v-if="isEnriching" class="fetch-spinner">⏳ 解析中...</span>
              <span v-else>🔍 智能解析</span>
            </button>
          </div>
        </div>
        <div class="form-group col-span">
          <label>音标</label>
          <input v-model="form.phonetic" type="text" placeholder="ɪˈlæb.ər.ət" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group col-span">
          <label>释义 <span class="required">*</span></label>
          <input v-model="form.definitions" type="text" placeholder="adj. 精心制作的；v. 详细阐述" />
        </div>
        <div class="form-group col-span">
          <label>词性</label>
          <select v-model="form.partOfSpeech">
            <option value="n">名词 / n.</option>
            <option value="v">动词 / v.</option>
            <option value="adj">形容词 / adj.</option>
            <option value="adv">副词 / adv.</option>
            <option value="prep">介词 / prep.</option>
            <option value="conj">连词 / conj.</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group col-span">
          <label>例句</label>
          <input v-model="form.example" type="text" placeholder="He elaborated on his theory." />
        </div>
        <div class="form-group col-span">
          <label>例句翻译</label>
          <input v-model="form.exampleCn" type="text" placeholder="他详细阐述了他的理论。" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group col-span">
          <label>词根词缀</label>
          <input v-model="form.etymology" type="text" placeholder="e-(出) + labor(劳动) + -ate" />
        </div>
        <div class="form-group col-span">
          <label>助记</label>
          <input v-model="form.mnemonic" type="text" placeholder="付出劳动去做出来 → 精心制作" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group col-span">
          <label>标签</label>
          <input v-model="form.tags" type="text" placeholder="#四级 #高频" />
        </div>
        <div class="form-group col-span">
          <label>所属词库</label>
          <div class="batch-book-select">
            <select v-model="form.bookId" class="book-select">
              <option disabled value="">选择词库</option>
              <option v-for="book in vocabStore.wordBooks" :key="book.id" :value="book.id">{{ book.icon }} {{ book.name }}</option>
            </select>
            <button class="new-book-btn" @click="showNewBookForm = true" title="新建词库">+</button>
          </div>
          <div v-if="showNewBookForm" class="new-book-inline">
            <input ref="newBookNameRef" v-model="newBookName" type="text" lang="zh-CN" placeholder="输入词库名称" autocomplete="off" spellcheck="false" @keyup.enter="createBook" />
            <button class="confirm-book-btn" @click="createBook" :disabled="!newBookName.trim()">确认</button>
            <button class="cancel-book-btn" @click="cancelNewBook">取消</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>难度</label>
        <div class="difficulty-selector">
          <button v-for="star in 5" :key="star" class="star-btn" :class="{ filled: star <= form.difficulty }" @click="form.difficulty = star">
            {{ star <= form.difficulty ? '★' : '☆' }}
          </button>
        </div>
      </div>
      <div class="form-actions">
        <button class="cancel-btn" @click="resetForm">取消</button>
        <button v-if="!saved" class="save-btn primary" @click="saveWord" :disabled="!form.word || !form.definitions">保存</button>
        <button v-if="!saved" class="save-btn primary outline" @click="saveAndContinue" :disabled="!form.word || !form.definitions">保存并继续</button>
        <span v-if="saved" class="success-msg">已保存!</span>
      </div>
    </div>

    <!-- Batch Import -->
    <div v-else-if="importMode === 'batch'" class="batch-section">
      <div class="batch-formats">
        <p class="format-hint">支持格式：每行一个单词 | Tab/逗号分隔 | JSON数组 | CSV | Excel (.xlsx)</p>
      </div>
      <div class="file-upload">
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" @change="handleFileUpload" class="file-input-hidden" />
        <button class="file-upload-btn" @click="fileInput?.click()">📎 上传 Excel / CSV 文件</button>
      </div>
      <div class="batch-book-select">
        <label class="batch-select-label">导入词库：</label>
        <select v-model="batchBookId" class="book-select">
          <option disabled value="">选择词库</option>
          <option v-for="book in vocabStore.wordBooks" :key="book.id" :value="book.id">{{ book.icon }} {{ book.name }}</option>
        </select>
        <button class="new-book-btn" @click="showNewBookForm = true" title="新建词库">+</button>
      </div>
      <div v-if="showNewBookForm" class="new-book-inline">
        <input ref="newBookNameRef" v-model="newBookName" type="text" lang="zh-CN" placeholder="输入词库名称" autocomplete="off" spellcheck="false" @keyup.enter="createBook" />
        <button class="confirm-book-btn" @click="createBook" :disabled="!newBookName.trim()">确认</button>
        <button class="cancel-book-btn" @click="cancelNewBook">取消</button>
      </div>
      <textarea
        v-model="batchText"
        class="batch-textarea"
        rows="10"
        placeholder="粘贴单词数据...
例如:
elaborate  ɪˈlæb.ər.ət  adj. 精心制作的
sophisticated  səˈfɪs.tɪ.keɪ.tɪd  adj. 精密的；老练的
ubiquitous  juːˈbɪk.wɪ.təs  adj. 无处不在的"
      />
      <div class="batch-actions">
        <button class="parse-btn" @click="parseBatch" :disabled="!batchText.trim()">预览解析</button>
      </div>

      <!-- Preview Table -->
      <div v-if="batchParsed && batchPreview.length" class="batch-preview">
        <h4>预览 ({{ batchPreview.length }} 条)</h4>
        <div class="preview-table">
          <div class="preview-header">
            <span class="col-word">单词</span>
            <span class="col-phonetic">音标</span>
            <span class="col-def">释义</span>
            <span class="col-example">例句</span>
          </div>
          <div v-for="(item, i) in batchPreview.slice(0, 20)" :key="i" class="preview-row" :class="{ error: item.error }">
            <span class="col-word">{{ item.word || '(空)' }}</span>
            <span class="col-phonetic">{{ item.phonetic || '-' }}</span>
            <span class="col-def">{{ item.definition || '(需手动补充)' }}</span>
            <span class="col-example">{{ item.example || '-' }}</span>
          </div>
          <p v-if="batchPreview.length > 20" class="more-hint">... 还有 {{ batchPreview.length - 20 }} 条</p>
        </div>
        <!-- Batch enrich -->
        <div v-if="batchParsed && batchPreview.length" class="batch-enrich-section">
          <button
            class="enrich-btn"
            :disabled="isEnrichingBatch"
            @click="startBatchEnrich"
          >
            {{ isEnrichingBatch ? `🤖 智能补全中... ${enrichProgress.word} (${enrichProgress.current}/${enrichProgress.total})` : '🤖 智能补全释义/例句/音标' }}
          </button>
          <div v-if="isEnrichingBatch" class="enrich-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: (enrichProgress.current / enrichProgress.total * 100) + '%' }"
              />
            </div>
            <span class="progress-text">{{ enrichProgress.current }} / {{ enrichProgress.total }}</span>
          </div>
        </div>
        <button class="import-btn primary" @click="importBatch">确认导入 {{ batchPreview.length }} 个单词</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.import-page { animation: fadeInUp 0.3s var(--ease-out); }

.mode-tabs {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: white;
  border: 1px solid var(--border);
  transition: all var(--duration-fast) var(--ease-out);
}

.mode-btn:hover { border-color: var(--accent); color: var(--accent); }
.mode-btn.active { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
.mode-icon { font-size: var(--text-lg); }

.manual-form { max-width: 640px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-2); }
.form-group input, .form-group select { width: 100%; }
.required { color: var(--danger); }

.difficulty-selector { display: flex; gap: var(--space-2); }
.star-btn { font-size: 1.5rem; color: var(--border); padding: 0; transition: color var(--duration-fast) var(--ease-out); }
.star-btn.filled { color: var(--warning); }
.star-btn:hover { color: var(--warning); }

.form-actions { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-6); }
.cancel-btn { padding: var(--space-3) var(--space-5); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); background: var(--bg-secondary); }
.cancel-btn:hover { background: var(--bg-tertiary); }
.save-btn { padding: var(--space-3) var(--space-6); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; }
.save-btn.primary { background: var(--accent); color: white; }
.save-btn.primary:hover:not(:disabled) { background: var(--accent-hover); }
.save-btn.primary.outline { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
.save-btn.primary.outline:hover:not(:disabled) { background: var(--accent-light); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.success-msg { font-size: var(--text-base); color: var(--success); font-weight: 500; }

/* Batch */
.batch-section { max-width: 640px; }
.format-hint { font-size: var(--text-sm); color: var(--text-tertiary); margin-bottom: var(--space-4); }

.batch-textarea {
  width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  resize: vertical;
  background: white;
  color: var(--text-primary);
}

.batch-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); outline: none; }

.batch-actions { margin-top: var(--space-4); margin-bottom: var(--space-4); }
.parse-btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); background: var(--accent-light); color: var(--accent); font-size: var(--text-sm); font-weight: 500; }
.parse-btn:hover:not(:disabled) { background: var(--accent); color: white; }
.parse-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Word input with smart parse button */
.word-input-wrapper { position: relative; display: flex; gap: var(--space-2); }
.word-input-wrapper input { flex: 1; }
.smart-parse-btn {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}
.smart-parse-btn:hover:not(:disabled) { background: var(--accent-hover); }
.smart-parse-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fetch-spinner { font-size: var(--text-xs); }

/* Usage guide */
.usage-guide {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}
.usage-summary {
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  user-select: none;
}
.usage-summary:hover { color: var(--accent); }
.usage-content { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); }
.usage-section strong { font-size: var(--text-sm); color: var(--text-primary); display: block; margin-bottom: var(--space-1); }
.usage-section p { font-size: var(--text-xs); color: var(--text-tertiary); margin: 0; line-height: 1.6; }

/* Batch enrich */
.batch-enrich-section { margin: var(--space-4) 0; }
.enrich-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--accent-light), #EDE9FE);
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: 500;
  border: 1px solid var(--accent);
  transition: all var(--duration-fast) var(--ease-out);
  width: 100%;
}
.enrich-btn:hover:not(:disabled) { background: var(--accent); color: white; }
.enrich-btn:disabled { opacity: 0.7; cursor: wait; }

.enrich-progress { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-3); }
.progress-bar { flex: 1; height: 6px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #818CF8); border-radius: var(--radius-full); transition: width var(--duration-normal) var(--ease-out); }
.progress-text { font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap; }

/* Book selector with new button */
.new-book-btn {
  width: 36px; height: 36px;
  border-radius: var(--radius-sm);
  background: var(--accent-light);
  color: var(--accent);
  font-size: var(--text-xl);
  font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.new-book-btn:hover { background: var(--accent); color: white; }

/* New book inline form */
.new-book-inline {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  align-items: center;
}
.new-book-inline input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.new-book-inline input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}
.confirm-book-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: background var(--duration-fast) var(--ease-out);
}
.confirm-book-btn:hover:not(:disabled) { background: var(--accent-hover); }
.confirm-book-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cancel-book-btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}
.cancel-book-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }

/* Batch book selector */
.batch-book-select {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.batch-select-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}
.batch-book-select select { flex: 1; }

/* File upload */
.file-input-hidden { display: none; }
.file-upload { margin-bottom: var(--space-3); }
.file-upload-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  border: 1px dashed var(--border);
  width: 100%;
  transition: all var(--duration-fast) var(--ease-out);
}
.file-upload-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

.batch-preview { margin-top: var(--space-4); }
.batch-preview h4 { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3); }

.preview-table { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; margin-bottom: var(--space-4); }
.preview-header, .preview-row { display: grid; grid-template-columns: 1fr 0.8fr 1.5fr 1.5fr; gap: var(--space-2); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); }
.preview-header { background: var(--bg-secondary); font-weight: 600; color: var(--text-secondary); }
.preview-row { border-bottom: 1px solid var(--border); color: var(--text-primary); }
.preview-row:last-child { border-bottom: none; }
.preview-row.error { background: #FEF2F2; color: var(--danger); }
.col-word { font-family: var(--font-serif); }
.col-phonetic { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); }
.col-example { font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.more-hint { font-size: var(--text-xs); color: var(--text-tertiary); padding: var(--space-2) var(--space-3); }

.import-btn.primary {
  display: inline-flex;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: white;
  font-size: var(--text-base);
  font-weight: 600;
}

.import-btn.primary:hover { background: var(--accent-hover); }

.placeholder-block { text-align: center; padding: var(--space-16) var(--space-8); }
.placeholder-icon { font-size: 3rem; margin-bottom: var(--space-4); }
.placeholder-block h3 { font-size: var(--text-xl); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3); }
.placeholder-block p { color: var(--text-secondary); }
.placeholder-block .sub { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: var(--space-4); }

/* Preset grid */
/* Preset CSS removed — moved to SettingsView */

@media (max-width: 768px) {
  .form-row { grid-template-columns: 1fr; }
  .mode-tabs { flex-direction: column; }
  .preview-header, .preview-row { grid-template-columns: 1fr 1fr 1.5fr 1fr; font-size: var(--text-xs); }
}
</style>
