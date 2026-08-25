import { VoiceRecording } from './types';

const DB_NAME = 'QuranVoiceRecordingsDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

export interface StoredRecording {
  id: string;
  pageNumber: number;
  surahName?: string;
  blob: Blob;
  duration: number;
  createdAt: number;
  mimeType: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('فشل فتح قاعدة بيانات التسجيلات'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('pageNumber', 'pageNumber', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function saveRecording(recording: VoiceRecording): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(recording);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('فشل حفظ التسجيل الصوتي'));
  });
}

export async function getRecordingsByPage(pageNumber: number): Promise<StoredRecording[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('pageNumber');
    const request = index.getAll(pageNumber);

    request.onsuccess = () => {
      const results: StoredRecording[] = request.result || [];
      // Sort newest first
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(new Error('فشل جلب تسجيلات الصفحة'));
  });
}

export async function getAllRecordings(): Promise<StoredRecording[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results: StoredRecording[] = request.result || [];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(new Error('فشل جلب قائمة التسجيلات'));
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('فشل حذف التسجيل'));
  });
}

export async function getRecordingById(id: string): Promise<StoredRecording | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('فشل جلب التسجيل المطلوب'));
  });
}

export function downloadRecordingAudio(recording: StoredRecording, defaultName?: string): void {
  const ext = recording.mimeType.includes('webm') ? 'webm' : 
              recording.mimeType.includes('ogg') ? 'ogg' : 
              recording.mimeType.includes('mp4') || recording.mimeType.includes('aac') ? 'm4a' : 'wav';
  const fileName = defaultName || `تلاوة-صفحة-${recording.pageNumber}-${new Date(recording.createdAt).toISOString().slice(0, 10)}.${ext}`;
  
  const url = URL.createObjectURL(recording.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
