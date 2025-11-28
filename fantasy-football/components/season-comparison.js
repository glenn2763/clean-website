/**
 * Season Comparison Component
 * Shows team performance across multiple seasons
 */

import { getTeamNameFromObject, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render season comparison chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderSeasonComparison(allSeasonsData) {
    const canvas = document.getElementById('season-comparison-chart');
    if (!canvas) return;
    
    const teamSeasons = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const standings = data?.mStandings;
        const teams = getTeams(data);
        
        if (!standings || !Array.isArray(standings.entries)) return;
        
        standings.entries.forEach(entry => {
            const team = teams.find(t => t.id === entry.teamId);
            if (team) {
                const name = getTeamNameFromObject(team);
                if (!teamSeasons[name]) {
                    teamSeasons[name] = {};
                }
                teamSeasons[name][season] = {
                    wins: entry.overallWinLossTie?.wins || 0,
                    losses: entry.overallWinLossTie?.losses || 0,
                    pointsFor: entry.overallPointsFor || 0
                };
            }
        });
    });
    
    const teamList = Object.keys(teamSeasons).slice(0, 8);
    
    createChart('seasonComparison', canvas, {
        type: 'line',
        data: {
            labels: seasons,
            datasets: teamList.map((name, idx) => ({
                label: name,
                data: seasons.map(season => teamSeasons[name][season]?.wins || 0),
                borderColor: `hsl(${idx * 45}, 70%, 50%)`,
                backgroundColor: `hsla(${idx * 45}, 70%, 50%, 0.1)`,
                tension: 0.4
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Wins by Season' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Wins' } }
            }
        }
    });
    
    document.getElementById('season-comparison-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    ${seasons.map(s => `<th>${s} W-L</th>`).join('')}
                    <th>Total Wins</th>
                </tr>
            </thead>
            <tbody>
                ${teamList.map(name => {
                    const totalWins = seasons.reduce((sum, season) => 
                        sum + (teamSeasons[name][season]?.wins || 0), 0);
                    return `
                        <tr>
                            <td>${name}</td>
                            ${seasons.map(season => {
                                const record = teamSeasons[name][season];
                                return `<td>${record ? `${record.wins}-${record.losses}` : '-'}</td>`;
                            }).join('')}
                            <td><strong>${totalWins}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

export { renderSeasonComparison };

