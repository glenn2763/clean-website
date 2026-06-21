/**
 * Score Extremes Component
 * Shows how the league's highest weekly score has changed season over season
 */

import {
    buildOwnerMap,
    getActiveSeasons,
    getMatchups,
    getOwnerKey,
    getOwnerLabel,
    getTeamNameFromObject,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';

function getTeamInfo(teams, teamId, ownerMap) {
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) {
        return {
            teamId,
            manager: `Team ${teamId}`,
            teamName: `Team ${teamId}`,
        };
    }
    const ownerKey = getOwnerKey(team);
    return {
        teamId,
        manager: getOwnerLabel(ownerKey, ownerMap),
        teamName: getTeamNameFromObject(team),
    };
}

const STARTER_SLOT_ORDER = [
    { slot: 'QB', label: 'QB', count: 1 },
    { slot: 'RB', label: 'RB', count: 2 },
    { slot: 'WR', label: 'WR', count: 2 },
    { slot: 'TE', label: 'TE', count: 1 },
    { slot: 'RB/WR/TE', label: 'RB/WR/TE', count: 1 },
    { slot: 'D/ST', label: 'D/ST', count: 1 },
    { slot: 'K', label: 'K', count: 1 },
];

function organizeLineup(roster) {
    if (!Array.isArray(roster)) {
        return { starters: [], bench: [], starterTotal: 0 };
    }

    const players = roster
        .filter((entry) => entry?.fullName)
        .map((entry, index) => ({
            id: entry.id ?? `${entry.fullName}-${index}`,
            name: entry.fullName,
            slot: entry.rosteredPosition || entry.defaultPosition || '—',
            points: entry.totalPoints ?? 0,
        }));

    const used = new Set();
    const take = (slot) => {
        const player = players.find((entry) => entry.slot === slot && !used.has(entry.id));
        if (!player) return null;
        used.add(player.id);
        return player;
    };

    const starters = [];
    STARTER_SLOT_ORDER.forEach(({ slot, label, count }) => {
        for (let i = 0; i < count; i += 1) {
            const player = take(slot);
            if (player) {
                starters.push({ ...player, displaySlot: label });
            }
        }
    });

    const bench = players
        .filter((entry) => !used.has(entry.id))
        .map((entry) => ({ ...entry, displaySlot: entry.slot === 'Bench' ? 'Bench' : entry.slot }));

    const starterTotal = starters.reduce((sum, player) => sum + player.points, 0);

    return { starters, bench, starterTotal };
}

function parseRosterLineup(roster) {
    return organizeLineup(roster);
}

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

function renderLineupTable(lineup, teamScore) {
    const { starters, bench, starterTotal } = lineup || { starters: [], bench: [], starterTotal: 0 };

    if (!starters.length && !bench.length) {
        return '<p class="score-record-empty">Lineup not available for this matchup.</p>';
    }

    const total = teamScore ?? starterTotal;

    return `
        <table class="score-record-lineup">
            <thead>
                <tr>
                    <th>Slot</th>
                    <th>Player</th>
                    <th>Pts</th>
                </tr>
            </thead>
            <tbody>
                ${starters.map((player) => `
                    <tr>
                        <td>${player.displaySlot}</td>
                        <td>${player.name}</td>
                        <td>${player.points.toFixed(2)}</td>
                    </tr>
                `).join('')}
                <tr class="score-record-total-row">
                    <td colspan="2">Total</td>
                    <td>${total.toFixed(2)}</td>
                </tr>
                ${bench.length ? `
                    <tr class="score-record-bench-divider">
                        <td colspan="3">Bench</td>
                    </tr>
                    ${bench.map((player) => `
                        <tr class="score-record-bench-row">
                            <td>${player.displaySlot}</td>
                            <td>${player.name}</td>
                            <td>${player.points.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                ` : ''}
            </tbody>
        </table>
    `;
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
                borderColor: 'rgba(118, 199, 192, 1)',
                backgroundColor: 'rgba(118, 199, 192, 0.18)',
                pointBackgroundColor: 'rgba(118, 199, 192, 1)',
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
                intersect: false,
            },
            onHover(_event, elements) {
                if (elements[0]?.index != null) {
                    selectRecord(elements[0].index);
                }
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
