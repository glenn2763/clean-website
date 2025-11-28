/**
 * Consistency Analysis Component
 * Shows teams ranked by score consistency (standard deviation)
 */

import { getTeamNameFromObject, calculateConsistency, getMatchups, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render consistency chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderConsistencyChart(allSeasonsData) {
    const canvas = document.getElementById('consistency-chart');
    if (!canvas) return;
    
    const teamConsistency = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = getMatchups(seasonData);
        const teams = getTeams(seasonData);
        
        if (teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamConsistency[team.id]) {
                teamConsistency[team.id] = { 
                    name: getTeamNameFromObject(team), 
                    scores: [] 
                };
            }
            
            matchups.forEach(matchup => {
                if (matchup.homeTeamId === team.id) {
                    teamConsistency[team.id].scores.push(matchup.homeScore || 0);
                } else if (matchup.awayTeamId === team.id) {
                    teamConsistency[team.id].scores.push(matchup.awayScore || 0);
                }
            });
        });
    });
    
    const consistencyData = Object.entries(teamConsistency).map(([id, info]) => ({
        id,
        name: info.name,
        stdDev: calculateConsistency(info.scores),
        avgScore: info.scores.length > 0 
            ? info.scores.reduce((a, b) => a + b, 0) / info.scores.length 
            : 0
    })).sort((a, b) => a.stdDev - b.stdDev);
    
    createChart('consistency', canvas, {
        type: 'bar',
        data: {
            labels: consistencyData.map(t => t.name),
            datasets: [{
                label: 'Standard Deviation (Lower = More Consistent)',
                data: consistencyData.map(t => t.stdDev),
                backgroundColor: 'rgba(118, 199, 192, 0.6)',
                borderColor: 'rgba(118, 199, 192, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Team Consistency (Score Standard Deviation)' },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Standard Deviation' } }
            }
        }
    });
    
    document.getElementById('consistency-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Avg Score</th>
                    <th>Std Dev</th>
                    <th>Consistency</th>
                </tr>
            </thead>
            <tbody>
                ${consistencyData.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.avgScore.toFixed(2)}</td>
                        <td>${team.stdDev.toFixed(2)}</td>
                        <td>${team.stdDev < 15 ? 'Very Consistent' : team.stdDev < 25 ? 'Consistent' : 'Volatile'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderConsistencyChart };

