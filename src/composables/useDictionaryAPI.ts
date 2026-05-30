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

// ---- Dictionary API helpers ----

interface ShanbayResult {
  definition: string
  cnDef: string
  cnPos: string
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

async function lookupShanbay(word: string): Promise<ShanbayResult | null> {
  const directUrl = `https://api.shanbay.com/bdc/search/?word=${encodeURIComponent(word.trim())}`

  // 1. Try direct call (works if CORS allows)
  const json = await fetchJson(directUrl)
  if (json && (json as Record<string, unknown>).status_code === 0) {
    const data = (json as Record<string, unknown>).data as Record<string, unknown>
    if (data) {
      const cnDef = ((data.cn_definition as Record<string, unknown>)?.defn as string) || ''
      const cnPos = ((data.cn_definition as Record<string, unknown>)?.pos as string) || ''
      const definition: string = (data.definition as string) || cnDef
      if (definition) return { definition, cnDef, cnPos }
    }
  }

  // 2. Fallback: via CORS proxy
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
  const proxyJson = await fetchJson(proxyUrl)
  if (proxyJson && (proxyJson as Record<string, unknown>).status_code === 0) {
    const data = (proxyJson as Record<string, unknown>).data as Record<string, unknown>
    if (data) {
      const cnDef = ((data.cn_definition as Record<string, unknown>)?.defn as string) || ''
      const cnPos = ((data.cn_definition as Record<string, unknown>)?.pos as string) || ''
      const definition: string = (data.definition as string) || cnDef
      if (definition) return { definition, cnDef, cnPos }
    }
  }

  return null
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

    const wordClean = word.trim()
    const difficulty = estimateDifficulty(wordClean)

    // 1. Try Shanbay first for Chinese definition
    const shanbay = await lookupShanbay(wordClean)
    let phonetic = ''
    let partOfSpeech: string[] = []
    let definitions: Definition[] = []
    let examples: Example[] = []
    let synonyms: string[] = []
    const definitionsCn = shanbay?.definition || ''

    if (shanbay?.cnDef) {
      // Shanbay succeeded — use Chinese definition as primary
      definitions.push({ pos: shanbay.cnPos || '中译', meaning: shanbay.cnDef })
    }

    // 2. Supplement with Free Dictionary for phonetics / examples / synonyms
    const freeDict = await lookupFreeDict(wordClean)
    if (freeDict) {
      const parsed = parseFreeDict(freeDict, wordClean)
      phonetic = parsed.phonetic
      partOfSpeech = parsed.partOfSpeech
      examples = parsed.examples
      synonyms = parsed.synonyms

      // If Shanbay failed, use English definitions as fallback
      if (!shanbay && parsed.definitions.length) {
        definitions = parsed.definitions
      }
    }

    loading.value = false

    if (!shanbay && !freeDict) {
      error.value = `未找到「${wordClean}」的释义`
      return null
    }

    return {
      word: wordClean,
      phonetic,
      partOfSpeech,
      definitions,
      definitionsCn,
      examples,
      synonyms,
      relatedWords: [],
      phrases: [],
      wordForms: [],
      examTypes: [],
      tags: generateTags(partOfSpeech, difficulty),
      difficulty,
    }
  }

  return { lookup, loading, error }
}
