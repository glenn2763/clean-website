/**
 * Unlucky Players Component
 * Shows teams that consistently face the highest-scoring opponents
 */

import { getTeamNameFromObject, calculatePointsAgainst, getMatchups, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render unlucky players chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderUnluckyPlayersChart(allSeasonsData) {
    const canvas = document.getElementById('points-against-chart');
    if (!canvas) return;
    
    // Check if we have any data
    const hasData = Object.values(allSeasonsData).some(data => 
        data?.mMatchup?.schedule && data?.mTeam
    );
    if (!hasData) {
        document.getElementById('unlucky-table').innerHTML = 
            '<p>Matchup data not available for this analysis.</p>';
        return;
    }
    
    const teamPA = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = getMatchups(data);
        const teams = getTeams(data);
        
        if (teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamPA[team.id]) {
                teamPA[team.id] = { name: getTeamNameFromObject(team), data: {} };
            }
            const pa = calculatePointsAgainst(team.id, matchups, teams);
            teamPA[team.id].data[season] = pa;
        });
    });
    
    // Get top 5 unluckiest teams (highest average PA)
    const avgPA = Object.entries(teamPA).map(([id, info]) => {
        const values = Object.values(info.data);
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return { id, ...info, avg };
    }).sort((a, b) => b.avg - a.avg).slice(0, 5);
    
    const labels = seasons;
    const datasets = avgPA.map((team, idx) => ({
        label: team.name,
        data: labels.map(season => team.data[season] || 0),
        borderColor: `hsl(${idx * 60}, 70%, 50%)`,
        backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`,
        tension: 0.4
    }));
    
    createChart('pointsAgainst', canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Points Against by Year (Top 5 Unluckiest)' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Points Against' } }
            }
        }
    });
    
    // Render table
    const tableContainer = document.getElementById('unlucky-table');
    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    ${seasons.map(s => `<th>${s}</th>`).join('')}
                    <th>Average</th>
                </tr>
            </thead>
            <tbody>
                ${avgPA.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        ${seasons.map(season => `<td>${(team.data[season] || 0).toFixed(2)}</td>`).join('')}
                        <td><strong>${team.avg.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderUnluckyPlayersChart };

