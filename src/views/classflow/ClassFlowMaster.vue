<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import DashboardView from './DashboardView.vue'
import StudentsView from './StudentsView.vue'
import ClassesView from './ClassesView.vue'
import AttendanceView from './AttendanceView.vue'
import AssignmentsView from './AssignmentsView.vue'
import CalendarView from './CalendarView.vue'
import StudentWorkspace from './StudentWorkspace.vue'
import UsersView from './UsersView.vue'
import type { UserRole } from '@/types/classflow'
import {
  LayoutDashboard, Users, GraduationCap, ClipboardCheck, FileEdit, CalendarDays,
  BookOpen, LogOut, UserCircle,
  Sun, Moon, ArrowLeft,
} from 'lucide-vue-next'

const router = useRouter()
const settingsStore = useSettingsStore()
const auth = useAuthStore()

const allTabs = [
  { id: 'dashboard',   label: '仪表盘', icon: LayoutDashboard, roles: ['admin','teacher','student'] as UserRole[] },
  { id: 'users',       label: '用户管理', icon: UserCircle,      roles: ['admin'] as UserRole[] },
  { id: 'students',    label: '学生库',  icon: Users,           roles: ['admin'] as UserRole[] },
  { id: 'classes',     label: '班级管理', icon: GraduationCap,   roles: ['admin'] as UserRole[] },
  { id: 'attendance',  label: '签到台',  icon: ClipboardCheck,  roles: ['admin','teacher'] as UserRole[] },
  { id: 'assignments', label: '作业中心', icon: FileEdit,        roles: ['admin','teacher'] as UserRole[] },
  { id: 'calendar',    label: '日历',    icon: CalendarDays,     roles: ['admin','teacher'] as UserRole[] },
  { id: 'workspace',   label: '学生工作台', icon: BookOpen,      roles: ['admin','student'] as UserRole[] },
]

const visibleTabs = computed(() =>
  allTabs.filter(t => t.roles.includes(auth.currentUser?.role || 'student'))
)

const activeTab = ref('dashboard')

// Login/Register form
const authMode = ref<'login' | 'register'>('login')
const loginUsername = ref('')
const loginPassword = ref('')
const regUsername = ref('')
const regPassword = ref('')
const regDisplayName = ref('')
const regRole = ref<UserRole>('student')
const authError = ref('')

function handleLogin() {
  authError.value = ''
  if (!loginUsername.value.trim() || !loginPassword.value.trim()) {
    authError.value = '请输入用户名和密码'
    return
  }
  const ok = auth.login(loginUsername.value.trim(), loginPassword.value)
  if (!ok) {
    authError.value = '用户名或密码错误'
  } else {
    loginUsername.value = ''
    loginPassword.value = ''
  }
}

function handleRegister() {
  authError.value = ''
  if (!regUsername.value.trim() || !regPassword.value.trim() || !regDisplayName.value.trim()) {
    authError.value = '请填写所有必填字段'
    return
  }
  try {
    auth.register({
      username: regUsername.value.trim(),
      password: regPassword.value,
      role: regRole.value,
      displayName: regDisplayName.value.trim(),
    })
    regUsername.value = ''
    regPassword.value = ''
    regDisplayName.value = ''
  } catch (e: unknown) {
    authError.value = (e as Error).message
  }
}

function handleLogout() {
  auth.logout()
  activeTab.value = 'dashboard'
}

function switchTab(tabId: string) {
  activeTab.value = tabId
}

function goBack() {
  router.push('/')
}

function roleLabel(role: UserRole): string {
  return { admin: '管理员', teacher: '老师', student: '学生' }[role]
}
</script>

