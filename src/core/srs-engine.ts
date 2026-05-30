export interface SRSResult {
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: Date
  status: 'new' | 'learning' | 'review' | 'familiar' | 'mastered'
}

const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const QUALITY_PASS = 3

export function calculateSRS(
  currentEase: number,
  currentInterval: number,
  currentRepetitions: number,
  quality: number
): SRSResult {
  let interval: number
  let repetitions: number
  let easeFactor = currentEase

  if (quality < QUALITY_PASS) {
    repetitions = 0
    interval = 1
  } else {
    if (currentRepetitions === 0) {
      interval = 1
    } else if (currentRepetitions === 1) {
      interval = 3
    } else {
      interval = Math.round(currentInterval * easeFactor)
    }
    repetitions = currentRepetitions + 1
  }

  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  easeFactor = Math.max(MIN_EASE, easeFactor)

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  const status = getStatus(quality)

  return { easeFactor, interval, repetitions, nextReview, status }
}

function getStatus(quality: number): SRSResult['status'] {
  const statusMap: Record<number, SRSResult['status']> = {
    0: 'new',
    1: 'learning',
    2: 'learning',
    3: 'review',
    4: 'familiar',
    5: 'mastered',
  }
  return statusMap[quality] || 'new'
}

export function getDefaultSRS() {
  return {
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    nextReview: null as string | null,
    lastReview: null as string | null,
    status: 'new' as const,
    totalReviews: 0,
    correctCount: 0,
    wrongCount: 0,
    avgResponseTime: 0,
    history: [] as { date: string; quality: number; interval: number }[],
  }
}
