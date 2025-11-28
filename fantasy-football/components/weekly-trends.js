/**
 * Weekly Trends Component
 * Shows average points per week by team
 */

import { getTeamNameFromObject, getMatchups, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render weekly trends chart
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderWeeklyTrends(allSeasonsData) {
    const canvas = document.getElementById('weekly-trends-chart');
    if (!canvas) return;
    
    const teamWeeklyAverages = {};
    const weeks = new Set();
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = getMatchups(seasonData);
        const teams = getTeams(seasonData);
        
        if (!Array.isArray(matchups)) return;
        
        matchups.forEach(matchup => {
            const week = matchup.matchupPeriodId || 0;
            weeks.add(week);
            
            if (matchup.homeScore !== undefined && matchup.awayScore !== undefined) {
                // Process home team
                const homeTeam = teams.find(t => t.id === matchup.homeTeamId);
                const homeName = getTeamNameFromObject(homeTeam || { id: matchup.homeTeamId });
                if (!teamWeeklyAverages[homeName]) {
                    teamWeeklyAverages[homeName] = {};
                }
                if (!teamWeeklyAverages[homeName][week]) {
                    teamWeeklyAverages[homeName][week] = [];
                }
                teamWeeklyAverages[homeName][week].push(matchup.homeScore || 0);
                
                // Process away team
                const awayTeam = teams.find(t => t.id === matchup.awayTeamId);
                const awayName = getTeamNameFromObject(awayTeam || { id: matchup.awayTeamId });
                if (!teamWeeklyAverages[awayName]) {
                    teamWeeklyAverages[awayName] = {};
                }
                if (!teamWeeklyAverages[awayName][week]) {
                    teamWeeklyAverages[awayName][week] = [];
                }
                teamWeeklyAverages[awayName][week].push(matchup.awayScore || 0);
            }
        });
    });
    
    const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
    const teamNames = Object.keys(teamWeeklyAverages).slice(0, 8); // Limit to 8 teams for readability
    
    const datasets = teamNames.map((name, idx) => ({
        label: name,
        data: sortedWeeks.map(week => {
            const scores = teamWeeklyAverages[name][week] || [];
            return scores.length > 0 
                ? scores.reduce((a, b) => a + b, 0) / scores.length 
                : 0;
        }),
        borderColor: `hsl(${idx * 45}, 70%, 50%)`,
        backgroundColor: `hsla(${idx * 45}, 70%, 50%, 0.1)`,
        tension: 0.4
    }));
    
    createChart('weeklyTrends', canvas, {
        type: 'line',
        data: {
            labels: sortedWeeks.map(w => `Week ${w}`),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Average Points per Week by Team' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Points' } }
            }
        }
    });
}

export { renderWeeklyTrends };

