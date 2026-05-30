import { ref, watch } from 'vue'
import { supabase } from '@/libs/supabase'
import { useVocabStore } from '@/stores/vocabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { WordBook, Word, StudySession, Settings } from '@/types/vocab'

const syncing = ref(false)
const userId = ref<string | null>(null)
const userEmail = ref<string | null>(null)
const lastSyncAt = ref<string | null>(null)
const connected = ref(false)
const authLoading = ref(false)
const authError = ref<string | null>(null)

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
      const hadRemote = await pullAll()
      if (!hadRemote) {
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        authError.value = getErrorMessage(error)
        return false
      }
      userId.value = data.user?.id ?? null
      userEmail.value = data.user?.email ?? null
      const hadRemote = await pullAll()
      if (!hadRemote) {
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
      const hadRemote = await pullAll()
      if (!hadRemote) {
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
  }

  async function pullAll(): Promise<boolean> {
    if (!userId.value) return false
    syncing.value = true
    let hadData = false
    try {
      const [booksRes, wordsRes, sessionsRes, settingsRes] = await Promise.all([
        supabase.from('word_books').select('*').eq('user_id', userId.value),
        supabase.from('words').select('*').eq('user_id', userId.value),
        supabase.from('sessions').select('*').eq('user_id', userId.value),
        supabase.from('settings').select('*').eq('user_id', userId.value).single(),
      ])

      if (booksRes.data && booksRes.data.length > 0) {
        vocabStore.wordBooks = booksRes.data as WordBook[]
        hadData = true
      }
      if (wordsRes.data && wordsRes.data.length > 0) {
        vocabStore.words = wordsRes.data as Word[]
        hadData = true
      }
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        vocabStore.sessions = sessionsRes.data as StudySession[]
        hadData = true
      }
      if (settingsRes.data) {
        const s = settingsRes.data as { data: Settings; streak_days: number; last_study_date: string | null; achievements: Record<string, string> }
        if (s.data) settingsStore.settings = s.data
        if (s.streak_days != null) settingsStore.streakDays = s.streak_days
        if (s.last_study_date != null) settingsStore.lastStudyDate = s.last_study_date
        hadData = true
      }

      lastSyncAt.value = new Date().toISOString()
    } catch (e) {
      console.warn('[sync] Pull failed:', e)
    } finally {
      syncing.value = false
    }
    return hadData
  }

  async function pushAll() {
    if (syncing.value || !userId.value) return
    syncing.value = true
    try {
      const uid = userId.value

      const books = vocabStore.wordBooks.map((b) => ({ ...b, user_id: uid }))
      await supabase.from('word_books').delete().eq('user_id', uid)
      if (books.length > 0) await supabase.from('word_books').insert(books)

      const allWords = vocabStore.words.map((w) => ({ ...w, user_id: uid }))
      await supabase.from('words').delete().eq('user_id', uid)
      for (let i = 0; i < allWords.length; i += 200) {
        await supabase.from('words').insert(allWords.slice(i, i + 200))
      }

      const sessions = vocabStore.sessions.map((s) => ({ ...s, user_id: uid }))
      await supabase.from('sessions').delete().eq('user_id', uid)
      if (sessions.length > 0) await supabase.from('sessions').insert(sessions)

      await supabase.from('settings').upsert({
        user_id: uid,
        data: settingsStore.settings,
        streak_days: settingsStore.streakDays,
        last_study_date: settingsStore.lastStudyDate,
      }, { onConflict: 'user_id' })

      lastSyncAt.value = new Date().toISOString()
    } catch (e) {
      console.warn('[sync] Push failed:', e)
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
    syncing,
    connected,
    authLoading,
    authError,
  }
}
