import type { Canvas } from 'fabric';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';

const AUTOSAVE_KEY = 'autosave';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

export class StorageManager {
  private localStorage: LocalStorageAdapter;
  private indexedDB: IndexedDBAdapter;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private canvas: Canvas | null = null;

  constructor() {
    this.localStorage = new LocalStorageAdapter();
    this.indexedDB = new IndexedDBAdapter();
  }

  async init(canvas: Canvas): Promise<void> {
    this.canvas = canvas;
    await this.indexedDB.init();
  }

  startAutosave(): void {
    if (this.autosaveTimer) return;

    this.autosaveTimer = setInterval(() => {
      this.saveAutosave();
    }, AUTOSAVE_INTERVAL);
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  async saveAutosave(): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const data = this.canvas.toObject();
      await this.indexedDB.set(AUTOSAVE_KEY, {
        canvas: data,
        savedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Autosave failed:', error);
      return false;
    }
  }

  async loadAutosave(): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const data = await this.indexedDB.get<{ canvas: object; savedAt: number }>(
        AUTOSAVE_KEY
      );

      if (!data) return false;

      await this.canvas.loadFromJSON(data.canvas);
      this.canvas.requestRenderAll();
      return true;
    } catch (error) {
      console.error('Load autosave failed:', error);
      return false;
    }
  }

  async hasAutosave(): Promise<boolean> {
    const data = await this.indexedDB.get(AUTOSAVE_KEY);
    return data !== null;
  }

  async clearAutosave(): Promise<boolean> {
    return this.indexedDB.remove(AUTOSAVE_KEY);
  }

  savePreference(key: string, value: unknown): boolean {
    return this.localStorage.set(`pref:${key}`, value);
  }

  getPreference<T>(key: string, defaultValue: T): T {
    const value = this.localStorage.get<T>(`pref:${key}`);
    return value ?? defaultValue;
  }

  async saveProject(id: string, name: string): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const data = {
        canvas: this.canvas.toObject(),
        metadata: {
          name,
          createdAt: Date.now(),
          modifiedAt: Date.now()
        }
      };

      await this.indexedDB.set(`project:${id}`, data);
      return true;
    } catch (error) {
      console.error('Save project failed:', error);
      return false;
    }
  }

  async loadProject(id: string): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const data = await this.indexedDB.get<{
        canvas: object;
        metadata: { name: string; createdAt: number; modifiedAt: number };
      }>(`project:${id}`);

      if (!data) return false;

      await this.canvas.loadFromJSON(data.canvas);
      this.canvas.requestRenderAll();
      return true;
    } catch (error) {
      console.error('Load project failed:', error);
      return false;
    }
  }

  async listProjects(): Promise<
    Array<{ id: string; name: string; modifiedAt: number }>
  > {
    const keys = await this.indexedDB.getAllKeys();
    const projects: Array<{ id: string; name: string; modifiedAt: number }> = [];

    for (const key of keys) {
      if (key.startsWith('project:')) {
        const data = await this.indexedDB.get<{
          metadata: { name: string; modifiedAt: number };
        }>(key);

        if (data) {
          projects.push({
            id: key.replace('project:', ''),
            name: data.metadata.name,
            modifiedAt: data.metadata.modifiedAt
          });
        }
      }
    }

    return projects.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.indexedDB.remove(`project:${id}`);
  }

  dispose(): void {
    this.stopAutosave();
    this.canvas = null;
  }
}
