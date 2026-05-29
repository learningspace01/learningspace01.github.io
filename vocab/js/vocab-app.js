/**
 * Vocab App — Main Controller
 * Manages routing, state, and coordinates all sub-modules
 */

import { themeManager } from '../../assets/js/core/theme.js';
import { vocabStorage } from './storage.js';
import {
  getDueWords,
  getTodayLearnedCount,
  getTodayReviewedCount,
  getStreakDays,
  createLearningRecord,
  updateLearningRecord,
  RESULT,
} from './spaced-repetition.js';
import { Flashcard } from './flashcard.js';
import { isSpeechAvailable } from './speech.js';

// ============================================
// App State
// ============================================

const state = {
  currentTab: 'learn',
  words: [],
  records: [],
  stats: null,
  settings: null,
  currentWordIndex: 0,
  quizQueue: [],
  quizAnswers: [],
  isInitialized: false,
};

// ============================================
// DOM References
// ============================================

const contentEl = document.getElementById('vocab-content');
const tabBarEl = document.getElementById('tab-bar');
const sidebarEl = document.getElementById('sidebar');
const toastEl = document.getElementById('toast');

// ============================================
// Initialization
// ============================================

async function init() {
  // Theme
  setupTheme();

  // Load data
  try {
    const [words, records, stats, settings] = await Promise.all([
      vocabStorage.getWords(),
      vocabStorage.getRecords(),
      vocabStorage.getStats(),
      vocabStorage.getSettings(),
    ]);

    state.words = words;
    state.records = records;
    state.stats = stats;
    state.settings = settings;
    state.isInitialized = true;

    console.log(`Loaded ${words.length} words, ${records.length} records`);
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('数据加载失败，请刷新页面');
  }

  // Setup tabs
  setupTabs();

  // Render initial tab
  switchTab('learn');
}

function setupTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const lightIcon = document.getElementById('theme-icon-light');
  const darkIcon = document.getElementById('theme-icon-dark');

  function updateIcon() {
    const isDark = themeManager.getEffectiveTheme() === 'dark';
    lightIcon.style.display = isDark ? 'none' : 'block';
    darkIcon.style.display = isDark ? 'block' : 'none';
  }

  updateIcon();
  toggleBtn.addEventListener('click', () => {
    themeManager.toggle();
    updateIcon();
  });
  window.addEventListener('themechange', updateIcon);
}

function setupTabs() {
  // Bottom tab bar (mobile)
  tabBarEl.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Sidebar navigation (desktop)
  if (sidebarEl) {
    sidebarEl.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        switchTab(item.dataset.tab);
      });
    });
  }
}

function switchTab(tabName) {
  state.currentTab = tabName;

  // Update tab bar
  tabBarEl.querySelectorAll('.tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  // Update sidebar
  if (sidebarEl) {
    sidebarEl.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });
  }

  // Render content
  contentEl.innerHTML = '';
  switch (tabName) {
    case 'learn':
      renderLearnMode();
      break;
    case 'review':
      renderReviewMode();
      break;
    case 'quiz':
      renderQuizMode();
      break;
    case 'stats':
      renderStatsPage();
      break;
    case 'wordbook':
      renderWordbookPage();
      break;
  }
}

// ============================================
// Toast
// ============================================

let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

// ============================================
// Learn Mode
// ============================================

