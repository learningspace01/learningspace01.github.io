/**
 * Storage Layer — 多词库独立存储
 * 每个词库的学习记录和统计独立，设置共享
 */

const BUILTIN_CATEGORIES = {
  'cet4':            { key: 'cet4',             label: 'CET-4 核心词汇',             file: '../../../assets/data/vocab-cet4.json', builtin: true },
  'oxford-primary':  { key: 'oxford-primary',   label: '上海牛津 · 小学',             file: '../../../assets/data/vocab-oxford-primary.json', builtin: true },
  'oxford-junior':   { key: 'oxford-junior',    label: '上海牛津 · 初中',             file: '../../../assets/data/vocab-oxford-junior.json', builtin: true },
  'oxford-senior':   { key: 'oxford-senior',    label: '上海牛津 · 高中',             file: '../../../assets/data/vocab-oxford-senior.json', builtin: true },
  'ket':             { key: 'ket',               label: 'KET 核心词汇',                file: '../../../assets/data/vocab-ket.json', builtin: true },
};

const IMPORTED_CATS_KEY = 'ls01_vocab_imported_cats';
const SETTINGS_KEY = 'ls01_vocab_settings';

class LocalStorageAdapter {
  async get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }
  async remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch { return false; }
  }
}

function keyFor(category, type) {
  return `ls01_vocab_${type}_${category}`;
}

class VocabStorage {
  constructor() {
    this.adapter = new LocalStorageAdapter();
    this.cache = new Map();
    this.currentCategory = 'cet4';
  }

  // --- 词库类别管理 ---

  _allCategories() {
    return { ...BUILTIN_CATEGORIES, ...this._importedCats };
  }

  getCategories() {
    return Object.values(this._allCategories());
  }

  getCurrentCategory() {
    return this.currentCategory;
  }

  getCategoryLabel(key) {
    const all = this._allCategories();
    return all[key]?.label || key;
  }

  async _loadImportedCats() {
    const data = await this.adapter.get(IMPORTED_CATS_KEY);
    this._importedCats = data || {};
  }

  async switchCategory(categoryKey) {
    const all = this._allCategories();
    if (!all[categoryKey]) return false;
    this.currentCategory = categoryKey;
    this.cache.clear();
    await this.adapter.set('ls01_vocab_current_category', categoryKey);
    return true;
  }

  async initCategory() {
    await this._loadImportedCats();
    const saved = await this.adapter.get('ls01_vocab_current_category');
    const all = this._allCategories();
    if (saved && all[saved]) {
      this.currentCategory = saved;
    }
    return this.currentCategory;
  }

  async addImportedCategory(name, words) {
    await this._loadImportedCats();
    const key = 'import_' + Date.now();
    const cat = { key, label: name, builtin: false };
    this._importedCats[key] = cat;
    await this.adapter.set(IMPORTED_CATS_KEY, this._importedCats);

    // Save words under this category
    const wordsKey = keyFor(key, 'words');
    await this.adapter.set(wordsKey, words);

    // Auto-switch to new category
    await this.switchCategory(key);
    return key;
  }

  async removeImportedCategory(categoryKey) {
    await this._loadImportedCats();
    if (!this._importedCats[categoryKey]) return false;
    delete this._importedCats[categoryKey];
    await this.adapter.set(IMPORTED_CATS_KEY, this._importedCats);
    // Clean up data
    await Promise.all([
      this.adapter.remove(keyFor(categoryKey, 'words')),
      this.adapter.remove(keyFor(categoryKey, 'records')),
      this.adapter.remove(keyFor(categoryKey, 'stats')),
    ]);
    this.cache.clear();
    if (this.currentCategory === categoryKey) {
      this.currentCategory = 'cet4';
    }
    return true;
  }

  // --- 单词库管理 ---

  _wordsKey() { return keyFor(this.currentCategory, 'words'); }
  _recordsKey() { return keyFor(this.currentCategory, 'records'); }
  _statsKey() { return keyFor(this.currentCategory, 'stats'); }

  async getWords() {
    const k = this._wordsKey();
    const cached = this.cache.get(k);
    if (cached) return cached;

    let words = await this.adapter.get(k);
    if (!words || !Array.isArray(words) || words.length === 0) {
      words = await this.loadDefaultWords();
      await this.adapter.set(k, words);
    }
    this.cache.set(k, words);
    return words;
  }

  async setWords(words) {
    const k = this._wordsKey();
    this.cache.set(k, words);
    return this.adapter.set(k, words);
  }

  async addWord(word) {
    const words = await this.getWords();
    const exists = words.some(w => w.word.toLowerCase() === word.word.toLowerCase());
    if (exists) return false;
    word.id = word.id || crypto.randomUUID?.() || this._generateId();
    words.push(word);
    await this.setWords(words);
    return true;
  }

  async updateWord(wordId, updates) {
    const words = await this.getWords();
    const index = words.findIndex(w => w.id === wordId);
    if (index === -1) return false;
    words[index] = { ...words[index], ...updates };
    await this.setWords(words);
    return true;
  }

  async deleteWord(wordId) {
    const words = await this.getWords();
    const filtered = words.filter(w => w.id !== wordId);
    if (filtered.length === words.length) return false;
    await this.setWords(filtered);
    const records = await this.getRecords();
    await this.setRecords(records.filter(r => r.wordId !== wordId));
    return true;
  }

