/**
 * SM-2 Spaced Repetition Algorithm (Improved)
 * 0-5 quality rating system
 */

const QUALITY = {
  BLACK:  0, // completely forgotten
  RED:    1, // very vague
  ORANGE: 2, // vague, can't recall
  YELLOW: 3, // recalled with effort
  GREEN:  4, // recalled with slight hesitation
  BLUE:   5, // instant recall
};

const LABELS = {
  [QUALITY.BLACK]:  { name: 'again', label: '不认识',   sub: '明天',   color: 'var(--danger)' },
  [QUALITY.RED]:    { name: 'hard',  label: '模糊',     sub: '1天后', color: 'var(--warning)' },
  [QUALITY.ORANGE]: { name: 'hard',  label: '想想能想起', sub: '1天后', color: 'var(--warning)' },
  [QUALITY.YELLOW]: { name: 'good',  label: '想起来了',  sub: '3天后', color: 'var(--success)' },
  [QUALITY.GREEN]:  { name: 'good',  label: '较熟悉',    sub: '7天后', color: 'var(--success)' },
  [QUALITY.BLUE]:   { name: 'easy',  label: '完全掌握',  sub: '14天后', color: 'var(--accent)' },
};

const RESULT = { AGAIN: 'again', HARD: 'hard', GOOD: 'good', EASY: 'easy' };

function calculateSM2(word, quality) {
  const srs = word.srs || { easeFactor: 2.5, interval: 0, repetitions: 0 };
  let { easeFactor, interval, repetitions } = srs;
  if (quality < 3) { repetitions = 0; interval = 1; }
  else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  nextReview.setHours(9, 0, 0, 0);
  return { easeFactor, interval, repetitions, nextReview: nextReview.toISOString() };
}

function createLearningRecord(wordId) {
  return {
    wordId, easeFactor: 2.5, interval: 0, repetitions: 0,
    nextReview: new Date().toISOString(), reviewCount: 0,
    correctCount: 0, wrongCount: 0, lastReviewed: null,
    addedAt: new Date().toISOString(), history: [],
  };
}

function updateLearningRecord(record, quality) {
  const srs = calculateSM2({ srs: record }, quality);
  const isCorrect = quality >= 3;
  const now = new Date().toISOString();
  return {
    ...record, ...srs,
    reviewCount: record.reviewCount + 1,
    correctCount: isCorrect ? record.correctCount + 1 : record.correctCount,
    wrongCount: !isCorrect ? record.wrongCount + 1 : record.wrongCount,
    lastReviewed: now,
    history: [...(record.history || []), { date: now.split('T')[0], quality, interval: srs.interval }],
  };
}

function isDueForReview(nextReview) {
  const d = new Date(nextReview); d.setHours(0,0,0,0);
  const n = new Date(); n.setHours(0,0,0,0);
  return d <= n;
}

function getDueWords(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(r => isDueForReview(r.nextReview))
    .sort((a, b) => a.easeFactor - b.easeFactor);
}

function getTodayLearnedCount(records) {
  if (!Array.isArray(records)) return 0;
  const t = new Date().toISOString().split('T')[0];
  return records.filter(r => (r.addedAt||'').split('T')[0] === t).length;
}

function getTodayReviewedCount(records) {
  if (!Array.isArray(records)) return 0;
  const t = new Date().toISOString().split('T')[0];
  return records.filter(r => r.lastReviewed && r.lastReviewed.split('T')[0] === t).length;
}

function getStreakDays(history) {
  if (!Array.isArray(history) || !history.length) return 0;
  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  const today = new Date(); today.setHours(0,0,0,0);
  const last = new Date(sorted[0].date); last.setHours(0,0,0,0);
  if (Math.floor((today-last)/86400000) > 1) return 0;
  let s = 1;
  for (let i=1; i<sorted.length; i++) {
    const a=new Date(sorted[i-1].date), b=new Date(sorted[i].date);
    a.setHours(0,0,0,0); b.setHours(0,0,0,0);
    if(Math.floor((a-b)/86400000)===1) s++; else break;
  }
  return s;
}

export { QUALITY, LABELS, RESULT, calculateSM2, createLearningRecord, updateLearningRecord, isDueForReview, getDueWords, getTodayLearnedCount, getTodayReviewedCount, getStreakDays };
