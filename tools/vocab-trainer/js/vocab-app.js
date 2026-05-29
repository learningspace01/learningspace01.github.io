/**
 * Vocab App — Main Controller
 * Manages routing, state, and coordinates all sub-modules
 */

import { themeManager } from '../../../assets/js/core/theme.js';
import { vocabStorage } from './storage.js';
import {
  getDueWords, getTodayLearnedCount, getTodayReviewedCount, getStreakDays,
  createLearningRecord, updateLearningRecord,
  RESULT, QUALITY, LABELS,
} from './spaced-repetition.js';
import { Flashcard } from './flashcard.js';
import { isSpeechAvailable } from './speech.js';

// ============================================
// App State
// ============================================

const state = {
  currentTab: 'dashboard',
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
  setupTheme();

  // Initialize category
  await vocabStorage.initCategory();

  // Load data
  await reloadWordData();

  // Setup tabs
  setupTabs();

  // Update category label in sidebar
  updateCategoryLabel();

  // Render initial tab
  switchTab('dashboard');
}

async function reloadWordData() {
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

    console.log(`Loaded ${words.length} words (${vocabStorage.getCurrentCategory()})`);
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('数据加载失败，请刷新页面');
  }
}

function updateCategoryLabel() {
  const label = document.getElementById('sidebar-category-label');
  if (label) {
    label.textContent = vocabStorage.getCategoryLabel(vocabStorage.getCurrentCategory());
  }
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
    case 'dashboard':
      renderDashboard();
      break;
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
    case 'settings':
      renderSettingsPage();
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
// Dashboard
// ============================================

function renderDashboard() {
  const dueCount = getDueWords(state.records).length;
  const learnedCount = state.records.filter(r => r.repetitions > 0).length;
  const totalWords = state.words.length;
  const accuracy = state.records.length > 0
    ? Math.round((state.records.reduce((s, r) => s + r.correctCount, 0) / Math.max(1, state.records.reduce((s, r) => s + r.reviewCount, 0))) * 100)
    : 0;
  const streak = getStreakDays(state.stats.studyHistory || []);
  const catLabel = vocabStorage.getCategoryLabel(vocabStorage.getCurrentCategory());
  const todayReviewed = getTodayReviewedCount(state.records);
  const dailyGoal = state.settings.dailyGoal || 20;
  const reviewProgress = Math.min(100, Math.round((todayReviewed / dailyGoal) * 100));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning! ☀️' : hour < 18 ? 'Good Afternoon! 🌤️' : 'Good Evening! 🌙';

  contentEl.innerHTML = `
    <div class="dashboard">
      <div class="dash-greeting">${greeting}</div>
      <p class="dash-subtitle">${dueCount > 0 ? `今天有 <strong>${dueCount}</strong> 个单词等你复习` : '没有待复习的单词，去学些新词吧'}</p>

      <div class="dash-stats">
        <div class="dash-stat-card">
          <div class="dash-stat-icon">🔥</div>
          <div class="dash-stat-value">${streak}</div>
          <div class="dash-stat-label">连续打卡</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-icon">📚</div>
          <div class="dash-stat-value">${learnedCount}</div>
          <div class="dash-stat-label">已学单词</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-icon">✅</div>
          <div class="dash-stat-value">${accuracy}%</div>
          <div class="dash-stat-label">掌握率</div>
        </div>
      </div>

      <div class="dash-actions">
        ${dueCount > 0 ? `
        <div class="dash-action-card dash-action-primary" id="go-review">
          <div class="dash-action-icon">⏰</div>
          <div class="dash-action-info">
            <div class="dash-action-label">今日复习</div>
            <div class="dash-action-desc">${dueCount} 词待复习 · 已复习 ${todayReviewed} 词</div>
          </div>
          <div class="dash-action-cta">开始复习 →</div>
        </div>
        ` : ''}
        <div class="dash-action-card" id="go-learn">
          <div class="dash-action-icon">📖</div>
          <div class="dash-action-info">
            <div class="dash-action-label">学习新词</div>
            <div class="dash-action-desc">${catLabel} · ${totalWords - learnedCount} 词未学</div>
          </div>
          <div class="dash-action-cta">开始学习 →</div>
        </div>
      </div>

      <div class="dash-section-title">最近词库</div>
      <div class="dash-book-list">
        ${vocabStorage.getCategories().map(cat => {
          const isActive = cat.key === vocabStorage.getCurrentCategory();
          return `
          <div class="dash-book-item ${isActive ? 'active' : ''}" data-cat="${cat.key}">
            <div class="dash-book-icon">📘</div>
            <div class="dash-book-info">
              <div class="dash-book-name">${cat.label}</div>
              <div class="dash-book-progress">
                <div class="progress-bar" style="height:4px"><div class="progress-fill" style="width:${isActive ? Math.round((learnedCount/Math.max(1,totalWords))*100) : 0}%"></div></div>
                <span style="font-size:var(--text-xs);color:var(--text-tertiary)">${isActive ? learnedCount + '/' + totalWords : ''}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('go-review')?.addEventListener('click', () => switchTab('review'));
  document.getElementById('go-learn')?.addEventListener('click', () => switchTab('learn'));
  contentEl.querySelectorAll('.dash-book-item').forEach(item => {
    item.addEventListener('click', async () => {
      const catKey = item.dataset.cat;
      if (catKey !== vocabStorage.getCurrentCategory()) {
        await handleCategoryChange(catKey);
      }
    });
  });
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
      <div class="badge badge-accent">已复习 ${record.reviewCount || 0} 次</div>
    </div>
    <div class="flashcard-wrapper" id="flashcard-container"></div>
    <div class="rating-bar-5">
      <button class="rating-btn-5 r5-0" data-q="0"><span class="r5-emoji">😵</span><span class="r5-label">不认识</span><span class="r5-sub">${LABELS[0].sub}</span></button>
      <button class="rating-btn-5 r5-1" data-q="1"><span class="r5-emoji">😟</span><span class="r5-label">模糊</span><span class="r5-sub">${LABELS[1].sub}</span></button>
      <button class="rating-btn-5 r5-2" data-q="2"><span class="r5-emoji">🤔</span><span class="r5-label">想想</span><span class="r5-sub">${LABELS[2].sub}</span></button>
      <button class="rating-btn-5 r5-3" data-q="3"><span class="r5-emoji">😊</span><span class="r5-label">想起来了</span><span class="r5-sub">${LABELS[3].sub}</span></button>
      <button class="rating-btn-5 r5-4" data-q="4"><span class="r5-emoji">🎯</span><span class="r5-label">掌握</span><span class="r5-sub">${LABELS[4].sub}</span></button>
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

  contentEl.querySelectorAll('.rating-btn-5').forEach(btn => {
    btn.addEventListener('click', async () => {
      const quality = parseInt(btn.dataset.q);
      await handleReviewRate(word, quality);
      state.currentWordIndex++;
      showReviewCard();
    });
  });
}

async function handleReviewRate(word, quality) {
  let record = state.records.find(r => r.wordId === word.id);
  if (!record) return;

  record = updateLearningRecord(record, quality);
  await vocabStorage.saveRecord(record);

  const idx = state.records.findIndex(r => r.wordId === word.id);
  if (idx >= 0) state.records[idx] = record;

  const isCorrect = quality >= 3;
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
// Settings Page
// ============================================

function renderSettingsPage() {
  const categories = vocabStorage.getCategories();
  const currentCat = vocabStorage.getCurrentCategory();

  contentEl.innerHTML = `
    <div class="settings-page">
      <!-- Category Selection -->
      <div class="settings-section">
        <div class="settings-section-header">词库选择</div>
        <div class="cat-radio-group" id="cat-radio-group">
          ${categories.map(cat => `
            <button class="cat-radio-item ${cat.key === currentCat ? 'active' : ''}" data-cat="${cat.key}">
              <span class="cat-radio-check"></span>
              <span>${cat.label}</span>
              <span class="cat-radio-count" id="cat-count-${cat.key}">...</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Learning Settings -->
      <div class="settings-section">
        <div class="settings-section-header">学习设置</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">每日新词目标</div>
          </div>
          <div class="stepper">
            <button class="stepper-btn" id="goal-minus">−</button>
            <span class="stepper-value" id="goal-value">${state.settings.dailyGoal || 20}</span>
            <button class="stepper-btn" id="goal-plus">+</button>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">自动发音</div>
            <div class="settings-row-desc">显示新卡片时自动朗读</div>
          </div>
          <input type="checkbox" class="toggle" id="auto-audio" ${state.settings.autoPlayAudio ? 'checked' : ''}>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">显示音标</div>
          </div>
          <input type="checkbox" class="toggle" id="show-phonetic" ${state.settings.showPhonetic ? 'checked' : ''}>
        </div>
      </div>

      <!-- Data Management -->
      <div class="settings-section">
        <div class="settings-section-header">数据管理</div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">导入单词</div>
            <div class="settings-row-desc">从 Excel 批量导入，自动创建新词库</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="open-import">导入</button>
          <input type="file" id="import-excel-file" accept=".xlsx,.xls,.csv" style="display:none">
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">导出学习数据</div>
            <div class="settings-row-desc">导出当前词库的 JSON 备份</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="export-data">导出</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">导入学习数据</div>
            <div class="settings-row-desc">从 JSON 文件恢复数据</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="import-data">导入</button>
          <input type="file" id="import-file" accept=".json" style="display:none">
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">清除当前词库记录</div>
            <div class="settings-row-desc">保留单词，仅清除学习进度</div>
          </div>
          <button class="btn-danger-text" id="clear-category">清除</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label" style="color: var(--accent-red);">重置所有数据</div>
            <div class="settings-row-desc">删除所有词库的学习记录</div>
          </div>
          <button class="btn-danger-text" id="reset-all">重置</button>
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="settings-about">
          基于<b>艾宾浩斯遗忘曲线</b>的间隔重复算法，在遗忘临界点安排复习。<br>
          8 个复习阶段：1天 → 2天 → 4天 → 7天 → 15天 → 30天 → 60天 → 90天。<br>
          将短期记忆转化为长期记忆。
        </div>
      </div>
    </div>
  `;

  // Load word counts for each category
  loadCategoryCounts();

  // Event: Category selection
  document.getElementById('cat-radio-group').querySelectorAll('.cat-radio-item').forEach(item => {
    item.addEventListener('click', async () => {
      const catKey = item.dataset.cat;
      if (catKey === vocabStorage.getCurrentCategory()) return;
      await handleCategoryChange(catKey);
    });
  });

  // Event: Daily goal stepper
  document.getElementById('goal-minus').addEventListener('click', async () => {
    const newGoal = Math.max(5, (state.settings.dailyGoal || 20) - 5);
    state.settings.dailyGoal = newGoal;
    document.getElementById('goal-value').textContent = newGoal;
    await vocabStorage.setSettings(state.settings);
  });
  document.getElementById('goal-plus').addEventListener('click', async () => {
    const newGoal = Math.min(50, (state.settings.dailyGoal || 20) + 5);
    state.settings.dailyGoal = newGoal;
    document.getElementById('goal-value').textContent = newGoal;
    await vocabStorage.setSettings(state.settings);
  });

  // Event: Auto audio toggle
  document.getElementById('auto-audio').addEventListener('change', async (e) => {
    state.settings.autoPlayAudio = e.target.checked;
    await vocabStorage.setSettings(state.settings);
  });

  // Event: Show phonetic toggle
  document.getElementById('show-phonetic').addEventListener('change', async (e) => {
    state.settings.showPhonetic = e.target.checked;
    await vocabStorage.setSettings(state.settings);
  });

  // Event: Open import
  document.getElementById('open-import').addEventListener('click', () => {
    document.getElementById('import-excel-file').click();
  });
  document.getElementById('import-excel-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleExcelImport(file);
    e.target.value = '';
  });

  // Event: Export data
  document.getElementById('export-data').addEventListener('click', async () => {
    const data = await vocabStorage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-${vocabStorage.getCurrentCategory()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  });

  // Event: Import data
  document.getElementById('import-data').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const success = await vocabStorage.importData(ev.target.result);
      if (success) {
        await reloadWordData();
        showToast('导入成功');
      } else {
        showToast('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  });

  // Event: Clear current category
  document.getElementById('clear-category').addEventListener('click', async () => {
    if (confirm('确定要清除当前词库的学习记录吗？单词数据保留。')) {
      await vocabStorage.clearCurrentCategoryData();
      await reloadWordData();
      showToast('已清除');
    }
  });

  // Event: Reset all
  document.getElementById('reset-all').addEventListener('click', async () => {
    if (confirm('确定要删除所有词库的全部数据吗？此操作不可撤销。')) {
      await vocabStorage.clearAllData();
      await reloadWordData();
      updateCategoryLabel();
      showToast('已重置所有数据');
    }
  });
}

async function handleCategoryChange(categoryKey) {
  await vocabStorage.switchCategory(categoryKey);
  await reloadWordData();
  updateCategoryLabel();
  // Re-render settings to reflect new active category
  renderSettingsPage();
}

async function loadCategoryCounts() {
  const categories = vocabStorage.getCategories();
  for (const cat of categories) {
    const countEl = document.getElementById(`cat-count-${cat.key}`);
    if (!countEl) continue;
    try {
      const response = await fetch(cat.file);
      if (response.ok) {
        const words = await response.json();
        countEl.textContent = `${words.length} 词`;
      }
    } catch {
      countEl.textContent = '—';
    }
  }
}

// ============================================
// Excel Import
// ============================================

let importPreviewData = [];

async function handleExcelImport(file) {
  try {
    const data = await readExcelFile(file);
    if (!data || data.length === 0) {
      showToast('文件中没有找到单词数据');
      return;
    }
    importPreviewData = data;
    showImportModal(data);
  } catch (err) {
    console.error('Import error:', err);
    showToast('导入失败，请检查文件格式');
  }
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { resolve([]); return; }

        // Detect header row (first row) — normalize column names
        const headers = rows[0].map(h => String(h || '').toLowerCase().trim());

        const colMap = {};
        const mappings = {
          word: ['word', '单词', '英文', 'english', '词汇'],
          phonetic: ['phonetic', '音标', 'phonetics', 'pronunciation'],
          meaning: ['meaning', '释义', '中文', 'chinese', '意思', '含义', '定义'],
          pos: ['pos', '词性', 'part of speech', 'type'],
          examples: ['examples', '例句', 'example', 'sentences', '例句(en)', '例句（en）'],
        };

        for (const [key, names] of Object.entries(mappings)) {
          for (const name of names) {
            const idx = headers.indexOf(name);
            if (idx >= 0) { colMap[key] = idx; break; }
          }
        }

        if (colMap.word === undefined) {
          // Fallback: first column is word
          colMap.word = 0;
          if (headers.length > 1) colMap.meaning = 1;
        }

        const words = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[colMap.word]) continue;
          const word = String(row[colMap.word]).trim();
          if (!word) continue;

          const meaning = colMap.meaning >= 0 ? String(row[colMap.meaning] || '').trim() : '';
          const phonetic = colMap.phonetic >= 0 ? String(row[colMap.phonetic] || '').trim() : '';
          const pos = colMap.pos >= 0 ? String(row[colMap.pos] || '').trim() : '';

          // Parse examples: split by | or newline
          let examples = [];
          if (colMap.examples >= 0) {
            const raw = String(row[colMap.examples] || '').trim();
            if (raw) {
              examples = raw.split('|').map(s => {
                const parts = s.trim().split('\n');
                return { en: parts[0]?.trim() || '', cn: parts[1]?.trim() || '' };
              }).filter(e => e.en);
            }
          }

          // If no pos in data, infer from meaning
          let finalPos = pos;
          if (!finalPos && meaning) {
            if (meaning.startsWith('v') || meaning.startsWith('V')) finalPos = 'v.';
            else if (meaning.startsWith('n') || meaning.startsWith('N')) finalPos = 'n.';
            else if (meaning.startsWith('adj') || meaning.startsWith('Adj')) finalPos = 'adj.';
            else if (meaning.startsWith('adv') || meaning.startsWith('Adv')) finalPos = 'adv.';
          }

          words.push({
            id: `imp_${Date.now()}_${i}`,
            word,
            phonetic,
            meaning,
            definitions: [{ pos: finalPos, def: meaning, example: examples[0]?.en || '' }],
            examples,
            tags: ['导入'],
            difficulty: 2,
          });
        }

        resolve(words);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function showImportModal(data) {
  const preview = data.slice(0, 10);

  const modal = document.createElement('div');
  modal.className = 'import-modal-overlay';
  modal.id = 'import-modal';
  modal.innerHTML = `
    <div class="import-modal">
      <h2>导入单词</h2>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
        解析到 <strong>${data.length}</strong> 个单词
      </p>
      ${preview.length > 0 ? `
        <div class="import-preview">
          <table>
            <thead><tr>
              <th>#</th><th>单词</th><th>音标</th><th>释义</th><th>词性</th>
            </tr></thead>
            <tbody>
              ${preview.map((w, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${w.word}</strong></td>
                  <td>${w.phonetic || '—'}</td>
                  <td>${(w.meaning || '').slice(0, 20)}</td>
                  <td>${w.definitions?.[0]?.pos || '—'}</td>
                </tr>
              `).join('')}
              ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary)">... 还有 ${data.length - 10} 个单词</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      ` : ''}
      <div class="import-field">
        <label>词库名称</label>
        <input type="text" id="import-cat-name" placeholder="例如：我的生词本" value="导入词库 ${new Date().toLocaleDateString('zh-CN')}">
      </div>
      <div class="import-actions">
        <button class="btn btn-secondary" id="import-cancel">取消</button>
        <button class="btn btn-primary" id="import-confirm">确认导入 ${data.length} 个单词</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Events
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeImportModal();
  });

  document.getElementById('import-cancel').addEventListener('click', closeImportModal);
  document.getElementById('import-confirm').addEventListener('click', async () => {
    const name = document.getElementById('import-cat-name').value.trim() || '导入词库';
    await vocabStorage.addImportedCategory(name, importPreviewData);
    closeImportModal();
    await reloadWordData();
    updateCategoryLabel();
    renderSettingsPage();
    showToast(`已导入 ${importPreviewData.length} 个单词`);
  });
}

function closeImportModal() {
  const modal = document.getElementById('import-modal');
  if (modal) modal.remove();
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
