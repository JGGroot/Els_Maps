const DB_NAME = 'elsmaps-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export class IndexedDBAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB init failed');
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async set(id: string, data: unknown): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put({ id, data, updatedAt: Date.now() });

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async get<T>(id: string): Promise<T | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.data as T) : null);
      };

      request.onerror = () => resolve(null);
    });
  }

  async remove(id: string): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result.map((key) => String(key)));
      };

      request.onerror = () => resolve([]);
    });
  }

  async clear(): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }
}
