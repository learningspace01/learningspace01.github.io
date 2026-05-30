<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useAuthStore } from '@/stores/authStore'
import { useClassFlowFileStorage } from '@/composables/useClassFlowFileStorage'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import type { Assignment, Submission, SubmissionFileMeta, Student } from '@/types/classflow'
import {
  Search, FileEdit, Clock, CheckCircle, Upload, Send,
  ChevronDown, ChevronRight, X, UserCheck, AlertCircle,
} from 'lucide-vue-next'

const cf = useClassFlowStore()
const auth = useAuthStore()
const fs = useClassFlowFileStorage()
const toast = useToast()

// --- Auto-detect for student role ---
const linkedStudent = computed<Student | null>(() => {
  if (!auth.isStudent || !auth.currentUser?.studentId) return null
  return cf.students.find(s => s.id === auth.currentUser!.studentId) || null
})

const autoClasses = computed(() => {
  if (!linkedStudent.value) return []
  return cf.classes.filter(c => c.studentIds.includes(linkedStudent.value!.id))
})

const autoAssignments = computed(() => {
  if (!linkedStudent.value) return []
  const classIds = autoClasses.value.map(c => c.id)
  return cf.assignments
    .filter(a => classIds.includes(a.classId))
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
})

const autoGrouped = computed(() => {
  const obj: Record<string, { clsId: string; assignments: Assignment[] }> = {}
  for (const asg of autoAssignments.value) {
    const cls = cf.classes.find(c => c.id === asg.classId)
    const key = cls?.name || '未分类'
    if (!obj[key]) obj[key] = { clsId: asg.classId, assignments: [] }
    obj[key].assignments.push(asg)
  }
  return obj
})

const autoStats = computed(() => {
  const items = autoAssignments.value
  let pending = 0, submitted = 0, graded = 0
  for (const asg of items) {
    const sub = cf.getOrCreateSubmission(asg.id, linkedStudent.value!.id)
    if (sub.status === 'pending' || sub.status === 'returned') pending++
    else if (sub.status === 'submitted') submitted++
    else if (sub.status === 'graded') graded++
  }
  const grades = items.map(asg => {
    const s = cf.getOrCreateSubmission(asg.id, linkedStudent.value!.id)
    return s.grade || 0
  }).filter(g => g > 0)
  return {
    total: items.length,
    pending, submitted, graded,
    avgGrade: grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0,
  }
})

// --- Stat filter ---
const filterStat = ref<string>('all')

const filteredAssignments = computed(() => {
  if (filterStat.value === 'all') return autoAssignments.value
  return autoAssignments.value.filter(asg => {
    const sub = cf.getOrCreateSubmission(asg.id, linkedStudent.value!.id)
    if (filterStat.value === 'submitted') return sub.status === 'submitted'
    if (filterStat.value === 'graded') return sub.status === 'graded'
    if (filterStat.value === 'returned') return sub.status === 'returned'
    return false
  })
})

// Also make autoGrouped use filteredAssignments
// We'll override the computed below — need to re-define autoGrouped
// Actually just update the template to use a separate grouped computed

const groupedForDisplay = computed(() => {
  const obj: Record<string, { clsId: string; assignments: Assignment[] }> = {}
  for (const asg of filteredAssignments.value) {
    const cls = cf.classes.find(c => c.id === asg.classId)
    const key = cls?.name || '未分类'
    if (!obj[key]) obj[key] = { clsId: asg.classId, assignments: [] }
    obj[key].assignments.push(asg)
  }
  return obj
})

function setFilter(val: string) {
  filterStat.value = filterStat.value === val ? 'all' : val
}

// --- Detail Modal ---
const showDetailModal = ref(false)
const detailAssignmentId = ref<string | null>(null)
const detailAssignment = computed(() =>
  detailAssignmentId.value ? cf.assignments.find(a => a.id === detailAssignmentId.value) : null
)
const detailSubmission = computed(() => {
  if (!detailAssignmentId.value || !linkedStudent.value) return null
  return cf.getOrCreateSubmission(detailAssignmentId.value, linkedStudent.value.id)
})

function openDetail(asgId: string) {
  detailAssignmentId.value = asgId
  detailFiles.value = []
  detailNote.value = ''
  showDetailModal.value = true
}

function closeDetail() {
  showDetailModal.value = false
  detailAssignmentId.value = null
}

// --- Detail Modal: file upload + notes + submit ---
const detailFiles = ref<SubmissionFileMeta[]>([])
const detailNote = ref('')
const detailSubmitting = ref(false)

function handleDetailFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  for (const file of Array.from(input.files)) {
    fs.storeFile(file, `detail_${detailAssignmentId.value}_${linkedStudent.value!.id}`).then(meta => {
      detailFiles.value.push(meta)
    })
  }
  input.value = ''
}

function removeDetailFile(id: string) {
  detailFiles.value = detailFiles.value.filter(f => f.id !== id)
}

async function handleDetailSubmit() {
  if (!detailAssignmentId.value || !linkedStudent.value) return
  detailSubmitting.value = true
  try {
    cf.submitAssignment(detailAssignmentId.value, linkedStudent.value.id, detailFiles.value)
    toast.show('已提交', '作业已提交成功', '📤', '#10B981')
    // closeDetail()
  } finally {
    detailSubmitting.value = false
  }
}

// --- Query mode (for admin/teacher) ---
const queryClassId = ref<string | null>(null)
const hasQueried = ref(false)

const classAssignments = computed(() => {
  if (!queryClassId.value) return []
  return cf.assignments
    .filter(a => a.classId === queryClassId.value)
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
})

const classStudents = computed(() => {
  if (!queryClassId.value) return []
  return cf.getStudentsByClass(queryClassId.value)
})

function handleQuery() {
  expandedAssignmentId.value = null
  hasQueried.value = true
}

// --- Expand ---
const expandedAssignmentId = ref<string | null>(null)

function toggleExpand(asgId: string) {
  expandedAssignmentId.value = expandedAssignmentId.value === asgId ? null : asgId
}

// --- Submission summary per assignment ---
function getSubmissionSummary(asgId: string) {
  const subs = cf.getSubmissionsByAssignment(asgId)
  const students = classStudents.value
  const submitted = subs.filter(s => s.status === 'submitted')
  const graded = subs.filter(s => s.status === 'graded')
  const returned = subs.filter(s => s.status === 'returned')
  const pending = students.filter(stu =>
    !subs.find(s => s.studentId === stu.id && s.status !== 'pending')
  ).length
  return {
    total: students.length,
    submitted: submitted.length,
    graded: graded.length,
    returned: returned.length,
    pending: pending,
    rate: students.length > 0 ? Math.round((submitted.length + graded.length) / students.length * 100) : 0,
  }
}

// Get student rows for expanded assignment
interface StudentRow {
  student: Student
  submission: Submission | undefined
  status: string
}

function getStudentRows(asgId: string): StudentRow[] {
  const subs = cf.getSubmissionsByAssignment(asgId)
  return classStudents.value.map(stu => {
    const sub = subs.find(s => s.studentId === stu.id)
    return {
      student: stu,
      submission: sub,
      status: sub ? sub.status : 'pending',
    }
  })
}

// --- Submit Modal ---
const showSubmitModal = ref(false)
const submitStudentId = ref<string | null>(null)
const submitAssignmentId = ref<string | null>(null)
const submitFiles = ref<SubmissionFileMeta[]>([])

const submitStudent = computed(() =>
  submitStudentId.value ? cf.students.find(s => s.id === submitStudentId.value) : null
)
const submitAssignment = computed(() =>
  submitAssignmentId.value ? cf.assignments.find(a => a.id === submitAssignmentId.value) : null
)
const submitting = ref(false)

function openSubmitModal(studentId: string, assignmentId: string) {
  submitStudentId.value = studentId
  submitAssignmentId.value = assignmentId
  submitFiles.value = []
  showSubmitModal.value = true
}

function closeSubmitModal() {
  showSubmitModal.value = false
  submitStudentId.value = null
  submitAssignmentId.value = null
  submitFiles.value = []
}

function handleSubmitFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  for (const file of Array.from(input.files)) {
    fs.storeFile(file, `sub_${submitStudentId.value}_${submitAssignmentId.value}`).then(meta => {
      submitFiles.value.push(meta)
    })
  }
  input.value = ''
}

function removeSubmitFile(id: string) {
  submitFiles.value = submitFiles.value.filter(f => f.id !== id)
}

async function handleConfirmSubmit(withFiles: boolean) {
  if (!submitAssignmentId.value || !submitStudentId.value) return
  submitting.value = true
  try {
    if (withFiles) {
      cf.submitAssignment(submitAssignmentId.value, submitStudentId.value, submitFiles.value)
      toast.show('已提交', `作业已提交，${submitFiles.value.length} 个文件`, '📤', '#10B981')
    } else {
      cf.submitAssignment(submitAssignmentId.value, submitStudentId.value, [])
      toast.show('已提交', '作业已标记为完成', '📤', '#10B981')
    }
    closeSubmitModal()
  } finally {
    submitting.value = false
  }
}

// --- Helpers ---
function isOverdue(deadline: string): boolean {
  if (!deadline) return false
  return deadline < new Date().toISOString().split('T')[0]
}

function statusLabel(status: string): string {
  return { pending: '未提交', submitted: '待批改', graded: '已批改', returned: '已退回' }[status] || status
}
function statusColor(status: string): string {
  return { pending: '#9CA3AF', submitted: '#F59E0B', graded: '#10B981', returned: '#6366F1' }[status] || '#999'
}
function statusBg(status: string): string {
  return { pending: 'transparent', submitted: 'rgba(245,158,11,0.12)', graded: 'rgba(16,185,129,0.12)', returned: 'rgba(99,102,241,0.12)' }[status] || 'transparent'
}
function canSubmit(status: string): boolean {
  return status === 'pending' || status === 'returned'
}
function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="workspace">
    <div class="page-header">
      <h2 class="page-title">学生工作台</h2>
    </div>

    <!-- ===== STUDENT AUTO VIEW ===== -->
    <template v-if="auth.isStudent && linkedStudent">
      <div class="auto-banner">
        <UserCheck :size="18" stroke-width="2" />
        <span>当前身份：<strong>{{ linkedStudent.name }}</strong></span>
      </div>

      <div class="stats-row">
        <button class="stat-card" :class="{ active: filterStat === 'all' }" @click="setFilter('all')">
          <span class="stat-value">{{ autoStats.total }}</span>
          <span class="stat-label">总作业</span>
        </button>
        <button class="stat-card" :class="{ active: filterStat === 'submitted' }" @click="setFilter('submitted')">
          <span class="stat-value" style="color:#F59E0B">{{ autoStats.submitted }}</span>
          <span class="stat-label">待批改</span>
        </button>
        <button class="stat-card" :class="{ active: filterStat === 'graded' }" @click="setFilter('graded')">
          <span class="stat-value" style="color:#10B981">{{ autoStats.graded }}</span>
          <span class="stat-label">已批改</span>
        </button>
        <button class="stat-card" :class="{ active: filterStat === 'returned' }" @click="setFilter('returned')">
          <span class="stat-value" style="color:#6366F1">{{ autoStats.returned || 0 }}</span>
          <span class="stat-label">已退回</span>
        </button>
      </div>

      <div v-if="autoAssignments.length === 0" class="empty-state">
        <FileEdit :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
        <p v-if="autoClasses.length === 0">你尚未被加入任何班级，请联系管理员</p>
        <p v-else>暂无作业任务</p>
      </div>

      <div v-else class="class-groups">
        <div v-for="(group, clsName) in groupedForDisplay" :key="clsName" class="class-group">
          <h3 class="class-group-title">{{ clsName }}</h3>
          <div class="ac-list">
            <div v-for="asg in group.assignments" :key="asg.id" class="ac-card clickable"
              :class="(cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).status"
              @click="openDetail(asg.id)">
              <div class="ac-header-row">
                <span class="ac-title">{{ asg.title }}</span>
                <span class="status-badge-sm"
                  :style="{
                    background: statusBg((cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).status),
                    color: statusColor((cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).status)
                  }">
                  {{ statusLabel((cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).status) }}
                </span>
              </div>
              <div v-if="asg.description" class="ac-desc">{{ asg.description }}</div>
              <div class="ac-meta">
                <span v-if="asg.deadline" class="ac-deadline" :class="{ overdue: isOverdue(asg.deadline) }">
                  <Clock :size="12" stroke-width="2" />截止 {{ asg.deadline }}
                </span>
              </div>
              <div v-if="(cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).status === 'graded'" class="ac-grade-info">
                <CheckCircle :size="16" stroke-width="2" color="#10B981" />
                <span class="grade-score">{{ (cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).grade }} 分</span>
                <span v-if="(cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).feedback" class="grade-fb">
                  — {{ (cf.getOrCreateSubmission(asg.id, linkedStudent!.id)).feedback }}
                </span>
              </div>
              <div class="ac-footer">
                <span class="ac-click-hint">点击查看详情</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== ADMIN QUERY VIEW ===== -->
    <template v-else>
    <!-- Query Area -->
    <GlassCard padding="var(--space-5) var(--space-6)" class="query-card">
      <div class="query-row">
        <label class="query-field">
          <span>选择班级</span>
          <select v-model="queryClassId">
            <option :value="null" disabled>请选择班级</option>
            <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
          </select>
        </label>
        <button class="query-btn" :disabled="!queryClassId" @click="handleQuery">
          <Search :size="18" stroke-width="2" />
          <span>查询</span>
        </button>
      </div>
    </GlassCard>

    <div v-if="!hasQueried" class="empty-state">
      <Search :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>选择班级后点击「查询」查看作业任务</p>
    </div>

    <div v-else-if="classAssignments.length === 0" class="empty-state">
      <FileEdit :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>该班级暂无作业任务</p>
    </div>

    <div v-else class="results-list">
      <div
        v-for="asg in classAssignments"
        :key="asg.id"
        class="asg-wrapper"
      >
        <!-- Assignment Card -->
        <GlassCard
          padding="var(--space-5) var(--space-6)"
          class="asg-card"
          :class="{ expanded: expandedAssignmentId === asg.id }"
        >
          <div class="asg-main" @click="toggleExpand(asg.id)">
            <div class="asg-expand-icon">
              <ChevronRight v-if="expandedAssignmentId !== asg.id" :size="18" stroke-width="2" />
              <ChevronDown v-else :size="18" stroke-width="2" />
            </div>
            <div class="asg-body">
              <div class="asg-title-row">
                <span class="asg-title">{{ asg.title }}</span>
                <span v-if="isOverdue(asg.deadline)" class="overdue-badge">
                  <AlertCircle :size="12" stroke-width="2" />
                  已逾期
                </span>
              </div>
              <div v-if="asg.description" class="asg-desc">{{ asg.description }}</div>
              <div class="asg-meta">
                <span v-if="asg.deadline" class="asg-deadline">
                  <Clock :size="12" stroke-width="2" />
                  截止 {{ asg.deadline }}
                </span>
                <span v-if="asg.attachments.length > 0" class="asg-attach">
                  📎 {{ asg.attachments.length }} 个附件
                </span>
              </div>
            </div>
            <div class="asg-progress">
              <div class="progress-bar-wrap">
                <div class="progress-bar" :style="{ width: getSubmissionSummary(asg.id).rate + '%' }"></div>
              </div>
              <span class="progress-text">
                {{ getSubmissionSummary(asg.id).submitted + getSubmissionSummary(asg.id).graded }}/{{ getSubmissionSummary(asg.id).total }} 已提交
              </span>
            </div>
          </div>
        </GlassCard>

        <!-- Expanded Detail Table -->
        <div v-if="expandedAssignmentId === asg.id" class="asg-detail">
          <div class="detail-header">
            <span class="detail-title">{{ asg.title }} — 全班提交明细</span>
          </div>
          <div class="detail-table-wrap">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>学生</th>
                  <th>状态</th>
                  <th>提交时间</th>
                  <th>文件</th>
                  <th>分数</th>
                  <th>评语</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in getStudentRows(asg.id)"
                  :key="row.student.id"
                  :class="row.status"
                >
                  <td>
                    <div class="student-cell">
                      <span class="stu-avatar-sm">{{ row.student.name.charAt(0) }}</span>
                      {{ row.student.name }}
                    </div>
                  </td>
                  <td>
                    <span class="status-dot" :style="{ background: statusColor(row.status) }"></span>
                    <span class="status-text" :style="{ color: statusColor(row.status) }">
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                  <td class="time-cell">{{ row.submission?.submittedAt ? formatTime(row.submission.submittedAt) : '-' }}</td>
                  <td>{{ row.submission?.files?.length || 0 }} 个</td>
                  <td>
                    <span v-if="row.submission?.grade" class="grade-val" :style="{ color: '#10B981' }">
                      {{ row.submission.grade }} 分
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td class="feedback-cell">{{ row.submission?.feedback || '-' }}</td>
                  <td>
                    <button
                      v-if="canSubmit(row.status)"
                      class="submit-btn"
                      @click="openSubmitModal(row.student.id, asg.id)"
                    >
                      <Upload :size="12" stroke-width="2" />
                      选择并提交
                    </button>
                    <span v-else-if="row.status === 'submitted'" class="status-hint submitted-hint">等待批改</span>
                    <span v-else class="status-hint graded-hint">已批改</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Summary -->
          <div class="detail-summary">
            <span class="sum-item" style="color:#9CA3AF">未提交 {{ getSubmissionSummary(asg.id).pending }}</span>
            <span class="sum-item" style="color:#F59E0B">待批改 {{ getSubmissionSummary(asg.id).submitted }}</span>
            <span class="sum-item" style="color:#10B981">已批改 {{ getSubmissionSummary(asg.id).graded }}</span>
            <span v-if="getSubmissionSummary(asg.id).returned > 0" class="sum-item" style="color:#6366F1">已退回 {{ getSubmissionSummary(asg.id).returned }}</span>
          </div>
        </div>
      </div>
    </div>
    </template>

    <!-- ======================== SUBMIT MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showSubmitModal" class="modal-overlay" @click.self="closeSubmitModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>提交作业</h3>
            <button class="modal-close" @click="closeSubmitModal">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <div class="submit-info">
              <div class="submit-who">
                <UserCheck :size="16" stroke-width="2" color="#10B981" />
                <span>你正在以 <strong>{{ submitStudent?.name }}</strong> 的身份提交</span>
              </div>
              <div class="submit-what">
                <FileEdit :size="16" stroke-width="2" color="var(--text-tertiary)" />
                <span>作业：<strong>{{ submitAssignment?.title }}</strong></span>
              </div>
            </div>

            <!-- File upload -->
            <div class="submit-upload-section">
              <div v-if="submitFiles.length > 0" class="submit-files">
                <div v-for="f in submitFiles" :key="f.id" class="submit-file-chip">
                  <span class="sfc-name">{{ f.name }}</span>
                  <button class="sfc-remove" @click="removeSubmitFile(f.id)">✕</button>
                </div>
              </div>
              <label class="submit-upload-btn">
                <Upload :size="14" stroke-width="2" />
                选择文件
                <input type="file" multiple style="display:none" @change="handleSubmitFile" />
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="closeSubmitModal">取消</button>
            <button
              class="btn-mark-done"
              :disabled="submitting"
              @click="handleConfirmSubmit(false)"
            >
              <CheckCircle :size="16" stroke-width="2" />
              仅标记完成
            </button>
            <button
              class="btn-confirm"
              :disabled="submitting"
              @click="handleConfirmSubmit(true)"
            >
              <Send :size="16" stroke-width="2" />
              上传并提交
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ======================== DETAIL MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showDetailModal && detailAssignment" class="modal-overlay" @click.self="closeDetail">
        <div class="modal-content detail-modal">
          <div class="modal-header">
            <h3>{{ detailAssignment.title }}</h3>
            <button class="modal-close" @click="closeDetail">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <!-- Assignment Info -->
            <div class="detail-section">
              <div class="detail-field">
                <span class="detail-label">状态</span>
                <span class="status-badge-sm"
                  :style="{
                    background: statusBg(detailSubmission?.status || 'pending'),
                    color: statusColor(detailSubmission?.status || 'pending')
                  }">
                  {{ statusLabel(detailSubmission?.status || 'pending') }}
                </span>
              </div>
              <div v-if="detailAssignment.description" class="detail-field">
                <span class="detail-label">作业描述</span>
                <p class="detail-text">{{ detailAssignment.description }}</p>
              </div>
              <div v-if="detailAssignment.deadline" class="detail-field">
                <span class="detail-label">截止日期</span>
                <span class="detail-text" :class="{ overdue: isOverdue(detailAssignment.deadline) }">
                  <Clock :size="12" stroke-width="2" /> {{ detailAssignment.deadline }}
                </span>
              </div>
              <div v-if="detailAssignment.attachments.length > 0" class="detail-field">
                <span class="detail-label">教师附件（{{ detailAssignment.attachments.length }} 个）</span>
              </div>
            </div>

            <!-- Graded Info -->
            <div v-if="detailSubmission?.status === 'graded'" class="detail-section graded-section">
              <h4 class="detail-section-title">
                <CheckCircle :size="16" stroke-width="2" color="#10B981" />
                批改结果
              </h4>
              <div class="grade-row">
                <span class="grade-big">{{ detailSubmission.grade }} 分</span>
                <span v-if="detailSubmission.feedback" class="grade-feedback">— {{ detailSubmission.feedback }}</span>
              </div>
              <div v-if="detailSubmission.gradedAt" class="detail-field">
                <span class="detail-label">批改时间</span>
                <span class="detail-text">{{ formatTime(detailSubmission.gradedAt) }}</span>
              </div>
            </div>

            <!-- Submitted Files (view mode) -->
            <div v-if="detailSubmission?.status === 'submitted' || detailSubmission?.status === 'graded' || detailSubmission?.status === 'returned'" class="detail-section">
              <h4 class="detail-section-title">已提交文件</h4>
              <div v-if="detailSubmission.files.length === 0" class="detail-text dim">无文件（仅标记完成）</div>
              <div v-else class="detail-file-list">
                <div v-for="f in detailSubmission.files" :key="f.id" class="detail-file-item">
                  <span class="dfi-name">{{ f.name }}</span>
                  <span class="dfi-size">({{ (f.size / 1024).toFixed(1) }} KB)</span>
                </div>
              </div>
              <div v-if="detailSubmission.submittedAt" class="detail-field">
                <span class="detail-label">提交时间</span>
                <span class="detail-text">{{ formatTime(detailSubmission.submittedAt) }}</span>
              </div>
            </div>

            <!-- Submit Area (for pending/returned) -->
            <div v-if="canSubmit(detailSubmission?.status || 'pending')" class="detail-section submit-section">
              <h4 class="detail-section-title">
                <Upload :size="16" stroke-width="2" color="#10B981" />
                提交作业
              </h4>

              <!-- Note -->
              <div class="detail-field">
                <span class="detail-label">备注</span>
                <textarea v-model="detailNote" class="detail-note-input" placeholder="可填写作业备注..." rows="3" />
              </div>

              <!-- File Upload -->
              <div class="detail-field">
                <span class="detail-label">作业文件</span>
                <div class="detail-upload-area">
                  <div v-if="detailFiles.length > 0" class="detail-file-list">
                    <div v-for="f in detailFiles" :key="f.id" class="detail-file-item">
                      <span class="dfi-name">{{ f.name }}</span>
                      <span class="dfi-size">({{ (f.size / 1024).toFixed(1) }} KB)</span>
                      <button class="dfi-remove" @click="removeDetailFile(f.id)">✕</button>
                    </div>
                  </div>
                  <label class="detail-upload-btn">
                    <Upload :size="14" stroke-width="2" />
                    选择文件
                    <input type="file" multiple style="display:none" @change="handleDetailFile" />
                  </label>
                </div>
              </div>

              <div class="detail-submit-row">
                <button class="btn-confirm" :disabled="detailSubmitting" @click="handleDetailSubmit">
                  <Send :size="16" stroke-width="2" />
                  {{ detailSubmitting ? '提交中...' : '提交作业' }}
                </button>
              </div>
            </div>

            <!-- Returned info -->
            <div v-if="detailSubmission?.status === 'returned'" class="detail-section returned-notice">
              <AlertCircle :size="16" stroke-width="2" color="#6366F1" />
              <span>作业已被退回，请根据评语修改后重新提交</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.workspace {
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

/* --- Auto student view --- */
.auto-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-5);
}

