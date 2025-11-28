/**
 * Main Entry Point
 * Initializes the fantasy football stats page
 */

import { fetchAllLeagueData, fetchAllSeasons, clearCache } from './api.js';
import { renderAllVisualizations } from './components/index.js';

/**
 * Initialize the page
 */
function init() {
    const fetchBtn = document.getElementById('fetch-btn');
    const fetchAllBtn = document.getElementById('fetch-all-seasons-btn');
    const leagueIdInput = document.getElementById('league-id');
    const seasonSelect = document.getElementById('season-select');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('content');
    
    // Clear old cache on load if localStorage is getting full
    try {
        const testKey = '__cache_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old cache...');
            clearCache();
        }
    }
    
    async function fetchData(allSeasons = false) {
        const leagueId = leagueIdInput.value.trim();
        if (!leagueId) {
            errorEl.textContent = 'Please enter a league ID';
            errorEl.classList.remove('hidden');
            return;
        }
        
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        
        try {
            let allSeasonsData;
            
            if (allSeasons) {
                const seasons = ['2021', '2022', '2023', '2024'];
                allSeasonsData = await fetchAllSeasons(leagueId, seasons);
            } else {
                const season = seasonSelect.value;
                const data = await fetchAllLeagueData(leagueId, season);
                allSeasonsData = { [season]: data };
            }
            
            renderAllVisualizations(allSeasonsData);
            
            contentEl.classList.remove('hidden');
        } catch (error) {
            errorEl.textContent = `Error: ${error.message}. Make sure the server is running and the league ID is correct.`;
            errorEl.classList.remove('hidden');
        } finally {
            loadingEl.classList.add('hidden');
        }
    }
    
    fetchBtn.addEventListener('click', () => fetchData(false));
    fetchAllBtn.addEventListener('click', () => fetchData(true));
    
    // Clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            const cleared = clearCache();
            alert(`Cleared ${cleared} cached entries.`);
        });
    }
    
    // Allow Enter key to trigger fetch
    leagueIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchData(false);
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

