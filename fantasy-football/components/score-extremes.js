/**
 * Score Extremes Component
 * Shows league-wide scoring records and extremes
 */

import { getMatchups } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render score extremes chart
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderScoreExtremesChart(allSeasonsData) {
    const canvas = document.getElementById('score-extremes-chart');
    if (!canvas) return;
    
    const seasons = Object.keys(allSeasonsData).sort();
    const maxScores = [];
    const minScores = [];
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = getMatchups(data);
        
        if (!Array.isArray(matchups) || matchups.length === 0) return;
        
        let max = 0;
        let min = Infinity;
        
        matchups.forEach(matchup => {
            const scores = [matchup.homeScore, matchup.awayScore].filter(s => s !== undefined);
            scores.forEach(score => {
                if (score > max) max = score;
                if (score < min && score > 0) min = score;
            });
        });
        
        maxScores.push(max);
        minScores.push(min === Infinity ? 0 : min);
    });
    
    createChart('scoreExtremes', canvas, {
        type: 'bar',
        data: {
            labels: seasons,
            datasets: [
                {
                    label: 'Max Score',
                    data: maxScores,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)'
                },
                {
                    label: 'Min Score',
                    data: minScores,
                    backgroundColor: 'rgba(244, 67, 54, 0.6)',
                    borderColor: 'rgba(244, 67, 54, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'League Max and Min Scores by Season' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Points' } }
            }
        }
    });
}

export { renderScoreExtremesChart };

