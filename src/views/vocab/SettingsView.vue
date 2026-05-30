<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useVocabStore } from '@/stores/vocabStore'
import { useToast } from '@/composables/useToast'
import { useSupabaseSync } from '@/composables/useSupabaseSync'
import { presetBooks } from '@/data/presets'
import GlassCard from '@/components/GlassCard.vue'
import PresetManageModal from '@/components/PresetManageModal.vue'
import type { PresetBook } from '@/data/presets'

const settingsStore = useSettingsStore()
const vocabStore = useVocabStore()
const { show: showToast } = useToast()
const sync = useSupabaseSync()

// --- Auth state ---
const authEmail = ref('')
const authPassword = ref('')

// --- Word library management ---
const alreadyImported = computed(() =>
  new Set(vocabStore.wordBooks.map((b) => b.id))
)

const allBookItems = computed(() => {
  const items: { id: string; icon: string; name: string; wordCount: number; learnedCount: number; masteredCount: number; isPreset: boolean; imported: boolean }[] = []
  const added = new Set<string>()

  // Add user's books (both custom and imported presets)
  for (const book of vocabStore.wordBooks) {
    items.push({
      id: book.id,
      icon: book.icon,
      name: book.name,
      wordCount: book.wordCount,
      learnedCount: book.learnedCount,
      masteredCount: book.masteredCount,
      isPreset: book.isPreset,
      imported: true,
    })
    added.add(book.id)
  }

  // Add unimported preset books
  for (const preset of presetBooks) {
    if (!added.has(preset.book.id)) {
      items.push({
        id: preset.book.id,
        icon: preset.book.icon,
        name: preset.book.name,
        wordCount: preset.words.length,
        learnedCount: 0,
        masteredCount: 0,
        isPreset: true,
        imported: false,
      })
    }
  }

  return items
})

function isBookEnabled(bookId: string): boolean {
  return settingsStore.settings.enabledBookIds.includes(bookId)
}

async function toggleBook(bookId: string) {
  // Auto-import preset if not yet imported
  if (!alreadyImported.value.has(bookId)) {
    const preset = presetBooks.find((p) => p.book.id === bookId)
    if (preset) {
      try {
        await vocabStore.importPresetBook(preset.book, preset.words)
      } catch {
        showToast('导入失败', `「${preset.book.name}」导入失败`, '❌', '#EF4444')
        return
      }
    }
  }
  settingsStore.toggleBookEnabled(bookId)
}

function deleteBook(bookId: string) {
  const book = vocabStore.wordBooks.find((b) => b.id === bookId)
  if (!book) {
    showToast('请先启用词库', '打开开关导入后即可删除', '💡', '#4F6EF7')
    return
  }
  const name = book.name
  if (confirm(`确定要删除词库「${name}」及其所有单词吗？此操作不可撤销。`)) {
    vocabStore.deleteWordBook(bookId)
    showToast('词库已删除', `「${name}」已删除`, '🗑️', '#EF4444')
  }
}

// --- New book creation ---
const showNewBookForm = ref(false)
const newBookName = ref('')
const newBookNameRef = ref<HTMLInputElement | null>(null)

watch(showNewBookForm, (val) => {
  if (val) nextTick(() => newBookNameRef.value?.focus())
})

