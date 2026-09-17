/**
 * NiyamCheck IndexedDB Draft Storage
 * Safely persists multi-panel inspection images, panel assignments, and metadata
 * locally on the inspector's device without exhausting localStorage quotas.
 */

const DB_NAME = 'niyamcheck_db';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

export const draftStore = {
  /**
   * Save or update an inspection draft.
   */
  async saveDraft(draft) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        draftId: draft.draftId || `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: draft.title || `Draft Inspection (${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})`,
        createdAt: draft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: draft.images || [],
        notes: draft.notes || '',
        status: draft.status || 'draft',
      };

      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * List all saved drafts sorted by updatedAt descending.
   */
  async listDrafts() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Retrieve a single draft by ID.
   */
  async getDraft(draftId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(draftId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete a draft by ID.
   */
  async deleteDraft(draftId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(draftId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all drafts.
   */
  async clearAllDrafts() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
};
