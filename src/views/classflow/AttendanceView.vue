<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import type { AttendanceStatus, Session, Student } from '@/types/classflow'
import { Save, RotateCcw, CheckSquare, ClipboardList, Sun } from 'lucide-vue-next'

const cf = useClassFlowStore()
const toast = useToast()

// Session form
const selectedClassId = ref(cf.currentClassId || (cf.classes.length > 0 ? cf.classes[0].id : ''))
const sessionDate = ref(new Date().toISOString().split('T')[0])
const topic = ref('')
const teacherNotes = ref('')
const homework = ref('')

// Editing state
const editingSessionId = ref<string | null>(null)
const savedSessions = ref<Session[]>([])

const statusCycle: AttendanceStatus[] = ['present', 'late', 'absent', 'leave']

function nextStatus(current: AttendanceStatus): AttendanceStatus {
  const idx = statusCycle.indexOf(current)
  return statusCycle[(idx + 1) % statusCycle.length]
}

function statusLabel(s: AttendanceStatus): string {
  return { present: '出勤', late: '迟到', absent: '缺勤', leave: '请假' }[s]
}

function statusColor(s: AttendanceStatus): string {
  return { present: '#10B981', late: '#F59E0B', absent: '#EF4444', leave: '#6366F1' }[s]
}

// Holiday detection
const holidayInfo = computed(() => {
  if (!selectedClassId.value || !sessionDate.value) return null
  const isH = cf.isHoliday(sessionDate.value, selectedClassId.value)
  const isGlobal = cf.isHoliday(sessionDate.value, null)
  const allHolidays = (cf.holidays || []).filter(h =>
    h.date === sessionDate.value &&
    (h.classId === null || h.classId === selectedClassId.value)
  )
  if (allHolidays.length === 0) return null
  const h = allHolidays[0]
  const isRescheduleDay = cf.holidays.some(hh =>
    hh.type === 'reschedule' && hh.rescheduledDate === sessionDate.value
  )
  return {
    isHoliday: isH || isGlobal,
    isReschedule: h.type === 'reschedule',
    isRescheduleDay,
    reason: h.reason,
    hasClassHoliday: isH,
    hasGlobalHoliday: isGlobal,
  }
})

// Attendance records for the current session
const attendanceRecords = computed(() => {
  const students = selectedClassId.value ? cf.getStudentsByClass(selectedClassId.value) : []
  // Check if we're editing an existing session
  const session = editingSessionId.value
    ? cf.sessions.find(s => s.id === editingSessionId.value)
    : null
  if (session) {
    return students.map(stu => {
      const existing = session.attendance.find(a => a.studentId === stu.id)
      return {
        student: stu,
        status: existing?.status || 'present' as AttendanceStatus,
        note: existing?.note || '',
      }
    })
  }
  return students.map(stu => ({
    student: stu,
    status: 'present' as AttendanceStatus,
    note: '',
  }))
})

// Detect students who already have an attendance record for this class + date
const duplicateStudentIds = computed(() => {
  if (!selectedClassId.value || !sessionDate.value) return new Set<string>()
  const dupIds = new Set<string>()
  for (const s of cf.sessions) {
    if (s.classId !== selectedClassId.value) continue
    if (s.date !== sessionDate.value) continue
    if (editingSessionId.value && s.id === editingSessionId.value) continue
    for (const a of s.attendance) {
      dupIds.add(a.studentId)
    }
  }
  return dupIds
})

function toggleStatus(studentId: string) {
  const record = attendanceRecords.value.find(r => r.student.id === studentId)
  if (record) {
    record.status = nextStatus(record.status)
  }
}

function markAllPresent() {
  attendanceRecords.value.forEach(r => { r.status = 'present' })
}

function resetAttendance() {
  attendanceRecords.value.forEach(r => { r.status = 'present'; r.note = '' })
}

function loadSessionHistory() {
  if (!selectedClassId.value) {
    savedSessions.value = []
    return
  }
  savedSessions.value = cf.getSessionsByClass(selectedClassId.value).slice(0, 20)
}

watch(selectedClassId, () => {
  editingSessionId.value = null
  topic.value = ''
  teacherNotes.value = ''
  homework.value = ''
  loadSessionHistory()
})

function editSession(session: Session) {
  editingSessionId.value = session.id
  sessionDate.value = session.date
  topic.value = session.topic
  teacherNotes.value = session.teacherNotes
  homework.value = session.homework
}

function handleSave() {
  if (!selectedClassId.value) {
    toast.show('请选择班级', '请先选择一个班级', '⚠️', '#F59E0B')
    return
  }

  // Per-student duplicate check: same class + date + same student
  const dupNames: string[] = []
  for (const record of attendanceRecords.value) {
    const alreadySigned = cf.sessions.some(s =>
      s.classId === selectedClassId.value &&
      s.date === sessionDate.value &&
      (editingSessionId.value ? s.id !== editingSessionId.value : true) &&
      s.attendance.some(a => a.studentId === record.student.id)
    )
    if (alreadySigned) dupNames.push(record.student.name)
  }
  if (dupNames.length > 0) {
    toast.show(
      '检测到重复签到',
      `学生「${dupNames.join('、')}」已在 ${sessionDate.value} 签到过，无法重复签到`,
      '⚠️', '#F59E0B'
    )
    return
  }

  const attendance = attendanceRecords.value.map(r => ({
    studentId: r.student.id,
    status: r.status,
    note: r.note,
  }))

  if (editingSessionId.value) {
    cf.updateSession(editingSessionId.value, {
      date: sessionDate.value,
      topic: topic.value,
      teacherNotes: teacherNotes.value,
      homework: homework.value,
      attendance,
    })
    toast.show('已更新', '签到记录已更新', '✅', '#10B981')
  } else {
    cf.createSession({
      classId: selectedClassId.value,
      date: sessionDate.value,
      startTime: '',
      endTime: '',
      topic: topic.value,
      teacherNotes: teacherNotes.value,
      homework: homework.value,
    })
    // Update with custom attendance
    const newSession = cf.sessions[cf.sessions.length - 1]
    if (newSession) {
      newSession.attendance = attendance
    }
    toast.show('已保存', '签到记录已保存', '✅', '#10B981')
  }

  editingSessionId.value = null
  loadSessionHistory()
}

function handleDeleteSession(id: string) {
  if (confirm('确定要删除这次课次记录吗？')) {
    cf.deleteSession(id)
    if (editingSessionId.value === id) {
      editingSessionId.value = null
    }
    loadSessionHistory()
    toast.show('已删除', '课次记录已删除', '🗑️', '#EF4444')
  }
}
</script>

