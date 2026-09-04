/**
 * Score Extremes Component
 * Shows how the league's highest weekly score has changed season over season
 */

import {
    buildOwnerMap,
    getActiveSeasons,
    getMatchups,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';
import { getTeamInfo, parseRosterLineup, renderLineupTable } from './boxscore.js';

function findSeasonHighScores(allSeasonsData, seasons) {
    const ownerMap = buildOwnerMap(allSeasonsData);

    return seasons.map((season) => {
        const data = allSeasonsData[season];
        const matchups = getMatchups(data);
        const teams = getTeams(data);
        const regularSeasonWeeks =
            data?.mSettings?.scheduleSettings?.numberOfRegularSeasonMatchups ?? 14;

        let best = null;

        matchups.forEach((matchup) => {
            const week = matchup.matchupPeriodId || 0;
            if (week < 1 || week > regularSeasonWeeks) return;

            [
                { side: 'home', teamId: matchup.homeTeamId, score: matchup.homeScore },
                { side: 'away', teamId: matchup.awayTeamId, score: matchup.awayScore },
            ].forEach(({ side, teamId, score }) => {
                if (score == null || score <= 0) return;
                if (best && score <= best.score) return;

                const opponentSide = side === 'home' ? 'away' : 'home';
                const highTeam = getTeamInfo(teams, teamId, ownerMap);
                const opponentTeam = getTeamInfo(teams, matchup[`${opponentSide}TeamId`], ownerMap);

                best = {
                    season,
                    score,
                    week,
                    highSide: side,
                    matchup,
                    highTeam,
                    opponentTeam,
                    opponentScore: matchup[`${opponentSide}Score`] ?? 0,
                    lineup: parseRosterLineup(matchup[`${side}Roster`]),
                    opponentLineup: parseRosterLineup(matchup[`${opponentSide}Roster`]),
                };
            });
        });

        return best;
    }).filter(Boolean);
}

function updateRecordDetail(detailEl, record) {
    if (!detailEl || !record) return;

    detailEl.innerHTML = `
        <p class="score-record-summary">
            <strong>${record.season} · Week ${record.week}</strong> —
            ${record.highTeam.manager} scored ${record.score.toFixed(2)} pts
            vs ${record.opponentTeam.manager} (${record.opponentScore.toFixed(2)} pts)
        </p>
        <div class="score-record-boxscore">
            <div class="score-record-team-block">
                <h4>${record.highTeam.manager} <span class="score-record-team-score">${record.score.toFixed(2)}</span></h4>
                <p class="score-record-team-name">${record.highTeam.teamName}</p>
                ${renderLineupTable(record.lineup, record.score)}
            </div>
            <div class="score-record-team-block">
                <h4>${record.opponentTeam.manager} <span class="score-record-team-score">${record.opponentScore.toFixed(2)}</span></h4>
                <p class="score-record-team-name">${record.opponentTeam.teamName}</p>
                ${renderLineupTable(record.opponentLineup, record.opponentScore)}
            </div>
        </div>
    `;
}

/**
 * Render highest-score-by-season chart
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderScoreExtremesChart(allSeasonsData) {
    const canvas = document.getElementById('score-extremes-chart');
    const detailEl = document.getElementById('score-records-detail');
    if (!canvas) return;

    const seasons = getActiveSeasons(allSeasonsData);
    const records = findSeasonHighScores(allSeasonsData, seasons);

    if (!records.length) {
        if (detailEl) detailEl.textContent = 'No scored matchups available yet.';
        return;
    }

    const labels = records.map((record) => record.season);
    const scores = records.map((record) => record.score);

    let selectedIndex = records.length - 1;

    const selectRecord = (index) => {
        if (index == null || index < 0 || index >= records.length) return;
        selectedIndex = index;
        updateRecordDetail(detailEl, records[selectedIndex]);
    };

    createChart('scoreExtremes', canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Highest Weekly Score',
                data: scores,
                borderColor: 'rgba(10, 122, 106, 1)',
                backgroundColor: 'rgba(10, 122, 106, 0.18)',
                pointBackgroundColor: 'rgba(10, 122, 106, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 7,
                pointHoverRadius: 10,
                borderWidth: 2.5,
                fill: true,
                tension: 0.25,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true,
            },
            onClick(_event, elements) {
                if (elements[0]?.index != null) {
                    selectRecord(elements[0].index);
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Regular-Season Scoring Ceiling by Year',
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const record = records[items[0]?.index];
                            return record ? `${record.season} · Week ${record.week}` : '';
                        },
                        label(context) {
                            const record = records[context.dataIndex];
                            if (!record) return '';
                            return [
                                `${record.highTeam.manager}: ${record.score.toFixed(2)} pts`,
                                `vs ${record.opponentTeam.manager}: ${record.opponentScore.toFixed(2)} pts`,
                            ];
                        },
                    },
                },
            },
            scales: {
                x: {
                    title: { display: true, text: 'Season' },
                    grid: { display: false },
                },
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Highest Regular-Season Weekly Score (pts)' },
                    ticks: {
                        callback(value) {
                            return Number(value).toFixed(0);
                        },
                    },
                },
            },
        },
    });

    selectRecord(selectedIndex);
}

export { renderScoreExtremesChart };
