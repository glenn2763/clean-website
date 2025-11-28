/**
 * Component Exports
 * Central export point for all visualization components
 */

import { renderLeagueOverview } from './league-overview.js';
import { renderUnluckyPlayersChart } from './unlucky-players.js';
import { renderConsistencyChart } from './consistency.js';
import { renderProjectedVsActualChart } from './projected-vs-actual.js';
import { renderScoreExtremesChart } from './score-extremes.js';
import { renderH2HMatrix } from './h2h-matrix.js';
import { renderPlayoffPerformance } from './playoff-performance.js';
import { renderTransactionAnalysis } from './transactions.js';
import { renderPositionalAnalysis } from './positional-analysis.js';
import { renderWeeklyTrends } from './weekly-trends.js';
import { renderMatchupAnalysis } from './matchup-analysis.js';
import { renderSeasonComparison } from './season-comparison.js';

/**
 * Render all visualizations
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderAllVisualizations(allSeasonsData) {
    renderLeagueOverview(Object.values(allSeasonsData)[0] || {});
    renderUnluckyPlayersChart(allSeasonsData);
    renderProjectedVsActualChart(allSeasonsData);
    renderScoreExtremesChart(allSeasonsData);
    renderConsistencyChart(allSeasonsData);
    renderH2HMatrix(allSeasonsData);
    renderPlayoffPerformance(allSeasonsData);
    renderTransactionAnalysis(allSeasonsData);
    renderPositionalAnalysis(allSeasonsData);
    renderWeeklyTrends(allSeasonsData);
    renderMatchupAnalysis(allSeasonsData);
    renderSeasonComparison(allSeasonsData);
}

export {
    renderLeagueOverview,
    renderUnluckyPlayersChart,
    renderConsistencyChart,
    renderProjectedVsActualChart,
    renderScoreExtremesChart,
    renderH2HMatrix,
    renderPlayoffPerformance,
    renderTransactionAnalysis,
    renderPositionalAnalysis,
    renderWeeklyTrends,
    renderMatchupAnalysis,
    renderSeasonComparison,
    renderAllVisualizations
};

