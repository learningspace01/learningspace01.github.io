<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useClassFlowFileStorage } from '@/composables/useClassFlowFileStorage'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import GradingModal from './GradingModal.vue'
import type { Assignment, Submission, Student, SubmissionFileMeta } from '@/types/classflow'
import {
  Plus, FileEdit, Clock, CheckCircle, AlertCircle, Upload, Eye,
  X, ChevronDown, ChevronRight, Trash2, Send, ArrowLeftCircle,
} from 'lucide-vue-next'

const cf = useClassFlowStore()
const fs = useClassFlowFileStorage()
const toast = useToast()

// --- Class filter ---
const selectedClassId = ref<string | null>(cf.classes.length > 0 ? cf.classes[0].id : null)

const classAssignments = computed(() =>
  selectedClassId.value ? cf.assignments.filter(a => a.classId === selectedClassId.value) : []
)
const classStudents = computed(() =>
  selectedClassId.value ? cf.getStudentsByClass(selectedClassId.value) : []
)

// --- Deploy Modal ---
const showDeployModal = ref(false)

// Deploy form state
const deployClassId = ref<string | null>(null)
const deployTitle = ref('')
const deployDescription = ref('')
const deployDeadline = ref('')
const deployAttachments = ref<SubmissionFileMeta[]>([])

function openDeployModal() {
  deployClassId.value = selectedClassId.value
  deployTitle.value = ''
  deployDescription.value = ''
  deployDeadline.value = ''
  deployAttachments.value = []
  showDeployModal.value = true
}

function closeDeployModal() {
  showDeployModal.value = false
}

function handleDeployAttachment(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  for (const file of Array.from(input.files)) {
    fs.storeFile(file, 'asg_attach').then(meta => {
      deployAttachments.value.push(meta)
    })
  }
  input.value = ''
}

function removeDeployAttachment(id: string) {
  deployAttachments.value = deployAttachments.value.filter(a => a.id !== id)
}

function handleDeploy() {
  const clsId = deployClassId.value || selectedClassId.value
  if (!deployTitle.value.trim() || !clsId) return
  const title = deployTitle.value.trim()
  cf.addAssignment({
    classId: clsId,
    title,
    description: deployDescription.value.trim(),
    deadline: deployDeadline.value,
    attachments: deployAttachments.value.map(a => a.id),
  })
  closeDeployModal()
  toast.show('已布置', `作业「${title}」已下发到班级`, '📝', '#10B981')
}

// --- Expanded assignment ---
const expandedAssignmentId = ref<string | null>(null)

function toggleExpand(asgId: string) {
  expandedAssignmentId.value = expandedAssignmentId.value === asgId ? null : asgId
}

// Submission summary for an assignment
function getSubmissionSummary(asgId: string) {
  const subs = cf.getSubmissionsByAssignment(asgId)
  const students = classStudents.value
  const submitted = subs.filter(s => s.status === 'submitted')
  const graded = subs.filter(s => s.status === 'graded')
  const returned = subs.filter(s => s.status === 'returned')
  const pending = students.filter(stu =>
    !subs.find(s => s.studentId === stu.id)
    || subs.find(s => s.studentId === stu.id)?.status === 'pending'
  )
  return {
    total: students.length,
    pending: pending.length,
    submitted: submitted.length,
    graded: graded.length,
    returned: returned.length,
    rate: students.length > 0 ? Math.round((submitted.length + graded.length) / students.length * 100) : 0,
  }
}

// Student submission detail for expanded assignment
interface StudentSubRow {
  student: Student
  submission: Submission | undefined
  status: string
}

