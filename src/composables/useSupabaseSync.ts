import { ref, watch } from 'vue'
import { supabase } from '@/libs/supabase'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { WordBook, Word, StudySession, Settings } from '@/types/vocab'

const syncing = ref(false)
const userId = ref<string | null>(null)
const userEmail = ref<string | null>(null)
const lastSyncAt = ref<string | null>(null)
const lastSyncMessage = ref<string | null>(null)
const connected = ref(false)
const authLoading = ref(false)
const authError = ref<string | null>(null)
const syncError = ref<string | null>(null)

let pushTimer: ReturnType<typeof setTimeout> | null = null
const PUSH_DELAY = 3000

export function useSupabaseSync() {
  const vocabStore = useVocabStore()
  const settingsStore = useSettingsStore()

  async function init() {
    // Check for existing session (persisted by Supabase client)
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      userId.value = data.session.user.id
      userEmail.value = data.session.user.email ?? null
      const { hadData, failed } = await pullAll()
      if (!failed && !hadData) {
        const hasLocal = vocabStore.wordBooks.length > 0 || vocabStore.words.length > 0
        if (hasLocal) await pushAll()
      }
      connected.value = true
      watchStores()
    }
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    authLoading.value = true
    authError.value = null
    syncError.value = null
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        authError.value = getErrorMessage(error)
        return false
      }
      userId.value = data.user?.id ?? null
      userEmail.value = data.user?.email ?? null
      const { hadData, failed } = await pullAll()
      if (!failed && !hadData) {
        const hasLocal = vocabStore.wordBooks.length > 0 || vocabStore.words.length > 0
        if (hasLocal) await pushAll()
      }
      connected.value = true
      watchStores()
      return true
    } catch (e) {
      authError.value = '网络错误，请重试'
      return false
    } finally {
      authLoading.value = false
    }
  }

  async function signUp(email: string, password: string): Promise<boolean> {
    authLoading.value = true
    authError.value = null
    syncError.value = null
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        authError.value = getErrorMessage(error)
        return false
      }
      // Sign-up may auto-confirm or require email confirmation
      if (data.user?.identities?.length === 0) {
        authError.value = '该邮箱已注册，请直接登录'
        return false
      }
      userId.value = data.user?.id ?? null
      userEmail.value = data.user?.email ?? null
      const { hadData, failed } = await pullAll()
      if (!failed && !hadData) {
        const hasLocal = vocabStore.wordBooks.length > 0 || vocabStore.words.length > 0
        if (hasLocal) await pushAll()
      }
      connected.value = true
      watchStores()
      return true
    } catch (e) {
      authError.value = '网络错误，请重试'
      return false
    } finally {
      authLoading.value = false
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    userId.value = null
    userEmail.value = null
    connected.value = false
    lastSyncAt.value = null
    lastSyncMessage.value = null
    syncError.value = null
  }

  async function pullAll(): Promise<{ hadData: boolean; failed: boolean }> {
    if (!userId.value) return { hadData: false, failed: true }
    syncing.value = true
    let hadData = false
    let failed = false
    try {
      // Run queries separately so one failure doesn't block others
      const booksRes = await supabase.from('word_books').select('*').eq('user_id', userId.value)
      if (booksRes.error) { console.warn('[sync] Pull books failed:', booksRes.error); failed = true }
      else if (booksRes.data && booksRes.data.length > 0) {
        vocabStore.wordBooks = booksRes.data.map((r: Record<string, unknown>) => mapKeysToCamel<WordBook>(r))
        hadData = true
      }

      const wordsRes = await supabase.from('words').select('*').eq('user_id', userId.value)
      if (wordsRes.error) { console.warn('[sync] Pull words failed:', wordsRes.error); failed = true }
      else if (wordsRes.data && wordsRes.data.length > 0) {
        vocabStore.words = wordsRes.data.map((r: Record<string, unknown>) => mapKeysToCamel<Word>(r))
        hadData = true
      }

      const sessionsRes = await supabase.from('sessions').select('*').eq('user_id', userId.value)
      if (sessionsRes.error) { console.warn('[sync] Pull sessions failed:', sessionsRes.error); failed = true }
      else if (sessionsRes.data && sessionsRes.data.length > 0) {
        vocabStore.sessions = sessionsRes.data.map((r: Record<string, unknown>) => mapKeysToCamel<StudySession>(r))
        hadData = true
      }

      // Settings without .single() — avoid PGRST116 on first sign-in
      const settingsRes = await supabase.from('settings').select('*').eq('user_id', userId.value)
      if (settingsRes.error) { console.warn('[sync] Pull settings failed:', settingsRes.error); failed = true }
      else if (settingsRes.data && settingsRes.data.length > 0) {
        const s = settingsRes.data[0] as { data: Settings; streak_days: number; last_study_date: string | null; achievements: Record<string, string> }
        if (s.data) settingsStore.settings = s.data
        if (s.streak_days != null) settingsStore.streakDays = s.streak_days
        if (s.last_study_date != null) settingsStore.lastStudyDate = s.last_study_date
        hadData = true
      }

      if (!failed) {
        lastSyncAt.value = new Date().toISOString()
        lastSyncMessage.value = hadData ? '已同步到云端' : '云端无数据'
        syncError.value = null
      } else {
        syncError.value = '拉取数据时部分失败，请重试'
        lastSyncMessage.value = '同步异常'
      }
    } catch (e) {
      const msg = (e as Error)?.message || String(e)
      console.warn('[sync] Pull failed:', msg)
      failed = true
      syncError.value = `拉取失败: ${msg}`
    } finally {
      syncing.value = false
    }
    return { hadData, failed }
  }

  async function pushAll() {
    if (syncing.value || !userId.value) return
    syncing.value = true
    try {
      const uid = userId.value

      const books = vocabStore.wordBooks.map((b) => mapKeysToSnake({ ...b, user_id: uid }))
      const booksRes = await supabase.from('word_books').delete().eq('user_id', uid)
      if (booksRes.error) throw new Error(`删除词库失败: ${booksRes.error.message}`)
      if (books.length > 0) {
        const insRes = await supabase.from('word_books').insert(books)
        if (insRes.error) throw new Error(`上传词库失败: ${insRes.error.message}`)
      }

      const allWords = vocabStore.words.map((w) => mapKeysToSnake({ ...w, user_id: uid }))
      const delWordsRes = await supabase.from('words').delete().eq('user_id', uid)
      if (delWordsRes.error) throw new Error(`删除单词失败: ${delWordsRes.error.message}`)
      for (let i = 0; i < allWords.length; i += 200) {
        const insRes = await supabase.from('words').insert(allWords.slice(i, i + 200))
        if (insRes.error) throw new Error(`上传单词失败: ${insRes.error.message}`)
      }

      const sessions = vocabStore.sessions.map((s) => mapKeysToSnake({ ...s, user_id: uid }))
      const delSessRes = await supabase.from('sessions').delete().eq('user_id', uid)
      if (delSessRes.error) throw new Error(`删除记录失败: ${delSessRes.error.message}`)
      if (sessions.length > 0) {
        const insRes = await supabase.from('sessions').insert(sessions)
        if (insRes.error) throw new Error(`上传记录失败: ${insRes.error.message}`)
      }

      const upsRes = await supabase.from('settings').upsert({
        user_id: uid,
        data: settingsStore.settings,
        streak_days: settingsStore.streakDays,
        last_study_date: settingsStore.lastStudyDate,
      }, { onConflict: 'user_id' })
      if (upsRes.error) throw new Error(`上传设置失败: ${upsRes.error.message}`)

      lastSyncAt.value = new Date().toISOString()
      lastSyncMessage.value = '同步成功'
      syncError.value = null
    } catch (e) {
      const msg = (e as Error)?.message || String(e)
      console.warn('[sync] Push failed:', msg)
      syncError.value = msg
      lastSyncMessage.value = '同步失败'
    } finally {
      syncing.value = false
    }
  }

  function schedulePush() {
    if (syncing.value || !userId.value) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushAll, PUSH_DELAY)
  }

  function watchStores() {
    watch(() => vocabStore.wordBooks, schedulePush, { deep: true })
    watch(() => vocabStore.words, schedulePush, { deep: true })
    watch(() => vocabStore.sessions, schedulePush, { deep: true })
    watch(() => settingsStore.settings, schedulePush, { deep: true })
  }

  // ---- camelCase ↔ snake_case key mapping ----
  function toSnakeCase(key: string): string {
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  }

  function toCamelCase(key: string): string {
    return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  }

  function mapKeysToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toSnakeCase(key)] = value
    }
    return result
  }

  function mapKeysToCamel<T>(obj: Record<string, unknown>): T {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toCamelCase(key)] = value
    }
    return result as T
  }

  function getErrorMessage(error: { message: string; status?: number }): string {
    const msg = error.message.toLowerCase()
    if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) return '邮箱或密码错误'
    if (msg.includes('user already registered')) return '该邮箱已注册'
    if (msg.includes('email not confirmed')) return '邮箱未验证，请检查收件箱'
    if (msg.includes('too many requests')) return '请求过于频繁，请稍后再试'
    if (msg.includes('weak password')) return '密码强度不够（至少6位）'
    return error.message || '操作失败'
  }

  return {
    init,
    signIn,
    signUp,
    signOut,
    pullAll,
    pushAll,
    userId,
    userEmail,
    lastSyncAt,
    lastSyncMessage,
    syncing,
    connected,
    authLoading,
    authError,
    syncError,
  }
}