<template>
  <div class="classflow-master">
    <!-- ==================== LOGIN GATE ==================== -->
    <div v-if="!auth.isLoggedIn" class="login-gate">
      <div class="login-card">
        <div class="login-header">
          <GraduationCap :size="32" color="#10B981" stroke-width="2" />
          <h1>ClassFlow</h1>
          <p>教务与学情追踪引擎</p>
        </div>

        <!-- Toggle -->
        <div class="auth-toggle">
          <button :class="{ active: authMode === 'login' }" @click="authMode = 'login'; authError = ''">登录</button>
          <button :class="{ active: authMode === 'register' }" @click="authMode = 'register'; authError = ''">注册</button>
        </div>

        <div v-if="authError" class="auth-error">{{ authError }}</div>

        <!-- Login Form -->
        <form v-if="authMode === 'login'" class="auth-form" @submit.prevent="handleLogin">
          <label class="auth-field">
            <span>用户名</span>
            <input v-model="loginUsername" placeholder="输入用户名" autocomplete="username" />
          </label>
          <label class="auth-field">
            <span>密码</span>
            <input v-model="loginPassword" type="password" placeholder="输入密码" autocomplete="current-password" />
          </label>
          <button type="submit" class="auth-btn">登录</button>
        </form>

        <!-- Register Form -->
        <form v-else class="auth-form" @submit.prevent="handleRegister">
          <label class="auth-field">
            <span>用户名</span>
            <input v-model="regUsername" placeholder="输入用户名" autocomplete="username" />
          </label>
          <label class="auth-field">
            <span>显示名称</span>
            <input v-model="regDisplayName" placeholder="你的姓名" />
          </label>
          <label class="auth-field">
            <span>角色</span>
            <select v-model="regRole">
              <option value="student">学生</option>
              <option value="teacher">老师</option>
            </select>
          </label>
          <label class="auth-field">
            <span>密码</span>
            <input v-model="regPassword" type="password" placeholder="设置密码" autocomplete="new-password" />
          </label>
          <button type="submit" class="auth-btn">注册并登录</button>
        </form>
      </div>
    </div>

    <!-- ==================== LOGGED IN ==================== -->
    <template v-else>
      <header class="top-nav">
        <div class="nav-left">
          <button class="back-btn" @click="goBack">
            <ArrowLeft :size="18" />
          </button>
          <div class="logo">
            <GraduationCap :size="22" color="#10B981" stroke-width="2" />
            <span>ClassFlow</span>
          </div>
        </div>
        <div class="nav-right">
          <div class="user-info">
            <UserCircle :size="16" stroke-width="2" />
            <span class="user-name">{{ auth.currentUser?.displayName }}</span>
            <span class="user-role">{{ roleLabel(auth.currentUser?.role || 'student') }}</span>
          </div>
          <button class="theme-btn" @click="settingsStore.toggleDarkMode()"
            :title="settingsStore.settings.darkMode ? '切换亮色模式' : '切换暗色模式'">
            <Sun v-if="settingsStore.settings.darkMode" :size="18" />
            <Moon v-else :size="18" />
          </button>
          <button class="logout-btn" @click="handleLogout" title="退出登录">
            <LogOut :size="16" stroke-width="2" />
          </button>
        </div>
      </header>

      <nav class="tab-nav desktop">
        <button v-for="tab in visibleTabs" :key="tab.id"
          class="tab-btn" :class="{ active: activeTab === tab.id }"
          @click="switchTab(tab.id)">
          <component :is="tab.icon" :size="16" stroke-width="2" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <main class="main-content">
        <DashboardView v-if="activeTab === 'dashboard'" @navigate="switchTab" />
        <StudentsView v-else-if="activeTab === 'students'" />
        <ClassesView v-else-if="activeTab === 'classes'" />
        <AttendanceView v-else-if="activeTab === 'attendance'" />
        <AssignmentsView v-else-if="activeTab === 'assignments'" />
        <CalendarView v-else-if="activeTab === 'calendar'" />
        <UsersView v-else-if="activeTab === 'users'" />
        <StudentWorkspace v-else-if="activeTab === 'workspace'" />
      </main>

      <nav class="mobile-tab-bar">
        <button v-for="tab in visibleTabs" :key="tab.id"
          class="mobile-tab-btn" :class="{ active: activeTab === tab.id }"
          @click="switchTab(tab.id)">
          <component :is="tab.icon" :size="20" stroke-width="2" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.classflow-master {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-8);
  background: white;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.back-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
}

.user-role {
  color: #10B981;
  font-weight: 500;
}

.logout-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.theme-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.theme-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab-nav {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-8);
  background: white;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}

.tab-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.tab-btn.active {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.main-content {
  flex: 1;
  padding: var(--space-6) var(--space-8);
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  overflow-y: auto;
}

.mobile-tab-bar {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid var(--border);
  padding: var(--space-2) 0 env(safe-area-inset-bottom);
  z-index: 100;
}

.mobile-tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2) 0;
  font-size: 0.65rem;
  color: var(--text-tertiary);
  transition: color var(--duration-fast) var(--ease-out);
}

.mobile-tab-btn.active {
  color: #10B981;
}

[data-theme="dark"] .top-nav,
[data-theme="dark"] .tab-nav {
  background: var(--dark-surface);
}

[data-theme="dark"] .mobile-tab-bar {
  background: rgba(26, 29, 39, 0.92);
}

@media (max-width: 768px) {
  .top-nav {
    padding: var(--space-3) var(--space-5);
  }

  .tab-nav.desktop {
    display: none;
  }

  .main-content {
    padding: var(--space-4) var(--space-5);
    padding-bottom: calc(var(--space-4) + 72px);
  }

  .mobile-tab-bar {
    display: flex;
  }

  .login-card {
    width: 100%;
    max-width: 360px;
    padding: var(--space-6) var(--space-5);
  }

  .user-info {
    display: none;
  }
}

/* ==================== LOGIN GATE ==================== */
.login-gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--bg-primary);
}

.login-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-8) var(--space-10);
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.login-header h1 {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-top: var(--space-3);
}

.login-header p {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.auth-toggle {
  display: flex;
  gap: 0;
  margin-bottom: var(--space-5);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 2px;
}

.auth-toggle button {
  flex: 1;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}

.auth-toggle button.active {
  background: white;
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.auth-error {
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  margin-bottom: var(--space-4);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.auth-field span {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}

.auth-field input,
.auth-field select {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.auth-field input:focus,
.auth-field select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.auth-btn {
  padding: var(--space-3) var(--space-6);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  margin-top: var(--space-2);
  transition: background var(--duration-fast) var(--ease-out);
}

.auth-btn:hover {
  background: #059669;
}

[data-theme="dark"] .login-card {
  background: var(--dark-surface);
}

[data-theme="dark"] .auth-toggle button.active {
  background: var(--dark-surface);
}
</style>
