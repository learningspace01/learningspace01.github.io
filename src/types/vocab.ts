export interface Definition {
  pos: string
  meaning: string
}

export interface Example {
  en: string
  cn: string
}

export interface SRSHistory {
  date: string
  quality: number
  interval: number
}

export interface SRS {
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: string | null
  lastReview: string | null
  status: 'new' | 'learning' | 'review' | 'familiar' | 'mastered'
  totalReviews: number
  correctCount: number
  wrongCount: number
  avgResponseTime: number
  history: SRSHistory[]
}

export interface Word {
  id: string
  bookId: string
  word: string
  phonetic: string
  partOfSpeech: string[]
  definitions: Definition[]
  examples: Example[]
  etymology: string
  mnemonic: string
  synonyms: string[]
  antonyms: string[]
  relatedWords: string[]
  tags: string[]
  notes: string
  difficulty: number
  srs: SRS
  createdAt: string
  updatedAt: string
}

export interface WordBook {
  id: string
  name: string
  description: string
  icon: string
  wordCount: number
  learnedCount: number
  masteredCount: number
  createdAt: string
  updatedAt: string
  tags: string[]
  isPreset: boolean
  sortOrder: number
}

export interface StudySession {
  id: string
  type: 'learn' | 'review' | 'test' | 'practice'
  bookId: string | null
  startTime: string
  endTime: string | null
  duration: number
  totalWords: number
  completedWords: number
  correctCount: number
  accuracy: number
  newWordsLearned: number
  wordsReviewed: number
  wordsMastered: number
}

export interface Settings {
  dailyGoal: number
  newWordsPerDay: number
  reviewMode: 'flashcard' | 'spelling' | 'choice' | 'dictation'
  autoPlay: boolean
  darkMode: boolean
  fontSize: 'small' | 'medium' | 'large'
  showExampleFirst: boolean
  keyboardShortcuts: boolean
  notificationReminder: string | null
  theme: string
  dataExportFormat: 'json' | 'csv'
  youdaoProxyUrl: string
  enabledBookIds: string[]
}
