/**
 * ESPN Fantasy Football API Client
 * Handles data fetching, caching, and error handling
 */

import {
    KEY_PREFIX,
    getCacheItem,
    setCacheItem,
    clearAllCache,
    clearLegacyLocalStorageCache,
} from './cache.js';

const PROXY_BASE_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) || '/api/espn';

/** Bump when cached payload shape changes to avoid stale entries. */
const CACHE_VERSION = 'v4';

const ALL_VIEWS = [
    'mSettings',
    'mTeam',
    'mStandings',
    'mMatchup',
    'mRoster',
    'mTransactions',
    'kona_player_info',
];

const SEASON_FETCH_CONCURRENCY = 3;

function buildCacheKey(leagueId, season, view) {
    return `${KEY_PREFIX}${CACHE_VERSION}:${leagueId}-${season}-${view}`;
}

function isLegacyCacheKey(key) {
    return /^\d+-\d{4}-/.test(key);
}

/**
 * Fetch data from ESPN API (via proxy if needed)
 * @param {string} leagueId - ESPN league ID
 * @param {string} season - Season year (e.g., '2024')
 * @param {string} view - Optional view name
 * @returns {Promise<Object>} League data
 */
async function fetchESPNData(leagueId, season, view = '') {
    const cacheKey = buildCacheKey(leagueId, season, view);

    const cached = await getCacheItem(cacheKey);
    if (cached != null) {
        return cached;
    }

    const legacyKey = `${leagueId}-${season}-${view}`;
    if (typeof localStorage !== 'undefined') {
        const legacyCached = localStorage.getItem(legacyKey);
        if (legacyCached) {
            try {
                const data = JSON.parse(legacyCached);
                await setCacheItem(cacheKey, data);
                return data;
            } catch (e) {
                console.warn('Failed to parse legacy cached data', e);
            }
        }
    }

    const url = view
        ? `${PROXY_BASE_URL}/league/${leagueId}/${season}/${view}`
        : `${PROXY_BASE_URL}/league/${leagueId}/${season}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        await setCacheItem(cacheKey, data);
        return data;
    } catch (error) {
        console.error(`Error fetching ${view || 'league'} data:`, error);
        throw error;
    }
}

/**
 * Fetch all season years that have data for a league
 * @param {string} leagueId - ESPN league ID
 * @returns {Promise<string[]>} Season years, newest first
 */
async function fetchAvailableSeasons(leagueId) {
    const response = await fetch(`${PROXY_BASE_URL}/league/${leagueId}/seasons`);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return (data.seasons || []).map(String);
}

/**
 * Fetch all views for a league/season (parallel; uses cache when available)
 * @param {string} leagueId - ESPN league ID
 * @param {string} season - Season year
 * @returns {Promise<Object>} All league data views
 */
async function fetchAllLeagueData(leagueId, season) {
    const entries = await Promise.all(
        ALL_VIEWS.map(async (view) => {
            try {
                const data = await fetchESPNData(leagueId, season, view);
                return [view, data];
            } catch (error) {
                console.warn(`Failed to fetch ${view} for ${season}:`, error);
                return [view, null];
            }
        })
    );

    const data = Object.fromEntries(entries);

    if (data.mTransactions == null) {
        console.warn(`mTransactions missing for ${season} — waiver/trade sections may be empty`);
    }

    return data;
}

/**
 * Fetch data for multiple seasons
 * @param {string} leagueId - ESPN league ID
 * @param {string[]} seasons - Array of season years
 * @param {{ onProgress?: (progress: { completed: number, total: number }) => void }} [options]
 * @returns {Promise<Object>} Data for all seasons
 */
async function fetchAllSeasons(leagueId, seasons, options = {}) {
    const allData = {};
    const { onProgress } = options;
    let completed = 0;
    const total = seasons.length;

    const reportProgress = () => onProgress?.({ completed, total });

    for (let i = 0; i < seasons.length; i += SEASON_FETCH_CONCURRENCY) {
        const batch = seasons.slice(i, i + SEASON_FETCH_CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (season) => {
                const data = await fetchAllLeagueData(leagueId, season);
                completed += 1;
                reportProgress();
                return [season, data];
            })
        );

        batchResults.forEach(([season, data]) => {
            allData[season] = data;
        });
    }

    return allData;
}

/**
 * Clear saved league data (IndexedDB, in-memory, and legacy localStorage)
 * @returns {Promise<number>} Number of entries cleared
 */
async function clearCache() {
    try {
        const cleared = await clearAllCache();
        console.log(`Cleared ${cleared} cache entries`);
        return cleared;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return clearLegacyLocalStorageCache();
    }
}

export {
    fetchESPNData,
    fetchAvailableSeasons,
    fetchAllLeagueData,
    fetchAllSeasons,
    clearCache,
    isLegacyCacheKey,
};
