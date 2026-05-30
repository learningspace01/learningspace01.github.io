<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import GlassCard from '@/components/GlassCard.vue'
import { BookOpen, Clock, FileText, Calculator, GraduationCap, Search, Sun, Moon } from 'lucide-vue-next'

const router = useRouter()
const settingsStore = useSettingsStore()

const tools = [
  {
    id: 'vocab',
    name: 'VocabMaster',
    desc: '英语生词训练本 — 智能记忆与复习',
    icon: BookOpen,
    color: '#4F6EF7',
    active: true,
    path: '/vocab',
  },
  {
    id: 'classflow',
    name: 'ClassFlow',
    desc: '教务与学情追踪引擎 — 签到、作业、学生管理',
    icon: GraduationCap,
    color: '#10B981',
    active: true,
    path: '/classflow',
  },
  {
    id: 'todo',
    name: '番茄钟 / 待办',
    desc: '高效时间管理工具（即将上线）',
    icon: Clock,
    color: '#9CA3AF',
    active: false,
    path: '',
  },
  {
    id: 'note',
    name: '笔记工具',
    desc: '结构化学习笔记（即将上线）',
    icon: FileText,
    color: '#9CA3AF',
    active: false,
    path: '',
  },
  {
    id: 'math',
    name: '数学计算器',
    desc: '多功能科学计算器（即将上线）',
    icon: Calculator,
    color: '#9CA3AF',
    active: false,
    path: '',
  },
]

function goToTool(tool: typeof tools[0]) {
  if (tool.active && tool.path) {
    router.push(tool.path)
  }
}
</script>

<template>
  <div class="home-page">
    <!-- Theme Toggle -->
    <button
      class="theme-float"
      @click="settingsStore.toggleDarkMode()"
      :title="settingsStore.settings.darkMode ? '切换亮色模式' : '切换暗色模式'"
    >
      <Sun v-if="settingsStore.settings.darkMode" :size="20" />
      <Moon v-else :size="20" />
    </button>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-bg" />
      <div class="hero-content">
        <h1 class="hero-title">LearningSpace</h1>
        <p class="hero-subtitle">一站式学习工具集合，让知识触手可及</p>

        <!-- Search Bar -->
        <div class="search-bar">
          <Search :size="20" class="search-icon" />
          <input
            type="text"
            placeholder="搜索工具和资料..."
            disabled
          />
        </div>
      </div>
    </section>

    <!-- Tools Grid -->
    <section class="tools-section">
      <h2 class="section-title">学习工具</h2>
      <div class="tools-grid">
        <GlassCard
          v-for="tool in tools"
          :key="tool.id"
          padding="var(--space-8)"
          class="tool-card"
          :class="{ active: tool.active }"
          @click="goToTool(tool)"
        >
          <div class="tool-icon-wrapper" :style="{ background: tool.color + '15' }">
            <component
              :is="tool.icon"
              :size="28"
              :color="tool.color"
              :stroke-width="1.8"
            />
          </div>
          <h3 class="tool-name">{{ tool.name }}</h3>
          <p class="tool-desc">{{ tool.desc }}</p>
          <div v-if="!tool.active" class="tool-badge">即将上线</div>
          <div v-else class="tool-badge active">立即使用</div>
        </GlassCard>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <p>© 2026 LearningSpace — learningspace01.github.io</p>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--bg-primary);
}

.theme-float {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  width: 42px;
  height: 42px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
  z-index: 200;
  transition: all var(--duration-fast) var(--ease-out);
}

.theme-float:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.hero {
  position: relative;
  padding: var(--space-20) var(--space-8) var(--space-16);
  text-align: center;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 20%, rgba(79, 110, 247, 0.08) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 60%);
  z-index: 0;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 640px;
  margin: 0 auto;
}

.hero-title {
  font-family: var(--font-en);
  font-size: var(--text-5xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.hero-subtitle {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin-bottom: var(--space-8);
}

.search-bar {
  position: relative;
  max-width: 480px;
  margin: 0 auto;
}

.search-bar input {
  width: 100%;
  padding: var(--space-4) var(--space-4) var(--space-4) var(--space-12);
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-out);
}

.search-bar input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light), var(--shadow-md);
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}

.tools-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 var(--space-8) var(--space-16);
}

.section-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-6);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-5);
}

.tool-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.tool-card:not(.active) {
  opacity: 0.7;
}

.tool-card:not(.active):hover {
  cursor: not-allowed;
}

.tool-icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.tool-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.tool-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
  margin-bottom: var(--space-4);
}

.tool-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.tool-badge.active {
  background: var(--accent-light);
  color: var(--accent);
}

.home-footer {
  text-align: center;
  padding: var(--space-8);
  border-top: 1px solid var(--border);
}

.home-footer p {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .hero {
    padding: var(--space-12) var(--space-5) var(--space-10);
  }

  .hero-title {
    font-size: var(--text-4xl);
  }

  .tools-section {
    padding: 0 var(--space-5) var(--space-10);
  }

  .tools-grid {
    grid-template-columns: 1fr;
  }
}
</style>
