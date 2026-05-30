<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import StudentFormModal from './StudentFormModal.vue'
import type { Student, StudentStatus } from '@/types/classflow'
import { Plus, User, Edit2, Archive, Trash2 } from 'lucide-vue-next'

const cf = useClassFlowStore()
const auth = useAuthStore()
const toast = useToast()

function getLinkedUser(studentId: string) {
  return auth.users.find(u => u.studentId === studentId)
}

const filterStatus = ref<StudentStatus | 'all'>('all')
const showModal = ref(false)
const editingStudent = ref<Student | null>(null)

const filteredStudents = computed(() => {
  if (filterStatus.value === 'all') return cf.students
  return cf.students.filter(s => s.status === filterStatus.value)
})

const statusFilters = [
  { id: 'all' as const, label: '全部', count: cf.students.length },
  { id: 'active' as const, label: '在读', count: cf.activeStudents.length },
  { id: 'archived' as const, label: '已归档', count: cf.archivedStudents.length },
  { id: 'graduated' as const, label: '已毕业', count: cf.graduatedStudents.length },
]

function openAdd() {
  editingStudent.value = null
  showModal.value = true
}

function openEdit(student: Student) {
  editingStudent.value = student
  showModal.value = true
}

function handleSave(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) {
  if (editingStudent.value) {
    cf.updateStudent(editingStudent.value.id, data)
    toast.show('已更新', `学生「${data.name}」信息已更新`, '✅', '#10B981')
  } else {
    cf.addStudent(data)
    toast.show('已添加', `学生「${data.name}」已加入`, '✅', '#10B981')
  }
  showModal.value = false
}

function handleDelete(student: Student) {
  if (confirm(`确定要删除学生「${student.name}」吗？此操作不可撤销。`)) {
    cf.deleteStudent(student.id)
    toast.show('已删除', `学生「${student.name}」已移除`, '🗑️', '#EF4444')
  }
}

function handleArchive(student: Student) {
  cf.archiveStudent(student.id)
  toast.show('已归档', `学生「${student.name}」已归档`, '📁', '#F59E0B')
}

function statusClass(status: string) {
  return status === 'active' ? '' : 'inactive'
}
</script>

<template>
  <div class="students-view">
    <div class="page-header">
      <h2 class="page-title">学生库</h2>
      <button class="btn-primary" @click="openAdd">
        <Plus :size="16" stroke-width="2" />
        <span>添加学生</span>
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button
        v-for="f in statusFilters"
        :key="f.id"
        class="filter-btn"
        :class="{ active: filterStatus === f.id }"
        @click="filterStatus = f.id"
      >
        {{ f.label }}
        <span class="count">{{ f.count }}</span>
      </button>
    </div>

    <!-- Student Grid -->
    <div v-if="filteredStudents.length === 0" class="empty-state">
      <User :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>暂无学生</p>
    </div>
    <div v-else class="student-grid">
      <GlassCard
        v-for="student in filteredStudents"
        :key="student.id"
        padding="var(--space-5)"
        class="student-card"
        :class="statusClass(student.status)"
      >
        <div class="card-top">
          <div class="student-avatar" :style="{ background: '#10B981' }">
            {{ student.name.charAt(0) }}
          </div>
          <div class="student-info">
            <span class="student-name">{{ student.name }}</span>
            <span class="student-status-badge" :class="student.status">
              {{ { active: '在读', archived: '已归档', graduated: '已毕业' }[student.status] }}
            </span>
          </div>
        </div>
        <div class="student-meta">
          <span v-if="student.phone">📱 {{ student.phone }}</span>
          <span v-if="student.wechat">💬 {{ student.wechat }}</span>
          <span v-if="getLinkedUser(student.id)" class="linked-user">🔗 {{ getLinkedUser(student.id)!.username }}</span>
        </div>
        <div v-if="student.tags.length" class="student-tags">
          <span v-for="tag in student.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <div class="card-actions">
          <button class="icon-btn" title="编辑" @click="openEdit(student)">
            <Edit2 :size="14" stroke-width="2" />
          </button>
          <button v-if="student.status === 'active'" class="icon-btn" title="归档" @click="handleArchive(student)">
            <Archive :size="14" stroke-width="2" />
          </button>
          <button class="icon-btn danger" title="删除" @click="handleDelete(student)">
            <Trash2 :size="14" stroke-width="2" />
          </button>
        </div>
      </GlassCard>
    </div>

    <StudentFormModal
      :visible="showModal"
      :student="editingStudent"
      @save="handleSave"
      @close="showModal = false"
    />
  </div>
</template>

<style scoped>
.students-view {
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

.btn-primary:hover {
  background: #059669;
}

.filter-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-btn:hover {
  background: var(--bg-tertiary);
}

.filter-btn.active {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.count {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.student-card {
  position: relative;
}

.student-card.inactive {
  opacity: 0.7;
}

.card-top {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.student-avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.student-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.student-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.student-status-badge {
  font-size: 0.65rem;
  padding: 1px var(--space-2);
  border-radius: var(--radius-full);
  display: inline-block;
  width: fit-content;
}

.student-status-badge.active {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.student-status-badge.archived {
  background: rgba(245, 158, 11, 0.12);
  color: #F59E0B;
}

.student-status-badge.graduated {
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
}

.student-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.student-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.tag {
  padding: 1px var(--space-2);
  font-size: 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
}

.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all var(--duration-fast) var(--ease-out);
}

.icon-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

@media (max-width: 768px) {
  .student-grid {
    grid-template-columns: 1fr;
  }
}
</style>
