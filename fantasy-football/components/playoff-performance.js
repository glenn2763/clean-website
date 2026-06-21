/**
 * Playoff Performance Component
 * Shows championship-bracket berths and titles across seasons
 */

import {
    analyzeSeasonPlayoffs,
    buildOwnerMap,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render playoff performance chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderPlayoffPerformance(allSeasonsData) {
    const canvas = document.getElementById('playoff-chart');
    const tableEl = document.getElementById('playoff-table');
    if (!canvas || !tableEl) return;

    const ownerMap = buildOwnerMap(allSeasonsData);
    const playoffStats = {};

    Object.entries(allSeasonsData).forEach(([season, seasonData]) => {
        if (!getActiveSeasons({ [season]: seasonData }).length) return;

        const analysis = analyzeSeasonPlayoffs(seasonData);
        if (!analysis) return;

        const teams = getTeams(seasonData);
        const { seedTeamIds, championTeamId } = analysis;

        seedTeamIds.forEach((teamId) => {
            const team = teams.find((entry) => entry.id === teamId);
            if (!team) return;

            const ownerKey = getOwnerKey(team);
            if (!playoffStats[ownerKey]) {
                playoffStats[ownerKey] = { appearances: 0, championships: 0 };
            }
            playoffStats[ownerKey].appearances += 1;
        });

        if (championTeamId != null) {
            const championTeam = teams.find((entry) => entry.id === championTeamId);
            if (championTeam) {
                const ownerKey = getOwnerKey(championTeam);
                if (!playoffStats[ownerKey]) {
                    playoffStats[ownerKey] = { appearances: 0, championships: 0 };
                }
                playoffStats[ownerKey].championships += 1;
            }
        }
    });

    Object.keys(ownerMap).forEach((ownerKey) => {
        if (!playoffStats[ownerKey]) {
            playoffStats[ownerKey] = { appearances: 0, championships: 0 };
        }
    });

    const sorted = Object.entries(playoffStats)
        .map(([ownerKey, stats]) => ({
            name: getOwnerLabel(ownerKey, ownerMap),
            ...stats,
        }))
        .sort((a, b) => b.championships - a.championships || b.appearances - a.appearances || a.name.localeCompare(b.name));

    createChart('playoff', canvas, {
        type: 'bar',
        data: {
            labels: sorted.map((team) => team.name),
            datasets: [
                {
                    label: 'Championship Bracket Berths',
                    data: sorted.map((team) => team.appearances),
                    backgroundColor: 'rgba(118, 199, 192, 0.6)',
                    borderColor: 'rgba(118, 199, 192, 1)',
                },
                {
                    label: 'Championships',
                    data: sorted.map((team) => team.championships),
                    backgroundColor: 'rgba(255, 193, 7, 0.6)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Championship Bracket Berths and Titles',
                },
                legend: { position: 'top' },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: 'Seasons' },
                },
            },
        },
    });

    tableEl.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Manager</th>
                    <th>Berths</th>
                    <th>Championships</th>
                    <th>Title Rate</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((team) => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.appearances}</td>
                        <td>${team.championships}</td>
                        <td>${team.appearances > 0 ? `${((team.championships / team.appearances) * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderPlayoffPerformance };
