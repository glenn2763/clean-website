/**
 * Component Exports — Field Report hub-aware rendering
 */

import { getActiveSeasons } from '../utils.js';
import { renderLeagueOverview } from './league-overview.js';
import { renderUnluckyPlayersChart } from './unlucky-players.js';
import { renderLuckQuadrantChart } from './luck-quadrant.js';
import { renderConsistencyChart } from './consistency.js';
import { renderProjectedVsActualChart } from './projected-vs-actual.js';
import { renderScoreExtremesChart } from './score-extremes.js';
import { renderH2HMatrix } from './h2h-matrix.js';
import { renderPlayoffPerformance } from './playoff-performance.js';
import { renderPositionalAnalysis } from './positional-analysis.js';
import { renderWeeklyTrends } from './weekly-trends.js';
import { renderMatchupAnalysis } from './matchup-analysis.js';
import { renderSeasonComparison, renderCareerSnapshot } from './season-comparison.js';
import { renderWaiverWireSpecialist } from './waiver-wire-specialist.js';
import { renderWinsCorrelation } from './wins-correlation.js';
import { renderTradeAnalyzer, renderLeagueTradeNetwork } from './trade-analyzer.js';
import { renderBirthplaceMap } from './birthplace-map.js';
import { destroyAllCharts } from '../charts.js';

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderPulseHub(scopeType, allSeasonsData) {
    if (scopeType === 'season') {
        renderLeagueOverview(Object.values(allSeasonsData)[0] || {});
        return;
    }

    const seasons = getActiveSeasons(allSeasonsData);
    if (seasons.length >= 2) {
        renderCareerSnapshot(allSeasonsData);
        renderPlayoffPerformance(allSeasonsData);
    }
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderScoringHub(scopeType, allSeasonsData) {
    if (scopeType === 'season') {
        renderWeeklyTrends(allSeasonsData);
        renderProjectedVsActualChart(allSeasonsData);
        renderConsistencyChart(allSeasonsData);
        return;
    }

    const seasons = getActiveSeasons(allSeasonsData);
    if (seasons.length >= 2) {
        renderSeasonComparison(allSeasonsData);
    } else {
        const table = document.getElementById('season-comparison-table');
        const canvas = document.getElementById('season-comparison-chart');
        if (table) table.innerHTML = '';
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }

    renderScoreExtremesChart(allSeasonsData);

    const seasonComparisonSection = document.getElementById('section-season-comparison');
    if (seasonComparisonSection) {
        const needsMoreSeasons = seasons.length < 2;
        seasonComparisonSection.classList.toggle('section-unavailable', needsMoreSeasons);
        const notice = seasonComparisonSection.querySelector('.section-unavailable-notice');
        if (notice) {
            notice.classList.toggle('hidden', !needsMoreSeasons);
        }
    }
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderLuckHub(scopeType, allSeasonsData) {
    if (scopeType !== 'all' || getActiveSeasons(allSeasonsData).length < 2) return;
    renderUnluckyPlayersChart(allSeasonsData);
    renderLuckQuadrantChart(allSeasonsData);
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderMatchupsHub(scopeType, allSeasonsData) {
    if (scopeType === 'season') {
        renderMatchupAnalysis(allSeasonsData);
        return;
    }
    if (getActiveSeasons(allSeasonsData).length >= 2) {
        renderH2HMatrix(allSeasonsData);
    }
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderWireHub(scopeType, allSeasonsData) {
    if (scopeType === 'season') {
        renderTradeAnalyzer(allSeasonsData);
        return;
    }
    if (getActiveSeasons(allSeasonsData).length >= 2) {
        renderWaiverWireSpecialist(allSeasonsData);
        renderLeagueTradeNetwork(allSeasonsData);
    }
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderRosterHub(scopeType, allSeasonsData) {
    if (scopeType === 'season') {
        renderPositionalAnalysis(allSeasonsData);
        return;
    }
    if (getActiveSeasons(allSeasonsData).length < 2) return;

    Promise.resolve(renderBirthplaceMap(allSeasonsData)).catch((error) => {
        console.warn('Birthplace map failed:', error);
        const notice = document.getElementById('birthplace-map-notice');
        if (notice) {
            notice.textContent = `Could not render birthplace map: ${error.message}`;
            notice.classList.remove('hidden');
        }
    });
}

/**
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderLabHub(scopeType, allSeasonsData) {
    if (scopeType !== 'all' || getActiveSeasons(allSeasonsData).length < 2) return;
    renderWinsCorrelation(allSeasonsData);
}

/**
 * Render visualizations for one hub (idempotent per data load — caller tracks visits).
 * @param {string} hubId
 * @param {'season'|'all'} scopeType
 * @param {Object} allSeasonsData
 */
function renderHub(hubId, scopeType, allSeasonsData) {
    switch (hubId) {
        case 'pulse':
            renderPulseHub(scopeType, allSeasonsData);
            break;
        case 'scoring':
            renderScoringHub(scopeType, allSeasonsData);
            break;
        case 'luck':
            renderLuckHub(scopeType, allSeasonsData);
            break;
        case 'matchups':
            renderMatchupsHub(scopeType, allSeasonsData);
            break;
        case 'wire':
            renderWireHub(scopeType, allSeasonsData);
            break;
        case 'roster':
            renderRosterHub(scopeType, allSeasonsData);
            break;
        case 'lab':
            renderLabHub(scopeType, allSeasonsData);
            break;
        default:
            break;
    }
}

/**
 * Legacy entry used by older callers / tests — renders every hub for the given mode.
 * @param {'single'|'multi'|'season'|'all'} mode
 * @param {Object} allSeasonsData
 */
function renderVisualizations(mode, allSeasonsData) {
    destroyAllCharts();
    const scopeType = mode === 'multi' || mode === 'all' ? 'all' : 'season';
    const hubs = ['pulse', 'scoring', 'luck', 'matchups', 'wire', 'roster', 'lab'];
    hubs.forEach((hubId) => renderHub(hubId, scopeType, allSeasonsData));
}

export {
    renderLeagueOverview,
    renderUnluckyPlayersChart,
    renderConsistencyChart,
    renderProjectedVsActualChart,
    renderScoreExtremesChart,
    renderH2HMatrix,
    renderPlayoffPerformance,
    renderPositionalAnalysis,
    renderWaiverWireSpecialist,
    renderTradeAnalyzer,
    renderLeagueTradeNetwork,
    renderWeeklyTrends,
    renderMatchupAnalysis,
    renderSeasonComparison,
    renderBirthplaceMap,
    renderHub,
    renderVisualizations,
    destroyAllCharts,
};
