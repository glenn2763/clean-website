/**
 * Main Entry Point — Field Report
 * Scope filter + thematic hub navigation
 */

import { fetchAllLeagueData, fetchAllSeasons, fetchAvailableSeasons, clearCache } from './api.js';
import { getActiveSeasons } from './utils.js';
import { renderHub, destroyAllCharts } from './components/index.js';
import { refreshAllCharts } from './charts.js';

const HUBS = ['pulse', 'scoring', 'matchups', 'trades', 'roster', 'luck', 'waivers', 'lab'];
const ALL_ONLY_HUBS = new Set(['luck', 'waivers', 'lab']);
const DEFAULT_HUB = 'pulse';

function getHubsForScope(scopeType) {
    if (scopeType === 'all') return HUBS;
    return HUBS.filter((hubId) => !ALL_ONLY_HUBS.has(hubId));
}

function resolveHub(hubId, scopeType) {
    const hubs = getHubsForScope(scopeType);
    return hubs.includes(hubId) ? hubId : DEFAULT_HUB;
}

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
    const scopeSelect = document.getElementById('scope-select');
    const seasonScopePanel = document.getElementById('season-scope-panel');
    const allScopePanel = document.getElementById('all-scope-panel');
    const loadingEl = document.getElementById('loading');
    const loadingTextEl = document.getElementById('loading-text');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('content');
    const resultsBannerEl = document.getElementById('results-banner');
    const multiSeasonSummaryEl = document.getElementById('multi-season-summary');
    const hubNav = document.getElementById('hub-nav');

    let availableSeasons = [];
    let seasonsForLeagueId = null;
    let seasonLoadToken = 0;
    let activeHub = DEFAULT_HUB;
    let currentData = null;
    /** @type {'season'|'all'|null} */
    let currentScopeType = null;
    const renderedHubs = new Set();

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

    function getScopeType() {
        return scopeSelect.value === 'all' ? 'all' : 'season';
    }

    function updateLeagueUI() {
        const custom = isCustomLeagueSelected();
        customLeaguePanel.classList.toggle('hidden', !custom);
        if (custom) {
            leagueIdInput.focus();
        }
    }

    function updateScopeUI() {
        const scopeType = getScopeType();
        document.body.dataset.scope = scopeType;
        seasonScopePanel.classList.toggle('hidden', scopeType !== 'season');
        allScopePanel.classList.toggle('hidden', scopeType !== 'all');
        analyzeBtn.textContent = scopeType === 'all' ? 'Analyze All Seasons' : 'Analyze Season';
        updateMultiSeasonSummary();
        applyHubNavVisibility();
        applyScopeVisibility();
        ensureActiveHubForScope(scopeType);
    }

    function applyHubNavVisibility(scopeType = getScopeType()) {
        hubNav.querySelectorAll('.hub-btn').forEach((btn) => {
            const hubScope = btn.getAttribute('data-hub-scope');
            const visible = hubScope !== 'all' || scopeType === 'all';
            btn.classList.toggle('hidden', !visible);
        });
    }

    function ensureActiveHubForScope(scopeType) {
        const resolved = resolveHub(activeHub, scopeType);
        if (resolved !== activeHub) {
            setActiveHub(resolved, { updateHash: true });
        }
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
            : `${availableSeasons.length} seasons (${oldest}–${newest}). Data is saved locally after the first load.`;
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

    function showResultsBanner(scopeType, seasons, leagueId) {
        const sorted = [...seasons].sort();
        const leagueLabel = getLeagueLabel(leagueId);
        let message;

        if (scopeType === 'season') {
            message = sorted.length === 1
                ? `${leagueLabel} — ${sorted[0]}`
                : `${leagueLabel} — season analysis`;
        } else if (sorted.length < 2) {
            message = sorted.length === 1
                ? `${leagueLabel} — ${sorted[0]} only (some hubs need 2+ seasons)`
                : `${leagueLabel} — all seasons`;
        } else {
            message = `${leagueLabel} — ${sorted.length} seasons (${sorted[0]}–${sorted[sorted.length - 1]})`;
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

    /**
     * Show/hide sections by data-scope and empty-state CTAs based on loaded data.
     */
    function applyScopeVisibility() {
        const scopeType = currentScopeType || getScopeType();
        const seasonCount = currentData ? getActiveSeasons(currentData).length : 0;
        const hasMulti = seasonCount >= 2;
        const hasAnyData = Boolean(currentData);

        document.querySelectorAll('.hub-panel .analysis-section[data-scope]').forEach((section) => {
            const sectionScope = section.getAttribute('data-scope');
            let visible = false;
            if (!hasAnyData) {
                visible = false;
            } else if (sectionScope === 'season') {
                visible = scopeType === 'season';
            } else if (sectionScope === 'all') {
                visible = scopeType === 'all' && hasMulti;
            } else {
                visible = sectionScope === 'both';
            }
            section.classList.toggle('hidden', !visible);
        });

        document.querySelectorAll('.hub-intro-season, .hub-intro-all').forEach((el) => {
            const isSeasonIntro = el.classList.contains('hub-intro-season');
            const show = scopeType === 'season' ? isSeasonIntro : !isSeasonIntro;
            el.classList.toggle('hidden', !show);
        });

        // Empty states when multi-year data is required but unavailable
        document.querySelectorAll('.scope-empty').forEach((el) => {
            const key = el.getAttribute('data-empty-for');
            let show = false;

            if (!hasAnyData) {
                show = false;
            } else if (key === 'luck' || key === 'lab' || key.endsWith('-all')) {
                show = scopeType === 'all' && !hasMulti;
            }

            const panel = el.closest('.hub-panel');
            const inActiveHub = panel && !panel.classList.contains('hidden');
            el.hidden = !(show && inActiveHub);
        });
    }

    function setActiveHub(hubId, { updateHash = true } = {}) {
        const scopeType = currentScopeType || getScopeType();
        hubId = resolveHub(hubId, scopeType);
        activeHub = hubId;

        document.querySelectorAll('.hub-panel').forEach((panel) => {
            const isActive = panel.getAttribute('data-hub-panel') === hubId;
            panel.classList.toggle('hidden', !isActive);
            if (isActive) {
                panel.classList.remove('hub-panel-enter');
                // Retrigger enter animation
                void panel.offsetWidth;
                panel.classList.add('hub-panel-enter');
            }
        });

        hubNav.querySelectorAll('.hub-btn').forEach((btn) => {
            const isCurrent = btn.dataset.hub === hubId;
            btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
            btn.classList.toggle('is-active', isCurrent);
        });

        if (updateHash) {
            const url = new URL(window.location.href);
            url.hash = hubId;
            history.replaceState(null, '', url);
        }

        applyHubNavVisibility();
        applyScopeVisibility();
        ensureHubRendered(hubId);
    }

    function ensureHubRendered(hubId) {
        if (!currentData || !currentScopeType) return;

        const alwaysRefresh = hubId === 'trades';
        if (!renderedHubs.has(hubId) || alwaysRefresh) {
            renderHub(hubId, currentScopeType, currentData);
            renderedHubs.add(hubId);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                refreshAllCharts();
            });
        });
    }

    function hubFromHash() {
        const hash = window.location.hash.replace(/^#/, '');
        const hubId = hash;
        const scopeType = currentScopeType || getScopeType();
        return resolveHub(HUBS.includes(hubId) ? hubId : DEFAULT_HUB, scopeType);
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

    /**
     * @param {{ forceAll?: boolean }} [opts]
     */
    async function runAnalysis(opts = {}) {
        const leagueId = getLeagueId();
        const scopeType = opts.forceAll ? 'all' : getScopeType();

        if (opts.forceAll) {
            scopeSelect.value = 'all';
            updateScopeUI();
        }

        if (!leagueId) {
            errorEl.textContent = isCustomLeagueSelected()
                ? 'Please enter a league ID'
                : 'Please select a league';
            errorEl.classList.remove('hidden');
            return;
        }

        loadingTextEl.textContent = scopeType === 'all' ? 'Loading all seasons…' : 'Loading season data…';
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        resultsBannerEl.classList.add('hidden');

        try {
            let allSeasonsData;

            if (scopeType === 'all') {
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

            currentData = allSeasonsData;
            currentScopeType = scopeType;
            renderedHubs.clear();
            destroyAllCharts();

            contentEl.classList.remove('hidden');
            const bannerSeasons = getActiveSeasons(allSeasonsData);
            showResultsBanner(scopeType, bannerSeasons, leagueId);

            await new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            setActiveHub(activeHub || hubFromHash(), { updateHash: true });
        } catch (error) {
            errorEl.textContent = `Error: ${error.message}. Make sure the server is running and the league ID is correct.`;
            errorEl.classList.remove('hidden');
        } finally {
            loadingEl.classList.add('hidden');
        }
    }

    analyzeBtn.addEventListener('click', () => runAnalysis());

    hubNav.addEventListener('click', (event) => {
        const btn = event.target.closest('.hub-btn');
        if (!btn) return;
        setActiveHub(btn.dataset.hub);
    });

    document.addEventListener('click', (event) => {
        const loadBtn = event.target.closest('.load-all-seasons-btn');
        if (!loadBtn) return;
        runAnalysis({ forceAll: true });
    });

    window.addEventListener('hashchange', () => {
        if (!currentData) return;
        setActiveHub(hubFromHash(), { updateHash: false });
    });

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

    scopeSelect.addEventListener('change', () => {
        updateScopeUI();
        // If data already loaded and user switches scope, re-fetch for the new scope
        if (currentData) {
            runAnalysis();
        }
    });

    leagueIdInput.addEventListener('input', scheduleSeasonLoad);
    leagueIdInput.addEventListener('change', loadAvailableSeasons);

    leagueIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runAnalysis();
        }
    });

    activeHub = hubFromHash();
    updateScopeUI();
    updateLeagueUI();
    loadAvailableSeasons();

    // Sync hub button state before first analyze
    hubNav.querySelectorAll('.hub-btn').forEach((btn) => {
        const isCurrent = btn.dataset.hub === activeHub;
        btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
        btn.classList.toggle('is-active', isCurrent);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
