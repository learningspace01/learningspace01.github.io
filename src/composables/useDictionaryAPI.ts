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

// ---- Shanbay API ----
interface ShanbayResult {
  definition: string       // e.g. "int. 你好；喂"
  cnDef: string            // pure Chinese definition
  cnPos: string            // Chinese part of speech
}

async function lookupShanbay(word: string): Promise<ShanbayResult | null> {
  try {
    const resp = await fetch(
      `https://api.shanbay.com/bdc/search/?word=${encodeURIComponent(word.trim())}`
    )
    if (!resp.ok) return null
    const json = await resp.json()
    if (json.status_code !== 0 || !json.data) return null

    const data = json.data
    const cnDef = data.cn_definition?.defn || ''
    const cnPos = data.cn_definition?.pos || ''
    const definition: string = data.definition || cnDef

    return { definition, cnDef, cnPos }
  } catch {
    return null
  }
}

// ---- Free Dictionary API ----
interface FreeDictEntry {
  word?: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: {
    partOfSpeech?: string
    definitions?: {
      definition?: string
      example?: string
      synonyms?: string[]
      antonyms?: string[]
    }[]
    synonyms?: string[]
    antonyms?: string[]
  }[]
}

async function lookupFreeDict(word: string): Promise<FreeDictEntry | null> {
  try {
    const resp = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`
    )
    if (!resp.ok) return null
    const data = await resp.json()
    return data[0] || null
  } catch {
    return null
  }
}

function parseFreeDict(data: FreeDictEntry, word: string) {
  const phonetics = data.phonetics || []
  const phonetic = phonetics.find((p) => p.text)?.text || data.phonetic || ''

  const meanings = data.meanings || []
  const partOfSpeech: string[] = []
  const definitions: Definition[] = []
  const examples: Example[] = []
  let allSynonyms: string[] = []
  let allAntonyms: string[] = []

  for (const m of meanings) {
    const pos = normalizePos(m.partOfSpeech || '')
    if (pos && !partOfSpeech.includes(pos)) partOfSpeech.push(pos)

    const defs = m.definitions || []
    for (const d of defs) {
      const defText = (d.definition || '').trim()
      if (defText) {
        definitions.push({ pos, meaning: defText })
      }

      const exText = (d.example || '').trim()
      if (exText && examples.length < 5) {
        examples.push({ en: exText, cn: '' })
      }

      allSynonyms = [...allSynonyms, ...(d.synonyms || [])]
      allAntonyms = [...allAntonyms, ...(d.antonyms || [])]
    }

    allSynonyms = [...allSynonyms, ...(m.synonyms || [])]
    allAntonyms = [...allAntonyms, ...(m.antonyms || [])]
  }

  return {
    partOfSpeech,
    definitions,
    examples,
    synonyms: [...new Set(allSynonyms)].slice(0, 12),
    antonyms: [...new Set(allAntonyms)].slice(0, 12),
    phonetic,
  }
}

export function useDictionaryAPI() {
  async function lookup(word: string): Promise<DictResult | null> {
    if (!word.trim()) return null
    loading.value = true
    error.value = null

    // Fetch from both APIs in parallel
    const [shanbay, freeDict] = await Promise.all([
      lookupShanbay(word),
      lookupFreeDict(word),
    ])

    loading.value = false

    if (!shanbay && !freeDict) {
      error.value = `未找到「${word.trim()}」的释义`
      return null
    }

    const wordClean = word.trim()
    const difficulty = estimateDifficulty(wordClean)
    const parsed = freeDict ? parseFreeDict(freeDict, wordClean) : {
      partOfSpeech: [] as string[],
      definitions: [] as Definition[],
      examples: [] as Example[],
      synonyms: [] as string[],
      antonyms: [] as string[],
      phonetic: '',
    }

    // Build definitionsCn from Shanbay
    const definitionsCn = shanbay?.definition || ''

    // Build merged definitions: Chinese first, then English
    const mergedDefinitions: Definition[] = []
    if (shanbay?.cnDef) {
      mergedDefinitions.push({ pos: shanbay.cnPos || '中译', meaning: shanbay.cnDef })
    }
    mergedDefinitions.push(...parsed.definitions)

    // Build tags
    const tags = generateTags(parsed.partOfSpeech, difficulty)

    return {
      word: wordClean,
      phonetic: parsed.phonetic,
      partOfSpeech: parsed.partOfSpeech,
      definitions: mergedDefinitions,
      definitionsCn,
      examples: parsed.examples,
      synonyms: parsed.synonyms,
      relatedWords: [],
      phrases: [],
      wordForms: [],
      examTypes: [],
      tags,
      difficulty,
    }
  }

  return { lookup, loading, error }
}
