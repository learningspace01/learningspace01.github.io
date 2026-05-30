<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import GlassCard from '@/components/GlassCard.vue'
import { Calendar, ClipboardCheck, Clock, Users, FileEdit, UserCheck, ArrowRight } from 'lucide-vue-next'

const emit = defineEmits<{
  navigate: [tabId: string]
}>()

const cf = useClassFlowStore()
const auth = useAuthStore()
const settingsStore = useSettingsStore()

const greeting = computed(() => {
  const name = auth.currentUser?.displayName || ''
  const role = { admin: '管理员', teacher: '老师', student: '同学' }[auth.currentUser?.role || 'student'] || ''
  return `${name}${role}，${settingsStore.todayGreeting}`
})
const greetingEmoji = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return '☀️'
  if (h < 18) return '🌤️'
  return '🌙'
})

const todayClasses = computed(() => {
  return cf.todaySessions.map(s => {
    const cls = cf.classes.find(c => c.id === s.classId)
    return { ...s, className: cls?.name || '未命名班级' }
  })
})

const stats = computed(() => [
  { icon: Calendar, label: '本周课时', value: `${cf.weeklyStats.totalHours}h`, color: '#4F6EF7' },
  { icon: Users, label: '平均出勤率', value: `${cf.weeklyStats.avgAttendance}%`, color: '#10B981' },
  { icon: FileEdit, label: '作业提交率', value: `${cf.weeklyStats.submissionRate}%`, color: '#F59E0B' },
  { icon: ClipboardCheck, label: '待批改', value: cf.pendingSubmissions.length, color: '#EF4444' },
])

const pendingActions = computed(() => {
  const actions: { label: string; type: string }[] = []
  if (cf.pendingSubmissions.length > 0) {
    actions.push({ label: `${cf.pendingSubmissions.length} 份作业待批改`, type: '作业' })
  }
  const overdue = cf.overdueAssignments.length
  if (overdue > 0) {
    actions.push({ label: `${overdue} 个作业已逾期`, type: '逾期' })
  }
  return actions
})

// --- Student Detail (Class-first) ---
const selectedClassId = ref<string | null>(cf.classes.length > 0 ? cf.classes[0].id : null)
const selectedStudentId = ref<string | null>(null)

const classStudents = computed(() => {
  if (!selectedClassId.value) return []
  return cf.getStudentsByClass(selectedClassId.value)
})

function selectStudent(id: string) {
  selectedStudentId.value = selectedStudentId.value === id ? null : id
}

const studentDetail = computed(() => {
  if (!selectedStudentId.value) return null
  return cf.getStudentDetail(selectedStudentId.value)
})

function statusLabel(s: string): string {
  return { present: '出勤', late: '迟到', absent: '缺勤', leave: '请假' }[s] || s
}

function statusColor(s: string): string {
  return { present: '#10B981', late: '#F59E0B', absent: '#EF4444', leave: '#6366F1' }[s] || '#999'
}

function statusLabelSub(s: string): string {
  return { submitted: '待批改', graded: '已批改', pending: '未提交', returned: '已退回' }[s] || s
}
</script>

<template>
  <div class="dashboard">
    <div class="greeting-section">
      <h2 class="greeting">{{ greeting }} {{ greetingEmoji }}</h2>
      <p class="greeting-sub">
        {{ cf.activeStudents.length }} 名在读学生 · {{ cf.classes.length }} 个班级
      </p>
    </div>

    <!-- Stats Row -->
    <div class="stats-row">
      <GlassCard
        v-for="stat in stats"
        :key="stat.label"
        padding="var(--space-5) var(--space-6)"
        class="stat-card"
      >
        <div class="stat-icon" :style="{ background: stat.color + '15' }">
          <component :is="stat.icon" :size="20" :color="stat.color" stroke-width="2" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </GlassCard>
    </div>

    <!-- Today's Classes -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title">
          <Calendar :size="18" stroke-width="2" />
          今日课程
        </h3>
      </div>
      <div v-if="todayClasses.length === 0" class="empty-state">
        <p>今天没有课程安排 🎉</p>
      </div>
      <div v-else class="session-list">
        <GlassCard
          v-for="s in todayClasses"
          :key="s.id"
          padding="var(--space-5) var(--space-6)"
          class="session-card"
        >
          <div class="session-time">
            <Clock :size="16" stroke-width="2" />
            <span>{{ s.startTime }} - {{ s.endTime }}</span>
          </div>
          <div class="session-info">
            <span class="session-class">{{ s.className }}</span>
            <span class="session-topic">{{ s.topic || '无主题' }}</span>
          </div>
          <div v-if="s.isRescheduled" class="rescheduled-badge">调课</div>
        </GlassCard>
      </div>
    </section>

    <!-- Action Items -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title">
          <ClipboardCheck :size="18" stroke-width="2" />
          待办事项
        </h3>
      </div>
      <div v-if="pendingActions.length === 0" class="empty-state">
        <p>太棒了！所有事项都已处理 ☕️</p>
      </div>
      <div v-else class="action-list">
        <button
          v-for="(item, i) in pendingActions"
          :key="i"
          class="action-item"
          :class="{ overdue: item.type === '逾期' }"
          @click="emit('navigate', 'assignments')"
        >
          <span class="action-badge" :class="item.type">{{ item.type }}</span>
          <span class="action-text">{{ item.label }}</span>
          <ArrowRight :size="14" stroke-width="2" class="action-arrow" />
        </button>
      </div>
    </section>

    <!-- Student Detail Section -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title">
          <UserCheck :size="18" stroke-width="2" />
          学生明细
        </h3>
      </div>

      <!-- Class Selector -->
      <div class="class-selector">
        <select v-model="selectedClassId" @change="selectedStudentId = null">
          <option value="" disabled>选择班级</option>
          <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">
            {{ cls.name }}
          </option>
        </select>
      </div>

      <!-- Student List -->
      <div v-if="selectedClassId && classStudents.length === 0" class="empty-state">
        <p>该班级暂无学生</p>
      </div>
      <div v-else-if="classStudents.length > 0" class="student-list">
        <button
          v-for="stu in classStudents"
          :key="stu.id"
          class="student-list-item"
          :class="{ active: selectedStudentId === stu.id }"
          @click="selectStudent(stu.id)"
        >
          <div class="sl-avatar">{{ stu.name.charAt(0) }}</div>
          <span class="sl-name">{{ stu.name }}</span>
          <span class="sl-check">{{ selectedStudentId === stu.id ? '✓' : '' }}</span>
        </button>
      </div>

      <!-- Detail Content -->
      <div v-if="!selectedStudentId" class="empty-state">
        <p>请在上方选择学生查看明细数据</p>
      </div>

      <template v-else-if="studentDetail">
        <!-- Overview Cards -->
        <div class="detail-stats-row">
          <GlassCard padding="var(--space-4) var(--space-5)" class="ds-card">
            <span class="ds-value">{{ studentDetail.attendance.total }}</span>
            <span class="ds-label">总课次</span>
          </GlassCard>
          <GlassCard padding="var(--space-4) var(--space-5)" class="ds-card">
            <span class="ds-value" :style="{ color: studentDetail.attendance.attendanceRate >= 80 ? '#10B981' : '#F59E0B' }">
              {{ studentDetail.attendance.attendanceRate }}%
            </span>
            <span class="ds-label">出勤率</span>
          </GlassCard>
          <GlassCard padding="var(--space-4) var(--space-5)" class="ds-card">
            <span class="ds-value">{{ studentDetail.homework.submitted }}</span>
            <span class="ds-label">已提交作业</span>
          </GlassCard>
          <GlassCard padding="var(--space-4) var(--space-5)" class="ds-card">
            <span class="ds-value">{{ studentDetail.homework.avgGrade || '-' }}</span>
            <span class="ds-label">平均分</span>
          </GlassCard>
        </div>

        <!-- Attendance Breakdown -->
        <GlassCard padding="var(--space-5)" class="detail-card">
          <h4 class="detail-card-title">出勤明细</h4>
          <div class="att-breakdown">
            <span class="ab-item" style="color:#10B981">出勤 {{ studentDetail.attendance.present }}</span>
            <span class="ab-item" style="color:#F59E0B">迟到 {{ studentDetail.attendance.late }}</span>
            <span class="ab-item" style="color:#EF4444">缺勤 {{ studentDetail.attendance.absent }}</span>
            <span class="ab-item" style="color:#6366F1">请假 {{ studentDetail.attendance.leave }}</span>
            <span v-if="studentDetail.attendance.exempted" class="ab-item" style="color:#9CA3AF">
              豁免 {{ studentDetail.attendance.exempted }}
            </span>
          </div>

          <!-- Attendance History Table -->
          <div v-if="studentDetail.attendance.records.length > 0" class="detail-table-wrap">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>日期</th><th>班级</th><th>时间</th><th>状态</th><th>主题</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in studentDetail.attendance.records.slice(0, 20)"
                  :key="r.sessionId"
                  :class="{ exempted: r.isHolidayExempted, rescheduled: r.isRescheduled }"
                >
                  <td>{{ r.date }}</td>
                  <td>{{ r.className }}</td>
                  <td>{{ r.startTime }}-{{ r.endTime }}</td>
                  <td>
                    <span class="status-badge" :style="{ background: statusColor(r.status) + '18', color: statusColor(r.status) }">
                      {{ statusLabel(r.status) }}
                    </span>
                    <span v-if="r.isHolidayExempted" class="exempted-tag">豁免</span>
                    <span v-if="r.isRescheduled" class="rs-tag">调课</span>
                  </td>
                  <td>{{ r.topic || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>

        <!-- Homework Detail -->
        <GlassCard padding="var(--space-5)" class="detail-card">
          <h4 class="detail-card-title">作业明细</h4>
          <div class="hw-breakdown">
            <span class="ab-item" style="color:#10B981">已批改 {{ studentDetail.homework.graded }}</span>
            <span class="ab-item" style="color:#F59E0B">待批改 {{ studentDetail.homework.submitted }}</span>
            <span class="ab-item" style="color:#9CA3AF">未提交 {{ studentDetail.homework.pending }}</span>
          </div>

          <div v-if="studentDetail.homework.details.length > 0" class="detail-table-wrap">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>作业</th><th>班级</th><th>状态</th><th>分数</th><th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in studentDetail.homework.details.slice(0, 20)" :key="h.assignmentId">
                  <td>{{ h.title }}</td>
                  <td>{{ h.className }}</td>
                  <td>
                    <span class="status-badge" :class="h.status">
                      {{ statusLabelSub(h.status) }}
                    </span>
                  </td>
                  <td>{{ h.grade > 0 ? h.grade : '-' }}</td>
                  <td>{{ h.submittedAt ? new Date(h.submittedAt).toLocaleDateString('zh-CN') : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            <p>暂无作业记录</p>
          </div>
        </GlassCard>
      </template>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  animation: fadeInUp 0.3s var(--ease-out);
}

.greeting-section {
  margin-bottom: var(--space-8);
}

.greeting {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.greeting-sub {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-body {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.section {
  margin-bottom: var(--space-6);
}

.section-header {
  margin-bottom: var(--space-4);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.session-card {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  cursor: default;
}

.session-time {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.session-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.session-class {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.session-topic {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.rescheduled-badge {
  font-size: 0.65rem;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
  font-weight: 500;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.action-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);
}

.action-item:hover {
  background: rgba(16, 185, 129, 0.08);
}

.action-text {
  flex: 1;
}

.action-arrow {
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.action-item:hover .action-arrow {
  opacity: 1;
}

.action-badge {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
}

.action-badge.作业 {
  background: rgba(79, 110, 247, 0.12);
  color: var(--accent);
}

.action-badge.逾期 {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

/* Student Detail */
.class-selector {
  margin-bottom: var(--space-4);
}

.class-selector select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.class-selector select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.student-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.student-list-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.student-list-item:hover {
  background: rgba(16, 185, 129, 0.08);
  color: var(--text-primary);
}

.student-list-item.active {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.sl-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: #10B981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  flex-shrink: 0;
}

.sl-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sl-check {
  font-size: 0.75rem;
  font-weight: 700;
  color: #10B981;
}

.detail-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.ds-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
}

.ds-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.ds-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.detail-card {
  margin-bottom: var(--space-4);
}

.detail-card-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.att-breakdown,
.hw-breakdown {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.ab-item {
  font-size: var(--text-sm);
  font-weight: 500;
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
}

.detail-table td {
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.detail-table tr:hover td {
  background: var(--bg-secondary);
}

.detail-table tr.exempted td {
  opacity: 0.6;
}

.status-badge {
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 500;
  display: inline-block;
}

.exempted-tag {
  font-size: 0.6rem;
  padding: 1px var(--space-1);
  background: rgba(156, 163, 175, 0.15);
  color: var(--text-tertiary);
  border-radius: var(--radius-sm);
  margin-left: var(--space-1);
}

.rs-tag {
  font-size: 0.6rem;
  padding: 1px var(--space-1);
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
  border-radius: var(--radius-sm);
  margin-left: var(--space-1);
}


@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .detail-stats-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr; }
  .detail-stats-row { grid-template-columns: 1fr; }
}
</style>
