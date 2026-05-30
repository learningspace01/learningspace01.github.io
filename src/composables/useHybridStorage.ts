import { ref, watch, type Ref } from 'vue'

const DB_NAME = 'vocabmaster'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbRead<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly')
      const store = tx.objectStore('kv')
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result?.value as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

async function idbWrite<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite')
      const store = tx.objectStore('kv')
      store.put({ key, value })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* ignore write errors */ }
}

let writeTimers: Record<string, ReturnType<typeof setTimeout>> = {}

/**
 * Hybrid storage: reads from localStorage for instant init, persists to IndexedDB for capacity.
 * On first load, if IndexedDB has newer data (e.g., from another tab), it wins.
 */
export function useHybridStorage<T>(key: string, defaultValue: T): Ref<T> {
  // Fast sync init from localStorage
  const stored = localStorage.getItem(key)
  const initialValue: T = stored ? JSON.parse(stored) : defaultValue
  const data = ref<T>(initialValue) as Ref<T>

  // Async: check IndexedDB for potentially newer data
  idbRead<T>(key).then((idbVal) => {
    if (idbVal !== undefined) {
      data.value = idbVal
      localStorage.setItem(key, JSON.stringify(idbVal))
    }
  })

  // Write-through to both stores
  watch(
    data,
    (newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue))
      if (writeTimers[key]) clearTimeout(writeTimers[key])
      writeTimers[key] = setTimeout(() => {
        idbWrite(key, newValue)
      }, 500)
    },
    { deep: true }
  )

  return data
}
