<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Student, StudentStatus } from '@/types/classflow'

const props = defineProps<{
  student?: Student | null
  visible: boolean
}>()

const emit = defineEmits<{
  save: [data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>]
  close: []
}>()

const name = ref('')
const phone = ref('')
const wechat = ref('')
const tagsText = ref('')
const enrollDate = ref(new Date().toISOString().split('T')[0])
const status = ref<StudentStatus>('active')
const notes = ref('')

watch(() => props.visible, (val) => {
  if (val && props.student) {
    name.value = props.student.name
    phone.value = props.student.phone
    wechat.value = props.student.wechat
    tagsText.value = props.student.tags.join('、')
    enrollDate.value = props.student.enrollDate
    status.value = props.student.status
    notes.value = props.student.notes
  } else if (val) {
    name.value = ''
    phone.value = ''
    wechat.value = ''
    tagsText.value = ''
    enrollDate.value = new Date().toISOString().split('T')[0]
    status.value = 'active'
    notes.value = ''
  }
})

function handleSave() {
  if (!name.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    avatarUrl: '',
    phone: phone.value.trim(),
    wechat: wechat.value.trim(),
    tags: tagsText.value.split(/[、,，]/).map(t => t.trim()).filter(Boolean),
    enrollDate: enrollDate.value,
    status: status.value,
    notes: notes.value.trim(),
  })
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content">
        <h3 class="modal-title">{{ student ? '编辑学生' : '添加学生' }}</h3>
        <div class="form-grid">
          <label class="field">
            <span>姓名 <span class="required">*</span></span>
            <input v-model="name" placeholder="学生姓名" />
          </label>
          <label class="field">
            <span>电话</span>
            <input v-model="phone" placeholder="手机号码" />
          </label>
          <label class="field">
            <span>微信</span>
            <input v-model="wechat" placeholder="微信号" />
          </label>
          <label class="field">
            <span>标签</span>
            <input v-model="tagsText" placeholder="用顿号分隔，如：雅思、冲刺班" />
          </label>
          <label class="field">
            <span>入学日期</span>
            <input v-model="enrollDate" type="date" />
          </label>
          <label class="field">
            <span>状态</span>
            <select v-model="status">
              <option value="active">在读</option>
              <option value="archived">已归档</option>
              <option value="graduated">已毕业</option>
            </select>
          </label>
          <label class="field full">
            <span>备注</span>
            <textarea v-model="notes" placeholder="备注信息..." rows="3" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="emit('close')">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="!name.trim()">
            {{ student ? '保存修改' : '添加' }}
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
  background: rgba(0, 0, 0, 0.4);
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

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.2s var(--ease-out);
}

@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-6);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field.full {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.required {
  color: var(--danger);
}

.field input,
.field select,
.field textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.btn {
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

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-primary {
  background: #10B981;
  color: white;
}

.btn-primary:hover {
  background: #059669;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

[data-theme="dark"] .modal-content {
  background: var(--dark-surface);
}

[data-theme="dark"] .field input,
[data-theme="dark"] .field select,
[data-theme="dark"] .field textarea {
  background: var(--dark-bg);
  border-color: var(--dark-border);
}
</style>
