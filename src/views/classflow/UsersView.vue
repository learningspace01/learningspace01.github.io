<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import type { ClassFlowUser, UserRole } from '@/types/classflow'
import {
  Plus, User, Shield, GraduationCap, Edit2, Lock, Trash2,
  X, Send, AlertCircle, UserCheck,
} from 'lucide-vue-next'

const auth = useAuthStore()
const cf = useClassFlowStore()
const toast = useToast()

// --- Role filter ---
const filterRole = ref<UserRole | 'all'>('all')

const filteredUsers = computed(() => {
  if (filterRole.value === 'all') return auth.users
  return auth.users.filter(u => u.role === filterRole.value)
})

const roleFilters = computed(() => [
  { id: 'all' as const, label: '全部', count: auth.users.length },
  { id: 'admin' as const, label: '管理员', count: auth.users.filter(u => u.role === 'admin').length },
  { id: 'teacher' as const, label: '老师', count: auth.users.filter(u => u.role === 'teacher').length },
  { id: 'student' as const, label: '学生', count: auth.users.filter(u => u.role === 'student').length },
])

// --- Role helpers ---
const roleConfig: Record<UserRole, { label: string; color: string; bg: string; icon: any }> = {
  admin:   { label: '管理员', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: Shield },
  teacher: { label: '老师',   color: '#6366F1', bg: 'rgba(99,102,241,0.12)', icon: GraduationCap },
  student: { label: '学生',   color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: User },
}

function linkedStudentName(user: ClassFlowUser): string {
  if (user.role !== 'student' || !user.studentId) return ''
  const stu = cf.students.find(s => s.id === user.studentId)
  return stu?.name || '(关联已断)'
}

function linkedStudentClasses(user: ClassFlowUser): string[] {
  if (user.role !== 'student' || !user.studentId) return []
  return cf.classes
    .filter(c => c.studentIds.includes(user.studentId!))
    .map(c => c.name)
}

function canDelete(user: ClassFlowUser): boolean {
  if (user.id === auth.currentUser?.id) return false // 不能删自己
  if (user.role === 'admin') {
    // 不能删唯一的管理员
    return auth.users.filter(u => u.role === 'admin').length > 1
  }
  return true
}

function canEditRole(user: ClassFlowUser): boolean {
  // 不能改自己的角色
  if (user.id === auth.currentUser?.id) return false
  // 不能把最后一个管理员降级
  if (user.role === 'admin' && auth.users.filter(u => u.role === 'admin').length <= 1) return false
  return true
}

// ======================== CREATE MODAL ========================
const showCreateModal = ref(false)
const createForm = reactive({
  username: '',
  password: '',
  displayName: '',
  role: 'student' as UserRole,
})
const createError = ref('')

function openCreate() {
  createForm.username = ''
  createForm.password = ''
  createForm.displayName = ''
  createForm.role = 'student'
  createError.value = ''
  showCreateModal.value = true
}

function handleCreate() {
  createError.value = ''
  if (!createForm.username.trim() || !createForm.password.trim() || !createForm.displayName.trim()) {
    createError.value = '请填写所有字段'
    return
  }
  try {
    auth.createUser({
      username: createForm.username.trim(),
      password: createForm.password,
      role: createForm.role,
      displayName: createForm.displayName.trim(),
    })
    showCreateModal.value = false
    toast.show('已创建', `用户「${createForm.displayName.trim()}」已创建`, '✅', '#10B981')
  } catch (e: unknown) {
    createError.value = (e as Error).message
  }
}

// ======================== EDIT MODAL ========================
const showEditModal = ref(false)
const editUser = ref<ClassFlowUser | null>(null)
const editDisplayName = ref('')
const editRole = ref<UserRole>('student')
const editError = ref('')

function openEdit(user: ClassFlowUser) {
  editUser.value = user
  editDisplayName.value = user.displayName
  editRole.value = user.role
  editError.value = ''
  showEditModal.value = true
}

function handleEdit() {
  if (!editUser.value) return
  editError.value = ''
  if (!editDisplayName.value.trim()) {
    editError.value = '显示名称不能为空'
    return
  }
  const patch: Partial<Pick<ClassFlowUser, 'displayName' | 'role'>> = {
    displayName: editDisplayName.value.trim(),
  }
  if (canEditRole(editUser.value) && editRole.value !== editUser.value.role) {
    patch.role = editRole.value
  }
  auth.updateUser(editUser.value.id, patch)
  showEditModal.value = false
  toast.show('已更新', '用户信息已修改', '✅', '#10B981')
}

