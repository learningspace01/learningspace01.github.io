/**
 * VocabMaster — Main App Controller
 * 5 tabs per design spec: Import / Learn / Review / Stats / Settings
 * Dashboard is landing page (click brand to return)
 */

import { themeManager } from '../../../assets/js/core/theme.js';
import { vocabStorage } from './storage.js';
import {
  getDueWords, getTodayLearnedCount, getTodayReviewedCount, getStreakDays,
  createLearningRecord, updateLearningRecord,
  QUALITY, LABELS,
} from './spaced-repetition.js';
import { Flashcard } from './flashcard.js';

// === State ===
const state = {
  currentTab: 'dashboard',
  words: [], records: [], stats: null, settings: null,
  currentWordIndex: 0, quizQueue: [], quizAnswers: [],
  importSubTab: 'manual', // manual | batch | preset | url
  learnMode: 'flashcard', // flashcard | spelling
  testMode: 'choice',    // choice | dictation
  testTimer: 0, testTimerInterval: null,
};

// === DOM ===
const contentEl = document.getElementById('vocab-content');
const tabBarEl = document.getElementById('tab-bar');
const sidebarEl = document.getElementById('sidebar');
const toastEl = document.getElementById('toast');

// === Init ===
async function init() {
  try {
    setupTheme();
    await vocabStorage.initCategory();
    await reloadWordData();
    setupTabs();
    updateCategoryLabel?.();
    switchTab('dashboard');
  } catch (err) {
    console.error('Init error:', err);
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">加载失败</div><div class="empty-state-desc">${err.message}</div><button class="btn btn-primary mt-6" onclick="location.reload()">重新加载</button></div>`;
  }
}

async function reloadWordData() {
  try {
    const [words, records, stats, settings] = await Promise.all([
      vocabStorage.getWords(), vocabStorage.getRecords(),
      vocabStorage.getStats(), vocabStorage.getSettings(),
    ]);
    state.words = words; state.records = records;
    state.stats = stats; state.settings = settings;
    console.log(`Loaded ${words.length} words (${vocabStorage.getCurrentCategory()})`);
  } catch (err) {
    console.error('Load error:', err); showToast('数据加载失败');
  }
}

function updateCategoryLabel() {
  const el = document.getElementById('sidebar-category-label');
  if (el) el.textContent = vocabStorage.getCategoryLabel(vocabStorage.getCurrentCategory());
}

function setupTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const light = document.getElementById('theme-icon-light');
  const dark = document.getElementById('theme-icon-dark');
  function update() {
    const isDark = themeManager.getEffectiveTheme() === 'dark';
    if (light) light.style.display = isDark ? 'none' : 'block';
    if (dark) dark.style.display = isDark ? 'block' : 'none';
  }
  update();
  if (toggleBtn) toggleBtn.addEventListener('click', () => { themeManager.toggle(); update(); });
  window.addEventListener('themechange', update);
}

function setupTabs() {
  // Desktop sidebar
  if (sidebarEl) {
    sidebarEl.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
  }
  // Mobile tab bar
  tabBarEl.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  // Brand click → dashboard
  document.getElementById('nav-brand')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('dashboard'); });
}

function switchTab(tabName) {
  state.currentTab = tabName;

  // Update sidebar
  if (sidebarEl) {
    sidebarEl.querySelectorAll('.sidebar-item').forEach(i =>
      i.classList.toggle('active', i.dataset.tab === tabName));
  }
  // Update bottom tab bar
  tabBarEl.querySelectorAll('.tab-item').forEach(i =>
    i.classList.toggle('active', i.dataset.tab === tabName));

  contentEl.innerHTML = '';
  switch (tabName) {
    case 'dashboard': renderDashboard(); break;
    case 'import': renderImport(); break;
    case 'learn': renderLearnMode(); break;
    case 'review': renderReviewMode(); break;
    case 'stats': renderStats(); break;
    case 'settings': renderSettings(); break;
  }
}

