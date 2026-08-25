import { getPageVerses } from '../quran-verses';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      return null;
    }
  }
  return null;
}

export interface CacheProgress {
  total: number;
  completed: number;
  percentage: number;
  currentPage: number;
  isComplete: boolean;
}

export async function cachePageRange(
  startPage: number,
  endPage: number,
  onProgress?: (progress: CacheProgress) => void
): Promise<void> {
  const clampedStart = Math.max(1, Math.min(604, startPage));
  const clampedEnd = Math.max(clampedStart, Math.min(604, endPage));
  const total = clampedEnd - clampedStart + 1;
  let completed = 0;

  for (let page = clampedStart; page <= clampedEnd; page++) {
    try {
      // Fetch and cache page verses into IndexedDB/Cache
      await getPageVerses(page);
    } catch (err) {
      console.warn(`Failed to pre-cache page ${page}`, err);
    }

    completed++;
    if (onProgress) {
      onProgress({
        total,
        completed,
        percentage: Math.round((completed / total) * 100),
        currentPage: page,
        isComplete: completed === total
      });
    }
  }
}
