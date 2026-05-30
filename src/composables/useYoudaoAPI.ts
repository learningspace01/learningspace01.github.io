/**
 * Youdao Dictionary JSON API Integration
 *
 * CORS NOTE: dict.youdao.com does not set CORS headers, so browser direct
 * calls fail in production. Three solutions:
 *
 * 1. Development: Vite dev server proxies /youdao-api -> http://dict.youdao.com
 *    (configured in vite.config.ts, works automatically with `npm run dev`)
 *
 * 2. Production (built-in fallback): Uses api.allorigins.win as a CORS proxy
 *    automatically — no setup needed.
 *
 * 3. Production (custom proxy): Configure a proxy via Settings > youdaoProxyUrl.
 *    Recommended: Deploy a free Cloudflare Worker:
 *
 *      export default {
 *        async fetch(request) {
 *          const url = new URL(request.url)
 *          const target = url.searchParams.get('url') || ''
 *          const resp = await fetch(decodeURIComponent(target))
 *          return new Response(await resp.text(), {
 *            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
 *          })
 *        }
 *      }
 *
 *    Then set youdaoProxyUrl to "https://your-worker.workers.dev/?url=" in Settings.
 */
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Definition, Example } from '@/types/vocab'

export interface YoudaoResult {
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

// Normalize value that can be single object or array
function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

export function useYoudaoAPI() {
  async function lookup(word: string): Promise<YoudaoResult | null> {
    if (!word.trim()) return null
    loading.value = true
    error.value = null

    const targetUrl = `http://dict.youdao.com/jsonapi?jsonversion=2&client=mobile&q=${encodeURIComponent(word.trim())}`

    let url: string
    if (import.meta.env.DEV) {
      url = `/youdao-api/jsonapi?jsonversion=2&client=mobile&q=${encodeURIComponent(word.trim())}`
    } else {
      const proxy = useSettingsStore().settings.youdaoProxyUrl
      if (proxy) {
        // User-configured custom proxy (e.g. Cloudflare Worker)
        url = `${proxy}${encodeURIComponent(targetUrl)}`
      } else {
        // Built-in fallback CORS proxy (no account needed)
        url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
      }
    }

    try {
      const resp = await fetch(url)
      if (!resp.ok) {
        loading.value = false
        return null
      }
      const data = await resp.json()
      loading.value = false
      return parseResponse(data, word.trim())
    } catch {
      error.value = '词典服务暂不可用'
      loading.value = false
      return null
    }
  }

  return { lookup, loading, error }
}

function parseResponse(data: Record<string, unknown>, word: string): YoudaoResult {
  const ec = data.ec as Record<string, unknown> | undefined
  const simple = data.simple as Record<string, unknown> | undefined
  const longman = data.longman as Record<string, unknown> | undefined
  const syno = data.syno as Record<string, unknown> | undefined
  const relWord = data.rel_word as Record<string, unknown> | undefined
  const phrs = data.phrs as Record<string, unknown> | undefined
  const wordform = data.wordform as Record<string, unknown> | undefined

  // Phonetic
  const ecWordArr = ensureArray(ec?.word)
  const ecWord = ecWordArr[0] as Record<string, unknown> | undefined
  const simpleWordArr = ensureArray(simple?.word)
  const simpleWord = simpleWordArr[0] as Record<string, unknown> | undefined
  const phonetic = (ecWord?.usphone as string) || (simpleWord?.usphone as string) || (ecWord?.ukphone as string) || ''

  // Part of speech & Chinese definitions from EC
  const trs = ensureArray(ecWord?.trs)
  const partOfSpeech: string[] = []
  const cnDefs: string[] = []
  for (const trItem of trs) {
    const tr = trItem as Record<string, unknown>
    if (tr.pos) partOfSpeech.push(normalizePos(tr.pos as string))
    const trArr = ensureArray(tr.tr)
    for (const trr of trArr) {
      const t = trr as Record<string, unknown>
      const l = t.l as Record<string, unknown> | undefined
      const i = ensureArray(l?.i)
      for (const def of i) {
        if (typeof def === 'string' && def.trim()) cnDefs.push(def.trim())
      }
    }
  }

  // English definitions & examples from Longman
  const definitions: Definition[] = []
  const examples: Example[] = []
  const lmWordArr = ensureArray(longman?.word)
  const lmEntry = lmWordArr[0] as Record<string, unknown> | undefined

  if (lmEntry) {
    const lmHeadArr = ensureArray(lmEntry.Head)
    const lmHead = lmHeadArr[0] as Record<string, unknown> | undefined
    if (lmHead?.POS && !partOfSpeech.length) {
      partOfSpeech.push(normalizePos(lmHead.POS as string))
    }

    const lmSenseArr = ensureArray(lmEntry.Sense)
    for (const sense of lmSenseArr) {
      const s = sense as Record<string, unknown>
      const defArr = ensureArray(s.DEF)
      const tranArr = ensureArray(s.TRAN)
      const defText = defArr.filter((d) => typeof d === 'string').join('; ')
      const defCn = tranArr.filter((d) => typeof d === 'string').join('; ')
      const posFromSign = (s.SIGNPOST as string) || ''

      if (defText) {
        definitions.push({
          pos: posFromSign || partOfSpeech[0] || '',
          meaning: defText,
        })
      }

      // Examples
      const exampleArr = ensureArray(s.EXAMPLE)
      const exampleTranArr = ensureArray(s.EXAMPLETRAN)
      for (let i = 0; i < Math.min(exampleArr.length, 3); i++) {
        const en = typeof exampleArr[i] === 'string' ? exampleArr[i] : ''
        const cn = typeof exampleTranArr[i] === 'string' ? exampleTranArr[i] : ''
        if (en) examples.push({ en, cn })
      }

      // Grammar examples
      const gramExaArr = ensureArray(s.GramExa)
      for (const ge of gramExaArr) {
        const g = ge as Record<string, unknown>
        const gExArr = ensureArray(g.EXAMPLE)
        const gTrArr = ensureArray(g.EXAMPLETRAN)
        if (examples.length >= 5) break
        for (let i = 0; i < gExArr.length && examples.length < 5; i++) {
          const en = typeof gExArr[i] === 'string' ? gExArr[i] : ''
          const cn = typeof gTrArr[i] === 'string' ? gTrArr[i] : ''
          if (en) examples.push({ en, cn })
        }
      }
    }
  }

  // If no Longman examples, try blng_sents_part (bilingual example sentences)
  if (!examples.length) {
    const blng = data.blng_sents_part as Record<string, unknown> | undefined
    if (blng) {
      const pairs = ensureArray(blng['sentence-pair'] as Record<string, unknown>[])
      for (const pair of pairs) {
        const p = pair as Record<string, unknown>
        const en = cleanHtml((p.sentence as string) || '')
        const cn = cleanHtml((p['sentence-translation'] as string) || '')
        if (en && examples.length < 5) {
          examples.push({ en, cn })
        }
      }
    }
  }

  // If no Longman definitions, try ee (WordNet English definitions)
  if (!definitions.length) {
    const eeData = data.ee as Record<string, unknown> | undefined
    if (eeData) {
      const eeWordArr = ensureArray(eeData.word)
      const eeWord = eeWordArr[0] as Record<string, unknown> | undefined
      const eeTrs = ensureArray(eeWord?.trs)
      for (const eeTr of eeTrs) {
        const t = eeTr as Record<string, unknown>
        const pos = normalizePos((t.pos as string) || '')
        const trArr = ensureArray(t.tr)
        for (const trr of trArr) {
          const r = trr as Record<string, unknown>
          const l = r.l as Record<string, unknown> | undefined
          const items = ensureArray(l?.i)
          for (const item of items) {
            if (typeof item === 'string' && item.trim()) {
              definitions.push({ pos, meaning: item.trim() })
              if (!partOfSpeech.length) partOfSpeech.push(pos)
            }
          }
        }
      }
    }
  }

  // If still no definitions, fall back to EC Chinese defs
  if (!definitions.length && cnDefs.length) {
    definitions.push({
      pos: partOfSpeech[0] || '',
      meaning: cnDefs.join('; '),
    })
  }

  // Synonyms
  const synonyms: string[] = []
  const synosArr = ensureArray(syno?.synos)
  for (const syn of synosArr) {
    const s = syn as Record<string, unknown>
    const wsArr = ensureArray(s.ws)
    for (const ws of wsArr) {
      const w = (ws as Record<string, unknown>).w as string
      if (w && !synonyms.includes(w)) synonyms.push(w)
    }
  }

  // Related words
  const relatedWords: { en: string; cn: string; pos: string }[] = []
  const relsArr = ensureArray(relWord?.rels)
  for (const rel of relsArr) {
    const r = rel as Record<string, unknown>
    const wordsArr = ensureArray(r.words)
    for (const rw of wordsArr) {
      const rwd = rw as Record<string, unknown>
      relatedWords.push({
        en: (rwd.word as string) || '',
        cn: (rwd.tran as string) || '',
        pos: (r.pos as string) || '',
      })
    }
  }

  // Phrases
  const phrases: { en: string; cn: string }[] = []
  const phrArr = ensureArray(phrs?.phr)
  for (const p of phrArr) {
    const phr = p as Record<string, unknown>
    phrases.push({
      en: (phr.phr as string) || '',
      cn: (phr.tran as string) || '',
    })
  }

  // Word forms
  const wordForms: { name: string; value: string }[] = []
  const wfsArr = ensureArray(ecWord?.wfs)
  for (const wf of wfsArr) {
    const w = wf as Record<string, unknown>
    const wfObj = w.wf as Record<string, unknown> | undefined
    if (wfObj?.name && wfObj?.value) {
      wordForms.push({ name: wfObj.name as string, value: wfObj.value as string })
    }
  }

  // Exam types
  const examTypes: string[] = ensureArray(ec?.exam_type).filter(
    (t): t is string => typeof t === 'string'
  )

  // Difficulty from exam types
  const difficulty = estimateDifficultyFromExam(examTypes, word.length)

  // Tags
  const tags = generateTags(partOfSpeech, difficulty, examTypes)

  // Deduplicate partOfSpeech
  const uniquePos = [...new Set(partOfSpeech)]

  return {
    word,
    phonetic,
    partOfSpeech: uniquePos,
    definitions,
    definitionsCn: cnDefs.join('; '),
    examples: examples.slice(0, 5),
    synonyms: synonyms.slice(0, 12),
    relatedWords,
    phrases,
    wordForms,
    examTypes,
    tags,
    difficulty,
  }
}

function normalizePos(pos: string): string {
  const p = pos.trim().toLowerCase()
  const map: Record<string, string> = {
    'n': 'n', 'noun': 'n', 'n.': 'n',
    'v': 'v', 'verb': 'v', 'v.': 'v', 'vi': 'v', 'vt': 'v', 'vi.': 'v', 'vt.': 'v',
    'adj': 'adj', 'adjective': 'adj', 'adj.': 'adj',
    'adv': 'adv', 'adverb': 'adv', 'adv.': 'adv',
    'prep': 'prep', 'preposition': 'prep', 'prep.': 'prep',
    'conj': 'conj', 'conjunction': 'conj', 'conj.': 'conj',
    'pron': 'pron', 'pronoun': 'pron', 'pron.': 'pron',
    'interj': 'interj', 'interjection': 'interj', 'interj.': 'interj',
    'num': 'num', 'numeral': 'num',
    'art': 'art', 'article': 'art',
  }
  return map[p] || p.replace(/[^a-z]/g, '')
}

function estimateDifficultyFromExam(examTypes: string[], wordLength: number): number {
  const examMap: Record<string, number> = {
    '四级': 2, 'CET4': 2,
    '六级': 3, 'CET6': 3,
    '考研': 3,
    '雅思': 3, 'IELTS': 3,
    '托福': 4, 'TOEFL': 4,
    'GRE': 5,
    'GMAT': 5,
    '高中': 2,
    '初中': 1, '中考': 1,
    '商务英语': 3,
  }

  let diff = 3
  for (const exam of examTypes) {
    const d = examMap[exam]
    if (d !== undefined && d > diff) diff = d
  }

  // If no exam type provided, fall back to length heuristic
  if (examTypes.length === 0) {
    const len = wordLength
    if (len < 5) diff = 1
    else if (len <= 6) diff = 2
    else if (len <= 8) diff = 3
    else if (len <= 10) diff = 4
    else diff = 5
  }

  return Math.max(1, Math.min(5, diff))
}

function generateTags(partOfSpeech: string[], difficulty: number, examTypes: string[]): string[] {
  const tags: string[] = []

  // POS tags
  const posTagMap: Record<string, string> = {
    n: '#名词', v: '#动词', adj: '#形容词', adv: '#副词',
    prep: '#介词', conj: '#连词', pron: '#代词', interj: '#感叹词',
  }
  for (const pos of partOfSpeech) {
    const tag = posTagMap[pos]
    if (tag && !tags.includes(tag)) tags.push(tag)
  }

  // Exam type tags
  const examTagMap: Record<string, string> = {
    '四级': '#四级', 'CET4': '#四级',
    '六级': '#六级', 'CET6': '#六级',
    '考研': '#考研',
    '雅思': '#雅思', 'IELTS': '#雅思',
    '托福': '#托福', 'TOEFL': '#托福',
    'GRE': '#GRE',
    '高中': '#高中', '中考': '#中考', '初中': '#初中',
    '商务英语': '#商务',
  }
  for (const exam of examTypes) {
    const tag = examTagMap[exam]
    if (tag && !tags.includes(tag)) tags.push(tag)
  }

  // Difficulty tags
  if (difficulty <= 2) tags.push('#简单')
  else if (difficulty === 3) tags.push('#中等')
  else tags.push('#较难')

  return tags
}