function renderLearnMode() {
  const unlearnedWords = state.words.filter(w => {
    const record = state.records.find(r => r.wordId === w.id);
    return !record || record.stage === 0;
  });

  const todayLearned = getTodayLearnedCount(state.records);
  const dueCount = getDueWords(state.records).length;

  if (unlearnedWords.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="empty-state-title">太棒了！</div>
        <div class="empty-state-desc">你已经学完了所有新单词，去复习吧！</div>
        <button class="btn btn-primary btn-lg mt-6" onclick="window.switchTabExternal('review')">去复习</button>
      </div>
    `;
    return;
  }

  // Show intro if no active session
  contentEl.innerHTML = `
    <div class="learn-mode">
      <div class="study-header">
        <div class="study-progress">今日新学 ${todayLearned} / ${state.settings.dailyGoal || 20}</div>
        <div class="study-progress-bar">
          <div class="study-progress-fill" style="width: ${Math.min((todayLearned / (state.settings.dailyGoal || 20)) * 100, 100)}%"></div>
        </div>
      </div>

      <div class="learn-intro">
        <h2>开始学习新单词</h2>
        <p>还有 ${unlearnedWords.length} 个新单词等待学习</p>
        <div class="learn-stats-row">
          <div class="learn-stat">
            <div class="learn-stat-value">${unlearnedWords.length}</div>
            <div class="learn-stat-label">待学新词</div>
          </div>
          <div class="learn-stat">
            <div class="learn-stat-value">${dueCount}</div>
            <div class="learn-stat-label">待复习</div>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="start-learn-btn">开始学习</button>
      </div>
    </div>
  `;

  document.getElementById('start-learn-btn').addEventListener('click', () => {
    startLearnSession(unlearnedWords.slice(0, state.settings.dailyGoal || 20));
  });
}

function startLearnSession(wordsToLearn) {
  state.currentWordIndex = 0;
  state.quizQueue = wordsToLearn;
  showLearnCard();
}

function showLearnCard() {
  const words = state.quizQueue;
  const index = state.currentWordIndex;

  if (index >= words.length) {
    // Session complete
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="empty-state-title">学习完成！</div>
        <div class="empty-state-desc">今天学习了 ${words.length} 个新单词</div>
        <div class="flex gap-3 mt-6">
          <button class="btn btn-secondary" id="learn-again-btn">再来一组</button>
          <button class="btn btn-primary" id="learn-to-review-btn">去复习</button>
        </div>
      </div>
    `;

    document.getElementById('learn-again-btn').addEventListener('click', () => switchTab('learn'));
    document.getElementById('learn-to-review-btn').addEventListener('click', () => switchTab('review'));
    return;
  }

  const word = words[index];
  const progress = ((index) / words.length) * 100;

  contentEl.innerHTML = `
    <div class="learn-mode">
      <div class="study-header">
        <div class="study-progress">${index + 1} / ${words.length}</div>
        <div class="study-progress-bar">
          <div class="study-progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="flashcard-wrapper" id="flashcard-container"></div>
      <div class="rating-bar">
        <button class="rating-btn rating-btn-again" data-rate="again">
          不认识
          <span class="rating-btn-label">重新学习</span>
        </button>
        <button class="rating-btn rating-btn-good" data-rate="good">
          认识
          <span class="rating-btn-label">下一个</span>
        </button>
      </div>
    </div>
  `;

  // Cleanup old flashcard & create new
  if (window._currentFlashcard) window._currentFlashcard.destroy();

  const flashcard = new Flashcard(
    document.getElementById('flashcard-container'),
    { autoPlayAudio: state.settings.autoPlayAudio }
  );
  flashcard.setWord(word);
  window._currentFlashcard = flashcard;

  contentEl.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rate = btn.dataset.rate;
      await handleLearnRate(word, rate);
      state.currentWordIndex++;
      showLearnCard();
    });
  });
}

async function handleLearnRate(word, rate) {
  let record = state.records.find(r => r.wordId === word.id);
  if (!record) {
    record = createLearningRecord(word.id);
  }

  record = updateLearningRecord(record, rate === 'again' ? RESULT.AGAIN : RESULT.GOOD);
  await vocabStorage.saveRecord(record);

  // Update local state
  const idx = state.records.findIndex(r => r.wordId === word.id);
  if (idx >= 0) state.records[idx] = record;
  else state.records.push(record);

  // Update stats
  await vocabStorage.updateDailyStats(1, 0, rate === 'good' ? 1 : 0);
}

// ============================================
// Review Mode
// ============================================

