import type { Word } from '@/types/vocab'

export function getReviewQueue(words: Word[]): Word[] {
  const today = new Date().toISOString().split('T')[0]

  const overdue: Word[] = []
  const fuzzy: Word[] = []
  const due: Word[] = []
  const ahead: Word[] = []

  for (const word of words) {
    if (word.srs.status === 'new' || !word.srs.nextReview) continue

    const reviewDate = word.srs.nextReview

    if (reviewDate < today) {
      const prevStatus = word.srs.history.at(-1)
      if (prevStatus && prevStatus.quality < 3) {
        fuzzy.push(word)
      } else {
        overdue.push(word)
      }
    } else if (reviewDate === today) {
      due.push(word)
    } else {
      ahead.push(word)
    }
  }

  const sortFn = (a: Word, b: Word) => {
    if (a.srs.easeFactor !== b.srs.easeFactor) {
      return a.srs.easeFactor - b.srs.easeFactor
    }
    const la = a.srs.lastReview || '1970-01-01'
    const lb = b.srs.lastReview || '1970-01-01'
    return la.localeCompare(lb)
  }

  overdue.sort(sortFn)
  fuzzy.sort(sortFn)
  due.sort(sortFn)
  ahead.sort(sortFn)

  return [...overdue, ...fuzzy, ...due, ...ahead]
}

export function getNewWordsQueue(words: Word[], count: number): Word[] {
  return words
    .filter((w) => w.srs.status === 'new')
    .slice(0, count)
}

export interface LearnQueueOptions {
  dailyNewLimit?: number
  randomize?: boolean
  excludeMastered?: boolean
  interleaveReviews?: boolean
  reviewRatio?: number // e.g. 3 = every 3rd word is a review
}

export function getLearnQueue(words: Word[], options: LearnQueueOptions = {}): Word[] {
  const {
    dailyNewLimit = Infinity,
    randomize = false,
    excludeMastered = true,
    interleaveReviews = true,
    reviewRatio = 4,
  } = options

  const today = new Date().toISOString().split('T')[0]

  // Separate words by status
  const newWords = words.filter((w) => w.srs.status === 'new')
  const dueWords = words.filter((w) => {
    if (w.srs.status === 'new') return false
    if (!w.srs.nextReview) return false
    return w.srs.nextReview <= today
  })
  const aheadWords = words.filter((w) => {
    if (w.srs.status === 'new') return false
    if (!w.srs.nextReview) return false
    return w.srs.nextReview > today
  })

  // Exclude mastered if configured
  const filterMastered = (ws: Word[]) =>
    excludeMastered ? ws.filter((w) => w.srs.status !== 'mastered') : ws

  let newPool = filterMastered(newWords).slice(0, dailyNewLimit)
  let duePool = filterMastered(dueWords)
  let aheadPool = filterMastered(aheadWords)

  const shuffle = (arr: Word[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  if (randomize) {
    newPool = shuffle([...newPool])
    duePool = shuffle([...duePool])
    aheadPool = shuffle([...aheadPool])
  }

  if (!interleaveReviews) {
    return [...newPool, ...duePool, ...aheadPool]
  }

  // Interleave: every Nth word is a review, starting with new words
  const result: Word[] = []
  let dueIdx = 0
  let newIdx = 0

  while (newIdx < newPool.length || dueIdx < duePool.length) {
    // Add new words first
    for (let i = 0; i < reviewRatio - 1 && newIdx < newPool.length; i++) {
      result.push(newPool[newIdx++])
    }
    // Then a review word
    if (dueIdx < duePool.length) {
      result.push(duePool[dueIdx++])
    } else if (newIdx < newPool.length) {
      result.push(newPool[newIdx++])
    }
  }

  // Append ahead words at end
  result.push(...aheadPool)

  return result
}

export interface TestQueueOptions {
  count?: number
  mode?: 'choice' | 'dictation'
  excludeNew?: boolean
  prioritizeWeak?: boolean
}

export function getTestQueue(words: Word[], options: TestQueueOptions = {}): Word[] {
  const {
    count = 10,
    mode = 'choice',
    excludeNew = true,
    prioritizeWeak = true,
  } = options

  let pool = words.slice()
  if (excludeNew) pool = pool.filter((w) => w.srs.status !== 'new')

  if (pool.length === 0) return []
  if (pool.length <= count) return pool.sort(() => Math.random() - 0.5)

  if (prioritizeWeak) {
    // Score by weakness: high wrongCount, low easeFactor, poor accuracy
    const scored = pool.map((w) => ({
      word: w,
      score:
        (w.srs.totalReviews > 0
          ? (w.srs.wrongCount * 3 - w.srs.correctCount) /
              Math.max(w.srs.totalReviews, 1)
          : 0) +
        (2.5 - Math.min(w.srs.easeFactor, 2.5)) / 2.5,
    }))
    scored.sort((a, b) => b.score - a.score)

    // 70% weakest + 30% random for variety
    const weakCount = Math.min(Math.floor(count * 0.7), pool.length)
    const randomCount = count - weakCount

    const selected: Word[] = []
    // Top weak words
    selected.push(...scored.slice(0, weakCount).map((s) => s.word))
    // Random from remaining
    const remaining = scored.slice(weakCount).sort(() => Math.random() - 0.5)
    selected.push(...remaining.slice(0, randomCount).map((s) => s.word))

    // Final shuffle
    return selected.sort(() => Math.random() - 0.5)
  }

  return [...pool].sort(() => Math.random() - 0.5).slice(0, count)
}

export function getTodayStats(words: Word[]) {
  const today = new Date().toISOString().split('T')[0]

  const dueForReview = words.filter(
    (w) => w.srs.nextReview && w.srs.nextReview <= today && w.srs.status !== 'new'
  )

  const completedToday = dueForReview.filter((w) => w.srs.lastReview === today)

  return {
    totalDue: dueForReview.length,
    completed: completedToday.length,
    remaining: Math.max(dueForReview.length - completedToday.length, 0),
  }
}