<template>
  <div class="attendance-view">
    <div class="page-header">
      <h2 class="page-title">签到台</h2>
    </div>

    <!-- Class & Session Info -->
    <GlassCard padding="var(--space-6)" class="session-form">
      <div class="form-row">
        <label class="field">
          <span>班级</span>
          <select v-model="selectedClassId">
            <option value="" disabled>选择班级</option>
            <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">
              {{ cls.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>日期</span>
          <input v-model="sessionDate" type="date" />
        </label>
      </div>
      <div class="form-row">
        <label class="field grow">
          <span>今日内容</span>
          <input v-model="topic" placeholder="本次课程主题/内容" />
        </label>
      </div>
      <div class="form-row">
        <label class="field grow">
          <span>课堂笔记</span>
          <textarea v-model="teacherNotes" placeholder="课堂记录..." rows="2" />
        </label>
      </div>
      <div class="form-row last">
        <label class="field grow">
          <span>布置作业</span>
          <textarea v-model="homework" placeholder="本次课后作业..." rows="2" />
        </label>
      </div>
    </GlassCard>

    <!-- Holiday Banner -->
    <div v-if="holidayInfo" class="holiday-banner" :class="{ reschedule: holidayInfo.isReschedule || holidayInfo.isRescheduleDay }">
      <Sun :size="18" stroke-width="2" />
      <span v-if="holidayInfo.isRescheduleDay && !holidayInfo.isHoliday">
        📅 今天是补课日
      </span>
      <span v-else-if="holidayInfo.isReschedule">
        🔄 调课：{{ holidayInfo.reason }}
      </span>
      <span v-else>
        🏖️ 放假：{{ holidayInfo.reason }}
        <span class="holiday-hint">（今日签到中的缺勤不计入缺勤率）</span>
      </span>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions" v-if="selectedClassId">
      <button class="action-btn" @click="markAllPresent">
        <CheckSquare :size="16" stroke-width="2" />
        全部出勤
      </button>
      <button class="action-btn" @click="resetAttendance">
        <RotateCcw :size="16" stroke-width="2" />
        重置签到
      </button>
    </div>

    <!-- Attendance Grid -->
    <div v-if="!selectedClassId" class="empty-state">
      <ClipboardList :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>请先选择班级</p>
    </div>
    <div v-else-if="attendanceRecords.length === 0" class="empty-state">
      <p>该班级暂无学生</p>
    </div>
    <div v-else class="attendance-grid">
      <div
        v-for="record in attendanceRecords"
        :key="record.student.id"
        class="student-attendance-card"
        :class="[
          record.status,
          { duplicate: duplicateStudentIds.has(record.student.id) }
        ]"
        @click="!duplicateStudentIds.has(record.student.id) && toggleStatus(record.student.id)"
      >
        <div class="stu-avatar" :style="{ background: statusColor(record.status) }">
          {{ record.student.name.charAt(0) }}
        </div>
        <span class="stu-name">{{ record.student.name }}</span>
        <span class="stu-status" :style="{ color: statusColor(record.status) }">
          {{ statusLabel(record.status) }}
        </span>
        <span v-if="duplicateStudentIds.has(record.student.id)" class="dup-badge">已签到</span>
      </div>
    </div>

    <!-- Save Button -->
    <div v-if="selectedClassId && attendanceRecords.length > 0" class="save-section">
      <button class="save-btn" @click="handleSave">
        <Save :size="18" stroke-width="2" />
        <span>{{ editingSessionId ? '更新签到' : '确认并保存' }}</span>
      </button>
    </div>

    <!-- Session History -->
    <div v-if="savedSessions.length > 0" class="history-section">
      <h3 class="section-title">历史记录</h3>
      <div class="history-list">
        <div
          v-for="session in savedSessions"
          :key="session.id"
          class="history-item"
          :class="{ editing: editingSessionId === session.id }"
        >
          <div class="history-date">
            <span class="h-date">{{ session.date }}</span>
            <span class="h-time">{{ session.startTime }}-{{ session.endTime }}</span>
          </div>
          <div class="history-topic">{{ session.topic || '无主题' }}</div>
          <span v-if="session.isRescheduled" class="rs-badge">调课</span>
          <div class="history-stats">
            <span
              v-for="s in ['present','late','absent','leave'] as AttendanceStatus[]"
              :key="s"
              class="h-stat"
              :style="{ color: statusColor(s) }"
            >
              {{ { present: '出', late: '迟', absent: '缺', leave: '请' }[s] }}:{{ session.attendance.filter(a => a.status === s).length }}
            </span>
          </div>
          <div class="history-actions">
            <button class="h-btn" @click="editSession(session)">编辑</button>
            <button class="h-btn danger" @click="handleDeleteSession(session.id)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-view {
  animation: fadeInUp 0.3s var(--ease-out);
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.session-form {
  margin-bottom: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.form-row.last {
  margin-bottom: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.field.grow { flex: 1; }

.field span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.field select,
.field input,
.field textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field select:focus,
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.quick-actions {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  transition: all var(--duration-fast) var(--ease-out);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

.attendance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.student-attendance-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
  background: white;
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  user-select: none;
}

.student-attendance-card:active {
  transform: scale(0.97);
}

.student-attendance-card.present { border-color: #10B981; }
.student-attendance-card.late { border-color: #F59E0B; }
.student-attendance-card.absent { border-color: #EF4444; }
.student-attendance-card.leave { border-color: #6366F1; }

.student-attendance-card.duplicate {
  opacity: 0.6;
  cursor: not-allowed;
  border-color: var(--text-tertiary) !important;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 4px,
    rgba(0,0,0,0.02) 4px,
    rgba(0,0,0,0.02) 8px
  );
}

.student-attendance-card.duplicate:hover {
  transform: none;
}

.dup-badge {
  font-size: 0.6rem;
  font-weight: 600;
  color: white;
  background: var(--text-tertiary);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.stu-avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: var(--text-sm);
}

.stu-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.stu-status {
  font-size: 0.7rem;
  font-weight: 500;
}

.save-section {
  text-align: center;
  margin-bottom: var(--space-8);
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-8);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  transition: background var(--duration-fast) var(--ease-out);
}

.save-btn:hover {
  background: #059669;
}

.history-section {
  margin-top: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.history-item.editing {
  border: 1px solid #10B981;
}

.history-date {
  display: flex;
  flex-direction: column;
  min-width: 80px;
}

.h-date {
  font-weight: 600;
  color: var(--text-primary);
}

.h-time {
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.history-topic {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-stats {
  display: flex;
  gap: var(--space-2);
  font-size: 0.65rem;
  font-weight: 600;
}

.rs-badge {
  font-size: 0.6rem;
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
  font-weight: 500;
}

.holiday-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: #F59E0B;
  margin-bottom: var(--space-4);
}

.holiday-banner.reschedule {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
  color: #6366F1;
}

.holiday-hint {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.history-actions {
  display: flex;
  gap: var(--space-2);
}

.h-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.7rem;
  color: #10B981;
  border-radius: var(--radius-sm);
}

.h-btn:hover {
  background: rgba(16, 185, 129, 0.08);
}

.h-btn.danger {
  color: var(--danger);
}

.h-btn.danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

[data-theme="dark"] .student-attendance-card {
  background: var(--dark-surface);
}

@media (max-width: 768px) {
  .attendance-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .form-row {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .attendance-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
