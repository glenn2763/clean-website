/**
 * IndexedDB cache for ESPN league data (handles large payloads localStorage cannot).
 */

const DB_NAME = 'fantasy-football-cache';
const DB_VERSION = 1;
const STORE_NAME = 'espn-data';
const KEY_PREFIX = 'ff:';

let dbPromise = null;
const memoryCache = new Map();

function supportsIndexedDB() {
    return typeof indexedDB !== 'undefined';
}

function openDB() {
    if (!supportsIndexedDB()) {
        return Promise.reject(new Error('IndexedDB unavailable'));
    }

    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    return dbPromise;
}

function withStore(mode, fn) {
    return openDB().then(
        (db) =>
            new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const store = tx.objectStore(STORE_NAME);
                const result = fn(store, tx);
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
            })
    );
}

/**
 * @param {string} key
 * @returns {Promise<*|null>}
 */
async function getCacheItem(key) {
    if (memoryCache.has(key)) {
        return memoryCache.get(key);
    }

    if (!supportsIndexedDB()) return null;

    try {
        const value = await withStore('readonly', (store) => {
            const request = store.get(key);
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => reject(request.error);
            });
        });
        if (value != null) {
            memoryCache.set(key, value);
        }
        return value;
    } catch (error) {
        console.warn('Cache read failed', error);
        return null;
    }
}

/**
 * @param {string} key
 * @param {*} value
 */
async function setCacheItem(key, value) {
    memoryCache.set(key, value);

    if (!supportsIndexedDB()) return;

    try {
        await withStore('readwrite', (store) => store.put(value, key));
    } catch (error) {
        console.warn('Cache write failed', error);
    }
}

async function listCacheKeys() {
    if (!supportsIndexedDB()) return [];

    try {
        return await withStore('readonly', (store) => {
            const request = store.getAllKeys();
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        });
    } catch (error) {
        console.warn('Cache list failed', error);
        return [];
    }
}

/**
 * @param {(key: string) => boolean} matcher
 * @returns {Promise<number>}
 */
async function removeMatchingCacheKeys(matcher) {
    let cleared = 0;

    for (const key of [...memoryCache.keys()]) {
        if (matcher(key)) {
            memoryCache.delete(key);
            cleared++;
        }
    }

    if (!supportsIndexedDB()) return cleared;

    try {
        const keys = await listCacheKeys();
        await withStore('readwrite', (store) => {
            keys.forEach((key) => {
                if (matcher(String(key))) {
                    store.delete(key);
                    cleared++;
                }
            });
        });
    } catch (error) {
        console.warn('Cache delete failed', error);
    }

    return cleared;
}

function forEachLocalStorageKey(callback) {
    if (typeof localStorage === 'undefined') return;

    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) callback(key);
    }
}

function clearLegacyLocalStorageCache() {
    let cleared = 0;
    try {
        const keys = [];
        forEachLocalStorageKey((key) => keys.push(key));
        keys.forEach((key) => {
            if (key.match(/^\d+-\d{4}-/)) {
                localStorage.removeItem(key);
                cleared += 1;
            }
        });
    } catch (error) {
        console.warn('Failed to clear legacy localStorage cache', error);
    }
    return cleared;
}

/**
 * Clear all saved ESPN league data.
 * @returns {Promise<number>}
 */
async function clearAllCache() {
    memoryCache.clear();
    const legacy = clearLegacyLocalStorageCache();
    const indexed = await removeMatchingCacheKeys((key) => key.startsWith(KEY_PREFIX));
    return legacy + indexed;
}

export {
    KEY_PREFIX,
    getCacheItem,
    setCacheItem,
    clearAllCache,
    clearLegacyLocalStorageCache,
    removeMatchingCacheKeys,
};
