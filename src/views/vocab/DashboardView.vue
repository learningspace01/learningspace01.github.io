<script setup lang="ts">
import { computed } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import GlassCard from '@/components/GlassCard.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import CountUp from '@/components/CountUp.vue'
import { Flame, BookOpen, CheckCircle, Play, Clock } from 'lucide-vue-next'

defineEmits<{
  switchTab: [tabId: string, subMode?: string]
}>()

const vocabStore = useVocabStore()
const settingsStore = useSettingsStore()

const greeting = computed(() => settingsStore.todayGreeting)
const greetingEmoji = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return '☀️'
  if (h < 18) return '🌤️'
  return '🌙'
})

const todayDueCount = computed(() => vocabStore.todayDueCount)
const todayProgress = computed(() =>
  Math.min(todayDueCount.value, settingsStore.settings.dailyGoal)
)
const todayRemaining = computed(() =>
  Math.max(settingsStore.settings.dailyGoal - todayDueCount.value, 0)
)

const statCards = computed(() => [
  {
    icon: Flame,
    label: '连续打卡',
    num: settingsStore.streakDays,
    suffix: ' 天',
    color: '#F59E0B',
  },
  {
    icon: BookOpen,
    label: '已学单词',
    num: vocabStore.totalLearned,
    suffix: ' 词',
    color: '#4F6EF7',
  },
  {
    icon: CheckCircle,
    label: '掌握率',
    num: vocabStore.masteryRate,
    suffix: '%',
    color: '#10B981',
  },
])
</script>

<template>
  <div class="dashboard">
    <!-- Greeting -->
    <div class="greeting-section">
      <h2 class="greeting">{{ greeting }} {{ greetingEmoji }}</h2>
      <p v-if="todayDueCount > 0" class="greeting-sub">
        今天有 <strong>{{ todayDueCount }}</strong> 个单词等你复习
      </p>
      <p v-else class="greeting-sub">
        没有待复习的单词，去学点新词吧
      </p>
    </div>

    <!-- Stat Cards -->
    <div class="stats-row">
      <GlassCard
        v-for="card in statCards"
        :key="card.label"
        padding="var(--space-5) var(--space-6)"
        class="stat-card"
      >
        <div class="stat-icon" :style="{ background: card.color + '15' }">
          <component :is="card.icon" :size="20" :color="card.color" stroke-width="2" />
        </div>
        <div class="stat-text">
          <span class="stat-value">
            <CountUp :end="card.num" :duration="1200" :suffix="card.suffix" />
          </span>
          <span class="stat-label">{{ card.label }}</span>
        </div>
      </GlassCard>
    </div>

    <!-- Today Review + Quick Import -->
    <div class="action-row">
      <GlassCard padding="var(--space-6)" class="review-card">
        <div class="review-header">
          <h3>今日复习</h3>
          <Clock />
        </div>
        <ProgressBar
          :current="todayProgress"
          :total="settingsStore.settings.dailyGoal"
        />
        <p class="review-info">
          今日目标 {{ settingsStore.settings.dailyGoal }} 词，
          剩余 {{ todayRemaining }} 词
        </p>
        <button
          class="primary-btn"
          @click="$emit('switchTab', 'learn')"
        >
          <Play :size="18" />
          <span>开始学习</span>
        </button>
      </GlassCard>

      <GlassCard padding="var(--space-6)" class="quick-import-card">
        <h3>快速导入</h3>
        <div class="import-actions">
          <button class="import-btn" @click="$emit('switchTab', 'import')">
            + 手动添加单词
          </button>
          <button class="import-btn secondary" @click="$emit('switchTab', 'import', 'batch')">
            + 批量导入
          </button>
          <button class="import-btn secondary" @click="$emit('switchTab', 'settings')">
            ⚙ 词库管理
          </button>
        </div>
      </GlassCard>
    </div>

    <!-- Word Books -->
    <div class="books-section">
      <h3 class="section-title">词库列表</h3>
      <div class="books-list">
        <GlassCard
          v-for="book in vocabStore.wordBooks"
          :key="book.id"
          padding="var(--space-5) var(--space-6)"
          class="book-card"
          @click="$emit('switchTab', 'settings')"
        >
          <div class="book-header">
            <span class="book-icon">{{ book.icon }}</span>
            <span class="book-name">{{ book.name }}</span>
            <span class="book-count">{{ book.learnedCount }}/{{ book.wordCount }}词</span>
          </div>
          <ProgressBar
            :current="book.masteredCount"
            :total="book.wordCount"
            color="linear-gradient(90deg, #10B981, #4F6EF7)"
          />
        </GlassCard>
        <GlassCard
          v-if="vocabStore.wordBooks.length === 0"
          padding="var(--space-8)"
          class="empty-book"
        >
          <p>暂无词库，点击上方「快速导入」或前往导入页添加</p>
        </GlassCard>
      </div>
    </div>
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
  font-family: var(--font-en);
  font-size: var(--text-3xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.greeting-sub {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.greeting-sub strong {
  color: var(--accent);
  font-weight: 600;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-family: var(--font-en);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-8);
}

.review-card h3, .quick-import-card h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.review-info {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-top: var(--space-3);
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  margin-top: var(--space-4);
  transition: all var(--duration-fast) var(--ease-out);
}

.primary-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 110, 247, 0.3);
}

.primary-btn:active {
  transform: scale(0.97);
}

.import-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.import-btn {
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-light);
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);
}

.import-btn:hover {
  background: var(--accent);
  color: white;
}

.import-btn.secondary {
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.import-btn.secondary:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.books-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.book-card {
  cursor: pointer;
}

.book-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.book-icon {
  font-size: var(--text-lg);
}

.book-name {
  flex: 1;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
}

.book-count {
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}

.empty-book {
  text-align: center;
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .stats-row {
    gap: var(--space-3);
  }

  .action-row {
    grid-template-columns: 1fr;
  }

  .stat-card {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2);
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 2px;
  }

  .stat-icon :deep(svg) {
    width: 16px;
    height: 16px;
  }

  .stat-text {
    align-items: center;
  }

  .stat-value {
    font-size: var(--text-base);
    line-height: 1.2;
  }

  .stat-label {
    font-size: 0.6rem;
    margin-top: 1px;
  }
}
</style>


