<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useClassFlowFileStorage } from '@/composables/useClassFlowFileStorage'
import { useToast } from '@/composables/useToast'
import type { Submission, SubmissionFileMeta } from '@/types/classflow'
import { Download, X, FileText, Music, ImageIcon, CheckCircle } from 'lucide-vue-next'

const props = defineProps<{
  submission: Submission
}>()

const emit = defineEmits<{
  close: []
  graded: []
}>()

const cf = useClassFlowStore()
const fs = useClassFlowFileStorage()
const toast = useToast()

const grade = ref(props.submission.grade || 85)
const feedback = ref(props.submission.feedback || '')
const fileUrls = ref<{ meta: SubmissionFileMeta; url: string }[]>([])
const loading = ref(true)

const student = computed(() =>
  cf.students.find(s => s.id === props.submission.studentId)
)

const assignment = computed(() =>
  cf.assignments.find(a => a.id === props.submission.assignmentId)
)

const quickTags = ['👍 发音清晰', '⚠️ 语法错误', '🌟 逻辑严密', '📉 需加强练习', '✅ 完成良好', '💪 继续努力']

async function loadFiles() {
  loading.value = true
  fileUrls.value = []
  for (const fileMeta of props.submission.files) {
    const blob = await fs.getFileBlob(fileMeta.id)
    if (blob) {
      const url = fs.createObjectURL(blob)
      fileUrls.value.push({ meta: fileMeta, url })
    }
  }
  loading.value = false
}

watch(() => props.submission.id, loadFiles, { immediate: true })

onUnmounted(() => {
  fileUrls.value.forEach(f => fs.revokeObjectURL(f.url))
})

function addQuickTag(tag: string) {
  const existing = feedback.value
  if (existing && !existing.endsWith('\n') && !existing.endsWith('。')) {
    feedback.value += '；' + tag
  } else {
    feedback.value += (existing ? '\n' : '') + tag
  }
}

function handleSave() {
  cf.gradeSubmission(props.submission.id, grade.value, feedback.value)
  toast.show('已批改', `评分 ${grade.value} 分已保存`, '✅', '#10B981')
  emit('graded')
}

function handleDownload(fileMeta: SubmissionFileMeta) {
  const entry = fileUrls.value.find(f => f.meta.id === fileMeta.id)
  if (!entry) return
  const a = document.createElement('a')
  a.href = entry.url
  a.download = fileMeta.name
  a.click()
}

function isImage(type: string) { return type.startsWith('image/') }
function isAudio(type: string) { return type.startsWith('audio/') }
</script>

<template>
  <Teleport to="body">
    <div class="grading-overlay" @click.self="emit('close')">
      <div class="grading-modal">
        <div class="modal-header">
          <div class="modal-title-group">
            <h3>批改作业</h3>
            <span class="modal-subtitle">
              {{ assignment?.title || '作业' }} — {{ student?.name || '未知学生' }}
            </span>
          </div>
          <button class="close-btn" @click="emit('close')">
            <X :size="20" stroke-width="2" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Left: File Preview -->
          <div class="preview-panel">
            <h4 class="panel-title">提交的文件</h4>
            <div v-if="loading" class="panel-empty">加载中...</div>
            <div v-else-if="fileUrls.length === 0" class="panel-empty">
              无文件附件
            </div>
            <div v-else class="file-list">
              <div v-for="f in fileUrls" :key="f.meta.id" class="file-item">
                <div class="file-icon">
                  <Music v-if="isAudio(f.meta.type)" :size="24" stroke-width="1.5" color="#10B981" />
                  <ImageIcon v-else-if="isImage(f.meta.type)" :size="24" stroke-width="1.5" color="#4F6EF7" />
                  <FileText v-else :size="24" stroke-width="1.5" color="#F59E0B" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ f.meta.name }}</span>
                  <span class="file-size">{{ (f.meta.size / 1024).toFixed(1) }} KB</span>
                </div>
                <button class="file-dl" @click="handleDownload(f.meta)" title="下载">
                  <Download :size="14" stroke-width="2" />
                </button>
              </div>
              <!-- Audio preview -->
              <div v-for="f in fileUrls.filter(x => isAudio(x.meta.type))" :key="'audio_'+f.meta.id" class="audio-preview">
                <audio :src="f.url" controls style="width:100%; height:40px" />
              </div>
              <!-- Image preview -->
              <div v-for="f in fileUrls.filter(x => isImage(x.meta.type))" :key="'img_'+f.meta.id" class="image-preview">
                <img :src="f.url" :alt="f.meta.name" />
              </div>
            </div>
          </div>

          <!-- Right: Grading -->
          <div class="grading-panel">
            <h4 class="panel-title">评价与反馈</h4>

            <div class="grade-row">
              <label>
                <span class="grade-label">成绩</span>
                <div class="grade-input-group">
                  <input v-model.number="grade" type="number" min="0" max="100" class="grade-input" />
                  <span class="grade-unit">/ 100</span>
                </div>
              </label>
            </div>

            <div class="feedback-row">
              <label>
                <span class="grade-label">评语</span>
                <textarea
                  v-model="feedback"
                  placeholder="输入评语..."
                  rows="5"
                />
              </label>
            </div>

            <div class="quick-tags">
              <span class="grade-label">快捷评语</span>
              <div class="tag-list">
                <button
                  v-for="tag in quickTags"
                  :key="tag"
                  class="quick-tag"
                  @click="addQuickTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="emit('close')">取消</button>
          <button class="btn btn-primary" @click="handleSave">
            <CheckCircle :size="16" stroke-width="2" />
            提交并通知
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.grading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.grading-modal {
  background: white;
  border-radius: var(--radius-xl);
  width: 92%;
  max-width: 800px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.2s var(--ease-out);
}

@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
}

.modal-title-group h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-md);
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  overflow-y: auto;
  flex: 1;
}

.panel-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.panel-empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.file-icon {
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.file-dl {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.file-dl:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.audio-preview {
  margin-top: var(--space-2);
}

.image-preview {
  margin-top: var(--space-2);
}

.image-preview img {
  max-width: 100%;
  border-radius: var(--radius-md);
}

.grading-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.grade-row label,
.feedback-row label {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.grade-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.grade-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.grade-input {
  width: 80px;
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  background: var(--bg-primary);
}

.grade-input:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.grade-unit {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.feedback-row textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  resize: vertical;
}

.feedback-row textarea:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.quick-tag {
  padding: var(--space-1) var(--space-2);
  font-size: 0.65rem;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.quick-tag:hover {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
}

.btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-secondary:hover { background: var(--bg-tertiary); }

.btn-primary {
  background: #10B981;
  color: white;
}

.btn-primary:hover { background: #059669; }

[data-theme="dark"] .grading-modal {
  background: var(--dark-surface);
}

[data-theme="dark"] .file-item {
  background: var(--dark-bg);
}

[data-theme="dark"] .grade-input,
[data-theme="dark"] .feedback-row textarea {
  background: var(--dark-bg);
  border-color: var(--dark-border);
}

@media (max-width: 768px) {
  .modal-body {
    grid-template-columns: 1fr;
  }
}
</style>