function renderReviewMode() {
  const dueWords = getDueWords(state.records);

  // Get full word objects for due records
  const dueRecords = dueWords.map(r => ({
    record: r,
    word: state.words.find(w => w.id === r.wordId),
  })).filter(item => item.word);

  if (dueRecords.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="empty-state-title">暂无复习任务</div>
        <div class="empty-state-desc">今天没有需要复习的单词，去学习新单词吧！</div>
        <button class="btn btn-primary btn-lg mt-6" onclick="window.switchTabExternal('learn')">去学习</button>
      </div>
    `;
    return;
  }

  startReviewSession(dueRecords);
}

function startReviewSession(dueRecords) {
  state.currentWordIndex = 0;
  state.quizQueue = dueRecords;
  showReviewCard();
}

function showReviewCard() {
  const items = state.quizQueue;
  const index = state.currentWordIndex;

  if (index >= items.length) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="empty-state-title">复习完成！</div>
        <div class="empty-state-desc">完成了 ${items.length} 个单词的复习</div>
        <button class="btn btn-primary btn-lg mt-6" onclick="window.switchTabExternal('stats')">查看统计</button>
      </div>
    `;
    return;
  }

  const { word, record } = items[index];
  const progress = ((index) / items.length) * 100;

  contentEl.innerHTML = `
    <div class="review-info">
      <div class="review-count">复习 <strong>${index + 1}</strong> / ${items.length}</div>
      <div class="badge badge-blue">阶段 ${record.stage}</div>
    </div>
    <div class="flashcard-wrapper" id="flashcard-container"></div>
    <div class="rating-bar">
      <button class="rating-btn rating-btn-again" data-rate="again">
        不认识
        <span class="rating-btn-label">1天后</span>
      </button>
      <button class="rating-btn rating-btn-hard" data-rate="hard">
        模糊
        <span class="rating-btn-label">保持</span>
      </button>
      <button class="rating-btn rating-btn-good" data-rate="good">
        认识
        <span class="rating-btn-label">推进</span>
      </button>
      <button class="rating-btn rating-btn-easy" data-rate="easy">
        熟练
        <span class="rating-btn-label">跳过</span>
      </button>
    </div>
  `;

  // Cleanup old flashcard & create new
  if (window._currentFlashcard) window._currentFlashcard.destroy();

  const flashcard = new Flashcard(
    document.getElementById('flashcard-container'),
    { autoPlayAudio: state.settings.autoPlayAudio }
  );
  flashcard.setWord(word);
  window._currentFlashcard = flashcard;

  contentEl.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rate = btn.dataset.rate;
      await handleReviewRate(word, rate);
      state.currentWordIndex++;
      showReviewCard();
    });
  });
}

async function handleReviewRate(word, rate) {
  let record = state.records.find(r => r.wordId === word.id);
  if (!record) return;

  record = updateLearningRecord(record, rate);
  await vocabStorage.saveRecord(record);

  const idx = state.records.findIndex(r => r.wordId === word.id);
  if (idx >= 0) state.records[idx] = record;

  // Update stats
  const isCorrect = rate !== 'again';
  await vocabStorage.updateDailyStats(0, 1, isCorrect ? 1 : 0);
}

// ============================================
// Quiz Mode
// ============================================