// === Toast ===
let toastT;
function showToast(msg) {
  clearTimeout(toastT);
  toastEl.textContent = msg; toastEl.classList.add('show');
  toastT = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ============================================
// DASHBOARD (§4.1)
// ============================================
function renderDashboard() {
  const due = getDueWords(state.records);
  const dueCount = due.length;
  const learned = state.records.filter(r => r.repetitions > 0).length;
  const total = state.words.length;
  const accuracy = state.records.length > 0
    ? Math.round((state.records.reduce((s,r) => s+r.correctCount,0) / Math.max(1, state.records.reduce((s,r) => s+r.reviewCount,0))) * 100)
    : 0;
  const streak = getStreakDays(state.stats.studyHistory || []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning! ☀️' : hour < 18 ? 'Good Afternoon! 🌤️' : 'Good Evening! 🌙';
  const todayR = getTodayReviewedCount(state.records);
  const dailyGoal = state.settings.dailyGoal || 20;

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
          <div class="dash-stat-value">${learned}</div>
          <div class="dash-stat-label">已学单词</div>
        </div>
        <div class="dash-stat-card">
          <div class="dash-stat-icon">✅</div>
          <div class="dash-stat-value">${accuracy}%</div>
          <div class="dash-stat-label">掌握率</div>
        </div>
      </div>

      <div class="dash-actions">
        <div class="dash-action-card dash-action-primary">
          <div class="dash-action-header">⏰ 今日复习</div>
          <div class="dash-action-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, Math.round((todayR/Math.max(1,dailyGoal))*100))}%"></div></div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:var(--space-1)">${todayR}/${dailyGoal} 词</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window._switchTab('review')">▶ 开始复习</button>
        </div>
        <div class="dash-action-card">
          <div class="dash-action-header">📥 快速导入</div>
          <div class="dash-action-sub">
            <a onclick="window._switchTab('import')">+ 手动添加单词</a>
            <a onclick="window._switchTab('import')">+ 批量导入</a>
            <a onclick="window._switchTab('import')">+ 从词库选择</a>
          </div>
        </div>
      </div>

      <div class="dash-chart">
        <div class="dash-chart-title">📊 本周学习趋势</div>
        <canvas id="weekly-chart" class="dash-chart-canvas"></canvas>
      </div>

      <div class="dash-section-title">最近学习的词库</div>
      ${vocabStorage.getCategories().map(cat => {
        const isActive = cat.key === vocabStorage.getCurrentCategory();
        const pct = isActive ? Math.round((learned / Math.max(1, total)) * 100) : 0;
        return `
        <div class="dash-book-item" data-cat="${cat.key}">
          <div class="dash-book-icon">📘</div>
          <div class="dash-book-info">
            <div class="dash-book-name">${cat.label}</div>
            <div class="dash-book-meta">
              <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${pct}%"></div></div>
              ${isActive ? `<span class="dash-book-count">${learned}/${total}词</span><span class="dash-book-pct">${pct}%</span>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  // Chart
  setTimeout(() => drawWeeklyChart(state.stats.studyHistory || []), 200);

  // Book switching
  contentEl.querySelectorAll('.dash-book-item').forEach(item => {
    item.addEventListener('click', async () => {
      const key = item.dataset.cat;
      if (key !== vocabStorage.getCurrentCategory()) {
        await vocabStorage.switchCategory(key);
        await reloadWordData();
        renderDashboard();
      }
    });
  });
}

function drawWeeklyChart(history) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas || !window.Chart) return;
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const entry = history.find(h => h.date === ds);
    days.push({ label: ['日','一','二','三','四','五','六'][d.getDay()], value: entry ? entry.learned + entry.reviewed : 0 });
  }
  new Chart(canvas, {
    type: 'bar',
    data: { labels: days.map(d => d.label), datasets: [{ data: days.map(d => d.value), backgroundColor: '#4F6EF7', borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, grid: { color: '#E5E7EB' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      plugins: { legend: { display: false } },
    },
  });
}

// ============================================
// IMPORT (§4.2)
// ============================================
function renderImport() {
  const sub = state.importSubTab;
  contentEl.innerHTML = `
    <div class="import-page">
      <div class="import-tabs">
        <button class="import-tab-btn ${sub==='manual'?'active':''}" data-sub="manual">✏️ 手动添加</button>
        <button class="import-tab-btn ${sub==='batch'?'active':''}" data-sub="batch">📋 批量导入</button>
        <button class="import-tab-btn ${sub==='preset'?'active':''}" data-sub="preset">📂 预设词库</button>
        <button class="import-tab-btn ${sub==='url'?'active':''}" data-sub="url">🔗 URL导入</button>
      </div>
      <div id="import-content"></div>
    </div>
  `;

  // Sub-tab switching
  contentEl.querySelectorAll('.import-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { state.importSubTab = btn.dataset.sub; renderImport(); });
  });

  const subContent = document.getElementById('import-content');
  switch (sub) {
    case 'manual': renderManualEntry(subContent); break;
    case 'batch': renderBatchImport(subContent); break;
    case 'preset': renderPresetBooks(subContent); break;
    case 'url': renderUrlImport(subContent); break;
  }
}

function renderManualEntry(el) {
  el.innerHTML = `
    <div class="import-form">
      <div class="import-form-row">
        <div class="import-field"><label>单词 <span class="req">*</span></label><input type="text" id="man-word" placeholder="elaborate"></div>
        <div class="import-field"><label>音标</label><input type="text" id="man-phonetic" placeholder="ɪˈlæb.ər.ət"></div>
      </div>
      <div class="import-form-row">
        <div class="import-field"><label>释义 <span class="req">*</span></label><input type="text" id="man-meaning" placeholder="adj. 精心制作的；v. 详细阐述"></div>
        <div class="import-field"><label>词性</label><select id="man-pos"><option value="">选择</option><option>n.</option><option>v.</option><option>adj.</option><option>adv.</option><option>prep.</option><option>conj.</option></select></div>
      </div>
      <div class="import-form-row">
        <div class="import-field"><label>例句(en)</label><input type="text" id="man-example-en" placeholder="He elaborated on his theory."></div>
        <div class="import-field"><label>例句(cn)</label><input type="text" id="man-example-cn" placeholder="他详细阐述了他的理论。"></div>
      </div>
      <div class="import-field"><label>词根词缀</label><input type="text" id="man-etymology" placeholder="e-(出)+labor(劳动)+-ate"></div>
      <div class="import-field"><label>助记</label><input type="text" id="man-mnemonic" placeholder="付出劳动去做出来→精心制作"></div>
      <div class="import-field"><label>标签</label><input type="text" id="man-tags" placeholder="#四级 #高频"></div>
      <div class="import-form-actions">
        <button class="btn btn-secondary" onclick="document.getElementById('import-content').innerHTML=''">取消</button>
        <button class="btn btn-primary" id="man-save">✓ 保存并继续</button>
      </div>
    </div>
  `;
  document.getElementById('man-save')?.addEventListener('click', async () => {
    const word = {
      id: 'man_' + Date.now(),
      word: document.getElementById('man-word')?.value?.trim(),
      phonetic: document.getElementById('man-phonetic')?.value?.trim(),
      meaning: document.getElementById('man-meaning')?.value?.trim(),
      definitions: [{ pos: document.getElementById('man-pos')?.value || '', def: document.getElementById('man-meaning')?.value?.trim() || '', example: document.getElementById('man-example-en')?.value?.trim() || '' }],
      examples: [{ en: document.getElementById('man-example-en')?.value?.trim() || '', cn: document.getElementById('man-example-cn')?.value?.trim() || '' }],
      etymology: document.getElementById('man-etymology')?.value?.trim(),
      mnemonic: document.getElementById('man-mnemonic')?.value?.trim(),
      tags: (document.getElementById('man-tags')?.value || '').split(/[,\s]+/).filter(Boolean),
      difficulty: 2,
    };
    if (!word.word || !word.meaning) { showToast('请填写单词和释义'); return; }
    await vocabStorage.addWord(word);
    await reloadWordData();
    showToast(`已添加: ${word.word}`);
    renderManualEntry(el); // reset form
  });
}

function renderBatchImport(el) {
  el.innerHTML = `
    <div class="batch-box" id="batch-upload">
      <div class="icon">📋</div>
      <div class="title">点击上传或拖拽文件</div>
      <div class="desc">Excel(.xlsx/.xls)、CSV、或直接粘贴文本</div>
    </div>
    <input type="file" id="batch-file" accept=".xlsx,.xls,.csv" style="display:none">
    <textarea class="batch-textarea" id="batch-text" placeholder="每行一个单词，或 Tab/逗号分隔：&#10;elaborate&#10;ubiquitous" style="margin-top:var(--space-4);display:none"></textarea>
    <div class="import-form-actions" style="margin-top:var(--space-4)">
      <button class="btn btn-secondary" id="batch-mode-file">📁 文件</button>
      <button class="btn btn-secondary" id="batch-mode-text">📝 文本</button>
      <button class="btn btn-primary" id="batch-import-btn" style="display:none">导入</button>
    </div>
  `;
  document.getElementById('batch-upload')?.addEventListener('click', () => document.getElementById('batch-file')?.click());
  document.getElementById('batch-file')?.addEventListener('change', (e) => handleExcelImport(e.target.files[0]));
  document.getElementById('batch-mode-text')?.addEventListener('click', () => {
    document.getElementById('batch-text').style.display = 'block';
    document.getElementById('batch-import-btn').style.display = 'inline-flex';
  });
  document.getElementById('batch-mode-file')?.addEventListener('click', () => document.getElementById('batch-file')?.click());
  document.getElementById('batch-import-btn')?.addEventListener('click', async () => {
    const text = document.getElementById('batch-text')?.value?.trim();
    if (!text) return;
    const lines = text.split('\n').filter(Boolean);
    const words = lines.map(line => {
      const parts = line.split(/[\t,]/);
      return {
        id: 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        word: (parts[0]||'').trim(),
        phonetic: (parts[1]||'').trim(),
        meaning: (parts[2]||'').trim(),
        definitions: [{ pos: '', def: (parts[2]||'').trim(), example: (parts[3]||'').trim() }],
        tags: ['导入'], difficulty: 2,
      };
    }).filter(w => w.word);
    if (words.length === 0) { showToast('未识别到单词'); return; }
    const name = `导入词库 ${new Date().toLocaleDateString('zh-CN')}`;
    await vocabStorage.addImportedCategory(name, words);
    await reloadWordData();
    showToast(`已导入 ${words.length} 个单词`);
    renderImport();
  });
}

function renderPresetBooks(el) {
  const presets = [
    { name:'中考核心1600', count:'1,600', for:'初中生' },
    { name:'高考核心3500', count:'3,500', for:'高中生' },
    { name:'四级核心词汇', count:'4,500', for:'大学生' },
    { name:'六级核心词汇', count:'5,500', for:'大学生' },
    { name:'雅思高频词汇', count:'6,000', for:'留学备考' },
    { name:'托福核心词汇', count:'8,000', for:'留学备考' },
    { name:'GRE核心词汇', count:'10,000', for:'研究生备考' },
    { name:'考研核心5500', count:'5,500', for:'考研学生' },
    { name:'常用3000词(Oxford)', count:'3,000', for:'通用英语' },
  ];
  el.innerHTML = `
    <div class="preset-grid">
      ${presets.map(p => `
        <div class="preset-card">
          <h4>📘 ${p.name}</h4>
          <p>${p.count}词 · ${p.for}</p>
        </div>
      `).join('')}
    </div>
    <p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-top:var(--space-4);text-align:center">更多预设词库即将上线</p>
  `;
}

function renderUrlImport(el) {
  el.innerHTML = `
    <div class="import-field"><label>输入URL</label><input type="url" id="url-input" placeholder="https://example.com/words.json"></div>
    <div class="import-form-actions" style="margin-top:var(--space-4)"><button class="btn btn-primary" id="url-fetch">获取并导入</button></div>
    <p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-top:var(--space-4);text-align:center">支持 JSON 格式，通过 CORS 验证的URL</p>
  `;
  document.getElementById('url-fetch')?.addEventListener('click', async () => {
    const url = document.getElementById('url-input')?.value?.trim();
    if (!url) return;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (!Array.isArray(data)) { showToast('JSON 格式必须是数组'); return; }
      const words = data.map((w,i) => ({ id: 'url_'+Date.now()+'_'+i, ...w, tags: [...(w.tags||[]), '导入'], difficulty: w.difficulty||2 }));
      await vocabStorage.addImportedCategory(`导入 ${new Date().toLocaleDateString('zh-CN')}`, words);
      await reloadWordData();
      showToast(`已导入 ${words.length} 个单词`);
    } catch { showToast('获取失败，请检查URL'); }
  });
}

// ============================================
// LEARN MODE (§4.3)
// ============================================
function renderLearnMode() {
  const unlearned = state.words.filter(w => {
    const r = state.records.find(x => x.wordId === w.id);
    return !r || r.repetitions === 0;
  });
  if (unlearned.length === 0) {
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div><div class="empty-state-title">太棒了</div><div class="empty-state-desc">所有新词已学完</div><button class="btn btn-primary mt-6" onclick="window._switchTab('review')">去复习</button></div>`;
    return;
  }
  state.currentWordIndex = 0;
  state.quizQueue = unlearned.slice(0, state.settings.dailyGoal || 20);
  showLearnCard();
}

function showLearnCard() {
  const words = state.quizQueue;
  const idx = state.currentWordIndex;
  if (idx >= words.length) {
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div><div class="empty-state-title">学习完成</div><div class="empty-state-desc">学习了 ${words.length} 个新词</div><button class="btn btn-primary mt-6" onclick="window._switchTab('dashboard')">返回仪表盘</button></div>`;
    return;
  }
  const word = words[idx];
  contentEl.innerHTML = `
    <div class="learn-header">
      <div class="learn-breadcrumb"><strong>${vocabStorage.getCategoryLabel(vocabStorage.getCurrentCategory())}</strong></div>
      <div class="learn-progress-text">${idx+1} / ${words.length}</div>
    </div>
    <div class="progress-bar" style="margin-bottom:var(--space-4)"><div class="progress-fill" style="width:${((idx)/words.length)*100}%"></div></div>
    <div class="flashcard-wrapper" id="flashcard-container"></div>
    <div class="learn-actions">
      <button class="btn btn-secondary btn-sm" id="learn-prev" ${idx===0?'disabled':''}>◀ 上一词</button>
      <span style="font-size:var(--text-sm);color:var(--text-tertiary)">[空格翻转]</span>
      <button class="btn btn-secondary btn-sm" id="learn-next">下一词 ▶</button>
    </div>
    <div class="rating-section">
      <div class="rating-label">掌握程度自评</div>
      <div class="rating-bar-4" id="learn-rating"></div>
    </div>
  `;

  // Flashcard
  if (window._fc) window._fc.destroy();
  const fc = new Flashcard(document.getElementById('flashcard-container'), { autoPlayAudio: state.settings.autoPlayAudio });
  fc.setWord(word);
  window._fc = fc;

  // Navigation
  document.getElementById('learn-prev')?.addEventListener('click', () => { if (idx > 0) { state.currentWordIndex--; showLearnCard(); } });
  document.getElementById('learn-next')?.addEventListener('click', () => { state.currentWordIndex++; showLearnCard(); });

  // 4-level rating (only in learn mode!)
  const ratingEl = document.getElementById('learn-rating');
  ratingEl.innerHTML = `
    <button class="rating-btn-l rl-0" data-q="0">😵<span>不认识</span></button>
    <button class="rating-btn-l rl-1" data-q="1">😐<span>有印象</span></button>
    <button class="rating-btn-l rl-2" data-q="3">😊<span>已掌握</span></button>
    <button class="rating-btn-l rl-3" data-q="4">🎯<span>太简单</span></button>
  `;
  ratingEl.querySelectorAll('.rating-btn-l').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = parseInt(btn.dataset.q);
      let record = state.records.find(r => r.wordId === word.id);
      if (!record) record = createLearningRecord(word.id);
      record = updateLearningRecord(record, q);
      await vocabStorage.saveRecord(record);
      const i = state.records.findIndex(r => r.wordId === word.id);
      if (i >= 0) state.records[i] = record; else state.records.push(record);
      await vocabStorage.updateDailyStats(1, 0, q >= 3 ? 1 : 0);
      state.currentWordIndex++;
      showLearnCard();
    });
  });
}

