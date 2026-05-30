<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSupabaseSync } from '@/composables/useSupabaseSync'
import DashboardView from './DashboardView.vue'
import ImportView from './ImportView.vue'
import LearnView from './LearnView.vue'
import ReviewView from './ReviewView.vue'
import TestView from './TestView.vue'
import StatsView from './StatsView.vue'
import SettingsView from './SettingsView.vue'
import { Download, BookOpen, RotateCcw, BarChart3, Settings, ClipboardCheck, Sun, Moon, Cloud, CloudOff } from 'lucide-vue-next'

const router = useRouter()
const vocabStore = useVocabStore()
const settingsStore = useSettingsStore()
const sync = useSupabaseSync()

const tabs = [
  { id: 'dashboard', label: '仪表盘', icon: BarChart3 },
  { id: 'import', label: '导入', icon: Download },
  { id: 'learn', label: '学习', icon: BookOpen },
  { id: 'review', label: '复习', icon: RotateCcw },
  { id: 'test', label: '测试', icon: ClipboardCheck },
  { id: 'stats', label: '统计', icon: BarChart3 },
  { id: 'settings', label: '设置', icon: Settings },
]

const activeTab = ref('dashboard')
const importSubMode = ref<'manual' | 'batch'>('manual')

function switchTab(tabId: string, subMode?: string) {
  activeTab.value = tabId
  if (subMode === 'batch') {
    importSubMode.value = subMode
  }
}

function goBack() {
  router.push('/')
}

onMounted(() => {
  sync.init()
})
</script>

<template>
  <div class="vocab-master">
    <!-- Top Nav -->
    <header class="top-nav">
      <div class="nav-left">
        <button class="back-btn" @click="goBack">
          <span>←</span>
        </button>
        <div class="logo">
          <BookOpen :size="22" color="#4F6EF7" stroke-width="2" />
          <span>VocabMaster</span>
        </div>
      </div>
      <div class="nav-right">
        <button
          class="sync-indicator"
          :class="{ connected: sync.connected.value && !sync.syncError.value, syncing: sync.syncing.value, error: sync.syncError.value }"
          :title="sync.syncError.value ? sync.syncError.value : (sync.syncing.value ? '同步中...' : (sync.connected.value ? '已同步到云端' : '未连接，点击设置'))"
          @click="switchTab('settings')"
        >
          <Cloud v-if="sync.connected.value && !sync.syncing.value && !sync.syncError.value" :size="14" />
          <CloudOff v-else-if="!sync.connected.value" :size="14" />
          <span v-else-if="sync.syncError.value" style="color:var(--danger)">!</span>
          <span v-else class="sync-spinner" />
        </button>
        <span v-if="sync.userEmail.value" class="sync-email">{{ sync.userEmail.value }}</span>
        <button class="theme-btn" @click="settingsStore.toggleDarkMode()" :title="settingsStore.settings.darkMode ? '切换亮色模式' : '切换暗色模式'">
          <Sun v-if="settingsStore.settings.darkMode" :size="18" />
          <Moon v-else :size="18" />
        </button>
      </div>
    </header>

    <!-- Desktop Tab Nav -->
    <nav class="tab-nav desktop">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        <component :is="tab.icon" :size="16" stroke-width="2" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <DashboardView v-if="activeTab === 'dashboard'" @switch-tab="switchTab" />
      <ImportView v-else-if="activeTab === 'import'" :initial-mode="importSubMode" @switch-tab="switchTab" />
      <LearnView v-else-if="activeTab === 'learn'" />
      <ReviewView v-else-if="activeTab === 'review'" />
      <TestView v-else-if="activeTab === 'test'" />
      <StatsView v-else-if="activeTab === 'stats'" />
      <SettingsView v-else-if="activeTab === 'settings'" />
    </main>

    <!-- Mobile Bottom Tab Bar -->
    <nav class="mobile-tab-bar">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.id"
        class="mobile-tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        <component :is="tab.icon" :size="20" stroke-width="2" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.vocab-master {
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
  font-size: var(--text-lg);
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
  font-family: var(--font-en);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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

.sync-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  transition: all var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.sync-indicator:hover {
  background: var(--bg-tertiary);
}

.sync-indicator.connected {
  color: var(--accent);
}

.sync-indicator.syncing {
  color: var(--warning);
}

.sync-indicator.error {
  color: var(--danger);
  font-weight: 700;
  font-size: 16px;
}

.sync-email {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--warning);
  border-radius: 50%;
  animation: syncSpin 0.6s linear infinite;
}

@keyframes syncSpin {
  to { transform: rotate(360deg); }
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
  background: var(--accent-light);
  color: var(--accent);
}

.main-content {
  flex: 1;
  padding: var(--space-6) var(--space-8);
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  overflow-y: auto;
}

/* Mobile Bottom Tab Bar */
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
  color: var(--accent);
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
}
</style>
