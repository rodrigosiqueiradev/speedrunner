/** A split file kept for a profile category, so other pages can use it without choosing it again. */
export interface StoredSplit {
  fileName: string;
  xml: string;
}

// Split files can run to megabytes, more than local storage holds, so they go in IndexedDB.
const DB_NAME = "speedrunner";
const STORE = "split-files";
// Where IndexedDB isn't available (some private windows, tests), local storage is the best effort.
const FALLBACK_KEY = "speedrunner.split-files.v1";

function openDb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()!;
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

function readFallback(): Record<string, StoredSplit> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallback(files: Record<string, StoredSplit>): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(files));
  } catch {
    // Too big or blocked; the files still work until the page is closed.
  }
}

const isStoredSplit = (v: unknown): v is StoredSplit =>
  !!v && typeof (v as StoredSplit).fileName === "string" && typeof (v as StoredSplit).xml === "string";

/** Every stored split file, by profile category key. */
export async function loadSplitFiles(): Promise<Record<string, StoredSplit>> {
  if (typeof indexedDB === "undefined") return readFallback();
  try {
    const db = await openDb()!;
    try {
      // One cursor in one transaction, so each file comes with its own key even if another
      // window (the overlay, another tab) adds or deletes one meanwhile.
      return await new Promise<Record<string, StoredSplit>>((resolve, reject) => {
        const files: Record<string, StoredSplit> = {};
        const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve(files);
          if (isStoredSplit(cursor.value)) files[String(cursor.key)] = cursor.value;
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return {};
  }
}

export async function putSplitFile(key: string, file: StoredSplit): Promise<void> {
  if (typeof indexedDB === "undefined") return writeFallback({ ...readFallback(), [key]: file });
  try {
    await withStore("readwrite", (s) => s.put(file, key));
  } catch {
    // Storage can be full or blocked; the file still works until the page is closed.
  }
}

export async function deleteSplitFile(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    const { [key]: _gone, ...rest } = readFallback();
    return writeFallback(rest);
  }
  try {
    await withStore("readwrite", (s) => s.delete(key));
  } catch {
    // Nothing more to do; a leftover file is ignored once its category is gone.
  }
}