// ======================== CHANGE PASSWORD MODAL ========================
const showPwdModal = ref(false)
const pwdUser = ref<ClassFlowUser | null>(null)
const newPassword = ref('')
const confirmPassword = ref('')
const pwdError = ref('')

function openChangePwd(user: ClassFlowUser) {
  pwdUser.value = user
  newPassword.value = ''
  confirmPassword.value = ''
  pwdError.value = ''
  showPwdModal.value = true
}

function handleChangePwd() {
  if (!pwdUser.value) return
  pwdError.value = ''
  if (!newPassword.value) {
    pwdError.value = '请输入新密码'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    pwdError.value = '两次输入的密码不一致'
    return
  }
  auth.changePassword(pwdUser.value.id, newPassword.value)
  showPwdModal.value = false
  toast.show('已修改', `用户「${pwdUser.value.displayName}」密码已更新`, '🔒', '#10B981')
}

// ======================== DELETE ========================
function handleDelete(user: ClassFlowUser) {
  const name = user.displayName || user.username
  if (!confirm(`确定要删除用户「${name}」吗？\n此操作不可撤销。`)) return
  auth.deleteUser(user.id)
  toast.show('已删除', `用户「${name}」已删除`, '🗑️', '#EF4444')
}

// ======================== TIME FORMAT ========================
function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}


</script>

