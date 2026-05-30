import type { SubmissionFileMeta } from '@/types/classflow'

const DB_NAME = 'classflow'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' })
        store.createIndex('submissionId', 'submissionId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

interface StoredFile {
  id: string
  submissionId: string
  blob: Blob
  name: string
  type: string
  size: number
  uploadedAt: string
}

let objectURLs: string[] = []

export function useClassFlowFileStorage() {
  async function storeFile(file: File, submissionId: string): Promise<SubmissionFileMeta> {
    const id = `cf_file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const db = await openDB()
    const storedFile: StoredFile = {
      id,
      submissionId,
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      store.put(storedFile)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return { id, name: file.name, size: file.size, type: file.type, uploadedAt: storedFile.uploadedAt }
  }

  async function getFileBlob(fileId: string): Promise<Blob | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly')
      const store = tx.objectStore('files')
      const req = store.get(fileId)
      req.onsuccess = () => resolve((req.result as StoredFile)?.blob ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async function getFileMeta(fileId: string): Promise<SubmissionFileMeta | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly')
      const store = tx.objectStore('files')
      const req = store.get(fileId)
      req.onsuccess = () => {
        const result = req.result as StoredFile | undefined
        if (!result) return resolve(null)
        const { id, name, type, size, uploadedAt } = result
        resolve({ id, name, size, type, uploadedAt })
      }
      req.onerror = () => reject(req.error)
    })
  }

  async function deleteFile(fileId: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      store.delete(fileId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async function deleteFilesBySubmission(submissionId: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      const index = store.index('submissionId')
      const req = index.openCursor(IDBKeyRange.only(submissionId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  function createObjectURL(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    objectURLs.push(url)
    return url
  }

  function revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url)
    objectURLs = objectURLs.filter(u => u !== url)
  }

  function revokeAll(): void {
    objectURLs.forEach(url => URL.revokeObjectURL(url))
    objectURLs = []
  }

  return {
    storeFile,
    getFileBlob,
    getFileMeta,
    deleteFile,
    deleteFilesBySubmission,
    createObjectURL,
    revokeObjectURL,
    revokeAll,
  }
}
