/**
 * Matchup Analysis Component
 * Full season game log with team filter and expandable box scores
 */

import { renderGameLog } from './game-log.js';

/**
 * Render matchup analysis
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderMatchupAnalysis(allSeasonsData) {
    renderGameLog(allSeasonsData, 'matchup-analysis');
}

export { renderMatchupAnalysis };
