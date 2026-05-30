import type { Word } from '@/types/vocab'

let _idCounter = 0
function wordId(): string {
  return `preset_${Date.now()}_${_idCounter++}_${Math.random().toString(36).slice(2, 5)}`
}

interface RawWord {
  w: string
  p: string
  pos: string
  def: string
  ex?: string
  excn?: string
  ety?: string
  mne?: string
  syn?: string
  tags?: string
  diff?: number
}

export function makeWord(raw: RawWord, bookId: string): Word {
  const now = new Date().toISOString()
  return {
    id: wordId(),
    bookId,
    word: raw.w,
    phonetic: raw.p,
    partOfSpeech: [raw.pos],
    definitions: [{ pos: raw.pos, meaning: raw.def }],
    examples: raw.ex ? [{ en: raw.ex, cn: raw.excn || '' }] : [],
    etymology: raw.ety || '',
    mnemonic: raw.mne || '',
    synonyms: raw.syn ? raw.syn.split(',').map((s) => s.trim()) : [],
    antonyms: [],
    relatedWords: [],
    tags: raw.tags ? raw.tags.split(',').map((s) => s.trim()) : [],
    notes: '',
    difficulty: raw.diff || 3,
    srs: {
      easeFactor: 2.5, interval: 0, repetitions: 0,
      nextReview: null, lastReview: null, status: 'new',
      totalReviews: 0, correctCount: 0, wrongCount: 0,
      avgResponseTime: 0, history: [],
    },
    createdAt: now,
    updatedAt: now,
  }
}
