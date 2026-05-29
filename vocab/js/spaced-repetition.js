/**
 * Spaced Repetition System — 艾宾浩斯间隔重复算法
 *
 * 基于艾宾浩斯遗忘曲线，将复习分为 8 个阶段：
 * Stage 0: 新词（未学习）
 * Stage 1: 1 天后
 * Stage 2: 2 天后
 * Stage 3: 4 天后
 * Stage 4: 7 天后
 * Stage 5: 15 天后
 * Stage 6: 30 天后
 * Stage 7: 60 天后
 * Stage 8: 90 天后（完成）
 */

const STAGES = [0, 1, 2, 4, 7, 15, 30, 60, 90];
const MAX_STAGE = STAGES.length - 1;

const RESULT = {
  AGAIN: 'again', // 完全不认识 — 退回 stage 0
  HARD: 'hard',   // 模糊 — 保持当前 stage
  GOOD: 'good',   // 认识 — 正常推进
  EASY: 'easy',   // 非常熟练 — 跳过一个 stage
};

/**
 * 计算下次复习时间
 * @param {number} currentStage — 当前阶段 (0-8)
 * @param {string} result — 复习结果 again/hard/good/easy
 * @param {Date} [fromDate] — 从哪一天开始计算（默认今天）
 * @returns {object} { nextStage, nextReviewDate, intervalDays }
 */
function calculateNextReview(currentStage, result, fromDate = new Date()) {
  let nextStage = currentStage;

  switch (result) {
    case RESULT.AGAIN:
      // 完全不认识 — 退回 stage 1（不是 0，因为已经学过了）
      nextStage = 1;
      break;
    case RESULT.HARD:
      // 模糊 — 保持当前 stage
      break;
    case RESULT.GOOD:
      // 认识 — 正常推进一个 stage
      nextStage = Math.min(currentStage + 1, MAX_STAGE);
      break;
    case RESULT.EASY:
      // 非常熟练 — 跳过两个 stage
      nextStage = Math.min(currentStage + 2, MAX_STAGE);
      break;
    default:
      nextStage = Math.min(currentStage + 1, MAX_STAGE);
  }

  const intervalDays = STAGES[nextStage];
  const nextReviewDate = new Date(fromDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  nextReviewDate.setHours(9, 0, 0, 0); // 统一早上 9 点复习

  return {
    nextStage,
    intervalDays,
    nextReviewDate,
  };
}

/**
 * 检查一个单词今天是否需要复习
 * @param {Date|string} nextReview — 下次复习时间
 * @returns {boolean}
 */
function isDueForReview(nextReview) {
  const reviewDate = new Date(nextReview);
  const now = new Date();
  // 只比较日期部分，忽略时间
  reviewDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return reviewDate <= now;
}

/**
 * 获取今天需要复习的单词
 * @param {Array} records — 学习记录数组
 * @returns {Array} 今天到期的记录
 */
function getDueWords(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(r => isDueForReview(r.nextReview));
}

/**
 * 获取今天新学习的单词数量统计
 * @param {Array} records — 学习记录数组
 * @returns {number}
 */
function getTodayLearnedCount(records) {
  if (!Array.isArray(records)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return records.filter(r => {
    const added = new Date(r.addedAt);
    added.setHours(0, 0, 0, 0);
    return added.getTime() === today.getTime();
  }).length;
}

/**
 * 获取今天复习的单词数量统计
 * @param {Array} records — 学习记录数组
 * @returns {number}
 */
function getTodayReviewedCount(records) {
  if (!Array.isArray(records)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return records.filter(r => {
    if (!r.lastReviewed) return false;
    const reviewed = new Date(r.lastReviewed);
    reviewed.setHours(0, 0, 0, 0);
    return reviewed.getTime() === today.getTime();
  }).length;
}

/**
 * 获取连续学习天数
 * @param {Array} history — 学习历史数组 [{date: '2026-05-29', ...}]
 * @returns {number}
 */
function getStreakDays(history) {
  if (!Array.isArray(history) || history.length === 0) return 0;

  // 按日期排序（降序）
  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 检查今天或昨天是否有学习记录
  const lastDate = new Date(sorted[0].date);
  lastDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) return 0; // 中断超过 1 天

  streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i - 1].date);
    const prev = new Date(sorted[i].date);
    curr.setHours(0, 0, 0, 0);
    prev.setHours(0, 0, 0, 0);

    const dayDiff = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 创建新的学习记录
 * @param {string} wordId — 单词 ID
 * @returns {object} 新记录
 */
function createLearningRecord(wordId) {
  const now = new Date();
  now.setHours(9, 0, 0, 0);

  return {
    wordId,
    stage: 0,
    nextReview: now.toISOString(),
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastReviewed: null,
    addedAt: new Date().toISOString(),
  };
}

/**
 * 更新学习记录（复习后调用）
 * @param {object} record — 现有记录
 * @param {string} result — again/hard/good/easy
 * @returns {object} 更新后的记录
 */
function updateLearningRecord(record, result) {
  const now = new Date();
  const { nextStage, nextReviewDate } = calculateNextReview(record.stage, result, now);

  const isCorrect = result !== RESULT.AGAIN;

  return {
    ...record,
    stage: nextStage,
    nextReview: nextReviewDate.toISOString(),
    reviewCount: record.reviewCount + 1,
    correctCount: isCorrect ? record.correctCount + 1 : record.correctCount,
    wrongCount: !isCorrect ? record.wrongCount + 1 : record.wrongCount,
    lastReviewed: now.toISOString(),
  };
}

export {
  STAGES,
  MAX_STAGE,
  RESULT,
  calculateNextReview,
  isDueForReview,
  getDueWords,
  getTodayLearnedCount,
  getTodayReviewedCount,
  getStreakDays,
  createLearningRecord,
  updateLearningRecord,
};