function renderQuizMode() {
  const learnedWords = state.words.filter(w => {
    const record = state.records.find(r => r.wordId === w.id);
    return record && record.stage > 0;
  });

  if (learnedWords.length < 4) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          </svg>
        </div>
        <div class="empty-state-title">单词不够</div>
        <div class="empty-state-desc">需要先学习至少 4 个单词才能开始测试</div>
        <button class="btn btn-primary btn-lg mt-6" onclick="window.switchTabExternal('learn')">去学习</button>
      </div>
    `;
    return;
  }

  // Select 10 random words for quiz
  const shuffled = [...learnedWords].sort(() => Math.random() - 0.5);
  const quizWords = shuffled.slice(0, Math.min(10, learnedWords.length));

  startQuizSession(quizWords);
}

function startQuizSession(quizWords) {
  state.currentWordIndex = 0;
  state.quizQueue = quizWords;
  state.quizAnswers = [];
  showQuizQuestion();
}

function showQuizQuestion() {
  const words = state.quizQueue;
  const index = state.currentWordIndex;

  if (index >= words.length) {
    showQuizResults();
    return;
  }

  const word = words[index];
  const progress = ((index) / words.length) * 100;

  // Generate 4 options (1 correct + 3 random distractors)
  const otherWords = state.words.filter(w => w.id !== word.id);
  const distractors = otherWords
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = [word, ...distractors].sort(() => Math.random() - 0.5);

  contentEl.innerHTML = `
    <div class="quiz-container">
      <div class="study-header">
        <div class="study-progress">${index + 1} / ${words.length}</div>
        <div class="study-progress-bar">
          <div class="study-progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="quiz-question">
        <div class="quiz-question-word">${word.word}</div>
        <div class="quiz-question-hint">选择正确的中文释义</div>
      </div>
      <div class="quiz-options" id="quiz-options"></div>
    </div>
  `;

  const optionsEl = document.getElementById('quiz-options');
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt.meaning || opt.definitions?.[0]?.def || '未知';
    btn.addEventListener('click', () => handleQuizAnswer(word, opt, btn));
    optionsEl.appendChild(btn);
  });
}

function handleQuizAnswer(correctWord, selectedWord, btn) {
  const isCorrect = selectedWord.id === correctWord.id;
  const options = contentEl.querySelectorAll('.quiz-option');

  options.forEach(opt => {
    opt.disabled = true;
    if (opt === btn) {
      opt.classList.add(isCorrect ? 'quiz-option-correct' : 'quiz-option-wrong');
    }
  });

  // Highlight correct answer if wrong
  if (!isCorrect) {
    options.forEach(opt => {
      if (opt.textContent === (correctWord.meaning || correctWord.definitions?.[0]?.def)) {
        opt.classList.add('quiz-option-correct');
      }
    });
  }

  state.quizAnswers.push({ wordId: correctWord.id, correct: isCorrect });

  setTimeout(() => {
    state.currentWordIndex++;
    showQuizQuestion();
  }, 1200);
}

function showQuizResults() {
  const correct = state.quizAnswers.filter(a => a.correct).length;
  const total = state.quizAnswers.length;
  const rate = Math.round((correct / total) * 100);

  contentEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" style="background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="empty-state-title">测试完成</div>
      <div style="font-size: var(--text-4xl); font-weight: var(--font-bold); color: var(--accent-blue); margin: var(--space-4) 0;">
        ${correct}/${total}
      </div>
      <div class="empty-state-desc">正确率 ${rate}%</div>
      <div class="flex gap-3 mt-6">
        <button class="btn btn-secondary" onclick="window.switchTabExternal('quiz')">再测一次</button>
        <button class="btn btn-primary" onclick="window.switchTabExternal('stats')">查看统计</button>
      </div>
    </div>
  `;
}

// ============================================
// Stats Page
// ============================================

