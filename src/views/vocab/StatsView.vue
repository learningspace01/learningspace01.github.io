<script setup lang="ts">
import { computed } from 'vue'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import GlassCard from '@/components/GlassCard.vue'

const vocabStore = useVocabStore()
const settingsStore = useSettingsStore()

const stats = computed(() => [
  { label: '总学习量', value: `${vocabStore.totalLearned + vocabStore.totalMastered}词`, icon: '📚' },
  { label: '已掌握', value: `${vocabStore.totalMastered}词`, icon: '✅' },
  { label: '学习中', value: `${vocabStore.totalLearned - vocabStore.totalMastered}词`, icon: '📖' },
  { label: '连续天数', value: `${settingsStore.streakDays}天`, icon: '🔥' },
])

const weeklyMax = computed(() => {
  const max = Math.max(...vocabStore.weeklyActivity.map((d) => d.count), 1)
  return max
})

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const totalReviews = computed(() =>
  vocabStore.words.reduce((s, w) => s + w.srs.totalReviews, 0)
)
const totalCorrect = computed(() =>
  vocabStore.words.reduce((s, w) => s + w.srs.correctCount, 0)
)
const overallAccuracy = computed(() =>
  totalReviews.value ? Math.round((totalCorrect.value / totalReviews.value) * 100) : 0
)

// Learning curve data
const curveMax = computed(() => Math.max(...vocabStore.learningCurve, 1))
const curvePoints = computed(() => {
  const data = vocabStore.learningCurve
  if (data.length < 2) return ''
  const w = 540
  const h = 150
  const pad = 10
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2))
  const ys = data.map((v) => h - pad - (v / curveMax.value) * (h - pad * 2))
  return xs.map((x, i) => `${x},${ys[i]}`).join(' ')
})

// Forecast max
const forecastMax = computed(() => Math.max(...vocabStore.reviewForecast.map((d) => d.count), 1))

// Heatmap helpers
const heatmapWeeks = computed(() => {
  const weeks: { week: number; cells: typeof vocabStore.yearlyHeatmap }[] = []
  for (let w = 0; w < 52; w++) {
    const cells = vocabStore.yearlyHeatmap.filter((c) => c.week === w)
    if (cells.length > 0) weeks.push({ week: w, cells })
  }
  return weeks
})

function heatLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 8) return 2
  if (count <= 20) return 3
  return 4
}

// Day-of-week labels
const dayOfWeekLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
</script>

