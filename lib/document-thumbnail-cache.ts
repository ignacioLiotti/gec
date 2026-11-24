const DATABASE = "sintesis-document-thumbnails";
const STORE = "thumbnails";
const MAX_ENTRIES = 160;
const MAX_BYTES_PER_ENTRY = 256 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let generation = 0;

type ThumbnailEntry = {
  key: string;
  image: Blob;
  savedAt: number;
};

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "key" });
      store.createIndex("savedAt", "savedAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readDocumentThumbnail(key: string): Promise<Blob | null> {
  try {
    const cache = await openCache();
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const request = cache.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => {
          const entry = request.result as ThumbnailEntry | undefined;
          resolve(entry && Date.now() - entry.savedAt < MAX_AGE_MS ? entry.image : null);
        };
        request.onerror = () => reject(request.error);
      });
    } finally {
      cache.close();
    }
  } catch {
    return null;
  }
}

export async function saveDocumentThumbnail(key: string, image: Blob) {
  if (image.size === 0 || image.size > MAX_BYTES_PER_ENTRY) return;
  const currentGeneration = generation;
  try {
    const cache = await openCache();
    try {
      if (currentGeneration !== generation) return;
      await new Promise<void>((resolve, reject) => {
        const transaction = cache.transaction(STORE, "readwrite");
        const store = transaction.objectStore(STORE);
        const now = Date.now();
        store.put({ key, image, savedAt: now } satisfies ThumbnailEntry);
        const count = store.count();
        count.onsuccess = () => {
          let excess = Math.max(0, count.result - MAX_ENTRIES);
          const oldestFirst = store.index("savedAt").openCursor();
          oldestFirst.onsuccess = () => {
            const entry = oldestFirst.result;
            if (!entry || (excess === 0 && Number(entry.key) >= now - MAX_AGE_MS)) return;
            entry.delete();
            excess = Math.max(0, excess - 1);
            entry.continue();
          };
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      cache.close();
    }
  } catch {
    // The browser can deny persistent storage or evict the cache.
  }
}

export async function clearDocumentThumbnails() {
  generation++;
  try {
    const cache = await openCache();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = cache.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).clear();
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      cache.close();
    }
  } catch {
    // Storage can be unavailable.
  }
}