  async searchWords(query) {
    const words = await this.getWords();
    if (!query) return words;
    const q = query.toLowerCase().trim();
    return words.filter(w =>
      w.word.toLowerCase().includes(q) ||
      w.meaning?.toLowerCase().includes(q) ||
      w.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }

  // --- 学习记录管理 ---

  async getRecords() {
    const k = this._recordsKey();
    const cached = this.cache.get(k);
    if (cached) return cached;
    const records = await this.adapter.get(k) || [];
    this.cache.set(k, records);
    return records;
  }

  async setRecords(records) {
    const k = this._recordsKey();
    this.cache.set(k, records);
    return this.adapter.set(k, records);
  }

  async getRecord(wordId) {
    const records = await this.getRecords();
    return records.find(r => r.wordId === wordId) || null;
  }

  async saveRecord(record) {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.wordId === record.wordId);
    if (index >= 0) records[index] = record;
    else records.push(record);
    await this.setRecords(records);
    return true;
  }

  // --- 统计管理 ---

  async getStats() {
    const k = this._statsKey();
    const cached = this.cache.get(k);
    if (cached) return cached;
    let stats = await this.adapter.get(k);
    if (!stats) stats = this._createDefaultStats();
    this.cache.set(k, stats);
    return stats;
  }

  async setStats(stats) {
    const k = this._statsKey();
    this.cache.set(k, stats);
    return this.adapter.set(k, stats);
  }

  async updateDailyStats(learned = 0, reviewed = 0, correctRate = 0) {
    const stats = await this.getStats();
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = stats.studyHistory.find(h => h.date === today);
    if (todayEntry) {
      todayEntry.learned += learned;
      todayEntry.reviewed += reviewed;
      todayEntry.correctRate = correctRate;
    } else {
      stats.studyHistory.push({ date: today, learned, reviewed, correctRate });
    }
    if (stats.studyHistory.length > 365) stats.studyHistory = stats.studyHistory.slice(-365);
    stats.totalLearned = (await this.getRecords()).filter(r => r.stage > 0).length;
    stats.totalReviewed = stats.studyHistory.reduce((sum, h) => sum + h.reviewed, 0);
    stats.lastStudyDate = today;
    await this.setStats(stats);
    return stats;
  }

  // --- 设置管理（全局共享） ---

  async getSettings() {
    const settings = await this.adapter.get(SETTINGS_KEY);
    return { ...this._createDefaultSettings(), ...settings };
  }

  async setSettings(settings) {
    return this.adapter.set(SETTINGS_KEY, settings);
  }

  // --- 数据导入导出（当前词库） ---

  async exportData() {
    return JSON.stringify({
      category: this.currentCategory,
      words: await this.getWords(),
      records: await this.getRecords(),
      stats: await this.getStats(),
      settings: await this.getSettings(),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }, null, 2);
  }

  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.words) await this.setWords(data.words);
      if (data.records) await this.setRecords(data.records);
      if (data.stats) await this.setStats(data.stats);
      if (data.settings) await this.setSettings(data.settings);
      this.cache.clear();
      return true;
    } catch { return false; }
  }

  // --- 工具方法 ---

  async loadDefaultWords() {
    const all = this._allCategories();
    const cat = all[this.currentCategory];
    // Imported categories have no file — return empty (user data already stored)
    if (cat && !cat.file) {
      const words = await this.adapter.get(this._wordsKey()) || [];
      if (words.length > 0) return words;
      return this._createFallbackWords();
    }
    const file = cat?.file || BUILTIN_CATEGORIES['cet4'].file;
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error('Failed to load');
      const words = await response.json();
      return words.map((w, i) => ({ ...w, id: w.id || `word_${Date.now()}_${i}` }));
    } catch {
      return this._createFallbackWords();
    }
  }

  _generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _createDefaultStats() {
    return { totalLearned: 0, totalReviewed: 0, streakDays: 0, lastStudyDate: null, dailyGoal: 20, studyHistory: [] };
  }

  _createDefaultSettings() {
    return { dailyGoal: 20, autoPlayAudio: true, showPhonetic: true, showExample: true, darkMode: 'auto', reviewNotification: false };
  }

  _createFallbackWords() {
    return [
      { id: 'demo_1', word: 'apple', phonetic: '/ˈæp.əl/', meaning: 'n. 苹果', definitions: [{ pos: 'n.', def: '苹果', example: 'I eat an apple every day.' }], tags: ['基础'], difficulty: 1 },
      { id: 'demo_2', word: 'book', phonetic: '/bʊk/', meaning: 'n. 书', definitions: [{ pos: 'n.', def: '书', example: 'I have a new book.' }], tags: ['基础'], difficulty: 1 },
      { id: 'demo_3', word: 'learn', phonetic: '/lɜːn/', meaning: 'v. 学习', definitions: [{ pos: 'v.', def: '学习', example: 'We learn English every day.' }], tags: ['基础'], difficulty: 1 },
    ];
  }

  // --- 清除当前词库数据 ---

  async clearCurrentCategoryData() {
    await Promise.all([
      this.adapter.remove(this._wordsKey()),
      this.adapter.remove(this._recordsKey()),
      this.adapter.remove(this._statsKey()),
    ]);
    this.cache.clear();
  }

  async clearAllData() {
    const allCats = { ...BUILTIN_CATEGORIES, ...this._importedCats };
    for (const cat of Object.keys(allCats)) {
      await Promise.all([
        this.adapter.remove(keyFor(cat, 'words')),
        this.adapter.remove(keyFor(cat, 'records')),
        this.adapter.remove(keyFor(cat, 'stats')),
      ]);
    }
    await this.adapter.remove(SETTINGS_KEY);
    await this.adapter.remove(IMPORTED_CATS_KEY);
    await this.adapter.remove('ls01_vocab_current_category');
    this._importedCats = {};
    this.cache.clear();
    this.currentCategory = 'cet4';
  }
}

const vocabStorage = new VocabStorage();

export { VocabStorage, vocabStorage, CATEGORIES };
