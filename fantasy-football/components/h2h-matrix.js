/**
 * Head-to-Head Matrix Component
 * Shows win/loss records between all teams
 */

import { getTeamNameFromObject, getAllTeams, getMatchups } from '../utils.js';

/**
 * Render head-to-head matrix
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderH2HMatrix(allSeasonsData) {
    const container = document.getElementById('h2h-matrix');
    const teamList = getAllTeams(allSeasonsData);
    const h2hRecords = {};
    
    // Initialize records
    teamList.forEach(team => {
        h2hRecords[team.id] = {};
        teamList.forEach(opponent => {
            if (team.id !== opponent.id) {
                h2hRecords[team.id][opponent.id] = { wins: 0, losses: 0 };
            }
        });
    });
    
    // Calculate records
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = getMatchups(seasonData);
        if (!Array.isArray(matchups)) return;
        
        matchups.forEach(matchup => {
            if (matchup.homeScore !== undefined && matchup.awayScore !== undefined) {
                const winner = matchup.homeScore > matchup.awayScore ? matchup.homeTeamId : matchup.awayTeamId;
                const loser = winner === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId;
                
                if (h2hRecords[winner] && h2hRecords[winner][loser]) {
                    h2hRecords[winner][loser].wins++;
                    h2hRecords[loser][winner].losses++;
                }
            }
        });
    });
    
    container.innerHTML = `
        <div class="h2h-matrix">
            <table>
                <thead>
                    <tr>
                        <th>Team</th>
                        ${teamList.map(team => `<th>${team.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${teamList.map(team => `
                        <tr>
                            <th>${team.name}</th>
                            ${teamList.map(opponent => {
                                if (team.id === opponent.id) {
                                    return '<td>-</td>';
                                }
                                const record = h2hRecords[team.id]?.[opponent.id] || { wins: 0, losses: 0 };
                                const total = record.wins + record.losses;
                                if (total === 0) return '<td>-</td>';
                                const winPct = (record.wins / total * 100).toFixed(0);
                                return `<td class="${record.wins > record.losses ? 'win' : 'loss'}">${record.wins}-${record.losses} (${winPct}%)</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export { renderH2HMatrix };

