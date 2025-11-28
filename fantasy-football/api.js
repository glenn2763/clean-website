/**
 * ESPN Fantasy Football API Client
 * Handles data fetching, caching, and error handling
 */

const PROXY_BASE_URL = window.BACKEND_URL || '/api/espn';

const LARGE_VIEWS = ['mMatchup', 'mSchedule', 'mRoster', 'kona_player_info'];
const ALL_VIEWS = [
    'mSettings',
    'mRoster',
    'mMatchup',
    'mSchedule',
    'mStandings',
    'mScoreboard',
    'mTeam',
    'mDraftDetail',
    'mTransactions',
    'kona_player_info'
];

/**
 * Fetch data from ESPN API (via proxy if needed)
 * @param {string} leagueId - ESPN league ID
 * @param {string} season - Season year (e.g., '2024')
 * @param {string} view - Optional view name
 * @returns {Promise<Object>} League data
 */
async function fetchESPNData(leagueId, season, view = '') {
    const cacheKey = `${leagueId}-${season}-${view}`;
    const skipCache = LARGE_VIEWS.includes(view);
    
    // Check localStorage cache
    if (!skipCache) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.warn('Failed to parse cached data', e);
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
        
        // Cache the data
        if (!skipCache) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.warn(`Cache quota exceeded for ${cacheKey}, skipping cache`);
                    clearOldCacheEntries(leagueId);
                } else {
                    throw e;
                }
            }
        }
        return data;
    } catch (error) {
        console.error(`Error fetching ${view || 'league'} data:`, error);
        throw error;
    }
}

/**
 * Clear old cache entries for a league
 * @param {string} leagueId - League ID
 */
function clearOldCacheEntries(leagueId) {
    try {
        const keys = Object.keys(localStorage);
        let cleared = 0;
        for (let i = 0; i < Math.min(10, keys.length); i++) {
            if (keys[i].startsWith(`${leagueId}-`)) {
                localStorage.removeItem(keys[i]);
                cleared++;
            }
        }
        return cleared;
    } catch (error) {
        console.warn('Failed to clear old cache entries', error);
        return 0;
    }
}

/**
 * Fetch all views for a league/season
 * @param {string} leagueId - ESPN league ID
 * @param {string} season - Season year
 * @returns {Promise<Object>} All league data views
 */
async function fetchAllLeagueData(leagueId, season) {
    const data = {};
    
    for (const view of ALL_VIEWS) {
        try {
            data[view] = await fetchESPNData(leagueId, season, view);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.warn(`Failed to fetch ${view}:`, error);
            data[view] = null;
        }
    }

    return data;
}

/**
 * Fetch data for multiple seasons
 * @param {string} leagueId - ESPN league ID
 * @param {string[]} seasons - Array of season years
 * @returns {Promise<Object>} Data for all seasons
 */
async function fetchAllSeasons(leagueId, seasons) {
    const allData = {};
    
    for (const season of seasons) {
        allData[season] = await fetchAllLeagueData(leagueId, season);
    }
    
    return allData;
}

/**
 * Clear localStorage cache for fantasy football data
 * @returns {number} Number of entries cleared
 */
function clearCache() {
    try {
        const keys = Object.keys(localStorage);
        let cleared = 0;
        keys.forEach(key => {
            if (key.match(/^\d+-\d{4}-/)) { // Match pattern: leagueId-year-view
                localStorage.removeItem(key);
                cleared++;
            }
        });
        console.log(`Cleared ${cleared} cache entries`);
        return cleared;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return 0;
    }
}

export {
    fetchESPNData,
    fetchAllLeagueData,
    fetchAllSeasons,
    clearCache
};