<template>
  <div class="stats-page">
    <!-- Overview Cards -->
    <div class="stats-row">
      <GlassCard v-for="s in stats" :key="s.label" padding="var(--space-4) var(--space-5)" class="stat-card">
        <span class="stat-icon">{{ s.icon }}</span>
        <div class="stat-info">
          <span class="stat-val">{{ s.value }}</span>
          <span class="stat-lbl">{{ s.label }}</span>
        </div>
      </GlassCard>
    </div>

    <div class="stats-grid-2col">
      <!-- Mastery Overview -->
      <GlassCard padding="var(--space-6)" class="section-card">
        <h3 class="section-title">综合正确率</h3>
        <div class="accuracy-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-secondary)" stroke-width="8" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="url(#grad)"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 52"
              :stroke-dashoffset="2 * Math.PI * 52 * (1 - overallAccuracy / 100)"
              transform="rotate(-90 60 60)"
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#4F6EF7" />
                <stop offset="100%" stop-color="#10B981" />
              </linearGradient>
            </defs>
          </svg>
          <div class="ring-center">
            <span class="ring-value">{{ overallAccuracy }}%</span>
            <span class="ring-label">综合正确率</span>
          </div>
        </div>
        <div class="accuracy-details">
          <span>总复习: {{ totalReviews }}次</span>
          <span>正确: {{ totalCorrect }}次</span>
        </div>
      </GlassCard>

      <!-- Status Distribution Donut -->
      <GlassCard padding="var(--space-6)" class="section-card">
        <h3 class="section-title">单词状态分布</h3>
        <div v-if="vocabStore.words.length === 0" class="empty-text-small">暂无数据</div>
        <div v-else class="status-dist">
          <div class="status-legend">
            <div v-for="item in vocabStore.statusDistribution" :key="item.status" class="status-legend-row">
              <span class="status-dot" :style="{ background: item.color }" />
              <span class="status-label">{{ item.label }}</span>
              <span class="status-count">{{ item.count }}</span>
              <span class="status-pct">{{ item.pct }}%</span>
            </div>
          </div>
          <div class="status-bar-full">
            <div
              v-for="item in vocabStore.statusDistribution"
              :key="item.status"
              class="status-bar-seg"
              :style="{ width: item.pct + '%', background: item.color }"
              :title="`${item.label}: ${item.count}词 (${item.pct}%)`"
            />
          </div>
        </div>
      </GlassCard>
    </div>

    <!-- Learning Trend Curve -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">30天学习趋势</h3>
      <div v-if="vocabStore.learningCurve.length < 2" class="empty-text-small">学习更多单词后会显示趋势曲线</div>
      <div v-else class="curve-chart">
        <svg viewBox="0 0 540 150" class="curve-svg" preserveAspectRatio="xMidYMid meet">
          <!-- Grid lines -->
          <line v-for="i in 4" :key="'g'+i" :x1="10" :y1="30*i" :x2="530" :y2="30*i" stroke="var(--bg-secondary)" stroke-width="1" />
          <!-- Area fill -->
          <polygon
            :points="'10,140 ' + curvePoints + ' 530,140'"
            fill="url(#curveGrad)"
            opacity="0.15"
          />
          <!-- Line -->
          <polyline
            :points="curvePoints"
            fill="none"
            stroke="#4F6EF7"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <defs>
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#4F6EF7" />
              <stop offset="100%" stop-color="#4F6EF7" stop-opacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div class="curve-x-labels">
          <span>30天前</span>
          <span>15天前</span>
          <span>今天</span>
        </div>
      </div>
    </GlassCard>

    <!-- Rating Quality + Weekly Activity -->
    <div class="stats-grid-2col">
      <!-- Rating Quality Distribution -->
      <GlassCard padding="var(--space-6)" class="section-card">
        <h3 class="section-title">评分质量分布</h3>
        <div v-if="totalReviews === 0" class="empty-text-small">完成复习后会显示评分分布</div>
        <div v-else class="rating-dist">
          <div v-for="(item, i) in vocabStore.ratingDistribution" :key="i" class="rating-row">
            <span class="rating-label">{{ i + 1 }}分</span>
            <div class="rating-bar-track">
              <div class="rating-bar-fill" :style="{ width: item.pct + '%', background: i < 2 ? '#EF4444' : i < 3 ? '#F59E0B' : '#10B981' }" />
            </div>
            <span class="rating-num">{{ item.count }}</span>
            <span class="rating-pct">{{ item.pct }}%</span>
          </div>
        </div>
      </GlassCard>

      <!-- Weekly Activity -->
      <GlassCard padding="var(--space-6)" class="section-card">
        <h3 class="section-title">本周学习趋势</h3>
        <div class="bar-chart">
          <div v-for="(day, i) in vocabStore.weeklyActivity" :key="i" class="bar-column">
            <div class="bar-wrapper">
              <div
                class="bar"
                :style="{ height: (day.count / weeklyMax) * 100 + '%' }"
              />
            </div>
            <span class="bar-label">{{ dayLabels[i] }}</span>
            <span class="bar-val">{{ day.count }}</span>
          </div>
        </div>
      </GlassCard>
    </div>

    <!-- Review Load Forecast -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">复习负荷预测（未来14天）</h3>
      <div class="forecast-chart">
        <div v-for="(day, i) in vocabStore.reviewForecast" :key="i" class="forecast-column">
          <div class="forecast-bar-wrap">
            <div
              class="forecast-bar"
              :class="{ warn: day.count > settingsStore.settings.dailyGoal }"
              :style="{ height: (day.count / forecastMax) * 100 + '%' }"
            />
          </div>
          <span class="forecast-label">{{ day.date.slice(5) }}</span>
          <span class="forecast-val" :class="{ warn: day.count > settingsStore.settings.dailyGoal }">{{ day.count }}</span>
        </div>
      </div>
    </GlassCard>

    <!-- Yearly Heatmap -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">全年学习热力图</h3>
      <div class="yearly-heatmap">
        <div class="heatmap-grid">
          <div v-for="cell in vocabStore.yearlyHeatmap" :key="cell.date" :class="'heat-cell level-' + heatLevel(cell.count)" :title="`${cell.date}: ${cell.count}次复习`" />
        </div>
        <div class="heatmap-legend">
          <span>少</span>
          <span class="legend-dot level-0" />
          <span class="legend-dot level-1" />
          <span class="legend-dot level-2" />
          <span class="legend-dot level-3" />
          <span class="legend-dot level-4" />
          <span>多</span>
        </div>
      </div>
    </GlassCard>

    <!-- Study Time Distribution -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">学习时段分布</h3>
      <div v-if="vocabStore.sessions.length === 0" class="empty-text-small">完成学习会话后会显示时段分布</div>
      <div v-else class="time-dist-chart">
        <div v-for="(item, h) in vocabStore.studyTimeDistribution" :key="h" class="time-bar-col">
          <div class="time-bar-track">
            <div class="time-bar-fill" :style="{ height: item.pct + '%' }" />
          </div>
          <span class="time-hour">{{ h }}h</span>
        </div>
      </div>
    </GlassCard>

    <!-- Confused Words -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">易错词 TOP 10</h3>
      <div v-if="vocabStore.confusedWords.length === 0" class="empty-text">
        暂无数据，学习更多单词后会显示
      </div>
      <div v-else class="confused-list">
        <div
          v-for="(word, i) in vocabStore.confusedWords"
          :key="word.id"
          class="confused-item"
        >
          <span class="rank">{{ i + 1 }}</span>
          <span class="cw-word">{{ word.word }}</span>
          <span class="cw-def">{{ word.definitions[0]?.meaning }}</span>
          <span class="cw-errors">{{ word.srs.wrongCount }}次</span>
          <span class="cw-rate">
            掌握度: {{ Math.round((word.srs.correctCount / Math.max(word.srs.totalReviews, 1)) * 100) }}%
          </span>
        </div>
      </div>
    </GlassCard>

    <!-- Achievements -->
    <GlassCard padding="var(--space-6)" class="section-card">
      <h3 class="section-title">成就</h3>
      <div class="achievements-grid">
        <div
          v-for="ach in vocabStore.achievements"
          :key="ach.id"
          class="achievement"
          :class="{ unlocked: ach.unlocked, locked: !ach.unlocked }"
        >
          <span class="ach-icon">{{ ach.unlocked ? ach.icon : '🔒' }}</span>
          <span class="ach-name">{{ ach.name }}</span>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<style scoped>
