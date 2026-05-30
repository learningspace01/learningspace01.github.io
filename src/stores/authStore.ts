import { defineStore } from 'pinia'
import { ref, computed, watchEffect } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useSupabaseTable } from '@/composables/useSupabaseTable'
import { supabase } from '@/lib/supabase'
import { useClassFlowStore } from './classflowStore'
import type { ClassFlowUser, UserRole, Student } from '@/types/classflow'

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_ADMIN: ClassFlowUser = {
  id: 'u-admin-001',
  username: 'admin',
  password: 'kevinshuai',
  role: 'admin',
  displayName: '管理员',
  createdAt: '2024-01-01T00:00:00.000Z',
}

export const useAuthStore = defineStore('classflow-auth', () => {
  const { data: users, add: addUserRecord, update: updateUserRecord, remove: removeUserRecord, ready: usersReady } = useSupabaseTable<ClassFlowUser>('cf_users', 'cf-users', [DEFAULT_ADMIN])
  const currentUserId = useLocalStorage<string | null>('cf-current-user-id', null)

  // 确保默认管理员同步到 Supabase
  watchEffect(() => {
    if (usersReady.value && users.value.length > 0) {
      const admin = users.value.find(u => u.id === DEFAULT_ADMIN.id)
      if (admin && admin !== DEFAULT_ADMIN) {
        // 数据是从 Supabase 加载的，无需操作
      } else if (users.value.length === 1 && users.value[0].id === DEFAULT_ADMIN.id) {
        // 只有默认管理员（localStorage 兜底），尝试写入 Supabase
        try {
          supabase.from('cf_users').upsert(DEFAULT_ADMIN).then(({ error }) => {
            if (error) console.warn('[Auth] 默认管理员同步失败:', error.message)
          })
        } catch { /* ignore */ }
      }
    }
  })

  const currentUser = computed<ClassFlowUser | null>(() => {
    if (!currentUserId.value) return null
    return users.value.find(u => u.id === currentUserId.value) || null
  })

  const isLoggedIn = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const isTeacher = computed(() => currentUser.value?.role === 'teacher')
  const isStudent = computed(() => currentUser.value?.role === 'student')

  function login(username: string, password: string): boolean {
    const user = users.value.find(
      u => u.username === username && u.password === password
    )
    if (!user) return false
    currentUserId.value = user.id
    return true
  }

  function register(data: {
    username: string
    password: string
    role: UserRole
    displayName: string
  }): ClassFlowUser {
    if (data.role === 'admin') {
      throw new Error('不能注册管理员账户')
    }
    const exists = users.value.find(u => u.username === data.username)
    if (exists) {
      throw new Error('用户名已存在')
    }
    const id = uid('u')
    const user: ClassFlowUser = {
      id,
      username: data.username,
      password: data.password,
      role: data.role,
      displayName: data.displayName,
      createdAt: new Date().toISOString(),
    }
    // Student: auto-create or reuse Student record in classflowStore
    if (data.role === 'student') {
      const cfStore = useClassFlowStore()
      // 优先用 username（登录名，唯一）查找已存在的 Student 记录
      // 这样可以正确关联管理员先在「学生库」中创建了 Student 并加入班级的场景
      let existingStudent = cfStore.students.find(s => s.username === data.username)
      // 兼容旧数据：如果 Student 没有 username，用 displayName 匹配且未关联账号的
      if (!existingStudent) {
        existingStudent = cfStore.students.find(
          s => s.name === data.displayName && !users.value.some(u => u.studentId === s.id)
        ) ?? null
      }
      if (existingStudent) {
        user.studentId = existingStudent.id
        // 回填 username，确保下次匹配走 username 精确查找
        if (!existingStudent.username) {
          cfStore.updateStudent(existingStudent.id, { username: data.username })
        }
      } else {
        const studentId = cfStore.addStudent({
          name: data.displayName,
          username: data.username,
          avatarUrl: '',
          phone: '',
          wechat: '',
          tags: [],
          enrollDate: new Date().toISOString().split('T')[0],
          status: 'active',
          notes: '',
        })
        user.studentId = studentId
      }
    }
    addUserRecord(user)
    currentUserId.value = id
    return user
  }

  function logout() {
    currentUserId.value = null
  }

  function deleteUser(id: string) {
    removeUserRecord(id)
    if (currentUserId.value === id) {
      currentUserId.value = null
    }
  }

  function getUsersByRole(role: UserRole): ClassFlowUser[] {
    return users.value.filter(u => u.role === role)
  }

  function getLinkedStudent(userId: string): Student | null {
    const user = users.value.find(u => u.id === userId)
    if (!user?.studentId) return null
    const cfStore = useClassFlowStore()
    return cfStore.students.find(s => s.id === user.studentId) || null
  }

  function getUserByStudentId(studentId: string): ClassFlowUser | undefined {
    return users.value.find(u => u.studentId === studentId)
  }

  // --- Admin user management ---

  function createUser(data: {
    username: string
    password: string
    role: UserRole
    displayName: string
  }): ClassFlowUser {
    if (data.role === 'admin') {
      throw new Error('不能通过此方式创建管理员')
    }
    const exists = users.value.find(u => u.username === data.username)
    if (exists) {
      throw new Error('用户名已存在')
    }
    const id = uid('u')
    const user: ClassFlowUser = {
      id,
      username: data.username,
      password: data.password,
      role: data.role,
      displayName: data.displayName,
      createdAt: new Date().toISOString(),
    }
    // Student: auto-create or reuse Student record in classflowStore
    if (data.role === 'student') {
      const cfStore = useClassFlowStore()
      let existingStudent = cfStore.students.find(s => s.username === data.username)
      if (!existingStudent) {
        existingStudent = cfStore.students.find(
          s => s.name === data.displayName && !users.value.some(u => u.studentId === s.id)
        ) ?? null
      }
      if (existingStudent) {
        user.studentId = existingStudent.id
        if (!existingStudent.username) {
          cfStore.updateStudent(existingStudent.id, { username: data.username })
        }
      } else {
        const studentId = cfStore.addStudent({
          name: data.displayName,
          username: data.username,
          avatarUrl: '',
          phone: '',
          wechat: '',
          tags: [],
          enrollDate: new Date().toISOString().split('T')[0],
          status: 'active',
          notes: '',
        })
        user.studentId = studentId
      }
    }
    addUserRecord(user)
    return user
  }

  function updateUser(id: string, patch: Partial<Pick<ClassFlowUser, 'displayName' | 'role'>>): void {
    updateUserRecord(id, patch)
  }

  function changePassword(id: string, newPassword: string): void {
    updateUserRecord(id, { password: newPassword } as any)
  }

  return {
    users,
    currentUserId,
    currentUser,
    isLoggedIn,
    isAdmin,
    isTeacher,
    isStudent,
    login,
    register,
    logout,
    deleteUser,
    getUsersByRole,
    getLinkedStudent,
    getUserByStudentId,
    createUser,
    updateUser,
    changePassword,
  }
})
