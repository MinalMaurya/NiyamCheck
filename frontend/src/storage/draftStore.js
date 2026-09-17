/**
 * NiyamCheck IndexedDB Draft Storage
 * Safely persists multi-panel inspection images, panel assignments, and metadata
 * locally on the inspector's device without exhausting localStorage quotas.
 */

const DB_NAME = 'niyamcheck_db';
const DB_VERSION = 2;
const STORE_NAME = 'drafts';
const EVIDENCE_STORE = 'evidence';

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
      if (!db.objectStoreNames.contains(EVIDENCE_STORE)) {
        const evStore = db.createObjectStore(EVIDENCE_STORE, { keyPath: 'evidenceId' });
        evStore.createIndex('inspectionId', 'inspectionId', { unique: false });
        evStore.createIndex('savedAt', 'savedAt', { unique: false });
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

  /**
   * Preserve evidence item associated with a finding locally.
   */
  async saveEvidence(evidence) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, 'readwrite');
      const store = tx.objectStore(EVIDENCE_STORE);
      const item = {
        evidenceId: evidence.evidenceId || `ev-${evidence.inspectionId || 'insp'}-${evidence.ruleId || 'rule'}-${Date.now()}`,
        inspectionId: evidence.inspectionId || 'unknown',
        ruleId: evidence.ruleId || 'N/A',
        requirement: evidence.requirement || evidence.name || '',
        detectedValue: evidence.detectedValue || '',
        evidenceText: evidence.evidenceText || '',
        packagePanel: evidence.packagePanel || 'UNKNOWN',
        imageId: evidence.imageId || null,
        imageUrl: evidence.imageUrl || null,
        boundingBox: evidence.boundingBox || null,
        savedAt: new Date().toISOString(),
      };
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Retrieve saved evidence items, optionally filtered by inspectionId.
   */
  async listSavedEvidence(inspectionId = null) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVIDENCE_STORE, 'readonly');
      const store = tx.objectStore(EVIDENCE_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const list = request.result || [];
        if (inspectionId) {
          resolve(list.filter((item) => item.inspectionId === inspectionId));
        } else {
          resolve(list);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save an entire inspection session record locally without duplicates.
   */
  async saveInspectionSession(session) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const id = session.inspection_id || `insp-${Date.now()}`;
      const record = {
        draftId: id,
        inspectionId: id,
        title: `Inspection — ${session.product_category || 'Packaged Product'} (${id})`,
        createdAt: session.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessionData: session,
        status: 'completed_inspection',
      };
      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  },
};