// ============================================
// REVIEW MODE (§4.4)
// ============================================
function renderReviewMode() {
  const due = getDueWords(state.records);
  const dueRecords = due.map(r => ({ record: r, word: state.words.find(w => w.id === r.wordId) })).filter(x => x.word);
  if (dueRecords.length === 0) {
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div class="empty-state-title">暂无复习任务</div><div class="empty-state-desc">今天没有需要复习的单词</div><button class="btn btn-primary mt-6" onclick="window._switchTab('learn')">学新词</button></div>`;
    return;
  }
  state.currentWordIndex = 0;
  state.quizQueue = dueRecords;
  showReviewCard();
}

function showReviewCard() {
  const items = state.quizQueue;
  const idx = state.currentWordIndex;
  if (idx >= items.length) {
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div><div class="empty-state-title">复习完成</div><div class="empty-state-desc">完成了 ${items.length} 个单词的复习</div><button class="btn btn-primary mt-6" onclick="window._switchTab('dashboard')">返回仪表盘</button></div>`;
    return;
  }
  const { word, record } = items[idx];
  const days = record.lastReviewed ? Math.floor((Date.now() - new Date(record.lastReviewed)) / 86400000) : 0;

  contentEl.innerHTML = `
    <div class="review-header">
      <div class="review-info-text">🔄 智能复习 · <strong>${idx+1}</strong> / ${items.length}</div>
      <div class="badge badge-accent">第 ${record.repetitions||0} 次 · ${days>0?'上次:'+days+'天前':'今天新学'}</div>
    </div>
    <div class="progress-bar" style="margin-bottom:var(--space-4)"><div class="progress-fill" style="width:${((idx)/items.length)*100}%"></div></div>
    <div class="flashcard-wrapper" id="flashcard-container"></div>
    <div class="rating-section">
      <div class="rating-label">你对这个词的掌握程度？</div>
      <div class="rating-bar-5" id="review-rating"></div>
    </div>
    <div class="action-bar">
      <button class="btn btn-secondary btn-sm" onclick="window._fc?.playAudio()">🔊 发音</button>
      <button class="btn btn-ghost btn-sm" id="review-skip">⏭ 跳过</button>
      <span style="font-size:var(--text-xs);color:var(--text-tertiary)">⌨ 快捷键: 1-5</span>
    </div>
  `;

  if (window._fc) window._fc.destroy();
  const fc = new Flashcard(document.getElementById('flashcard-container'), { autoPlayAudio: state.settings.autoPlayAudio });
  fc.setWord(word);
  window._fc = fc;

  // 5-level rating
  const ratingEl = document.getElementById('review-rating');
  const labels = [
    { emoji:'😵', label:'不认识', sub:'1天后', cls:'rr-0' },
    { emoji:'😟', label:'模糊', sub:'1天后', cls:'rr-1' },
    { emoji:'🤔', label:'想想能想起', sub:'3天后', cls:'rr-2' },
    { emoji:'😊', label:'比较熟悉', sub:'14天后', cls:'rr-3' },
    { emoji:'🎯', label:'完全掌握', sub:'30天后', cls:'rr-4' },
  ];
  ratingEl.innerHTML = labels.map((l,i) => `<button class="rating-btn-r ${l.cls}" data-q="${i}"><span>${l.emoji}</span><span>${l.label}</span><span style="font-size:8px;opacity:0.6">${l.sub}</span></button>`).join('');
  ratingEl.querySelectorAll('.rating-btn-r').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = parseInt(btn.dataset.q);
      let rec = state.records.find(r => r.wordId === word.id);
      if (!rec) return;
      rec = updateLearningRecord(rec, q);
      await vocabStorage.saveRecord(rec);
      const i = state.records.findIndex(r => r.wordId === word.id);
      if (i >= 0) state.records[i] = rec;
      await vocabStorage.updateDailyStats(0, 1, q >= 3 ? 1 : 0);
      state.currentWordIndex++;
      showReviewCard();
    });
  });
  document.getElementById('review-skip')?.addEventListener('click', () => { state.currentWordIndex++; showReviewCard(); });
}

// ============================================
// TEST MODE (§4.5) — accessed from review/learn
// ============================================
function renderChoiceTest() {
  const learned = state.words.filter(w => {
    const r = state.records.find(x => x.wordId === w.id);
    return r && r.repetitions > 0;
  });
  if (learned.length < 4) { showToast('需要至少4个已学单词'); return; }
  const shuffled = [...learned].sort(() => Math.random() - 0.5);
  const quizWords = shuffled.slice(0, Math.min(10, learned.length));
  state.currentWordIndex = 0; state.quizQueue = quizWords; state.quizAnswers = [];
  state.testTimer = 0;
  clearInterval(state.testTimerInterval);
  state.testTimerInterval = setInterval(() => { state.testTimer++; updateTestTimer(); }, 1000);
  showChoiceQuestion();
}

function showChoiceQuestion() {
  const words = state.quizQueue;
  const idx = state.currentWordIndex;
  if (idx >= words.length) { clearInterval(state.testTimerInterval); showTestResults(); return; }
  const word = words[idx];
  const others = state.words.filter(w => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [word, ...others].sort(() => Math.random() - 0.5);

  contentEl.innerHTML = `
    <div class="test-page">
      <div class="test-header">
        <div>📝 选择测试 · ${idx+1}/${words.length}</div>
        <div class="test-timer" id="test-timer">⏱ 00:00</div>
      </div>
      <div class="progress-bar" style="margin-bottom:var(--space-4)"><div class="progress-fill" style="width:${(idx/words.length)*100}%"></div></div>
      <div class="test-question">"${word.word}" 的意思是？</div>
      <div id="test-options">${options.map((opt,i) => `
        <button class="test-option" data-id="${opt.id}" data-idx="${i}">${String.fromCharCode(65+i)}. ${opt.meaning || opt.definitions?.[0]?.def || '未知'}</button>
      `).join('')}</div>
      <div id="test-expand"></div>
    </div>
  `;
  document.querySelectorAll('.test-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const isCorrect = btn.dataset.id === word.id;
      const correct = document.querySelector(`.test-option[data-id="${word.id}"]`);
      btn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect && correct) correct.classList.add('correct');
      state.quizAnswers.push({ wordId: word.id, correct: isCorrect });
      // Show expand
      const expand = document.getElementById('test-expand');
      expand.innerHTML = `<div class="test-expand">📖 ${word.definitions?.[0]?.example || ''}${word.etymology ? `<br>🧩 ${word.etymology}` : ''}</div><button class="btn btn-primary btn-sm mt-4" id="test-next-btn">下一题 →</button>`;
      document.getElementById('test-next-btn')?.addEventListener('click', () => { state.currentWordIndex++; showChoiceQuestion(); });
      document.querySelectorAll('.test-option').forEach(b => b.disabled = true);
    });
  });
}

function updateTestTimer() {
  const el = document.getElementById('test-timer');
  if (!el) { clearInterval(state.testTimerInterval); return; }
  const m = Math.floor(state.testTimer / 60).toString().padStart(2,'0');
  const s = (state.testTimer % 60).toString().padStart(2,'0');
  el.textContent = `⏱ ${m}:${s}`;
}

function showTestResults() {
  const correct = state.quizAnswers.filter(a => a.correct).length;
  const total = state.quizAnswers.length;
  contentEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" style="background:var(--accent-light);color:var(--accent)">📝</div>
      <div class="empty-state-title">测试完成</div>
      <div style="font-size:var(--text-4xl);font-weight:var(--font-bold);color:var(--accent);margin:var(--space-4) 0">${correct}/${total}</div>
      <div class="empty-state-desc">正确率 ${Math.round((correct/total)*100)}% · 用时 ${Math.floor(state.testTimer/60)}分${state.testTimer%60}秒</div>
      <button class="btn btn-primary mt-6" onclick="window._switchTab('dashboard')">返回仪表盘</button>
    </div>
  `;
}

// ============================================
// STATS (§4.6)
// ============================================
async function renderStats() {
  const records = state.records;
  const total = state.words.length;
  const learned = records.filter(r => r.repetitions > 0).length;
  const mastered = records.filter(r => r.repetitions >= 5).length;
  const inProgress = learned - mastered;
  const streak = getStreakDays(state.stats.studyHistory || []);
  const todayL = getTodayLearnedCount(records);
  const todayR = getTodayReviewedCount(records);

  contentEl.innerHTML = `
    <div class="stats-page">
      <div class="stats-kpi">
        <div class="stats-kpi-card"><div class="stats-kpi-value">${learned}</div><div class="stats-kpi-label">总学习量</div><div class="stats-kpi-delta" style="color:var(--success)">▲ +${todayL}</div></div>
        <div class="stats-kpi-card"><div class="stats-kpi-value">${mastered}</div><div class="stats-kpi-label">已掌握</div><div class="stats-kpi-delta" style="color:var(--success)">▲ +${todayR}</div></div>
        <div class="stats-kpi-card"><div class="stats-kpi-value">${inProgress}</div><div class="stats-kpi-label">学习中</div></div>
        <div class="stats-kpi-card"><div class="stats-kpi-value">${streak}</div><div class="stats-kpi-label">连续天数</div><div class="stats-kpi-delta">🔥</div></div>
      </div>

      <div class="stats-chart-box">
        <div class="stats-chart-title">📈 艾宾浩斯记忆曲线 vs 你的掌握曲线</div>
        <canvas id="curve-chart" style="width:100%;height:200px"></canvas>
      </div>

      <div class="stats-chart-box">
        <div class="stats-chart-title">📅 学习热力图</div>
        <div class="stats-heatmap" id="stats-heatmap"></div>
      </div>

      <div class="stats-chart-box">
        <div class="stats-chart-title">🏆 成就</div>
        <div class="achievements" id="achievements"></div>
      </div>

      <div class="stats-chart-box">
        <div class="stats-chart-title">🔤 易错词 TOP 10</div>
        <div id="top10-list"></div>
      </div>
    </div>
  `;

  // Chart
  setTimeout(() => {
    const canvas = document.getElementById('curve-chart');
    if (canvas && window.Chart) {
      const days = [1,3,7,14,30,60,90];
      const ebbinghaus = [100,70,50,35,25,18,12];
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: days.map(d => d+'天'),
          datasets: [
            { label:'理论遗忘曲线', data: ebbinghaus, borderColor:'#9CA3AF', borderDash:[4,4], tension:0.3, pointRadius:3 },
            { label:'你的掌握曲线', data: ebbinghaus.map(v => Math.min(100, v + 15 + Math.random()*20)), borderColor:'#4F6EF7', tension:0.3, pointRadius:4, borderWidth:2 },
          ],
        },
        options: { responsive:true, maintainAspectRatio:false,
          scales: { y: { max:100, grid:{color:'#E5E7EB'} }, x: { grid:{display:false} } },
          plugins: { legend: { position:'bottom', labels:{usePointStyle:true,boxWidth:8} } },
        },
      });
    }
  }, 200);

  // Heatmap
  setTimeout(() => {
    const el = document.getElementById('stats-heatmap');
    if (!el) return;
    const cells = [];
    const today = new Date();
    for (let i = 48; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const entry = (state.stats.studyHistory||[]).find(h => h.date === ds);
      const total = entry ? entry.learned + entry.reviewed : 0;
      cells.push({ level: total>=50?5:total>=30?4:total>=15?3:total>=5?2:total>0?1:0, date:ds, total });
    }
    el.innerHTML = cells.map(c => `<div class="stats-heatmap-cell" data-l="${c.level}" title="${c.date}:${c.total}词"></div>`).join('');
  }, 100);

  // Achievements
  const achievements = [
    { icon:'✅', name:'初次导入词库', done:true },
    { icon:'🔥', name:'连续7天打卡', done:streak>=7 },
    { icon:'📚', name:'掌握100词', done:mastered>=100 },
    { icon:'🏆', name:'连续30天打卡', done:streak>=30 },
    { icon:'📖', name:'完成一本词库', done:learned>=total && total>0 },
  ];
  document.getElementById('achievements').innerHTML = achievements.map(a => `
    <div class="achievement ${a.done?'':'locked'}"><div class="achievement-icon">${a.done?a.icon:'🔒'}</div><div class="achievement-name">${a.name}</div></div>
  `).join('');

  // Top 10 error words
  const top10 = [...records].filter(r => r.wrongCount > 0).sort((a,b) => b.wrongCount - a.wrongCount).slice(0, 10);
  const top10El = document.getElementById('top10-list');
  if (top10.length === 0) {
    top10El.innerHTML = '<p style="font-size:var(--text-sm);color:var(--text-tertiary);text-align:center;padding:var(--space-4)">暂无错词数据，继续学习吧</p>';
  } else {
    top10El.innerHTML = top10.map((r,i) => {
      const w = state.words.find(x => x.id === r.wordId);
      const pct = r.reviewCount > 0 ? Math.round((r.correctCount/r.reviewCount)*100) : 0;
      return `<div class="stats-top10-item"><span class="stats-top10-num">${i+1}</span><span class="stats-top10-word">${w?.word||'?'}</span><span class="stats-top10-err">❌${r.wrongCount}次 · 掌握度${pct}%</span></div>`;
    }).join('');
  }
}

// ============================================
// SETTINGS (§4.2 — category & settings)
// ============================================
function renderSettings() {
  const cats = vocabStorage.getCategories();
  const cur = vocabStorage.getCurrentCategory();
  contentEl.innerHTML = `
    <div class="settings-page">
      <div class="settings-section">
        <div class="settings-section-header">词库选择</div>
        <div class="cat-radio-group">${cats.map(c => `
          <button class="cat-radio-item ${c.key===cur?'active':''}" data-cat="${c.key}"><span class="cat-radio-check"></span><span>${c.label}</span><span class="cat-radio-count" id="sc-${c.key}">...</span></button>
        `).join('')}</div>
      </div>
      <div class="settings-section">
        <div class="settings-section-header">学习设置</div>
        <div class="settings-row"><div class="settings-row-label">每日新词目标</div><div class="stepper"><button class="stepper-btn" id="goal-m">−</button><span class="stepper-value" id="goal-v">${state.settings.dailyGoal||20}</span><button class="stepper-btn" id="goal-p">+</button></div></div>
        <div class="settings-row"><div class="settings-row-label">自动发音</div><input type="checkbox" class="toggle" id="auto-audio" ${state.settings.autoPlayAudio?'checked':''}></div>
        <div class="settings-row"><div class="settings-row-label">暗色模式</div><input type="checkbox" class="toggle" id="dark-mode" ${themeManager.getEffectiveTheme()==='dark'?'checked':''}></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-header">数据管理</div>
        <div class="settings-row"><div class="settings-row-label">导出学习数据</div><button class="btn btn-sm btn-secondary" id="export-data">导出JSON</button></div>
        <div class="settings-row"><div><div class="settings-row-label">导入单词</div><div class="settings-row-desc">Excel/CSV 批量导入</div></div><button class="btn btn-sm btn-secondary" onclick="window._switchTab('import')">去导入</button></div>
        <div class="settings-row"><div><div class="settings-row-label" style="color:var(--danger)">重置所有数据</div><div class="settings-row-desc">不可撤销</div></div><button class="btn-danger-text" id="reset-all">重置</button></div>
      </div>
      <div class="settings-section"><div class="settings-about">基于 <b>SM-2改良算法</b> 间隔重复 · 6个阶段复习 · 将短期记忆转化为长期记忆</div></div>
    </div>
  `;

  // Category switch
  contentEl.querySelectorAll('.cat-radio-item').forEach(item => {
    item.addEventListener('click', async () => {
      const k = item.dataset.cat;
      if (k === vocabStorage.getCurrentCategory()) return;
      await vocabStorage.switchCategory(k);
      await reloadWordData();
      updateCategoryLabel();
      renderSettings();
    });
  });

  // Goal stepper
  document.getElementById('goal-m')?.addEventListener('click', async () => {
    state.settings.dailyGoal = Math.max(5, (state.settings.dailyGoal||20)-5);
    document.getElementById('goal-v').textContent = state.settings.dailyGoal;
    await vocabStorage.setSettings(state.settings);
  });
  document.getElementById('goal-p')?.addEventListener('click', async () => {
    state.settings.dailyGoal = Math.min(50, (state.settings.dailyGoal||20)+5);
    document.getElementById('goal-v').textContent = state.settings.dailyGoal;
    await vocabStorage.setSettings(state.settings);
  });

  // Toggles
  document.getElementById('auto-audio')?.addEventListener('change', async (e) => {
    state.settings.autoPlayAudio = e.target.checked;
    await vocabStorage.setSettings(state.settings);
  });
  document.getElementById('dark-mode')?.addEventListener('change', async (e) => {
    themeManager.applyTheme(e.target.checked ? 'dark' : 'light');
  });

  // Export
  document.getElementById('export-data')?.addEventListener('click', async () => {
    const data = await vocabStorage.exportData();
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vocab-${vocabStorage.getCurrentCategory()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); showToast('导出成功');
  });

  // Reset
  document.getElementById('reset-all')?.addEventListener('click', async () => {
    if (confirm('确定删除所有数据？')) { await vocabStorage.clearAllData(); await reloadWordData(); showToast('已重置'); renderSettings(); }
  });

  // Load category word counts
  loadCatCounts();
}

async function loadCatCounts() {
  for (const cat of vocabStorage.getCategories()) {
    const el = document.getElementById(`sc-${cat.key}`);
    if (!el) continue;
    if (cat.file) {
      try {
        const r = await fetch(cat.file);
        if (r.ok) { const words = await r.json(); el.textContent = `${words.length}词`; continue; }
      } catch {}
    }
    el.textContent = '—';
  }
}

// ============================================
// Excel Import helper
// ============================================
async function handleExcelImport(file) {
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { showToast('文件为空'); return; }
      const headers = rows[0].map(h => String(h||'').toLowerCase().trim());
      const colMap = {};
      for (const [key, names] of Object.entries({
        word: ['word','单词','英文','english'], meaning: ['meaning','释义','中文','chinese'],
        phonetic: ['phonetic','音标'], pos: ['pos','词性'], examples: ['examples','例句'],
      })) {
        for (const n of names) { const i = headers.indexOf(n); if (i>=0) { colMap[key]=i; break; } }
      }
      if (colMap.word === undefined) colMap.word = 0;
      const words = [];
      for (let i=1; i<rows.length; i++) {
        const row = rows[i]; if (!row || !row[colMap.word]) continue;
        const w = String(row[colMap.word]).trim(); if (!w) continue;
        const meaning = colMap.meaning>=0 ? String(row[colMap.meaning]||'').trim() : '';
        const phonetic = colMap.phonetic>=0 ? String(row[colMap.phonetic]||'').trim() : '';
        const pos = colMap.pos>=0 ? String(row[colMap.pos]||'').trim() : '';
        words.push({
          id: `xls_${Date.now()}_${i}`, word: w, phonetic, meaning,
          definitions: [{ pos, def: meaning }],
          tags: ['导入'], difficulty: 2,
        });
      }
      if (words.length===0) { showToast('未识别到单词'); return; }
      const name = prompt('词库名称:', `导入词库 ${new Date().toLocaleDateString('zh-CN')}`);
      if (!name) return;
      await vocabStorage.addImportedCategory(name, words);
      await reloadWordData();
      showToast(`已导入 ${words.length} 个单词`);
      renderImport();
    };
    reader.readAsArrayBuffer(file);
  } catch (err) { console.error(err); showToast('导入失败'); }
}

// ============================================
// Global helpers
// ============================================
window._switchTab = (tab) => switchTab(tab);

// ============================================
// Start
// ============================================
init();
