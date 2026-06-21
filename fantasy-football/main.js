/**
 * Main Entry Point
 * Initializes the fantasy football stats page
 */

import { fetchAllLeagueData, fetchAllSeasons, fetchAvailableSeasons, clearCache } from './api.js';
import { getActiveSeasons } from './utils.js';
import { renderVisualizations } from './components/index.js';
import { refreshAllCharts } from './charts.js';

const ANALYSIS_MODES = {
    single: {
        label: 'Single Season',
        description: 'Deep dive into one season — weekly trends, matchups, and roster activity.',
        actionLabel: 'Analyze Season',
        loadingLabel: 'Loading season data…',
    },
    multi: {
        label: 'League History',
        description: 'Compare trends across every available season — playoffs, luck, and scoring over time.',
        actionLabel: 'Analyze All Seasons',
        loadingLabel: 'Loading all seasons…',
    },
};

const LEAGUE_PRESETS = {
    37892: 'Domination League',
    38088471: 'Monkey Men',
};

/**
 * Initialize the page
 */
function init() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const leagueSelect = document.getElementById('league-select');
    const leagueIdInput = document.getElementById('league-id');
    const customLeaguePanel = document.getElementById('custom-league-panel');
    const seasonSelect = document.getElementById('season-select');
    const loadingEl = document.getElementById('loading');
    const loadingTextEl = document.getElementById('loading-text');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('content');
    const resultsBannerEl = document.getElementById('results-banner');
    const modeDescriptionEl = document.getElementById('mode-description');
    const multiSeasonSummaryEl = document.getElementById('multi-season-summary');
    const modeToggle = document.getElementById('mode-toggle');

    let availableSeasons = [];
    let seasonsForLeagueId = null;
    let seasonLoadToken = 0;
    let analysisMode = 'single';

    function getSelectedMode() {
        return modeToggle.querySelector('input[name="analysis-mode"]:checked')?.value || 'single';
    }

    function getLeagueId() {
        if (leagueSelect.value === 'custom') {
            return leagueIdInput.value.trim();
        }
        return leagueSelect.value;
    }

    function getLeagueLabel(leagueId) {
        return LEAGUE_PRESETS[leagueId] || `League ${leagueId}`;
    }

    function isCustomLeagueSelected() {
        return leagueSelect.value === 'custom';
    }

    function updateLeagueUI() {
        const custom = isCustomLeagueSelected();
        customLeaguePanel.classList.toggle('hidden', !custom);
        if (custom) {
            leagueIdInput.focus();
        }
    }

    function updateModeUI() {
        analysisMode = getSelectedMode();
        const config = ANALYSIS_MODES[analysisMode];

        document.body.dataset.analysisMode = analysisMode;
        modeDescriptionEl.textContent = config.description;
        analyzeBtn.textContent = config.actionLabel;

        const singlePanel = document.getElementById('single-season-panel');
        const multiPanel = document.getElementById('multi-season-panel');
        if (singlePanel) singlePanel.classList.toggle('hidden', analysisMode !== 'single');
        if (multiPanel) multiPanel.classList.toggle('hidden', analysisMode !== 'multi');

        updateMultiSeasonSummary();
    }

    function updateMultiSeasonSummary() {
        if (!multiSeasonSummaryEl) return;

        if (!availableSeasons.length) {
            multiSeasonSummaryEl.textContent = isCustomLeagueSelected() && !getLeagueId()
                ? 'Enter a league ID to load available seasons.'
                : 'Season list loads after you select a league.';
            return;
        }

        const oldest = availableSeasons[availableSeasons.length - 1];
        const newest = availableSeasons[0];
        multiSeasonSummaryEl.textContent = availableSeasons.length === 1
            ? `Only ${newest} is available for this league.`
            : `${availableSeasons.length} seasons (${oldest}–${newest}) will be compared. Data is saved locally after the first load.`;
    }

    function populateSeasonSelect(seasons) {
        seasonSelect.innerHTML = '';
        if (!seasons.length) {
            seasonSelect.innerHTML = '<option value="">No seasons found</option>';
            return;
        }
        seasons.forEach((season) => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = season;
            seasonSelect.appendChild(option);
        });
    }

    function showResultsBanner(mode, seasons, leagueId) {
        const sorted = [...seasons].sort();
        const leagueLabel = getLeagueLabel(leagueId);
        let message;

        if (mode === 'single') {
            message = sorted.length === 1
                ? `${leagueLabel} — ${sorted[0]} season analysis`
                : `${leagueLabel} — single-season analysis`;
        } else if (sorted.length < 2) {
            message = sorted.length === 1
                ? `${leagueLabel} — ${sorted[0]} only (season comparison needs 2+ seasons)`
                : `${leagueLabel} — league history analysis`;
        } else {
            message = `${leagueLabel} — comparing ${sorted.length} seasons (${sorted[0]}–${sorted[sorted.length - 1]})`;
        }

        resultsBannerEl.textContent = message;
        resultsBannerEl.classList.remove('hidden');
    }

    function resetSeasonList() {
        availableSeasons = [];
        seasonsForLeagueId = null;
        updateMultiSeasonSummary();
    }

    async function ensureSeasonsForLeague(leagueId) {
        if (seasonsForLeagueId === leagueId && availableSeasons.length) {
            return availableSeasons;
        }

        const seasons = await fetchAvailableSeasons(leagueId);
        availableSeasons = seasons;
        seasonsForLeagueId = leagueId;
        populateSeasonSelect(seasons);
        updateMultiSeasonSummary();
        return seasons;
    }

    function showViewPanels(mode) {
        const singleView = document.getElementById('single-season-view');
        const multiView = document.getElementById('multi-season-view');
        if (singleView) singleView.classList.toggle('hidden', mode !== 'single');
        if (multiView) multiView.classList.toggle('hidden', mode !== 'multi');
    }

    async function loadAvailableSeasons() {
        const leagueId = getLeagueId();
        const token = ++seasonLoadToken;

        if (!leagueId) {
            resetSeasonList();
            populateSeasonSelect([]);
            return;
        }

        resetSeasonList();
        multiSeasonSummaryEl.textContent = 'Loading seasons for this league…';

        seasonSelect.disabled = true;
        seasonSelect.innerHTML = '<option>Loading seasons...</option>';

        try {
            const seasons = await fetchAvailableSeasons(leagueId);
            if (token !== seasonLoadToken) return;

            availableSeasons = seasons;
            seasonsForLeagueId = leagueId;
            populateSeasonSelect(seasons);
            updateMultiSeasonSummary();
        } catch (error) {
            if (token !== seasonLoadToken) return;

            availableSeasons = [];
            seasonsForLeagueId = null;
            seasonSelect.innerHTML = '<option value="">Failed to load seasons</option>';
            errorEl.textContent = `Error loading seasons: ${error.message}`;
            errorEl.classList.remove('hidden');
        } finally {
            if (token === seasonLoadToken) {
                seasonSelect.disabled = false;
            }
        }
    }

    let seasonLoadTimeout;
    function scheduleSeasonLoad() {
        clearTimeout(seasonLoadTimeout);
        seasonLoadTimeout = setTimeout(loadAvailableSeasons, 400);
    }

    try {
        const testKey = '__cache_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing legacy cache...');
            clearCache();
        }
    }

    async function runAnalysis() {
        const leagueId = getLeagueId();
        const mode = getSelectedMode();
        const config = ANALYSIS_MODES[mode];

        if (!leagueId) {
            errorEl.textContent = isCustomLeagueSelected()
                ? 'Please enter a league ID'
                : 'Please select a league';
            errorEl.classList.remove('hidden');
            return;
        }

        loadingTextEl.textContent = config.loadingLabel;
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        resultsBannerEl.classList.add('hidden');

        try {
            let allSeasonsData;

            if (mode === 'multi') {
                loadingTextEl.textContent = 'Loading season list…';
                const seasons = await ensureSeasonsForLeague(leagueId);
                if (!seasons.length) {
                    throw new Error('No seasons found for this league');
                }
                allSeasonsData = await fetchAllSeasons(leagueId, [...seasons].reverse(), {
                    onProgress: ({ completed, total }) => {
                        loadingTextEl.textContent = `Loading seasons… ${completed}/${total}`;
                    },
                });
            } else {
                const season = seasonSelect.value;
                if (!season) {
                    throw new Error('Select a season to analyze');
                }
                loadingTextEl.textContent = 'Loading season data…';
                const data = await fetchAllLeagueData(leagueId, season);
                allSeasonsData = { [season]: data };
            }

            showViewPanels(mode);
            contentEl.classList.remove('hidden');
            const bannerSeasons = mode === 'multi' ? getActiveSeasons(allSeasonsData) : Object.keys(allSeasonsData);
            showResultsBanner(mode, bannerSeasons, leagueId);

            // Wait for layout so canvases have real dimensions before Chart.js measures them.
            await new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            renderVisualizations(mode, allSeasonsData);
            refreshAllCharts();
        } catch (error) {
            errorEl.textContent = `Error: ${error.message}. Make sure the server is running and the league ID is correct.`;
            errorEl.classList.remove('hidden');
        } finally {
            loadingEl.classList.add('hidden');
        }
    }

    analyzeBtn.addEventListener('click', runAnalysis);
    modeToggle.addEventListener('change', updateModeUI);

    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            const cleared = await clearCache();
            alert(`Cleared ${cleared} saved entries. Next analysis will re-download from ESPN.`);
        });
    }

    leagueSelect.addEventListener('change', () => {
        updateLeagueUI();
        loadAvailableSeasons();
    });

    leagueIdInput.addEventListener('input', scheduleSeasonLoad);
    leagueIdInput.addEventListener('change', loadAvailableSeasons);

    leagueIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runAnalysis();
        }
    });

    updateModeUI();
    updateLeagueUI();
    loadAvailableSeasons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
