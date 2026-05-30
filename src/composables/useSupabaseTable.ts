import { ref, type Ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useToast } from './useToast'

interface HasId {
  id: string
}

/**
 * Supabase 数据表桥接 composable
 * - 维护一个响应式 ref（同 useLocalStorage 接口）
 * - 初始化时从 Supabase 加载数据，localStorage 作为离线回退
 * - 提供增删改方法，自动同步到 Supabase
 */
export function useSupabaseTable<T extends HasId>(
  tableName: string,
  localStorageKey: string,
  defaultValue: T[]
) {
  // 先从 localStorage 初始化（保证首次渲染有数据）
  const stored = localStorage.getItem(localStorageKey)
  const data = ref<T[]>(stored ? JSON.parse(stored) : defaultValue) as Ref<T[]>
  const ready = ref(false)
  const toast = useToast()

  // 启动时从 Supabase 加载，覆盖 localStorage 数据
  async function init() {
    try {
      const { data: rows, error } = await supabase
        .from(tableName)
        .select('*')

      if (error) {
        console.warn(`[Supabase] ${tableName} 加载失败，使用本地缓存:`, error.message)
        return
      }

      if (rows && rows.length > 0) {
        // 将数据库行转回 TS 类型（处理 JSONB 字段已经是对象了）
        const serverData = rows as unknown as T[]
        data.value = serverData
        // 写回 localStorage 作为缓存
        localStorage.setItem(localStorageKey, JSON.stringify(serverData))
      }
    } catch (e) {
      console.warn(`[Supabase] ${tableName} 连接失败，使用本地缓存:`, e)
    } finally {
      ready.value = true
    }
  }

  // 立即执行初始化
  init()

  // 新增
  async function add(item: T): Promise<boolean> {
    data.value.push(item)
    persist()
    try {
      const { error } = await supabase.from(tableName).insert(item as any)
      if (error) {
        console.error(`[Supabase] ${tableName} 新增失败:`, error.message)
        toast.show('同步失败', `${tableName} 新增未同步到服务器`, '⚠️', '#F59E0B')
        return false
      }
      return true
    } catch (e) {
      console.error(`[Supabase] ${tableName} 新增异常:`, e)
      return false
    }
  }

  // 修改（局部更新）
  async function update(id: string, patch: Partial<T>): Promise<boolean> {
    const idx = data.value.findIndex(d => d.id === id)
    if (idx === -1) return false
    Object.assign(data.value[idx], patch)
    persist()
    try {
      const { error } = await supabase
        .from(tableName)
        .update(patch as any)
        .eq('id', id)
      if (error) {
        console.error(`[Supabase] ${tableName} 更新失败:`, error.message)
        toast.show('同步失败', `${tableName} 更新未同步到服务器`, '⚠️', '#F59E0B')
        return false
      }
      return true
    } catch (e) {
      console.error(`[Supabase] ${tableName} 更新异常:`, e)
      return false
    }
  }

  // 替换整条记录
  async function replace(item: T): Promise<boolean> {
    const idx = data.value.findIndex(d => d.id === item.id)
    if (idx === -1) {
      data.value.push(item)
    } else {
      data.value[idx] = item
    }
    persist()
    try {
      const { error } = await supabase
        .from(tableName)
        .upsert(item as any)
        .eq('id', item.id)
      if (error) {
        console.error(`[Supabase] ${tableName} 替换失败:`, error.message)
        return false
      }
      return true
    } catch (e) {
      console.error(`[Supabase] ${tableName} 替换异常:`, e)
      return false
    }
  }

  // 删除
  async function remove(id: string): Promise<boolean> {
    data.value = data.value.filter(d => d.id !== id)
    persist()
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
      if (error) {
        console.error(`[Supabase] ${tableName} 删除失败:`, error.message)
        toast.show('同步失败', `${tableName} 删除未同步到服务器`, '⚠️', '#F59E0B')
        return false
      }
      return true
    } catch (e) {
      console.error(`[Supabase] ${tableName} 删除异常:`, e)
      return false
    }
  }

  // 同步当前全部数据到 Supabase（全量替换）
  async function syncAll(): Promise<boolean> {
    try {
      // 先删后插
      const { error: delErr } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '__nonexistent__')
      if (delErr) {
        console.error(`[Supabase] ${tableName} 全量删除失败:`, delErr.message)
        return false
      }
      if (data.value.length > 0) {
        const { error: insErr } = await supabase
          .from(tableName)
          .insert(data.value as any)
        if (insErr) {
          console.error(`[Supabase] ${tableName} 全量插入失败:`, insErr.message)
          return false
        }
      }
      return true
    } catch (e) {
      console.error(`[Supabase] ${tableName} 全量同步异常:`, e)
      return false
    }
  }

  // 持久化到 localStorage
  function persist() {
    localStorage.setItem(localStorageKey, JSON.stringify(data.value))
  }

  return {
    data,
    ready,
    add,
    update,
    replace,
    remove,
    syncAll,
  }
}
