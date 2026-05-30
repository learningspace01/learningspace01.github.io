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

async function readKey<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly')
    const store = tx.objectStore('kv')
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result?.value as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function writeKey<T>(key: string, value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    const store = tx.objectStore('kv')
    store.put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let writeTimer: ReturnType<typeof setTimeout> | null = null

export function useIndexedDB<T>(key: string, defaultValue: T): Ref<T> {
  const data = ref<T>(defaultValue) as Ref<T>
  let loaded = false
  let pendingValue: T | undefined

  readKey<T>(key).then((val) => {
    if (val !== undefined) {
      data.value = val
    }
    loaded = true
    if (pendingValue !== undefined) {
      writeKey(key, pendingValue)
      pendingValue = undefined
    }
  })

  watch(
    data,
    (newValue) => {
      if (!loaded) {
        pendingValue = newValue
        return
      }
      if (writeTimer) clearTimeout(writeTimer)
      writeTimer = setTimeout(() => {
        writeKey(key, newValue)
      }, 300)
    },
    { deep: true }
  )

  return data
}
