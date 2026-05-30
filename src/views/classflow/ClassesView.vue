<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import type { ClassGroup, Student, ClassSchedule } from '@/types/classflow'
import { Plus, Users, ChevronDown, ChevronUp, X, Edit2, Clock } from 'lucide-vue-next'

const cf = useClassFlowStore()
const toast = useToast()

const showForm = ref(false)
const editingClassId = ref<string | null>(null)
const expandedId = ref<string | null>(null)

// Form fields
const formName = ref('')
const formColor = ref('#10B981')
const formDescription = ref('')
const formSchedules = ref<ClassSchedule[]>([])

// For adding students to class
const showStudentPicker = ref(false)
const pickingClassId = ref<string | null>(null)

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const weekIntervalOptions = [
  { value: 1, label: '每周' },
  { value: 2, label: '每两周' },
  { value: 4, label: '每四周' },
]

function resetForm() {
  formName.value = ''
  formColor.value = '#10B981'
  formDescription.value = ''
  formSchedules.value = []
}

function openNewForm() {
  editingClassId.value = null
  resetForm()
  showForm.value = true
}

function openEditForm(cls: ClassGroup) {
  editingClassId.value = cls.id
  formName.value = cls.name
  formColor.value = cls.color
  formDescription.value = cls.description
  formSchedules.value = cls.schedules && cls.schedules.length > 0
    ? cls.schedules.map(s => ({ ...s }))
    : [{ dayOfWeek: 6, startTime: '', endTime: '', weekInterval: 1 }]
  showForm.value = true
}

function addScheduleEntry() {
  formSchedules.value.push({ dayOfWeek: 6, startTime: '', endTime: '', weekInterval: 1 })
}

function removeScheduleEntry(index: number) {
  formSchedules.value.splice(index, 1)
}

function formatSchedule(s: ClassSchedule): string {
  const freq = weekIntervalOptions.find(w => w.value === s.weekInterval)?.label || '每周'
  return `${freq} ${dayNames[s.dayOfWeek]} ${s.startTime}-${s.endTime}`
}

function formatSchedules(schedules: ClassSchedule[]): string {
  if (!schedules || schedules.length === 0) return '未设定时'
  return schedules.map(formatSchedule).join(' / ')
}

function handleSave() {
  if (!formName.value.trim()) return
  if (editingClassId.value) {
    cf.updateClass(editingClassId.value, {
      name: formName.value.trim(),
      color: formColor.value,
      description: formDescription.value.trim(),
      schedules: formSchedules.value.filter(s => s.startTime && s.endTime),
    })
    toast.show('已更新', `班级「${formName.value.trim()}」已更新`, '✅', '#10B981')
  } else {
    cf.addClass({
      name: formName.value.trim(),
      studentIds: [],
      color: formColor.value,
      description: formDescription.value.trim(),
      schedules: formSchedules.value.filter(s => s.startTime && s.endTime),
    })
    toast.show('已添加', `班级「${formName.value.trim()}」已创建`, '✅', '#10B981')
  }
  showForm.value = false
  editingClassId.value = null
}

function handleDeleteClass(id: string) {
  const cls = cf.classes.find(c => c.id === id)
  if (!cls) return
  if (confirm(`确定要删除班级「${cls.name}」吗？相关的课次和作业也会被删除。`)) {
    cf.deleteClass(id)
    toast.show('已删除', `班级「${cls.name}」已删除`, '🗑️', '#EF4444')
  }
}

function toggleExpand(clsId: string) {
  expandedId.value = expandedId.value === clsId ? null : clsId
}

function openStudentPicker(classId: string) {
  pickingClassId.value = classId
  showStudentPicker.value = true
}

function toggleStudentInClass(student: Student) {
  if (!pickingClassId.value) return
  const cls = cf.classes.find(c => c.id === pickingClassId.value)
  if (!cls) return
  if (cls.studentIds.includes(student.id)) {
    cf.removeStudentFromClass(pickingClassId.value, student.id)
  } else {
    cf.addStudentToClass(pickingClassId.value, student.id)
  }
}

function classStudents(classId: string): Student[] {
  return cf.getStudentsByClass(classId)
}
</script>

<template>
  <div class="classes-view">
    <div class="page-header">
      <h2 class="page-title">班级管理</h2>
      <button class="btn-primary" @click="openNewForm">
        <Plus :size="16" stroke-width="2" />
        <span>添加班级</span>
      </button>
    </div>

    <!-- Class Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
        <div class="modal-content">
          <h4 class="modal-title">{{ editingClassId ? '编辑班级' : '新建班级' }}</h4>
          <div class="form-grid">
            <label class="field full">
              <span>班级名称 <span class="required">*</span></span>
              <input v-model="formName" placeholder="如：雅思口语冲刺班" />
            </label>

            <!-- Structured Schedules -->
            <div class="field full">
              <span>上课时间</span>
              <div
                v-for="(sched, idx) in formSchedules"
                :key="idx"
                class="schedule-row"
              >
                <select v-model="sched.weekInterval" class="sched-select">
                  <option v-for="opt in weekIntervalOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <select v-model="sched.dayOfWeek" class="sched-select">
                  <option v-for="(name, d) in dayNames" :key="d" :value="d">{{ name }}</option>
                </select>
                <input v-model="sched.startTime" type="time" class="sched-time" />
                <span class="sched-sep">-</span>
                <input v-model="sched.endTime" type="time" class="sched-time" />
                <button
                  v-if="formSchedules.length > 1"
                  class="icon-btn small"
                  @click="removeScheduleEntry(idx)"
                >
                  <X :size="12" stroke-width="2" />
                </button>
              </div>
              <button class="add-schedule-btn" @click="addScheduleEntry">
                <Plus :size="12" stroke-width="2" />
                添加另一时段
              </button>
            </div>

            <label class="field">
              <span>颜色标识</span>
              <div class="color-picker-row">
                <input v-model="formColor" type="color" class="color-input" />
                <span class="color-value">{{ formColor }}</span>
              </div>
            </label>
            <label class="field">
              <span>描述</span>
              <input v-model="formDescription" placeholder="班级描述..." />
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="showForm = false">取消</button>
            <button class="btn btn-primary" @click="handleSave" :disabled="!formName.trim()">
              {{ editingClassId ? '保存修改' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Class List -->
    <div v-if="cf.classes.length === 0" class="empty-state">
      <Users :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>暂无班级，点击右上角创建</p>
    </div>
    <div v-else class="class-list">
      <GlassCard
        v-for="cls in cf.classes"
        :key="cls.id"
        padding="var(--space-5) var(--space-6)"
        class="class-card"
      >
        <div class="class-header" @click="toggleExpand(cls.id)">
          <div class="class-left">
            <div class="class-color-dot" :style="{ background: cls.color }" />
            <div class="class-info">
              <span class="class-name">{{ cls.name }}</span>
              <span class="class-schedule">
                <Clock :size="12" stroke-width="2" />
                {{ formatSchedules(cls.schedules) }}
              </span>
            </div>
          </div>
          <div class="class-right">
            <span class="student-count">
              <Users :size="14" stroke-width="2" />
              {{ cls.studentIds.length }} 人
            </span>
            <button class="expand-btn">
              <ChevronDown v-if="expandedId !== cls.id" :size="18" />
              <ChevronUp v-else :size="18" />
            </button>
          </div>
        </div>

        <!-- Expanded Detail -->
        <div v-if="expandedId === cls.id" class="class-detail">
          <div class="detail-divider" />

          <!-- Schedule Details -->
          <div v-if="cls.schedules && cls.schedules.length > 0" class="sched-detail">
            <span class="detail-label">上课安排：</span>
            <div v-for="(s, i) in cls.schedules" :key="i" class="sched-chip">
              {{ formatSchedule(s) }}
            </div>
          </div>

          <div class="student-list">
            <div v-if="classStudents(cls.id).length === 0" class="no-students">
              暂无学生，点击下方按钮添加
            </div>
            <div
              v-for="student in classStudents(cls.id)"
              :key="student.id"
              class="student-row"
            >
              <div class="student-avatar" :style="{ background: '#10B981' }">
                {{ student.name.charAt(0) }}
              </div>
              <span class="student-row-name">{{ student.name }}</span>
              <button
                class="icon-btn small"
                title="移除"
                @click="cf.removeStudentFromClass(cls.id, student.id)"
              >
                <X :size="12" stroke-width="2" />
              </button>
            </div>
          </div>

          <div class="detail-actions">
            <button class="btn-text" @click="openStudentPicker(cls.id)">
              <Plus :size="14" stroke-width="2" />
              添加学生
            </button>
            <button class="btn-text" @click="openEditForm(cls)">
              <Edit2 :size="14" stroke-width="2" />
              编辑班级
            </button>
            <button class="btn-text danger" @click="handleDeleteClass(cls.id)">
              删除班级
            </button>
          </div>
        </div>
      </GlassCard>
    </div>

    <!-- Student Picker Modal -->
    <Teleport to="body">
      <div v-if="showStudentPicker" class="modal-overlay" @click.self="showStudentPicker = false">
        <div class="modal-picker">
          <h4>选择学生</h4>
          <div class="picker-list">
            <button
              v-for="s in cf.activeStudents"
              :key="s.id"
              class="picker-item"
              :class="{ selected: pickingClassId && cf.classes.find(c => c.id === pickingClassId)?.studentIds.includes(s.id) }"
              @click="toggleStudentInClass(s)"
            >
              <span>{{ s.name }}</span>
              <span v-if="pickingClassId && cf.classes.find(c => c.id === pickingClassId)?.studentIds.includes(s.id)" class="check">✓</span>
            </button>
          </div>
          <button class="btn btn-primary done-btn" @click="showStudentPicker = false">完成</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.classes-view {
  animation: fadeInUp 0.3s var(--ease-out);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--duration-fast) var(--ease-out);
}

.btn-primary:hover { background: #059669; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field.full { grid-column: 1 / -1; }

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field span { font-size: var(--text-xs); font-weight: 500; color: var(--text-secondary); }
.required { color: var(--danger); }

.field input, .field select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.field input:focus, .field select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.sched-select {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.sched-time {
  width: 90px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.sched-sep {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.add-schedule-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: #10B981;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.add-schedule-btn:hover {
  background: rgba(16, 185, 129, 0.08);
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.color-input {
  width: 36px;
  height: 36px;
  padding: 2px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--border);
}

.color-value {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all var(--duration-fast) var(--ease-out); }
.btn-secondary { background: var(--bg-secondary); color: var(--text-secondary); }
.btn-secondary:hover { background: var(--bg-tertiary); }

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
}

.icon-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.icon-btn.small { width: 22px; height: 22px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

.class-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.class-card { cursor: default; }

.class-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.class-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  flex: 1;
}

.class-color-dot {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.class-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.class-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.class-schedule {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.class-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.student-count {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.expand-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
}

.expand-btn:hover { background: var(--bg-secondary); }

.detail-divider {
  height: 1px;
  background: var(--border);
  margin: var(--space-4) 0;
}

.sched-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.detail-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.sched-chip {
  padding: 2px var(--space-2);
  background: rgba(16, 185, 129, 0.08);
  color: #10B981;
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 500;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.no-students {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--space-4);
}

.student-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}

.student-row:hover { background: var(--bg-secondary); }

.student-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
}

.student-row-name {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.detail-actions {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: #10B981;
  font-weight: 500;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.btn-text:hover { background: rgba(16, 185, 129, 0.08); }
.btn-text.danger { color: var(--danger); }
.btn-text.danger:hover { background: rgba(239, 68, 68, 0.08); }

.modal-picker {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 360px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-picker h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.picker-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  text-align: left;
}

.picker-item:hover { background: var(--bg-secondary); }
.picker-item.selected { background: rgba(16, 185, 129, 0.08); }

.check { color: #10B981; font-weight: 600; }

.done-btn { margin-top: var(--space-4); width: 100%; text-align: center; }

[data-theme="dark"] .modal-content,
[data-theme="dark"] .modal-picker {
  background: var(--dark-surface);
}

[data-theme="dark"] .field input,
[data-theme="dark"] .field select,
[data-theme="dark"] .sched-select,
[data-theme="dark"] .sched-time {
  background: var(--dark-bg);
  border-color: var(--dark-border);
}

@media (max-width: 768px) {
  .schedule-row {
    flex-wrap: wrap;
  }
}
</style>