function getStudentRows(asgId: string): StudentSubRow[] {
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

// --- Detail Modal ---
const detailSubmission = ref<Submission | null>(null)
const showDetail = ref(false)

function openDetail(sub: Submission) {
  detailSubmission.value = sub
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  detailSubmission.value = null
}

function detailStudentName(sub: Submission): string {
  const stu = cf.students.find(s => s.id === sub.studentId)
  return stu?.name || '未知'
}

// --- Grading ---
const gradingSubmission = ref<Submission | null>(null)
const showGrading = ref(false)

function openGrading(sub: Submission) {
  gradingSubmission.value = sub
  showGrading.value = true
}

function handleGraded() {
  showGrading.value = false
  gradingSubmission.value = null
}

// --- Return (打回) ---
const returnSubmissionData = ref<Submission | null>(null)
const showReturnConfirm = ref(false)
const returnReason = ref('')

function openReturnConfirm(sub: Submission) {
  returnSubmissionData.value = sub
  returnReason.value = ''
  showReturnConfirm.value = true
}

function handleReturn() {
  if (!returnSubmissionData.value) return
  cf.returnSubmission(returnSubmissionData.value.id, returnReason.value.trim())
  toast.show('已打回', `作业已打回给学生重新提交`, '🔄', '#6366F1')
  showReturnConfirm.value = false
  returnSubmissionData.value = null
}

// --- Delete assignment ---
function handleDelete(asgId: string) {
  if (confirm('确定要删除这个作业吗？相关提交记录也会被删除。')) {
    cf.deleteAssignment(asgId)
    if (expandedAssignmentId.value === asgId) expandedAssignmentId.value = null
    toast.show('已删除', '作业已删除', '🗑️', '#EF4444')
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

function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="assignments-view">
    <!-- Page Header -->
    <div class="page-header">
      <h2 class="page-title">作业中心</h2>
      <div class="header-actions">
        <select v-model="selectedClassId" class="class-filter">
          <option :value="null" disabled>选择班级</option>
          <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
        </select>
        <button class="btn-primary" @click="openDeployModal">
          <Plus :size="18" stroke-width="2" />
          <span>布置新作业</span>
        </button>
      </div>
    </div>

    <!-- Empty states -->
    <div v-if="!selectedClassId" class="empty-state">
      <FileEdit :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>请先选择班级</p>
    </div>
    <div v-else-if="classAssignments.length === 0" class="empty-state">
      <FileEdit :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>暂无作业，点击「布置新作业」下发任务</p>
    </div>

    <!-- Assignment List -->
    <div v-else class="assignment-list">
      <div
        v-for="asg in classAssignments"
        :key="asg.id"
        class="asg-card-wrapper"
      >
        <!-- Assignment Card -->
        <GlassCard padding="var(--space-5) var(--space-6)" class="asg-card" :class="{ expanded: expandedAssignmentId === asg.id }">
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
              <span v-if="getSubmissionSummary(asg.id).submitted > 0" class="pending-badge">
                {{ getSubmissionSummary(asg.id).submitted }} 待批改
              </span>
            </div>
          </div>
        </GlassCard>

        <!-- Expanded Detail Table -->
        <div v-if="expandedAssignmentId === asg.id" class="asg-detail">
          <div class="detail-header">
            <span class="detail-title">{{ asg.title }} — 提交明细</span>
            <button class="delete-btn" @click="handleDelete(asg.id)">
              <Trash2 :size="14" stroke-width="2" />
              删除作业
            </button>
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
                  <td>{{ row.submission?.files.length || 0 }} 个文件</td>
                  <td>
                    <span v-if="row.submission?.grade" class="grade-text" :style="{ color: '#10B981' }">
                      {{ row.submission.grade }} 分
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td>
                    <div class="action-cell">
                      <button
                        v-if="row.submission"
                        class="action-btn detail"
                        title="查看详情"
                        @click="openDetail(row.submission)"
                      >
                        <Eye :size="12" stroke-width="2" />
                        详情
                      </button>
                      <button
                        v-if="row.submission && (row.status === 'submitted')"
                        class="action-btn grade"
                        @click="openGrading(row.submission)"
                      >
                        <Send :size="12" stroke-width="2" />
                        批改
                      </button>
                      <button
                        v-if="row.submission && (row.status === 'submitted' || row.status === 'graded')"
                        class="action-btn return"
                        @click="openReturnConfirm(row.submission)"
                      >
                        <ArrowLeftCircle :size="12" stroke-width="2" />
                        打回
                      </button>
                      <span v-else-if="row.status === 'pending'" class="pending-hint">等待提交</span>
                      <span v-else-if="row.status === 'returned'" class="returned-hint">已退回</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Summary footer -->
          <div class="detail-summary">
            <span class="sum-item" style="color:#9CA3AF">未提交 {{ getSubmissionSummary(asg.id).pending }}</span>
            <span class="sum-item" style="color:#F59E0B">待批改 {{ getSubmissionSummary(asg.id).submitted }}</span>
            <span class="sum-item" style="color:#10B981">已批改 {{ getSubmissionSummary(asg.id).graded }}</span>
            <span v-if="getSubmissionSummary(asg.id).returned > 0" class="sum-item" style="color:#6366F1">已退回 {{ getSubmissionSummary(asg.id).returned }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================== DEPLOY MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showDeployModal" class="modal-overlay" @click.self="closeDeployModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>布置新作业</h3>
            <button class="modal-close" @click="closeDeployModal">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <!-- Class -->
            <label class="modal-field">
              <span>目标班级 <span class="required">*</span></span>
              <select v-model="deployClassId">
                <option :value="null" disabled>选择班级</option>
                <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
              </select>
            </label>

            <!-- Title -->
            <label class="modal-field">
              <span>作业标题 <span class="required">*</span></span>
              <input v-model="deployTitle" placeholder="如：Unit4 录音作业" />
            </label>

            <!-- Description -->
            <label class="modal-field">
              <span>作业描述</span>
              <textarea v-model="deployDescription" placeholder="作业要求、注意事项..." rows="4" />
            </label>

            <!-- Deadline -->
            <label class="modal-field">
              <span>截止日期</span>
              <input v-model="deployDeadline" type="date" />
            </label>

            <!-- Attachments -->
            <label class="modal-field">
              <span>附件材料</span>
              <div class="modal-attach-area">
                <div v-if="deployAttachments.length > 0" class="modal-attach-list">
                  <div v-for="file in deployAttachments" :key="file.id" class="modal-attach-item">
                    <span class="modal-attach-name">{{ file.name }}</span>
                    <button class="modal-attach-remove" @click="removeDeployAttachment(file.id)">✕</button>
                  </div>
                </div>
                <label class="modal-upload-btn">
                  <Upload :size="14" stroke-width="2" />
                  选择文件
                  <input type="file" multiple style="display:none" @change="handleDeployAttachment" />
                </label>
              </div>
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="closeDeployModal">取消</button>
            <button
              class="btn-confirm"
              :disabled="!deployTitle.trim() || !deployClassId"
              @click="handleDeploy"
            >
              <Send :size="16" stroke-width="2" />
              确认布置
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Grading Modal -->
    <GradingModal
      v-if="showGrading && gradingSubmission"
      :submission="gradingSubmission"
      @close="showGrading = false"
      @graded="handleGraded"
    />

    <!-- ======================== DETAIL MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showDetail && detailSubmission" class="modal-overlay" @click.self="closeDetail">
        <div class="modal-content">
          <div class="modal-header">
            <h3>提交详情</h3>
            <button class="modal-close" @click="closeDetail">
              <X :size="20" stroke-width="2" />
            </button>
          </div>
          <div class="modal-body">
            <!-- Student & Assignment -->
            <div class="detail-info-row">
              <div class="detail-info-item">
                <span class="detail-label">学生</span>
                <span class="detail-value">{{ detailStudentName(detailSubmission) }}</span>
              </div>
              <div class="detail-info-item">
                <span class="detail-label">状态</span>
                <span class="status-badge-sm"
                  :style="{
                    background: statusBg(detailSubmission.status),
                    color: statusColor(detailSubmission.status)
                  }">
                  {{ statusLabel(detailSubmission.status) }}
                </span>
              </div>
            </div>

            <!-- Submitted Files -->
            <div class="detail-section">
              <h4 class="detail-section-title">提交文件</h4>
              <div v-if="detailSubmission.files.length === 0" class="detail-empty">无文件（仅标记完成）</div>
              <div v-else class="detail-file-list">
                <div v-for="f in detailSubmission.files" :key="f.id" class="detail-file-item">
                  <span class="dfi-name">{{ f.name }}</span>
                  <span class="dfi-size">({{ (f.size / 1024).toFixed(1) }} KB)</span>
                </div>
              </div>
              <div v-if="detailSubmission.submittedAt" class="detail-meta">
                <span>提交时间：{{ formatTime(detailSubmission.submittedAt) }}</span>
              </div>
            </div>

            <!-- Grade & Feedback -->
            <div v-if="detailSubmission.status === 'graded'" class="detail-section graded-bg">
              <h4 class="detail-section-title">
                <CheckCircle :size="16" stroke-width="2" color="#10B981" />
                批改结果
              </h4>
              <div class="detail-grade-row">
                <span class="detail-grade-big">{{ detailSubmission.grade }} 分</span>
                <span v-if="detailSubmission.feedback" class="detail-grade-fb">— {{ detailSubmission.feedback }}</span>
              </div>
              <div v-if="detailSubmission.gradedAt" class="detail-meta">
                <span>批改时间：{{ formatTime(detailSubmission.gradedAt) }}</span>
              </div>
            </div>

            <!-- Return Reason -->
            <div v-if="detailSubmission.status === 'returned'" class="detail-section returned-bg">
              <h4 class="detail-section-title">
                <ArrowLeftCircle :size="16" stroke-width="2" color="#6366F1" />
                打回原因
              </h4>
              <p class="detail-return-reason">{{ detailSubmission.feedback || '未填写原因' }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ======================== RETURN CONFIRM MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showReturnConfirm && returnSubmissionData" class="modal-overlay" @click.self="showReturnConfirm = false">
        <div class="modal-content confirm-modal">
          <div class="modal-header">
            <h3>打回作业</h3>
            <button class="modal-close" @click="showReturnConfirm = false">
              <X :size="20" stroke-width="2" />
            </button>
          </div>
          <div class="modal-body">
            <div class="confirm-notice">
              <AlertCircle :size="24" stroke-width="2" color="#6366F1" />
              <div>
                <p class="confirm-title">确定要打回该作业吗？</p>
                <p class="confirm-desc">打回后学生将看到退回状态，可以重新修改并提交。已评分数将被重置。</p>
              </div>
            </div>

            <label class="modal-field">
              <span>打回原因（可选）</span>
              <textarea v-model="returnReason" class="return-reason-input" placeholder="请填写打回原因，方便学生了解修改方向..." rows="3" />
            </label>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showReturnConfirm = false">取消</button>
            <button class="btn-return" @click="handleReturn">
              <ArrowLeftCircle :size="16" stroke-width="2" />
              确认打回
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.assignments-view {
  animation: fadeInUp 0.3s var(--ease-out);
}

/* --- Page Header --- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.class-filter {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.class-filter:focus {
  outline: none;
  border-color: #10B981;
}

.btn-primary {
  display: flex;
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

.btn-primary:hover { background: #059669; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

/* --- Assignment List --- */
.assignment-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.asg-card-wrapper {
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
  min-width: 180px;
}

.progress-bar-wrap {
  width: 80px;
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

.pending-badge {
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.6rem;
  font-weight: 600;
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.12);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.detail-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: 0.7rem;
  color: var(--danger);
  border-radius: var(--radius-sm);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.08);
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

.detail-table tr.returned td {
  opacity: 0.7;
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

.grade-text {
  font-weight: 600;
}

.grade-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: 0.7rem;
  font-weight: 500;
  color: white;
  background: #10B981;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--ease-out);
}

.grade-btn:hover {
  background: #059669;
}

.graded-hint {
  font-size: 0.65rem;
  color: #10B981;
  font-weight: 500;
}

.pending-hint {
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.returned-hint {
  font-size: 0.65rem;
  color: #6366F1;
  font-weight: 500;
}

/* --- Action Buttons --- */
.action-cell {
  display: flex;
  gap: var(--space-1);
  flex-wrap: nowrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: var(--space-1) var(--space-2);
  font-size: 0.65rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.action-btn.detail {
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.action-btn.detail:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.grade {
  color: white;
  background: #10B981;
}

.action-btn.grade:hover {
  background: #059669;
}

.action-btn.return {
  color: #6366F1;
  background: rgba(99, 102, 241, 0.1);
}

.action-btn.return:hover {
  background: rgba(99, 102, 241, 0.2);
}

/* --- Detail Modal --- */
.detail-info-row {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-4);
}

.detail-info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-section {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
}

.detail-section:last-of-type {
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

.detail-empty {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-style: italic;
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

.detail-meta {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-2);
}

.graded-bg {
  background: rgba(16, 185, 129, 0.04);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
}

.detail-grade-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-grade-big {
  font-size: var(--text-lg);
  font-weight: 700;
  color: #10B981;
}

.detail-grade-fb {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.returned-bg {
  background: rgba(99, 102, 241, 0.04);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
}

.detail-return-reason {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* --- Return Confirm Modal --- */
.confirm-modal {
  max-width: 420px;
}

.confirm-notice {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: rgba(99, 102, 241, 0.04);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.confirm-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
}

.confirm-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.return-reason-input {
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

.return-reason-input:focus {
  outline: none;
  border-color: #6366F1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.btn-return {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  background: #6366F1;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: background var(--duration-fast) var(--ease-out);
}

.btn-return:hover {
  background: #4F46E5;
}

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

/* ======================== MODAL ======================== */
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
  max-width: 560px;
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
  transition: all var(--duration-fast) var(--ease-out);
}

.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.modal-field span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.required {
  color: var(--danger);
}

.modal-field input,
.modal-field select,
.modal-field textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  font-family: inherit;
}

.modal-field input:focus,
.modal-field select:focus,
.modal-field textarea:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.modal-field textarea {
  resize: vertical;
}

.modal-attach-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.modal-attach-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.modal-attach-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.modal-attach-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-attach-remove {
  font-size: 0.6rem;
  color: var(--text-tertiary);
  padding: 1px;
}

.modal-attach-remove:hover {
  color: var(--danger);
}

.modal-upload-btn {
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

.modal-upload-btn:hover {
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
}

.btn-cancel:hover {
  background: var(--bg-tertiary);
}

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

.btn-confirm:hover {
  background: #059669;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark mode */
[data-theme="dark"] .modal-content {
  background: var(--dark-surface);
}

[data-theme="dark"] .modal-overlay {
  background: rgba(0, 0, 0, 0.6);
}

[data-theme="dark"] .asg-detail {
  background: var(--dark-bg);
}

/* Responsive */
@media (max-width: 768px) {
  .asg-progress {
    min-width: auto;
    width: 100%;
    justify-content: flex-end;
    margin-top: var(--space-2);
  }

  .asg-main {
    flex-wrap: wrap;
  }

  .progress-bar-wrap {
    width: 60px;
  }

  .modal-content {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
