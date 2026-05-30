import type { WordBook, Word } from '@/types/vocab'
import { cet4Book, cet4Words } from './cet4-core'
import { cet6Book, cet6Words } from './cet6-core'
import { ieltsBook, ieltsWords } from './ielts-core'
import { toeflBook, toeflWords } from './toefl-core'
import { middleBook, middleWords } from './middle-school'
import { highBook, highWords } from './high-school'
import { oxfordBook, oxfordWords } from './oxford-3000'

export interface PresetBook {
  book: WordBook
  words: Word[]
}

export const presetBooks: PresetBook[] = [
  { book: cet4Book, words: cet4Words },
  { book: cet6Book, words: cet6Words },
  { book: ieltsBook, words: ieltsWords },
  { book: toeflBook, words: toeflWords },
  { book: middleBook, words: middleWords },
  { book: highBook, words: highWords },
  { book: oxfordBook, words: oxfordWords },
]
