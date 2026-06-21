/**
 * Component Exports
 * Central export point for all visualization components
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
import { renderSeasonComparison } from './season-comparison.js';
import { renderWaiverWireSpecialist } from './waiver-wire-specialist.js';
import { renderTradeAnalyzer, renderLeagueTradeNetwork } from './trade-analyzer.js';
import { destroyAllCharts } from '../charts.js';

/**
 * Single-season deep dive: one year of league detail
 * @param {Object} seasonData - Data for one season
 */
function renderSingleSeasonVisualizations(allSeasonsData) {
    renderLeagueOverview(Object.values(allSeasonsData)[0] || {});
    renderWeeklyTrends(allSeasonsData);
    renderProjectedVsActualChart(allSeasonsData);
    renderConsistencyChart(allSeasonsData);
    renderMatchupAnalysis(allSeasonsData);
    renderTradeAnalyzer(allSeasonsData);
    renderPositionalAnalysis(allSeasonsData);
}

/**
 * Multi-season league history: trends and comparisons across years
 * @param {Object} allSeasonsData - Data keyed by season year
 */
function renderMultiSeasonVisualizations(allSeasonsData) {
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
    renderH2HMatrix(allSeasonsData);
    renderUnluckyPlayersChart(allSeasonsData);
    renderLuckQuadrantChart(allSeasonsData);
    renderWaiverWireSpecialist(allSeasonsData);
    renderLeagueTradeNetwork(allSeasonsData);
    renderPlayoffPerformance(allSeasonsData);

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
 * @param {'single'|'multi'} mode
 * @param {Object} allSeasonsData
 */
function renderVisualizations(mode, allSeasonsData) {
    destroyAllCharts();

    if (mode === 'single') {
        renderSingleSeasonVisualizations(allSeasonsData);
    } else {
        renderMultiSeasonVisualizations(allSeasonsData);
    }
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
    renderSingleSeasonVisualizations,
    renderMultiSeasonVisualizations,
    renderVisualizations
};
