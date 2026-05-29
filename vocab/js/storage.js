/**
 * Storage Layer — 数据持久化抽象
 * 当前实现: LocalStorage
 * 预留: 后端 API 扩展接口
 */

const STORAGE_KEYS = {
  WORDS: 'ls01_vocab_words',
  RECORDS: 'ls01_vocab_records',
  STATS: 'ls01_vocab_stats',
  SETTINGS: 'ls01_vocab_settings',
};

/**
 * 本地存储适配器
 */
class LocalStorageAdapter {
  async get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 主存储类 — 统一数据访问接口
 */
class VocabStorage {
  constructor() {
    this.adapter = new LocalStorageAdapter();
    this.cache = new Map();
    this.apiEndpoint = null; // 预留：后端 API 地址
    this.apiEnabled = false;
  }

  // --- 单词库管理 ---

  async getWords() {
    const cached = this.cache.get(STORAGE_KEYS.WORDS);
    if (cached) return cached;

    let words = await this.adapter.get(STORAGE_KEYS.WORDS);
    if (!words || !Array.isArray(words) || words.length === 0) {
      // 首次使用，加载默认词库
      words = await this.loadDefaultWords();
      await this.adapter.set(STORAGE_KEYS.WORDS, words);
    }

    this.cache.set(STORAGE_KEYS.WORDS, words);
    return words;
  }

  async setWords(words) {
    this.cache.set(STORAGE_KEYS.WORDS, words);
    return this.adapter.set(STORAGE_KEYS.WORDS, words);
  }

  async addWord(word) {
    const words = await this.getWords();
    // 检查是否已存在
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

    // 同时删除学习记录
    const records = await this.getRecords();
    const filteredRecords = records.filter(r => r.wordId !== wordId);
    await this.setRecords(filteredRecords);
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
    const cached = this.cache.get(STORAGE_KEYS.RECORDS);
    if (cached) return cached;

    const records = await this.adapter.get(STORAGE_KEYS.RECORDS) || [];
    this.cache.set(STORAGE_KEYS.RECORDS, records);
    return records;
  }

  async setRecords(records) {
    this.cache.set(STORAGE_KEYS.RECORDS, records);
    return this.adapter.set(STORAGE_KEYS.RECORDS, records);
  }

  async getRecord(wordId) {
    const records = await this.getRecords();
    return records.find(r => r.wordId === wordId) || null;
  }

  async saveRecord(record) {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.wordId === record.wordId);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    await this.setRecords(records);
    return true;
  }

  // --- 统计管理 ---

  async getStats() {
    const cached = this.cache.get(STORAGE_KEYS.STATS);
    if (cached) return cached;

    let stats = await this.adapter.get(STORAGE_KEYS.STATS);
    if (!stats) {
      stats = this._createDefaultStats();
    }
    this.cache.set(STORAGE_KEYS.STATS, stats);
    return stats;
  }

  async setStats(stats) {
    this.cache.set(STORAGE_KEYS.STATS, stats);
    return this.adapter.set(STORAGE_KEYS.STATS, stats);
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
      stats.studyHistory.push({
        date: today,
        learned,
        reviewed,
        correctRate,
      });
    }

    // 保持最近 365 天的记录
    if (stats.studyHistory.length > 365) {
      stats.studyHistory = stats.studyHistory.slice(-365);
    }

    // 更新累计数据
    stats.totalLearned = (await this.getRecords()).filter(r => r.stage > 0).length;
    stats.totalReviewed = stats.studyHistory.reduce((sum, h) => sum + h.reviewed, 0);
    stats.lastStudyDate = today;

    await this.setStats(stats);
    return stats;
  }

  // --- 设置管理 ---

  async getSettings() {
    const settings = await this.adapter.get(STORAGE_KEYS.SETTINGS);
    return { ...this._createDefaultSettings(), ...settings };
  }

  async setSettings(settings) {
    return this.adapter.set(STORAGE_KEYS.SETTINGS, settings);
  }

  // --- 数据导入导出 ---

  async exportData() {
    const data = {
      words: await this.getWords(),
      records: await this.getRecords(),
      stats: await this.getStats(),
      settings: await this.getSettings(),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    return JSON.stringify(data, null, 2);
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
    } catch {
      return false;
    }
  }

  // --- 工具方法 ---

  async loadDefaultWords() {
    try {
      const response = await fetch('../assets/data/vocab-cet4.json');
      if (!response.ok) throw new Error('Failed to load default words');
      const words = await response.json();
      // 确保每个单词有唯一 ID
      return words.map((w, i) => ({
        ...w,
        id: w.id || `word_${Date.now()}_${i}`,
      }));
    } catch {
      // 返回最小默认词库作为 fallback
      return this._createFallbackWords();
    }
  }

  _generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _createDefaultStats() {
    return {
      totalLearned: 0,
      totalReviewed: 0,
      streakDays: 0,
      lastStudyDate: null,
      dailyGoal: 20,
      studyHistory: [],
    };
  }

  _createDefaultSettings() {
    return {
      dailyGoal: 20,
      autoPlayAudio: true,
      showPhonetic: true,
      showExample: true,
      darkMode: 'auto', // 'light' | 'dark' | 'auto'
      reviewNotification: false,
      apiEndpoint: null,
    };
  }

  _createFallbackWords() {
    return [
      { id: 'demo_1', word: 'apple', phonetic: '/ˈæp.əl/', meaning: 'n. 苹果', definitions: [{ pos: 'n.', def: '苹果', example: 'I eat an apple every day.' }], tags: ['基础'], difficulty: 1 },
      { id: 'demo_2', word: 'abandon', phonetic: '/əˈbæn.dən/', meaning: 'v. 放弃，遗弃', definitions: [{ pos: 'v.', def: '放弃，遗弃', example: 'They had to abandon their car.' }], tags: ['CET-4'], difficulty: 2 },
      { id: 'demo_3', word: 'ability', phonetic: '/əˈbɪl.ə.ti/', meaning: 'n. 能力，才能', definitions: [{ pos: 'n.', def: '能力，才能', example: 'She has the ability to speak four languages.' }], tags: ['CET-4'], difficulty: 2 },
      { id: 'demo_4', word: 'academic', phonetic: '/ˌæk.əˈdem.ɪk/', meaning: 'adj. 学术的；学院的', definitions: [{ pos: 'adj.', def: '学术的；学院的', example: 'The university offers various academic programs.' }], tags: ['CET-4'], difficulty: 3 },
      { id: 'demo_5', word: 'access', phonetic: '/ˈæk.ses/', meaning: 'n./v. 通道；进入；访问', definitions: [{ pos: 'n.', def: '通道；进入', example: 'You need a password to access the system.' }], tags: ['CET-4'], difficulty: 3 },
    ];
  }

  // --- 数据清理 ---

  async clearAllData() {
    await Promise.all([
      this.adapter.remove(STORAGE_KEYS.WORDS),
      this.adapter.remove(STORAGE_KEYS.RECORDS),
      this.adapter.remove(STORAGE_KEYS.STATS),
      this.adapter.remove(STORAGE_KEYS.SETTINGS),
    ]);
    this.cache.clear();
  }
}

// Singleton
const vocabStorage = new VocabStorage();

export { VocabStorage, vocabStorage, STORAGE_KEYS };
