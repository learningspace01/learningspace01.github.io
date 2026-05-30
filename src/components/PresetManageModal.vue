<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useToast } from '@/composables/useToast'
import type { Word } from '@/types/vocab'

const props = defineProps<{
  presetBookId: string
  bookName: string
  bookIcon: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const vocabStore = useVocabStore()
const { show: showToast } = useToast()

const searchQuery = ref('')
const expandedIndices = ref<Set<number>>(new Set())
const editingIndex = ref<number | null>(null)
const editForm = ref({ exampleEn: '', exampleCn: '', notes: '' })
const deleteConfirm = ref<number | null>(null)

watch(() => props.visible, (vis) => {
  if (vis) {
    searchQuery.value = ''
    expandedIndices.value = new Set()
    editingIndex.value = null
    deleteConfirm.value = null
  }
})

const importedWords = computed(() => {
  return vocabStore.words.filter((w) => w.bookId === props.presetBookId)
})

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return importedWords.value.map((w, i) => ({ word: w, idx: i }))
  return importedWords.value
    .map((w, i) => ({ word: w, idx: i }))
    .filter(
      ({ word }) =>
        word.word.toLowerCase().includes(q) ||
        word.definitions[0]?.meaning?.includes(q) ||
        word.phonetic.toLowerCase().includes(q)
    )
})

function toggleExpand(idx: number) {
  const s = new Set(expandedIndices.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  expandedIndices.value = s
  editingIndex.value = null
  deleteConfirm.value = null
}

function startEdit(idx: number, word: Word) {
  editingIndex.value = idx
  editForm.value = {
    exampleEn: word.examples[0]?.en || '',
    exampleCn: word.examples[0]?.cn || '',
    notes: word.notes || '',
  }
}

function cancelEdit() {
  editingIndex.value = null
}

function saveEdit(idx: number, word: Word) {
  vocabStore.updateWord(word.id, {
    examples: editForm.value.exampleEn
      ? [{ en: editForm.value.exampleEn, cn: editForm.value.exampleCn }]
      : word.examples,
    notes: editForm.value.notes,
  })
  editingIndex.value = null
  showToast('已更新', `「${word.word}」修改已保存`, '💾', '#4F6EF7')
}

function confirmDelete(idx: number) {
  deleteConfirm.value = idx
}

function cancelDelete() {
  deleteConfirm.value = null
}

function executeDelete(word: Word) {
  vocabStore.deleteWord(word.id)
  deleteConfirm.value = null
  showToast('已删除', `「${word.word}」已从词库中移除`, '🗑️', '#EF4444')
}

function resetSrs(word: Word) {
  vocabStore.resetBookProgress(word.bookId)

  showToast('已重置', `「${word.word}」的学习进度已重置`, '🔄', '#F59E0B')
}

function close() {
  emit('close')
}

const totalWords = computed(() => importedWords.value.length)
const learnedCount = computed(
  () => importedWords.value.filter((w) => w.srs.status !== 'new').length
)
const masteredCount = computed(
  () => importedWords.value.filter((w) => w.srs.status === 'mastered').length
)
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <div class="manage-modal">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title">
            <span class="modal-icon">{{ bookIcon }}</span>
            <div>
              <h3>{{ bookName }}</h3>
              <p class="word-stats">
                {{ totalWords }} 词 · 学习中 {{ learnedCount }} · 已掌握 {{ masteredCount }}
              </p>
            </div>
          </div>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <!-- Toolbar -->
        <div class="modal-toolbar">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索单词、释义、音标..."
          />
          <span class="count-badge">{{ filtered.length }} / {{ totalWords }}</span>
        </div>

        <!-- Word list -->
        <div class="modal-word-list">
          <div
            v-for="{ word, idx } in filtered"
            :key="word.id"
            class="word-item"
            :class="{ expanded: expandedIndices.has(idx) }"
          >
            <div class="word-row" @click="toggleExpand(idx)">
              <div class="word-main">
                <span class="word-text">{{ word.word }}</span>
                <span class="word-phonetic">{{ word.phonetic || '-' }}</span>
                <span class="word-def">{{ word.definitions[0]?.meaning || '-' }}</span>
              </div>
              <span class="status-badge" :class="word.srs.status">
                {{ { new: '新词', learning: '学习中', review: '复习中', familiar: '已熟悉', mastered: '已掌握' }[word.srs.status] || word.srs.status }}
              </span>
              <button class="expand-btn" @click.stop="toggleExpand(idx)">
                {{ expandedIndices.has(idx) ? '▾' : '▸' }}
              </button>
            </div>

            <!-- Expanded details -->
            <div v-if="expandedIndices.has(idx) && editingIndex !== idx" class="word-detail">
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
                <span class="detail-label">词根</span>
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
              <div class="detail-row">
                <span class="detail-label">笔记</span>
                <span>{{ word.notes || '-' }}</span>
              </div>
              <div class="detail-row srs-info">
                <span class="detail-label">SRS</span>
                <span>EF {{ word.srs.easeFactor.toFixed(2) }} · 间隔 {{ word.srs.interval }}天 · 复习 {{ word.srs.totalReviews }}次</span>
              </div>

              <!-- Actions -->
              <div class="detail-actions">
                <button class="action-btn edit-btn" @click.stop="startEdit(idx, word)">✏️ 编辑</button>
                <button class="action-btn reset-btn" @click.stop="resetSrs(word)">🔄 重置进度</button>
                <button
                  v-if="deleteConfirm !== idx"
                  class="action-btn delete-btn"
                  @click.stop="confirmDelete(idx)"
                >🗑️ 删除</button>
                <div v-else class="delete-confirm">
                  <span class="confirm-text">确认删除？</span>
                  <button class="confirm-yes" @click.stop="executeDelete(word)">确认</button>
                  <button class="confirm-no" @click.stop="cancelDelete">取消</button>
                </div>
              </div>
            </div>

            <!-- Inline edit form -->
            <div v-if="expandedIndices.has(idx) && editingIndex === idx" class="edit-form">
              <div class="edit-field">
                <label>例句 (英文)</label>
                <input v-model="editForm.exampleEn" type="text" placeholder="Example sentence..." />
              </div>
              <div class="edit-field">
                <label>例句翻译</label>
                <input v-model="editForm.exampleCn" type="text" placeholder="例句中文翻译" />
              </div>
              <div class="edit-field">
                <label>笔记</label>
                <input v-model="editForm.notes" type="text" placeholder="个人笔记" />
              </div>
              <div class="edit-actions">
                <button class="save-edit-btn" @click.stop="saveEdit(idx, word)">💾 保存</button>
                <button class="cancel-edit-btn" @click.stop="cancelEdit">取消</button>
              </div>
            </div>
          </div>

          <div v-if="filtered.length === 0" class="empty-list">
            <p v-if="searchQuery">未找到匹配的单词</p>
            <p v-else>暂无导入的单词</p>
          </div>
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

.manage-modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 720px;
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
.word-stats { font-size: var(--text-xs); color: var(--text-tertiary); margin: 0; }
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
}
.search-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.search-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 2px var(--accent-light); }
.count-badge { font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap; }