function createBook() {
  if (!newBookName.value.trim()) return
  const name = newBookName.value.trim()
  const id = `book_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  vocabStore.addWordBook({
    id, name, description: '', icon: '📚',
    wordCount: 0, learnedCount: 0, masteredCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    tags: [], isPreset: false, sortOrder: 0,
  })
  newBookName.value = ''
  showNewBookForm.value = false
  showToast('词库已创建', `「${name}」已创建`, '✅', '#10B981')
}

function cancelNewBook() {
  showNewBookForm.value = false
  newBookName.value = ''
}

// --- Auth handlers ---
async function handleSignIn() {
  const ok = await sync.signIn(authEmail.value, authPassword.value)
  if (ok) {
    authEmail.value = ''
    authPassword.value = ''
    showToast('登录成功', '数据已同步到云端', '🔐', '#10B981')
  }
}

async function handleSignUp() {
  const ok = await sync.signUp(authEmail.value, authPassword.value)
  if (ok) {
    authEmail.value = ''
    authPassword.value = ''
    showToast('注册成功', '数据已同步到云端', '🎉', '#10B981')
  }
}

async function handleSignOut() {
  await sync.signOut()
  showToast('已退出登录', '本地数据不受影响', '🔒', '#94A3B8')
}

// --- Manage word modal ---
const manageBookId = ref<string | null>(null)
const manageBookName = ref('')
const manageBookIcon = ref('📚')

async function openManageModal(bookId: string) {
  let book = vocabStore.wordBooks.find((b) => b.id === bookId)
  // Auto-import preset if not yet imported
  if (!book) {
    const preset = presetBooks.find((p) => p.book.id === bookId)
    if (preset) {
      try {
        await vocabStore.importPresetBook(preset.book, preset.words)
        book = vocabStore.wordBooks.find((b) => b.id === bookId) || null
      } catch {
        showToast('导入失败', `「${preset.book.name}」导入失败`, '❌', '#EF4444')
        return
      }
    }
  }
  if (!book) return
  manageBookId.value = book.id
  manageBookName.value = book.name
  manageBookIcon.value = book.icon
}

function closeManageModal() {
  manageBookId.value = null
}

// --- Existing settings functions ---

function exportData() {
  const json = vocabStore.exportData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocabmaster-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV() {
  const words = vocabStore.words
  const header = 'word,phonetic,partOfSpeech,definition,example_en,example_cn,etymology,status,wrongCount,correctCount'
  const rows = words.map((w) => {
    const status = w.srs.status
    return [
      `"${w.word}"`,
      `"${w.phonetic}"`,
      `"${w.partOfSpeech.join(';')}"`,
      `"${w.definitions.map((d) => d.meaning).join('; ')}"`,
      `"${w.examples[0]?.en || ''}"`,
      `"${w.examples[0]?.cn || ''}"`,
      `"${w.etymology}"`,
      `"${status}"`,
      w.srs.wrongCount,
      w.srs.correctCount,
    ].join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocabmaster-words-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        vocabStore.importData(reader.result as string)
        alert('数据导入成功！')
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function resetAllData() {
  if (confirm('确定要清除所有学习数据吗？此操作不可撤销。')) {
    const keys = ['vocab-books', 'vocab-words', 'vocab-sessions', 'vocab-settings', 'vocab-streak-days', 'vocab-last-study', 'vocab-achievements']
    keys.forEach((k) => localStorage.removeItem(k))
    if ('indexedDB' in window) {
      indexedDB.deleteDatabase('vocabmaster')
    }
    window.location.reload()
  }
}
</script>

<template>
  <div class="settings-page">
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">学习目标</h3>
      <div class="form-row">
        <div class="form-group">
          <label>每日复习目标（词数）</label>
          <div class="stepper">
            <button
              class="stepper-btn"
              @click="settingsStore.settings.dailyGoal = Math.max(5, settingsStore.settings.dailyGoal - 5)"
            >−</button>
            <span class="stepper-value">{{ settingsStore.settings.dailyGoal }}</span>
            <button
              class="stepper-btn"
              @click="settingsStore.settings.dailyGoal = Math.min(200, settingsStore.settings.dailyGoal + 5)"
            >+</button>
          </div>
        </div>
        <div class="form-group">
          <label>每日新词上限</label>
          <div class="stepper">
            <button
              class="stepper-btn"
              @click="settingsStore.settings.newWordsPerDay = Math.max(5, settingsStore.settings.newWordsPerDay - 5)"
            >−</button>
            <span class="stepper-value">{{ settingsStore.settings.newWordsPerDay }}</span>
            <button
              class="stepper-btn"
              @click="settingsStore.settings.newWordsPerDay = Math.min(100, settingsStore.settings.newWordsPerDay + 5)"
            >+</button>
          </div>
        </div>
      </div>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">词库管理</h3>
      <p class="setting-desc">管理所有词库，选择学习/复习/测试的来源</p>

      <!-- New book inline form -->
      <div v-if="showNewBookForm" class="new-book-inline">
        <input ref="newBookNameRef" v-model="newBookName" type="text" lang="zh-CN" placeholder="输入新词库名称" autocomplete="off" spellcheck="false" @keyup.enter="createBook" />
        <button class="confirm-book-btn" @click="createBook" :disabled="!newBookName.trim()">确认</button>
        <button class="cancel-book-btn" @click="cancelNewBook">取消</button>
      </div>

      <!-- Book list -->
      <div v-for="item in allBookItems" :key="item.id" class="book-item" :class="{ unimported: !item.imported }">
        <div class="book-item-main">
          <span class="book-item-icon">{{ item.icon }}</span>
          <div class="book-item-info">
            <span class="book-item-name">{{ item.name }}</span>
            <span class="book-item-stats" v-if="item.imported">{{ item.learnedCount }}/{{ item.wordCount }}词 · 掌握{{ item.masteredCount }}</span>
            <span class="book-item-stats" v-else>{{ item.wordCount }}词（未导入）</span>
          </div>
        </div>
        <div class="book-item-actions">
          <label class="switch" :title="isBookEnabled(item.id) ? '禁用为学习来源' : '启用为学习来源'">
            <input type="checkbox" :checked="isBookEnabled(item.id)" @change="toggleBook(item.id)" />
            <span class="slider" />
          </label>
          <button class="manage-btn" @click="openManageModal(item.id)">管理单词</button>
          <button class="delete-btn" @click="deleteBook(item.id)">删除</button>
        </div>
      </div>

      <!-- Add new book button -->
      <button v-if="!showNewBookForm" class="add-book-btn" @click="showNewBookForm = true">
        + 新建词库
      </button>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">复习偏好</h3>
      <div class="form-row">
        <div class="form-group">
          <label>默认复习模式</label>
          <select v-model="settingsStore.settings.reviewMode">
            <option value="flashcard">卡片浏览 (Flashcard)</option>
            <option value="spelling">拼写练习 (Spelling)</option>
            <option value="choice">选择测试 (Choice)</option>
            <option value="dictation">听写模式 (Dictation)</option>
          </select>
        </div>
      </div>
      <div class="toggle-row">
        <div class="toggle-item">
          <span class="toggle-label">学习时自动播放发音</span>
          <label class="switch">
            <input type="checkbox" v-model="settingsStore.settings.autoPlay" />
            <span class="slider" />
          </label>
        </div>
        <div class="toggle-item">
          <span class="toggle-label">启用键盘快捷键</span>
          <label class="switch">
            <input type="checkbox" v-model="settingsStore.settings.keyboardShortcuts" />
            <span class="slider" />
          </label>
        </div>
        <div class="toggle-item">
          <span class="toggle-label">先显示例句（而非释义）</span>
          <label class="switch">
            <input type="checkbox" v-model="settingsStore.settings.showExampleFirst" />
            <span class="slider" />
          </label>
        </div>
      </div>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">显示偏好</h3>
      <div class="toggle-row">
        <div class="toggle-item">
          <span class="toggle-label">暗色模式</span>
          <label class="switch">
            <input type="checkbox" :checked="settingsStore.settings.darkMode" @change="settingsStore.toggleDarkMode()" />
            <span class="slider" />
          </label>
        </div>
        <div class="toggle-item">
          <span class="toggle-label">字体大小</span>
          <select v-model="settingsStore.settings.fontSize" class="font-select">
            <option value="small">小 (14px)</option>
            <option value="medium">中 (16px)</option>
            <option value="large">大 (18px)</option>
          </select>
        </div>
      </div>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">学习提醒</h3>
      <div class="form-row">
        <div class="form-group">
          <label>每日提醒时间</label>
          <input
            type="time"
            v-model="settingsStore.settings.notificationReminder"
          />
        </div>
      </div>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">数据管理</h3>
      <div class="data-actions">
        <button class="action-btn primary" @click="exportData">
          📤 导出数据备份
        </button>
        <button class="action-btn secondary" @click="importData">
          📥 导入数据恢复
        </button>
        <button class="action-btn secondary" @click="exportCSV">
          📊 导出 CSV (Excel)
        </button>
        <button class="action-btn danger" @click="resetAllData">
          🗑 清除所有数据
        </button>
      </div>
      <p class="data-hint">
        数据存储在浏览器本地 (LocalStorage + IndexedDB)，
        建议定期导出备份以防数据丢失。
      </p>
    </GlassCard>

    <!-- Account & Sync -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">账号与同步</h3>
      <template v-if="sync.connected.value">
        <div class="auth-logged-in">
          <p class="auth-email">已登录：{{ sync.userEmail.value }}</p>
          <p class="auth-sync-info">
            <span v-if="sync.syncing.value">同步中…</span>
            <span v-else-if="sync.lastSyncAt.value">上次同步：{{ sync.lastSyncAt.value.slice(0, 16).replace('T', ' ') }}</span>
            <span v-else>已连接</span>
          </p>
          <button class="action-btn secondary" @click="handleSignOut">退出登录</button>
        </div>
      </template>
      <template v-else>
        <div class="auth-form">
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="authEmail" type="email" placeholder="your@email.com" autocomplete="email" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="authPassword" type="password" placeholder="至少6位密码" autocomplete="new-password" />
          </div>
          <p v-if="sync.authError.value" class="auth-error">{{ sync.authError.value }}</p>
          <div class="auth-actions">
            <button class="action-btn primary" :disabled="sync.authLoading.value || !authEmail || !authPassword" @click="handleSignIn">
              {{ sync.authLoading.value ? '登录中…' : '登录' }}
            </button>
            <button class="action-btn secondary" :disabled="sync.authLoading.value || !authEmail || !authPassword" @click="handleSignUp">
              注册
            </button>
          </div>
        </div>
      </template>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">有道词典代理</h3>
      <p class="setting-desc">
        有道词典 API 不支持浏览器直接调用（无 CORS 头），需配置代理地址。
        开发环境下默认使用 Vite 代理。生产环境建议使用 Cloudflare Worker 等免费代理。
      </p>
      <div class="form-row">
        <div class="form-group">
          <label>代理地址</label>
          <input
            type="text"
            v-model="settingsStore.settings.youdaoProxyUrl"
            placeholder="例如: https://youdao-proxy.yourname.workers.dev"
          />
        </div>
      </div>
    </GlassCard>

    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">关于</h3>
      <div class="about-info">
        <p>VocabMaster v1.0 — Phase 6</p>
        <p>SM-2 间隔重复算法 · 智能复习 · 数据统计</p>
        <p class="about-copy">© 2026 LearningSpace</p>
      </div>
    </GlassCard>

    <!-- Word Management Modal -->
    <PresetManageModal
      v-if="manageBookId"
      :preset-book-id="manageBookId"
      :book-name="manageBookName"
      :book-icon="manageBookIcon"
      :visible="true"
      @close="closeManageModal"
    />
  </div>
</template>

<style scoped>
.settings-page {
  animation: fadeInUp 0.3s var(--ease-out);
  max-width: 640px;
}

.section-card {
  margin-bottom: var(--space-5);
}

/* Word Library Management */
.new-book-inline {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  align-items: center;
}
.new-book-inline input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.new-book-inline input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}
.confirm-book-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: background var(--duration-fast) var(--ease-out);
}
.confirm-book-btn:hover:not(:disabled) { background: var(--accent-hover); }
.confirm-book-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cancel-book-btn {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}
.cancel-book-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }

.book-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  margin-bottom: var(--space-3);
  transition: all var(--duration-fast) var(--ease-out);
}
.book-item.unimported { opacity: 0.8; }
.book-item-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}
.book-item-icon { font-size: 1.5rem; flex-shrink: 0; }
.book-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.book-item-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.book-item-stats {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 1px;
}
.book-item-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-left: var(--space-3);
}
.manage-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-light);
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}
.manage-btn:hover { background: var(--accent); color: white; }
.delete-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--danger);
  background: transparent;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--ease-out);
}
.delete-btn:hover { background: #FEF2F2; color: var(--danger); }
.add-book-btn {
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  transition: all var(--duration-fast) var(--ease-out);
  margin-top: var(--space-2);
}
.add-book-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

@media (max-width: 640px) {
  .book-item { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
  .book-item-actions { margin-left: 0; width: 100%; justify-content: flex-end; }
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-5);
}

.setting-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
  margin-top: calc(-1 * var(--space-4));
}

.form-row {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-4);
}

.form-group {
  flex: 1;
}

.form-group label {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.form-group select {
  width: 100%;
}

.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.stepper-btn:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.stepper-value {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--accent);
  min-width: 3rem;
  text-align: center;
}

.toggle-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.toggle-item:last-child {
  border-bottom: none;
}

.toggle-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: var(--radius-full);
  transition: background var(--duration-fast) var(--ease-out);
}

.slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform var(--duration-fast) var(--ease-out);
}

.switch input:checked + .slider {
  background: var(--accent);
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

/* Auth */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.auth-form .form-group { margin-bottom: 0; }
.auth-actions {
  display: flex;
  gap: var(--space-3);
}
.auth-actions .action-btn { text-align: center; }
.auth-error {
  font-size: var(--text-sm);
  color: var(--danger);
  margin: 0;
}
.auth-logged-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}
.auth-email {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.auth-sync-info {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.action-btn {
  width: 100%;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);
}

.action-btn.primary {
  background: var(--accent-light);
  color: var(--accent);
}

.action-btn.primary:hover {
  background: var(--accent);
  color: white;
}

.action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.danger {
  background: #FEF2F2;
  color: var(--danger);
}

.action-btn.danger:hover {
  background: var(--danger);
  color: white;
}

.data-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-4);
  line-height: var(--leading-normal);
}

.about-info {
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.font-select {
  width: auto;
  min-width: 120px;
}

.about-copy {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  margin-top: var(--space-2);
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