.stats-page {
  animation: fadeInUp 0.3s var(--ease-out);
  padding-bottom: var(--space-16);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.stats-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.stat-icon { font-size: 1.5rem; }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-val {
  font-family: var(--font-en);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-lbl {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.section-card {
  margin-bottom: var(--space-5);
  height: fit-content;
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-5);
}

.empty-text-small {
  text-align: center;
  color: var(--text-tertiary);
  padding: var(--space-6);
  font-size: var(--text-sm);
}

/* Accuracy Ring */
.accuracy-ring {
  display: flex;
  justify-content: center;
  position: relative;
}

.ring-svg {
  width: 140px;
  height: 140px;
}

.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.ring-value {
  font-family: var(--font-en);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--accent);
  display: block;
}

.ring-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.accuracy-details {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  margin-top: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Status Distribution */
.status-dist {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.status-legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.status-legend-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-label { color: var(--text-secondary); min-width: 56px; }
.status-count { font-weight: 600; color: var(--text-primary); min-width: 30px; }
.status-pct { color: var(--text-tertiary); font-size: var(--text-xs); margin-left: auto; }

.status-bar-full {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-secondary);
}

.status-bar-seg {
  transition: width 0.4s var(--ease-out);
  min-width: 2px;
}

/* Curve Chart */
.curve-chart {
  width: 100%;
}

.curve-svg {
  width: 100%;
  height: auto;
}

.curve-x-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: 0 var(--space-2);
  margin-top: var(--space-1);
}

/* Bar Chart */
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 150px;
  padding: 0 var(--space-2);
}

.bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}

.bar-wrapper {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 60%;
  min-height: 3px;
  background: linear-gradient(180deg, #4F6EF7, #6366F1);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: height 0.5s var(--ease-out);
}

.bar-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.bar-val {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

/* Rating Distribution */
.rating-dist {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.rating-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.rating-label {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 28px;
}

.rating-bar-track {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.rating-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s var(--ease-out);
  min-width: 2px;
}

.rating-num {
  min-width: 32px;
  text-align: right;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.rating-pct {
  min-width: 36px;
  text-align: right;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* Forecast */
.forecast-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 140px;
  padding: 0 var(--space-1);
}

.forecast-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.forecast-bar-wrap {
  width: 100%;
  height: 90px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.forecast-bar {
  width: 55%;
  min-height: 3px;
  background: var(--accent);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: height 0.4s var(--ease-out);
}
.forecast-bar.warn { background: var(--warning, #F59E0B); }

.forecast-label {
  font-size: 9px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.forecast-val {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-weight: 500;
}
.forecast-val.warn { color: var(--warning, #F59E0B); font-weight: 600; }

/* Yearly Heatmap */
.yearly-heatmap {
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(52, 12px);
  grid-template-rows: repeat(7, 12px);
  gap: 2px;
  grid-auto-flow: column;
  justify-content: center;
}

.heat-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.heat-cell.level-0 { background: var(--bg-secondary); }
.heat-cell.level-1 { background: #C7D2FE; }
.heat-cell.level-2 { background: #A5B4FC; }
.heat-cell.level-3 { background: #818CF8; }
.heat-cell.level-4 { background: #4F6EF7; }

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-dot.level-0 { background: var(--bg-secondary); }
.legend-dot.level-1 { background: #C7D2FE; }
.legend-dot.level-2 { background: #A5B4FC; }
.legend-dot.level-3 { background: #818CF8; }
.legend-dot.level-4 { background: #4F6EF7; }

/* Time Distribution */
.time-dist-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 80px;
  padding: 0 var(--space-1);
}

.time-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.time-bar-track {
  width: 100%;
  height: 60px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.time-bar-fill {
  width: 70%;
  min-height: 2px;
  background: #4F6EF7;
  border-radius: 2px 2px 0 0;
  transition: height 0.4s var(--ease-out);
}

.time-hour {
  font-size: 8px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* Confused Words */
.empty-text {
  text-align: center;
  color: var(--text-tertiary);
  padding: var(--space-8);
}

.confused-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.confused-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.rank {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--accent);
  min-width: 20px;
}

.cw-word {
  font-family: var(--font-serif);
  font-size: var(--text-base);
  font-weight: 600;
  min-width: 120px;
}

.cw-def {
  flex: 1;
  color: var(--text-secondary);
}

.cw-errors {
  color: var(--danger);
  font-size: var(--text-xs);
}

.cw-rate {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  white-space: nowrap;
}

/* Achievements */
.achievements-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.achievement {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  opacity: 0.5;
}

.achievement.unlocked {
  opacity: 1;
  background: white;
  border: 1px solid var(--border);
}

.achievement.locked {
  opacity: 0.35;
}

.ach-icon { font-size: 1.2rem; }
.ach-name { font-size: var(--text-sm); color: var(--text-primary); font-weight: 500; }

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-grid-2col {
    grid-template-columns: 1fr;
  }

  .achievements-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .confused-item {
    flex-wrap: wrap;
  }

  .forecast-label {
    font-size: 7px;
  }

  .heatmap-grid {
    grid-template-columns: repeat(52, 8px);
    grid-template-rows: repeat(7, 8px);
    gap: 1px;
  }

  .heat-cell {
    width: 8px;
    height: 8px;
  }

  .time-dist-chart { gap: 1px; }
  .time-hour { font-size: 7px; }
}
</style>