.modal-word-list {
  flex: 1;
  overflow-y: auto;
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

.word-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.word-text { font-family: var(--font-serif); font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); flex-shrink: 0; }
.word-phonetic { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); flex-shrink: 0; }
.word-def { font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.status-badge {
  font-size: var(--text-xs);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 500;
  flex-shrink: 0;
}
.status-badge.new { background: var(--bg-tertiary); color: var(--text-tertiary); }
.status-badge.learning { background: #FEF3C7; color: #D97706; }
.status-badge.review { background: #DBEAFE; color: #2563EB; }
.status-badge.familiar { background: #D1FAE5; color: #059669; }
.status-badge.mastered { background: #EDE9FE; color: #7C3AED; }

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
.srs-info { opacity: 0.7; }

.detail-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}
.action-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  transition: all var(--duration-fast) var(--ease-out);
}
.edit-btn { background: var(--accent-light); color: var(--accent); }
.edit-btn:hover { background: var(--accent); color: white; }
.reset-btn { background: #FEF3C7; color: #D97706; }
.reset-btn:hover { background: #F59E0B; color: white; }
.delete-btn { background: #FEF2F2; color: var(--danger); }
.delete-btn:hover { background: var(--danger); color: white; }

.delete-confirm {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.confirm-text { font-size: var(--text-xs); color: var(--danger); font-weight: 500; }
.confirm-yes {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--danger);
  color: white;
}
.confirm-yes:hover { opacity: 0.9; }
.confirm-no {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.edit-form {
  padding: var(--space-3) var(--space-6) var(--space-4);
  padding-left: calc(var(--space-6) + 28px);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.edit-field label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}
.edit-field input {
  width: 100%;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}
.edit-field input:focus { border-color: var(--accent); outline: none; }
.edit-actions { display: flex; gap: var(--space-2); }
.save-edit-btn {
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--accent);
  color: white;
}
.save-edit-btn:hover { background: var(--accent-hover); }
.cancel-edit-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.empty-list { padding: var(--space-10); text-align: center; color: var(--text-tertiary); font-size: var(--text-sm); }

@media (max-width: 768px) {
  .manage-modal { max-height: 92vh; border-radius: var(--radius-lg); }
  .modal-header { padding: var(--space-4); }
  .word-row { padding: var(--space-2) var(--space-4); }
  .word-detail { padding-left: calc(var(--space-4) + 28px); padding-right: var(--space-4); }
  .edit-form { padding-left: calc(var(--space-4) + 28px); padding-right: var(--space-4); }
  .modal-toolbar { padding: var(--space-3) var(--space-4); }
}
</style>
