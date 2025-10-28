import { normalizeUrlForKey } from "./url.js";

function serializeVector(vec) {
  return Array.from(vec);
}

function deserializeVector(arr) {
  return new Float32Array(arr || []);
}

export class StorageManager {
  constructor(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
    this.maxAgeMs = maxAgeMs;
    // Keep payload under Chrome sync per-item quota (~8KB) with padding for metadata.
    this.syncLimitBytes = 6000;
  }

  async _getBucket(localOnly) {
    const area = localOnly ? 'local' : 'sync';
    const { vectors } = await chrome.storage[area].get('vectors');
    let bucket = { ...(vectors || {}) };
    const cutoff = Date.now() - this.maxAgeMs;

    let changed = false;
    for (const url of Object.keys(bucket)) {
      if ((bucket[url]?.timestamp || 0) < cutoff) {
        delete bucket[url];
        changed = true;
      }
    }

    if (!localOnly) {
      const sizeBytes = new Blob([JSON.stringify({ vectors: bucket })]).size;
      if (sizeBytes > this.syncLimitBytes) {
        try {
          const localData = await chrome.storage.local.get('vectors');
          const localBucket = { ...(localData.vectors || {}), ...bucket };
          await chrome.storage.local.set({ vectors: localBucket });
          await chrome.storage.sync.remove('vectors');
          bucket = {};
          changed = false;
          console.warn('Migrated oversized sync vector cache to local storage.');
        } catch (e) {
          console.warn('Failed to migrate oversized sync vector cache:', e);
        }
      }
    }

    if (changed) {
      try {
        await chrome.storage[area].set({ vectors: bucket });
      } catch (e) {
        console.warn('Failed to persist pruned vector bucket:', e);
      }
    }

    return { area, bucket };
  }

  async getVector(url, localOnly = false) {
    const { bucket } = await this._getBucket(localOnly);
    return bucket[url] ? deserializeVector(bucket[url].data) : null;
  }

  async saveVector(url, vector, localOnly = false) {
    if (!url || !vector) return;

    const { area, bucket } = await this._getBucket(localOnly);
    bucket[url] = { data: serializeVector(vector), timestamp: Date.now() };
    const payload = { vectors: bucket };

    if (!localOnly) {
      const sizeBytes = new Blob([JSON.stringify(payload)]).size;
      if (sizeBytes > this.syncLimitBytes) {
        delete bucket[url];
        try {
          await chrome.storage[area].set({ vectors: bucket });
        } catch {
          // Best-effort to keep sync state consistent; ignore errors.
        }
        console.warn('Sync quota headroom exceeded; storing vector locally for', url);
        return this.saveVector(url, vector, true);
      }
    }

    try {
      await chrome.storage[area].set(payload);
    } catch (e) {
      const message = e?.message || String(e);
      if (!localOnly && /quota/i.test(message)) {
        console.warn('Sync quota error; migrating vector to local for', url);
        delete bucket[url];
        try {
          await chrome.storage[area].set({ vectors: bucket });
        } catch {
          // Ignore follow-up failure during rollback.
        }
        return this.saveVector(url, vector, true);
      }
      console.warn('Failed to store vector:', e);
    }
  }

  async deleteVector(url) {
    if (!url) return;
    await Promise.all(['sync', 'local'].map(async (area) => {
      const { vectors } = await chrome.storage[area].get('vectors');
      if (!vectors || !vectors[url]) return;
      delete vectors[url];
      try {
        await chrome.storage[area].set({ vectors });
      } catch (e) {
        console.warn(`Failed to update ${area} vectors after delete:`, e);
      }
    }));
  }

  async deleteVectorByNormalized(normalizedUrl) {
    if (!normalizedUrl) return;
    await Promise.all(['sync', 'local'].map(async (area) => {
      const { vectors } = await chrome.storage[area].get('vectors');
      if (!vectors) return;
      let changed = false;
      for (const key of Object.keys(vectors)) {
        if (normalizeUrlForKey(key) === normalizedUrl) {
          delete vectors[key];
          changed = true;
        }
      }
      if (changed) {
        try {
          await chrome.storage[area].set({ vectors });
        } catch (e) {
          console.warn(`Failed to update ${area} vectors after normalized delete:`, e);
        }
      }
    }));
  }

  async clearAll() {
    await Promise.all(['sync', 'local'].map(area => chrome.storage[area].remove('vectors')));
  }
}