async function renderStatsPage() {
  const stats = await vocabStorage.getStats();
  const records = state.records;

  const totalWords = state.words.length;
  const learnedCount = records.filter(r => r.stage > 0).length;
  const masteredCount = records.filter(r => r.stage >= 8).length;
  const streak = getStreakDays(stats.studyHistory);
  const todayLearned = getTodayLearnedCount(records);
  const todayReviewed = getTodayReviewedCount(records);

  contentEl.innerHTML = `
    <div class="stats-page">
      <div class="stats-overview">
        <div class="stats-card">
          <div class="stats-card-value">${learnedCount}</div>
          <div class="stats-card-label">已学单词</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-value">${masteredCount}</div>
          <div class="stats-card-label">已掌握</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-value">${streak}</div>
          <div class="stats-card-label">连续天数</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-value">${todayLearned + todayReviewed}</div>
          <div class="stats-card-label">今日学习</div>
        </div>
      </div>

      <div class="stats-chart">
        <div class="stats-chart-title">学习热力图</div>
        <div class="heatmap" id="stats-heatmap"></div>
      </div>

      <div class="stats-chart">
        <div class="stats-chart-title">学习进度</div>
        <div style="display: flex; align-items: center; gap: var(--space-5); padding: var(--space-4) 0;">
          <svg width="120" height="120" viewBox="0 0 120 120" style="flex-shrink: 0;">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--separator)" stroke-width="10"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent-blue)" stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 52}"
              stroke-dashoffset="${2 * Math.PI * 52 * (1 - learnedCount / Math.max(totalWords, 1))}"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset var(--duration-slow) var(--ease-apple);"
            />
            <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="bold" fill="var(--text-primary)">${Math.round((learnedCount / Math.max(totalWords, 1)) * 100)}%</text>
            <text x="60" y="75" text-anchor="middle" font-size="12" fill="var(--text-secondary)">完成度</text>
          </svg>
          <div style="flex: 1;">
            <div style="margin-bottom: var(--space-4);">
              <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); margin-bottom: var(--space-1);">
                <span style="color: var(--text-secondary);">已掌握</span>
                <span style="font-weight: var(--font-semibold);">${masteredCount}</span>
              </div>
              <div style="height: 6px; background: var(--separator); border-radius: var(--radius-full); overflow: hidden;">
                <div style="height: 100%; width: ${(masteredCount / Math.max(learnedCount, 1)) * 100}%; background: var(--accent-green); border-radius: var(--radius-full); transition: width var(--duration-slow) var(--ease-apple);"></div>
              </div>
            </div>
            <div style="margin-bottom: var(--space-4);">
              <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); margin-bottom: var(--space-1);">
                <span style="color: var(--text-secondary);">学习中</span>
                <span style="font-weight: var(--font-semibold);">${learnedCount - masteredCount}</span>
              </div>
              <div style="height: 6px; background: var(--separator); border-radius: var(--radius-full); overflow: hidden;">
                <div style="height: 100%; width: ${((learnedCount - masteredCount) / Math.max(learnedCount, 1)) * 100}%; background: var(--accent-orange); border-radius: var(--radius-full); transition: width var(--duration-slow) var(--ease-apple);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: var(--text-sm); margin-bottom: var(--space-1);">
                <span style="color: var(--text-secondary);">未学习</span>
                <span style="font-weight: var(--font-semibold);">${totalWords - learnedCount}</span>
              </div>
              <div style="height: 6px; background: var(--separator); border-radius: var(--radius-full); overflow: hidden;">
                <div style="height: 100%; width: ${((totalWords - learnedCount) / Math.max(totalWords, 1)) * 100}%; background: var(--text-tertiary); border-radius: var(--radius-full); transition: width var(--duration-slow) var(--ease-apple);"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderHeatmap(stats.studyHistory);
}

function renderHeatmap(history) {
  const heatmapEl = document.getElementById('stats-heatmap');
  if (!heatmapEl) return;

  // Generate last 49 days (7x7 grid)
  const days = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = history.find(h => h.date === dateStr);
    const total = entry ? entry.learned + entry.reviewed : 0;
    let level = 0;
    if (total >= 50) level = 5;
    else if (total >= 30) level = 4;
    else if (total >= 15) level = 3;
    else if (total >= 5) level = 2;
    else if (total > 0) level = 1;

    days.push({ date: dateStr, level, total });
  }

  heatmapEl.innerHTML = days.map(d => `
    <div class="heatmap-cell" data-level="${d.level}" title="${d.date}: ${d.total} 个单词"></div>
  `).join('');
}

// ============================================
// Wordbook Page
// ============================================

function renderWordbookPage() {
  contentEl.innerHTML = `
    <div class="wordbook-page">
      <div class="wordbook-search">
        <svg class="wordbook-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
        <input type="text" id="wordbook-search" placeholder="搜索单词或释义..." autocomplete="off">
      </div>
      <div class="wordbook-list" id="wordbook-list"></div>
    </div>
  `;

  const searchInput = document.getElementById('wordbook-search');
  searchInput.addEventListener('input', (e) => {
    renderWordbookList(e.target.value);
  });

  renderWordbookList();
}

function renderWordbookList(query = '') {
  const listEl = document.getElementById('wordbook-list');
  if (!listEl) return;

  let words = state.words;
  if (query) {
    const q = query.toLowerCase().trim();
    words = words.filter(w =>
      w.word.toLowerCase().includes(q) ||
      w.meaning?.toLowerCase().includes(q)
    );
  }

  if (words.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-12) var(--space-6);">
        <div class="empty-state-desc">没有找到匹配的单词</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = words.map(word => {
    const record = state.records.find(r => r.wordId === word.id);
    let stageClass = 'wordbook-item-stage-new';
    let stageText = '新词';
    if (record) {
      if (record.stage >= 8) {
        stageClass = 'wordbook-item-stage-mastered';
        stageText = '已掌握';
      } else if (record.stage > 0) {
        stageClass = 'wordbook-item-stage-review';
        stageText = `阶段 ${record.stage}`;
      }
    }

    return `
      <div class="wordbook-item" data-word-id="${word.id}">
        <div class="wordbook-item-word">${word.word}</div>
        <div class="wordbook-item-phonetic">${word.phonetic || ''}</div>
        <div class="wordbook-item-meaning">${word.meaning || ''}</div>
        <span class="wordbook-item-stage ${stageClass}">${stageText}</span>
      </div>
    `;
  }).join('');
}

// ============================================
// External tab switch (for inline onclick handlers)
// ============================================

window.switchTabExternal = (tabName) => {
  switchTab(tabName);
};

// ============================================
// Start
// ============================================

init();
