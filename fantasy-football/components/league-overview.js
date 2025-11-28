/**
 * League Overview Component
 * Displays league information and current standings
 */

import { getTeamNameFromObject } from '../utils.js';

/**
 * Render league overview
 * @param {Object} data - Single season data
 */
function renderLeagueOverview(data) {
    const settings = data?.mSettings;
    const standings = data?.mStandings;
    const teams = data?.mTeam || [];
    
    if (!settings || !standings) {
        document.getElementById('league-overview').innerHTML = 
            '<p>League overview data not available.</p>';
        return;
    }
    
    const container = document.getElementById('league-overview');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-value">${settings.name || 'Unknown League'}</span>
                <span class="stat-label">League Name</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${teams.length}</span>
                <span class="stat-label">Teams</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${settings.scoringSettings?.scoringItems?.length || 'N/A'}</span>
                <span class="stat-label">Scoring Rules</span>
            </div>
        </div>
        <h3>Current Standings</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>W-L-T</th>
                    <th>Points For</th>
                    <th>Points Against</th>
                </tr>
            </thead>
            <tbody>
                ${(standings.entries || []).slice(0, 10).map((entry, idx) => {
                    const team = teams.find(t => t.id === entry.teamId);
                    const record = entry.overallWinLossTie || { wins: 0, losses: 0, ties: 0 };
                    const teamName = team ? getTeamNameFromObject(team) : `Team ${entry.teamId}`;
                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${teamName}</td>
                            <td>${record.wins}-${record.losses}-${record.ties}</td>
                            <td>${entry.overallPointsFor?.toFixed(2) || '0.00'}</td>
                            <td>${entry.overallPointsAgainst?.toFixed(2) || '0.00'}</td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="5">No standings data available</td></tr>'}
            </tbody>
        </table>
    `;
}

export { renderLeagueOverview };

