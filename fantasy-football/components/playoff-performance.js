/**
 * Playoff Performance Component
 * Shows playoff appearances and championship wins
 */

import { getTeamNameFromObject, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render playoff performance chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderPlayoffPerformance(allSeasonsData) {
    const canvas = document.getElementById('playoff-chart');
    if (!canvas) return;
    
    const playoffStats = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const settings = seasonData.mSettings;
        const standings = seasonData.mStandings;
        const teams = getTeams(seasonData);
        
        if (!settings || !standings) return;
        
        const playoffTeams = standings.entries
            ?.sort((a, b) => (b.overallWinLossTie?.wins || 0) - (a.overallWinLossTie?.wins || 0))
            .slice(0, settings.scheduleSettings?.playoffTeamCount || 4) || [];
        
        playoffTeams.forEach((entry, idx) => {
            const team = teams.find(t => t.id === entry.teamId);
            if (team) {
                const name = getTeamNameFromObject(team);
                if (!playoffStats[name]) {
                    playoffStats[name] = { appearances: 0, championships: 0 };
                }
                playoffStats[name].appearances++;
                if (idx === 0) {
                    playoffStats[name].championships++;
                }
            }
        });
    });
    
    const sorted = Object.entries(playoffStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.appearances - a.appearances);
    
    createChart('playoff', canvas, {
        type: 'bar',
        data: {
            labels: sorted.map(t => t.name),
            datasets: [
                {
                    label: 'Playoff Appearances',
                    data: sorted.map(t => t.appearances),
                    backgroundColor: 'rgba(118, 199, 192, 0.6)',
                    borderColor: 'rgba(118, 199, 192, 1)'
                },
                {
                    label: 'Championships',
                    data: sorted.map(t => t.championships),
                    backgroundColor: 'rgba(255, 193, 7, 0.6)',
                    borderColor: 'rgba(255, 193, 7, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Playoff Appearances and Championships' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count' } }
            }
        }
    });
    
    document.getElementById('playoff-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Appearances</th>
                    <th>Championships</th>
                    <th>Win %</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.appearances}</td>
                        <td>${team.championships}</td>
                        <td>${team.appearances > 0 ? ((team.championships / team.appearances * 100).toFixed(0) + '%') : '0%'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderPlayoffPerformance };

