import { ref } from 'vue'
import { useDictionaryAPI } from './useDictionaryAPI'
import type { Definition, Example } from '@/types/vocab'

export interface EnrichedWordData {
  word: string
  phonetic: string
  partOfSpeech: string[]
  definitions: Definition[]
  definitionsCn: string
  examples: Example[]
  etymology: string
  synonyms: string[]
  antonyms: string[]
  tags: string[]
  difficulty: number
}

const loading = ref(false)
const progress = ref({ current: 0, total: 0, word: '' })

export function useWordEnricher() {
  const { lookup } = useDictionaryAPI()

  function estimateDifficulty(word: string): number {
    const len = word.trim().length
    if (len < 5) return 1
    if (len <= 6) return 2
    if (len <= 8) return 3
    if (len <= 10) return 4
    return 5
  }

  async function enrichWord(word: string): Promise<EnrichedWordData> {
    const clean = word.trim()
    const difficulty = estimateDifficulty(clean)
    const emptyResult: EnrichedWordData = {
      word: clean,
      phonetic: '',
      partOfSpeech: [],
      definitions: [],
      definitionsCn: '',
      examples: [],
      etymology: '',
      synonyms: [],
      antonyms: [],
      tags: [],
      difficulty,
    }

    const result = await lookup(clean)
    if (!result) return emptyResult

    return {
      word: result.word,
      phonetic: result.phonetic,
      partOfSpeech: result.partOfSpeech,
      definitions: result.definitions,
      definitionsCn: result.definitionsCn,
      examples: result.examples,
      etymology: '',
      synonyms: result.synonyms,
      antonyms: [],
      tags: result.tags,
      difficulty: result.difficulty,
    }
  }

  async function enrichBatch(words: string[]): Promise<EnrichedWordData[]> {
    const results: EnrichedWordData[] = []
    loading.value = true
    progress.value = { current: 0, total: words.length, word: '' }

    for (let i = 0; i < words.length; i++) {
      progress.value = { current: i + 1, total: words.length, word: words[i] }
      try {
        const enriched = await enrichWord(words[i])
        results.push(enriched)
      } catch {
        results.push({
          word: words[i],
          phonetic: '',
          partOfSpeech: [],
          definitions: [],
          definitionsCn: '',
          examples: [],
          etymology: '',
          synonyms: [],
          antonyms: [],
          tags: [],
          difficulty: 3,
        })
      }
      if (i < words.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    loading.value = false
    return results
  }

  return { enrichWord, enrichBatch, loading, progress }
}
