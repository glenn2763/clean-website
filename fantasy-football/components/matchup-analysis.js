/**
 * Matchup Analysis Component
 * Shows closest games and biggest blowouts
 */

import { getTeamNameFromObject, getMatchups, getTeams } from '../utils.js';

/**
 * Render matchup analysis
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderMatchupAnalysis(allSeasonsData) {
    const container = document.getElementById('matchup-analysis');
    const matchups = [];
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const schedule = getMatchups(seasonData);
        const teams = getTeams(seasonData);
        
        if (!Array.isArray(schedule)) return;
        
        schedule.forEach(matchup => {
            if (matchup.homeScore !== undefined && matchup.awayScore !== undefined) {
                const margin = Math.abs(matchup.homeScore - matchup.awayScore);
                const winnerId = matchup.homeScore > matchup.awayScore ? matchup.homeTeamId : matchup.awayTeamId;
                const loserId = winnerId === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId;
                const winnerScore = matchup.homeScore > matchup.awayScore ? matchup.homeScore : matchup.awayScore;
                const loserScore = matchup.homeScore > matchup.awayScore ? matchup.awayScore : matchup.homeScore;
                
                const winnerTeam = teams.find(t => t.id === winnerId);
                const loserTeam = teams.find(t => t.id === loserId);
                
                matchups.push({
                    week: matchup.matchupPeriodId || 0,
                    winner: getTeamNameFromObject(winnerTeam || { id: winnerId }),
                    loser: getTeamNameFromObject(loserTeam || { id: loserId }),
                    winnerScore,
                    loserScore,
                    margin
                });
            }
        });
    });
    
    const closest = matchups.sort((a, b) => a.margin - b.margin).slice(0, 10);
    const blowouts = matchups.sort((a, b) => b.margin - a.margin).slice(0, 10);
    
    container.innerHTML = `
        <div class="tables-grid">
            <div>
                <h3>Closest Games</h3>
                ${closest.map(m => `
                    <div class="matchup-item">
                        <div class="matchup-header">Week ${m.week}: ${m.winner} vs ${m.loser}</div>
                        <div class="matchup-details">
                            ${m.winner}: ${m.winnerScore.toFixed(2)} | ${m.loser}: ${m.loserScore.toFixed(2)}<br>
                            Margin: ${m.margin.toFixed(2)} points
                        </div>
                    </div>
                `).join('')}
            </div>
            <div>
                <h3>Biggest Blowouts</h3>
                ${blowouts.map(m => `
                    <div class="matchup-item">
                        <div class="matchup-header">Week ${m.week}: ${m.winner} vs ${m.loser}</div>
                        <div class="matchup-details">
                            ${m.winner}: ${m.winnerScore.toFixed(2)} | ${m.loser}: ${m.loserScore.toFixed(2)}<br>
                            Margin: ${m.margin.toFixed(2)} points
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export { renderMatchupAnalysis };