<template>
  <div class="users-view">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <button class="btn-primary" @click="openCreate">
        <Plus :size="16" stroke-width="2" />
        <span>新建用户</span>
      </button>
    </div>

    <!-- Role Filter Tabs -->
    <div class="filter-tabs">
      <button
        v-for="f in roleFilters"
        :key="f.id"
        class="filter-btn"
        :class="{ active: filterRole === f.id }"
        @click="filterRole = f.id"
      >
        {{ f.label }}
        <span class="count">{{ f.count }}</span>
      </button>
    </div>

    <!-- User Grid -->
    <div v-if="filteredUsers.length === 0" class="empty-state">
      <User :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
      <p>暂无用户</p>
    </div>
    <div v-else class="user-grid">
      <GlassCard
        v-for="user in filteredUsers"
        :key="user.id"
        padding="var(--space-5)"
        class="user-card"
        :class="{ 'is-self': user.id === auth.currentUser?.id }"
      >
        <div class="card-top">
          <div class="user-avatar" :style="{ background: roleConfig[user.role].color }">
            {{ user.displayName.charAt(0) }}
          </div>
          <div class="user-info">
            <div class="user-name-row">
              <span class="user-name">{{ user.displayName }}</span>
              <span class="role-badge" :style="{ background: roleConfig[user.role].bg, color: roleConfig[user.role].color }">
                <component :is="roleConfig[user.role].icon" :size="10" stroke-width="2" />
                {{ roleConfig[user.role].label }}
              </span>
            </div>
            <span class="user-username">@{{ user.username }}</span>
          </div>
        </div>

        <!-- Student linkage info -->
        <div v-if="user.role === 'student'" class="linkage-info">
          <div class="linkage-row">
            <UserCheck :size="12" stroke-width="2" />
            <span>关联学生：<strong>{{ linkedStudentName(user) || '未关联' }}</strong></span>
          </div>
          <div v-if="linkedStudentClasses(user).length > 0" class="linkage-classes">
            <span v-for="cls in linkedStudentClasses(user)" :key="cls" class="class-chip">{{ cls }}</span>
          </div>
        </div>

        <div class="user-meta">
          <span class="meta-time">创建于 {{ formatTime(user.createdAt) }}</span>
          <span v-if="user.id === auth.currentUser?.id" class="self-tag">当前账号</span>
        </div>

        <div class="card-actions">
          <button class="icon-btn" title="编辑" @click="openEdit(user)">
            <Edit2 :size="14" stroke-width="2" />
          </button>
          <button class="icon-btn" title="修改密码" @click="openChangePwd(user)">
            <Lock :size="14" stroke-width="2" />
          </button>
          <button
            v-if="canDelete(user)"
            class="icon-btn danger"
            title="删除"
            @click="handleDelete(user)"
          >
            <Trash2 :size="14" stroke-width="2" />
          </button>
        </div>
      </GlassCard>
    </div>

    <!-- ======================== CREATE MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>新建用户</h3>
            <button class="modal-close" @click="showCreateModal = false">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <div v-if="createError" class="form-error">{{ createError }}</div>

            <label class="modal-field">
              <span>用户名 <span class="required">*</span></span>
              <input v-model="createForm.username" placeholder="登录用账号名" autocomplete="off" />
            </label>
            <label class="modal-field">
              <span>显示名称 <span class="required">*</span></span>
              <input v-model="createForm.displayName" placeholder="真实姓名" />
            </label>
            <label class="modal-field">
              <span>角色 <span class="required">*</span></span>
              <select v-model="createForm.role">
                <option value="student">学生</option>
                <option value="teacher">老师</option>
              </select>
            </label>
            <label class="modal-field">
              <span>密码 <span class="required">*</span></span>
              <input v-model="createForm.password" type="password" placeholder="设置初始密码" autocomplete="new-password" />
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showCreateModal = false">取消</button>
            <button class="btn-confirm" @click="handleCreate">
              <Send :size="16" stroke-width="2" />
              创建
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ======================== EDIT MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showEditModal && editUser" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>编辑用户 — {{ editUser.displayName }}</h3>
            <button class="modal-close" @click="showEditModal = false">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <div v-if="editError" class="form-error">{{ editError }}</div>

            <div class="modal-field">
              <span>用户名</span>
              <div class="field-static">{{ editUser.username }}</div>
            </div>
            <label class="modal-field">
              <span>显示名称 <span class="required">*</span></span>
              <input v-model="editDisplayName" placeholder="显示名称" />
            </label>
            <label class="modal-field" v-if="canEditRole(editUser)">
              <span>角色</span>
              <select v-model="editRole">
                <option value="admin">管理员</option>
                <option value="teacher">老师</option>
                <option value="student">学生</option>
              </select>
              <span v-if="editRole !== editUser.role" class="field-hint">⚠️ 更改角色可能影响该用户的访问权限</span>
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showEditModal = false">取消</button>
            <button class="btn-confirm" @click="handleEdit">
              保存修改
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ======================== PASSWORD MODAL ======================== -->
    <Teleport to="body">
      <div v-if="showPwdModal && pwdUser" class="modal-overlay" @click.self="showPwdModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>修改密码 — {{ pwdUser.displayName }}</h3>
            <button class="modal-close" @click="showPwdModal = false">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <div class="modal-body">
            <div v-if="pwdError" class="form-error">{{ pwdError }}</div>

            <label class="modal-field">
              <span>用户名</span>
              <div class="field-static">{{ pwdUser.username }}</div>
            </label>
            <label class="modal-field">
              <span>新密码 <span class="required">*</span></span>
              <input v-model="newPassword" type="password" placeholder="输入新密码" autocomplete="new-password" />
            </label>
            <label class="modal-field">
              <span>确认密码 <span class="required">*</span></span>
              <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" autocomplete="new-password" />
            </label>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showPwdModal = false">取消</button>
            <button class="btn-confirm" @click="handleChangePwd">
              <Lock :size="16" stroke-width="2" />
              确认修改
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.users-view {
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

/* --- Filter Tabs --- */
.filter-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
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

/* --- Empty State --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  color: var(--text-tertiary);
}

/* --- User Grid --- */
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.user-card {
  position: relative;
}

.user-card.is-self {
  border-color: #10B981;
  box-shadow: 0 0 0 1px rgba(16,185,129,0.3);
}

.card-top {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.user-avatar {
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

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.user-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.6rem;
  font-weight: 600;
  white-space: nowrap;
}

.user-username {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* --- Linkage Info --- */
.linkage-info {
  padding: var(--space-2) var(--space-3);
  background: rgba(16, 185, 129, 0.04);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.linkage-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.linkage-row strong {
  color: var(--text-primary);
}

.linkage-classes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.class-chip {
  padding: 1px var(--space-2);
  background: rgba(16, 185, 129, 0.08);
  color: #10B981;
  border-radius: var(--radius-sm);
  font-size: 0.6rem;
  font-weight: 500;
}

/* --- Meta --- */
.user-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.self-tag {
  padding: 1px var(--space-2);
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
  border-radius: var(--radius-sm);
  font-size: 0.6rem;
  font-weight: 600;
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
  z-index: 500;
  padding: var(--space-4);
}

.modal-content {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 480px;
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
  font-size: var(--text-base);
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

.form-error {
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.modal-field > span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.required {
  color: var(--danger);
}

.modal-field input,
.modal-field select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.modal-field input:focus,
.modal-field select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.field-static {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-family: monospace;
}

.field-hint {
  font-size: 0.65rem !important;
  color: #F59E0B !important;
  font-weight: 400 !important;
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

.btn-cancel:hover { background: var(--bg-tertiary); }

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

/* --- Dark mode --- */
[data-theme="dark"] .modal-content {
  background: var(--dark-surface);
}

[data-theme="dark"] .modal-overlay {
  background: rgba(0, 0, 0, 0.6);
}

[data-theme="dark"] .field-static {
  background: var(--dark-bg);
}

/* --- Responsive --- */
@media (max-width: 768px) {
  .user-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>