import { ref } from 'vue'
import type { Definition, Example } from '@/types/vocab'

export interface DictResult {
  word: string
  phonetic: string
  partOfSpeech: string[]
  definitions: Definition[]
  definitionsCn: string
  examples: Example[]
  synonyms: string[]
  relatedWords: { en: string; cn: string; pos: string }[]
  phrases: { en: string; cn: string }[]
  wordForms: { name: string; value: string }[]
  examTypes: string[]
  tags: string[]
  difficulty: number
}

const loading = ref(false)
const error = ref<string | null>(null)

function estimateDifficulty(word: string): number {
  const len = word.trim().length
  if (len < 5) return 1
  if (len <= 6) return 2
  if (len <= 8) return 3
  if (len <= 10) return 4
  return 5
}

function generateTags(pos: string[], difficulty: number): string[] {
  const tags: string[] = []
  const posTagMap: Record<string, string> = {
    noun: '#名词', verb: '#动词', adjective: '#形容词', adverb: '#副词',
    preposition: '#介词', conjunction: '#连词', pronoun: '#代词', interjection: '#感叹词',
  }
  for (const p of pos) {
    const tag = posTagMap[p]
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  if (difficulty <= 2) tags.push('#简单')
  else if (difficulty === 3) tags.push('#中等')
  else tags.push('#较难')
  return tags
}

function normalizePos(pos: string): string {
  const map: Record<string, string> = {
    noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv',
    preposition: 'prep', conjunction: 'conj', pronoun: 'pron',
    interjection: 'interj', numeral: 'num', article: 'art',
  }
  return map[pos.toLowerCase()] || pos.toLowerCase().replace(/[^a-z]/g, '')
}

export function useDictionaryAPI() {
  async function lookup(word: string): Promise<DictResult | null> {
    if (!word.trim()) return null
    loading.value = true
    error.value = null

    try {
      const resp = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`
      )
      if (!resp.ok) {
        if (resp.status === 404) {
          error.value = `未找到「${word.trim()}」的释义`
        }
        loading.value = false
        return null
      }
      const data = await resp.json()
      loading.value = false
      return parseResponse(data[0], word.trim())
    } catch {
      error.value = '词典服务暂不可用'
      loading.value = false
      return null
    }
  }

  return { lookup, loading, error }
}

function parseResponse(data: Record<string, unknown>, word: string): DictResult {
  // Phonetic — prefer first text phonetics
  const phonetics = (data.phonetics as Record<string, unknown>[]) || []
  const phonetic = phonetics.find((p) => p.text)?.text as string || (data.phonetic as string) || ''

  // Meanings
  const meanings = (data.meanings as Record<string, unknown>[]) || []
  const partOfSpeech: string[] = []
  const definitions: Definition[] = []
  const examples: Example[] = []
  let allSynonyms: string[] = []
  let allAntonyms: string[] = []

  for (const m of meanings) {
    const pos = normalizePos(m.partOfSpeech as string)
    if (pos && !partOfSpeech.includes(pos)) partOfSpeech.push(pos)

    const defs = (m.definitions as Record<string, unknown>[]) || []
    for (const d of defs) {
      // Definition
      const defText = (d.definition as string || '').trim()
      if (defText) {
        definitions.push({ pos, meaning: defText })
      }

      // Example
      const exText = (d.example as string || '').trim()
      if (exText && examples.length < 5) {
        examples.push({ en: exText, cn: '' })
      }

      // Per-definition synonyms
      const defSyns = (d.synonyms as string[]) || []
      const defAnts = (d.antonyms as string[]) || []
      allSynonyms = [...allSynonyms, ...defSyns]
      allAntonyms = [...allAntonyms, ...defAnts]
    }

    // Per-meaning synonyms/antonyms
    const mSyns = (m.synonyms as string[]) || []
    const mAnts = (m.antonyms as string[]) || []
    allSynonyms = [...allSynonyms, ...mSyns]
    allAntonyms = [...allAntonyms, ...mAnts]
  }

  allSynonyms = [...new Set(allSynonyms)].slice(0, 12)
  allAntonyms = [...new Set(allAntonyms)].slice(0, 12)

  const difficulty = estimateDifficulty(word)
  const tags = generateTags(partOfSpeech, difficulty)

  return {
    word,
    phonetic,
    partOfSpeech,
    definitions,
    definitionsCn: '',
    examples,
    synonyms: allSynonyms,
    relatedWords: [],
    phrases: [],
    wordForms: [],
    examTypes: [],
    tags,
    difficulty,
  }
}
