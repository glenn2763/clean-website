/**
 * Projected vs Actual Component
 * Shows teams that scored significantly more or less than projected
 */

import { getTeamNameFromObject, calculateAverage, getMatchups, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render projected vs actual chart and tables
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderProjectedVsActualChart(allSeasonsData) {
    const canvas = document.getElementById('projected-vs-actual-chart');
    if (!canvas) return;
    
    const teamStats = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = getMatchups(data);
        const teams = getTeams(data);
        
        if (teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamStats[team.id]) {
                teamStats[team.id] = { name: getTeamNameFromObject(team), actual: [], projected: [] };
            }
            
            matchups.forEach(matchup => {
                if (matchup.homeTeamId === team.id) {
                    teamStats[team.id].actual.push(matchup.homeScore || 0);
                    teamStats[team.id].projected.push(matchup.homeProjectedScore || 0);
                } else if (matchup.awayTeamId === team.id) {
                    teamStats[team.id].actual.push(matchup.awayScore || 0);
                    teamStats[team.id].projected.push(matchup.awayProjectedScore || 0);
                }
            });
        });
    });
    
    const underachievers = [];
    const overachievers = [];
    
    Object.entries(teamStats).forEach(([id, stats]) => {
        const avgActual = calculateAverage(stats.actual);
        const avgProjected = calculateAverage(stats.projected);
        const diff = avgActual - avgProjected;
        
        if (diff < -5) {
            underachievers.push({ name: stats.name, actual: avgActual, projected: avgProjected, diff });
        } else if (diff > 5) {
            overachievers.push({ name: stats.name, actual: avgActual, projected: avgProjected, diff });
        }
    });
    
    underachievers.sort((a, b) => a.diff - b.diff);
    overachievers.sort((a, b) => b.diff - a.diff);
    
    // Scatter plot data
    const scatterData = [];
    Object.values(teamStats).forEach(stats => {
        const avgActual = calculateAverage(stats.actual);
        const avgProjected = calculateAverage(stats.projected);
        scatterData.push({ x: avgProjected, y: avgActual });
    });
    
    createChart('projectedVsActual', canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Teams',
                data: scatterData,
                backgroundColor: 'rgba(118, 199, 192, 0.6)',
                borderColor: 'rgba(118, 199, 192, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Actual vs Projected Points' },
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: 'Projected Points' }, beginAtZero: true },
                y: { title: { display: true, text: 'Actual Points' }, beginAtZero: true }
            }
        }
    });
    
    // Render tables
    document.getElementById('underachievers-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Actual</th>
                    <th>Projected</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                ${underachievers.slice(0, 5).map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.actual.toFixed(2)}</td>
                        <td>${team.projected.toFixed(2)}</td>
                        <td><strong>${team.diff.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('overachievers-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Actual</th>
                    <th>Projected</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                ${overachievers.slice(0, 5).map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.actual.toFixed(2)}</td>
                        <td>${team.projected.toFixed(2)}</td>
                        <td><strong>+${team.diff.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderProjectedVsActualChart };

