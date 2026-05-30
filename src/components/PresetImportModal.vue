<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useToast } from '@/composables/useToast'
import type { Word } from '@/types/vocab'
import type { PresetBook } from '@/data/presets'

const props = defineProps<{
  preset: PresetBook
  visible: boolean
  alreadyImported: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const vocabStore = useVocabStore()
const { show: showToast } = useToast()

const stage = ref<'browse' | 'confirm' | 'importing' | 'done'>('browse')
const searchQuery = ref('')
const selectedIndices = ref<Set<number>>(new Set())
const expandedIndices = ref<Set<number>>(new Set())
const progress = ref({ current: 0, total: 0 })

watch(() => props.visible, (vis) => {
  if (vis) {
    selectedIndices.value = new Set(props.preset.words.map((_, i) => i))
    expandedIndices.value = new Set()
    stage.value = 'browse'
    searchQuery.value = ''
    progress.value = { current: 0, total: 0 }
  }
})

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.preset.words.map((w, i) => ({ word: w, idx: i }))
  return props.preset.words
    .map((w, i) => ({ word: w, idx: i }))
    .filter(({ word }) =>
      word.word.toLowerCase().includes(q) ||
      word.definitions[0]?.meaning?.includes(q) ||
      word.phonetic.toLowerCase().includes(q)
    )
})

const selectedCount = computed(() => selectedIndices.value.size)
const totalCount = computed(() => props.preset.words.length)
const allSelected = computed(() => selectedCount.value === totalCount.value && totalCount.value > 0)

function toggleWord(idx: number) {
  const s = new Set(selectedIndices.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  selectedIndices.value = s
}

function toggleExpand(idx: number) {
  const s = new Set(expandedIndices.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expandedIndices.value = s
}

function selectAll() { selectedIndices.value = new Set(props.preset.words.map((_, i) => i)) }
function deselectAll() { selectedIndices.value = new Set() }

function showConfirm() {
  if (selectedCount.value === 0) return
  stage.value = 'confirm'
}

function cancelConfirm() { stage.value = 'browse' }

async function startImport() {
  stage.value = 'importing'
  const selected = props.preset.words.filter((_, i) => selectedIndices.value.has(i))
  progress.value = { current: 0, total: selected.length }

  try {
    await vocabStore.importPresetBook(
      { ...props.preset.book },
      selected,
      {
        onProgress: (current, total) => {
          progress.value = { current, total }
        },
      }
    )
    stage.value = 'done'
    showToast('导入完成', `「${props.preset.book.name}」( ${selected.length}词 )`, '📥', '#10B981')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '导入失败'
    showToast('导入失败', msg, '❌', '#EF4444')
    stage.value = 'browse'
  }
}

function close() { emit('close') }
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <div class="preset-import-modal">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title">
            <span class="modal-icon">{{ preset.book.icon }}</span>
            <div>
              <h3>{{ preset.book.name }}</h3>
              <p>{{ preset.book.description }}</p>
            </div>
          </div>
          <div class="header-right">
            <span v-if="alreadyImported" class="imported-badge">已导入</span>
            <button class="close-btn" @click="close">&times;</button>
          </div>
        </div>

        <!-- Toolbar (browse mode only, not already imported) -->
        <div v-if="stage === 'browse' && !alreadyImported" class="modal-toolbar">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索单词、释义、音标..."
          />
          <div class="toolbar-actions">
            <button class="tool-btn" @click="selectAll">全选</button>
            <button class="tool-btn" @click="deselectAll">取消全选</button>
            <span class="count-badge">{{ selectedCount }} / {{ totalCount }} 已选</span>
          </div>
        </div>

        <!-- Word list -->
        <div class="modal-word-list">
          <div
            v-for="{ word, idx } in filtered"
            :key="word.id || idx"
            class="word-item"
            :class="{ expanded: expandedIndices.has(idx) }"
          >
            <div class="word-row" @click="!alreadyImported ? toggleWord(idx) : toggleExpand(idx)">
              <input
                v-if="!alreadyImported"
                type="checkbox"
                :checked="selectedIndices.has(idx)"
                class="word-checkbox"
                @click.stop
                @change="toggleWord(idx)"
              />
              <div class="word-main">
                <span class="word-text">{{ word.word }}</span>
                <span class="word-phonetic">{{ word.phonetic || '-' }}</span>
                <span class="word-def">{{ word.definitions[0]?.meaning || word.synonyms?.join(', ') || '-' }}</span>
              </div>
              <button class="expand-btn" @click.stop="toggleExpand(idx)">
                {{ expandedIndices.has(idx) ? '▾' : '▸' }}
              </button>
            </div>
            <!-- Expanded details -->
            <div v-if="expandedIndices.has(idx)" class="word-detail">
              <div class="detail-row" v-if="word.definitions.length > 1">
                <span class="detail-label">全部释义</span>
                <span>{{ word.definitions.map((d) => `${d.pos}. ${d.meaning}`).join('；') }}</span>
              </div>
              <div class="detail-row" v-if="word.examples[0]">
                <span class="detail-label">例句</span>
                <span>{{ word.examples[0].en }}</span>
              </div>
              <div class="detail-row" v-if="word.examples[0]?.cn">
                <span class="detail-label">例句翻译</span>
                <span>{{ word.examples[0].cn }}</span>
              </div>
              <div class="detail-row" v-if="word.etymology">
                <span class="detail-label">词源</span>
                <span>{{ word.etymology }}</span>
              </div>
              <div class="detail-row" v-if="word.synonyms?.length">
                <span class="detail-label">同义词</span>
                <span>{{ word.synonyms.join(', ') }}</span>
              </div>
              <div class="detail-row" v-if="word.tags?.length">
                <span class="detail-label">标签</span>
                <span>{{ word.tags.join(', ') }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">难度</span>
                <span>{{ '★'.repeat(word.difficulty) }}{{ '☆'.repeat(5 - word.difficulty) }}</span>
              </div>
            </div>
          </div>
          <div v-if="filtered.length === 0" class="empty-list">
            <p>未找到匹配的单词</p>
          </div>
        </div>

        <!-- Confirm panel -->
        <div v-if="stage === 'confirm'" class="confirm-panel">
          <p>确认导入 <strong>{{ selectedCount }}</strong> 个单词到词库「{{ preset.book.name }}」？</p>
          <div class="confirm-actions">
            <button class="cancel-btn" @click="cancelConfirm">取消</button>
            <button class="confirm-btn" @click="startImport">确认导入</button>
          </div>
        </div>

        <!-- Import progress -->
        <div v-if="stage === 'importing'" class="import-progress-section">
          <div class="progress-bar-wrapper">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progress.total ? (progress.current / progress.total * 100) + '%' : '0%' }"
              />
            </div>
          </div>
          <p class="progress-text">正在导入... {{ progress.current }} / {{ progress.total }}</p>
        </div>

        <!-- Done -->
        <div v-if="stage === 'done'" class="done-panel">
          <p>成功导入 <strong>{{ progress.total }}</strong> 个单词！</p>
          <button class="done-btn" @click="close">关闭</button>
        </div>

        <!-- Footer (browse mode) -->
        <div v-if="stage === 'browse'" class="modal-footer">
          <button class="cancel-btn" @click="close">取消</button>
          <button
            v-if="!alreadyImported"
            class="import-btn"
            :disabled="selectedCount === 0"
            @click="showConfirm"
          >
            确认导入（{{ selectedCount }}）
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.preset-import-modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  animation: modalIn 0.2s var(--ease-out);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96) translateY(16px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title { display: flex; gap: var(--space-4); align-items: flex-start; }
.modal-icon { font-size: 2rem; flex-shrink: 0; }
.modal-title h3 { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-1); }
.modal-title p { font-size: var(--text-sm); color: var(--text-secondary); margin: 0; }

.header-right { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
.imported-badge {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: #D1FAE5;
  color: #059669;
  font-weight: 500;
}
.close-btn {
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xl);
  color: var(--text-tertiary);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}
.close-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }

.modal-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 160px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: white;
  color: var(--text-primary);
}
.search-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 2px var(--accent-light); }
.toolbar-actions { display: flex; align-items: center; gap: var(--space-2); }
.tool-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}
.tool-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.count-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent);
  margin-left: var(--space-2);
  white-space: nowrap;
}

.modal-word-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.word-item { border-bottom: 1px solid var(--border); }
.word-item:last-child { border-bottom: none; }
.word-item.expanded { background: var(--bg-secondary); }

.word-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-6);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.word-row:hover { background: var(--bg-secondary); }

.word-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); flex-shrink: 0; }

.word-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.word-text {
  font-family: var(--font-serif);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}
.word-phonetic {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.word-def {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expand-btn {
  flex-shrink: 0;
  width: 24px; height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  display: flex; align-items: center; justify-content: center;
}
.expand-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

.word-detail {
  padding: var(--space-3) var(--space-6) var(--space-4);
  padding-left: calc(var(--space-6) + 28px);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-top: 1px solid var(--border);
}
.detail-row { display: flex; gap: var(--space-2); font-size: var(--text-xs); }
.detail-label { color: var(--text-tertiary); flex-shrink: 0; min-width: 60px; }
.detail-row span:last-child { color: var(--text-secondary); }

.empty-list { padding: var(--space-10); text-align: center; color: var(--text-tertiary); font-size: var(--text-sm); }

.confirm-panel {
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--border);
  text-align: center;
}
.confirm-panel p { font-size: var(--text-sm); color: var(--text-primary); margin: 0 0 var(--space-4); }
.confirm-actions { display: flex; justify-content: center; gap: var(--space-4); }

.import-progress-section {
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--border);
  text-align: center;
}
.progress-bar-wrapper { width: 100%; margin-bottom: var(--space-3); }
.progress-bar {
  width: 100%; height: 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #818CF8);
  border-radius: var(--radius-full);
  transition: width 0.2s var(--ease-out);
}
.progress-text { font-size: var(--text-sm); color: var(--text-secondary); margin: 0; }

.done-panel {
  padding: var(--space-6);
  border-top: 1px solid var(--border);
  text-align: center;
}
.done-panel p { font-size: var(--text-base); color: var(--text-primary); margin: 0 0 var(--space-4); font-weight: 500; }
.done-btn {
  padding: var(--space-2) var(--space-8);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: white;
  font-size: var(--text-sm);
  font-weight: 600;
}
.done-btn:hover { background: var(--accent-hover); }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.cancel-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}
.cancel-btn:hover { background: var(--bg-tertiary); }

.confirm-btn, .import-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: white;
  background: var(--accent);
  transition: all var(--duration-fast) var(--ease-out);
}
.confirm-btn:hover:not(:disabled), .import-btn:hover:not(:disabled) { background: var(--accent-hover); }
.import-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .preset-import-modal { max-height: 92vh; border-radius: var(--radius-lg); }
  .modal-header { padding: var(--space-4); }
  .word-row { padding: var(--space-2) var(--space-4); }
  .word-detail { padding-left: calc(var(--space-4) + 28px); padding-right: var(--space-4); }
  .modal-toolbar { padding: var(--space-3) var(--space-4); flex-direction: column; }
  .modal-footer { padding: var(--space-3) var(--space-4); }
}
</style>