.auto-banner strong {
  color: var(--text-primary);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
  cursor: pointer;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  transition: all var(--duration-fast) var(--ease-out);
}

.stat-card:hover {
  background: var(--bg-secondary);
  border-color: #10B981;
}

.stat-card.active {
  background: rgba(16, 185, 129, 0.08);
  border-color: #10B981;
  box-shadow: 0 0 0 2px rgba(16,185,129,0.15);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.class-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.class-group-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  border-left: 3px solid #10B981;
  padding-left: var(--space-3);
}

.ac-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ac-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
}

.ac-card.pending { border-left: 3px solid #9CA3AF; }
.ac-card.submitted { border-left: 3px solid #F59E0B; }
.ac-card.graded { border-left: 3px solid #10B981; }
.ac-card.returned { border-left: 3px solid #6366F1; }

.ac-card.clickable {
  cursor: pointer;
  transition: box-shadow var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.ac-card.clickable:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transform: translateY(-1px);
}

.ac-footer {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.ac-click-hint {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  opacity: 0.7;
}

/* --- Detail Modal --- */
.detail-modal .modal-body {
  max-height: 60vh;
  overflow-y: auto;
}

.detail-section {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
}

.detail-section:last-child {
  border-bottom: none;
}

.detail-section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.detail-field:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary);
}

.detail-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.5;
  margin: 0;
}

.detail-text.dim {
  color: var(--text-tertiary);
  font-style: italic;
}

.detail-text.overdue {
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.graded-section {
  background: rgba(16, 185, 129, 0.04);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
}

.grade-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.grade-big {
  font-size: var(--text-lg);
  font-weight: 700;
  color: #10B981;
}

.grade-feedback {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.detail-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.detail-file-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
}

.dfi-name {
  color: var(--text-primary);
  font-weight: 500;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dfi-size {
  color: var(--text-tertiary);
  font-size: 0.6rem;
}

.dfi-remove {
  font-size: 0.6rem;
  color: var(--danger);
  padding: 1px;
  margin-left: var(--space-1);
}

.dfi-remove:hover {
  opacity: 0.8;
}

.submit-section {
  background: rgba(16, 185, 129, 0.03);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
}

.detail-note-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  font-family: inherit;
  resize: vertical;
}

.detail-note-input:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.detail-upload-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  font-size: 0.75rem;
  color: #10B981;
  background: rgba(16, 185, 129, 0.08);
  border-radius: var(--radius-sm);
  cursor: pointer;
  align-self: flex-start;
}

.detail-upload-btn:hover {
  background: rgba(16, 185, 129, 0.15);
}

.detail-submit-row {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

.returned-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: #6366F1;
  background: rgba(99, 102, 241, 0.06);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.ac-header-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.ac-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge-sm {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 600;
}

.ac-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
  line-height: 1.4;
}

.ac-meta {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.ac-deadline {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.ac-deadline.overdue { color: var(--danger); }

.ac-grade-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(16, 185, 129, 0.06);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.grade-score {
  font-size: var(--text-sm);
  font-weight: 600;
  color: #10B981;
}

.grade-fb {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.ac-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.ac-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.ac-action-btn.upload {
  color: #10B981;
  background: rgba(16, 185, 129, 0.08);
}

.ac-action-btn.upload:hover { background: rgba(16, 185, 129, 0.15); }

.ac-action-btn.done {
  color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
}

.ac-action-btn.done:hover { background: rgba(99, 102, 241, 0.15); }
.ac-action-btn.done:disabled { opacity: 0.5; cursor: not-allowed; }

/* --- Query Area --- */
.query-card {
  margin-bottom: var(--space-6);
}

.query-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
}

.query-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.query-field span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.query-field select {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.query-field select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.query-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  white-space: nowrap;
  transition: background var(--duration-fast) var(--ease-out);
}

.query-btn:hover { background: #059669; }
.query-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

/* --- Assignment List --- */
.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.asg-wrapper {
  display: flex;
  flex-direction: column;
}

.asg-card {
  cursor: pointer;
  transition: box-shadow var(--duration-fast) var(--ease-out);
}

.asg-card:hover {
  box-shadow: var(--shadow-md);
}

.asg-card.expanded {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.asg-main {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.asg-expand-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.asg-body {
  flex: 1;
  min-width: 0;
}

.asg-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 2px;
}

.asg-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.overdue-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--danger);
  background: rgba(239, 68, 68, 0.08);
}

.asg-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asg-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.asg-deadline {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.asg-attach {
  font-size: 0.65rem;
  color: var(--accent);
}

.asg-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  min-width: 160px;
}

.progress-bar-wrap {
  width: 70px;
  height: 6px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #10B981;
  border-radius: var(--radius-full);
  transition: width 0.3s var(--ease-out);
}

.progress-text {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* --- Expanded Detail --- */
.asg-detail {
  background: var(--bg-secondary);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: var(--space-4) var(--space-6) var(--space-5);
  border: 1px solid var(--border);
  border-top: none;
}

.detail-header {
  margin-bottom: var(--space-4);
}

.detail-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.detail-table-wrap {
  overflow-x: auto;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.detail-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  color: var(--text-tertiary);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.detail-table td {
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.detail-table tr:hover td {
  background: rgba(16, 185, 129, 0.04);
}

.student-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stu-avatar-sm {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: #10B981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 600;
  flex-shrink: 0;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  margin-right: var(--space-1);
  flex-shrink: 0;
}

.status-text {
  font-weight: 500;
}

.time-cell {
  white-space: nowrap;
  font-size: 0.65rem;
}

.feedback-cell {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
}

.grade-val {
  font-weight: 600;
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  font-size: 0.7rem;
  font-weight: 500;
  color: white;
  background: #10B981;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: background var(--duration-fast) var(--ease-out);
}

.submit-btn:hover { background: #059669; }

.status-hint {
  font-size: 0.65rem;
  white-space: nowrap;
}

.submitted-hint { color: #F59E0B; }
.graded-hint { color: #10B981; }

.detail-summary {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
}

.sum-item {
  font-size: var(--text-xs);
  font-weight: 500;
}

/* ======================== SUBMIT MODAL ======================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-content {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
}

.submit-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.submit-who,
.submit-what {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.submit-who strong,
.submit-what strong {
  color: var(--text-primary);
}

.submit-upload-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.submit-files {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.submit-file-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sfc-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfc-remove {
  font-size: 0.6rem;
  color: var(--text-tertiary);
  padding: 1px;
}

.sfc-remove:hover { color: var(--danger); }

.submit-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: #10B981;
  background: rgba(16, 185, 129, 0.08);
  border-radius: var(--radius-sm);
  cursor: pointer;
  align-self: flex-start;
}

.submit-upload-btn:hover {
  background: rgba(16, 185, 129, 0.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
}

.btn-cancel {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  margin-right: auto;
}

.btn-cancel:hover { background: var(--bg-tertiary); }

.btn-mark-done {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-mark-done:hover { background: rgba(99, 102, 241, 0.15); }
.btn-mark-done:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: background var(--duration-fast) var(--ease-out);
}

.btn-confirm:hover { background: #059669; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

[data-theme="dark"] .modal-content { background: var(--dark-surface); }
[data-theme="dark"] .modal-overlay { background: rgba(0, 0, 0, 0.6); }
[data-theme="dark"] .asg-detail { background: var(--dark-bg); }

@media (max-width: 768px) {
  .query-row { flex-direction: column; align-items: stretch; }
  .query-btn { justify-content: center; }
  .asg-progress { min-width: auto; width: 100%; justify-content: flex-end; margin-top: var(--space-2); }
  .asg-main { flex-wrap: wrap; }
}
</style>
