/**
 * Shared box score rendering for matchup lineups
 */

import { getOwnerKey, getOwnerLabel, getTeamNameFromObject } from '../utils.js';

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

/**
 * Render side-by-side team box scores (winner or primary team on the left).
 * @param {{ manager: string, teamName: string, score: number, lineup: Object }} leftTeam
 * @param {{ manager: string, teamName: string, score: number, lineup: Object }} rightTeam
 * @returns {string}
 */
function renderTwoTeamBoxscore(leftTeam, rightTeam) {
    return `
        <div class="score-record-boxscore">
            <div class="score-record-team-block">
                <h4>${leftTeam.manager} <span class="score-record-team-score">${leftTeam.score.toFixed(2)}</span></h4>
                <p class="score-record-team-name">${leftTeam.teamName}</p>
                ${renderLineupTable(leftTeam.lineup, leftTeam.score)}
            </div>
            <div class="score-record-team-block">
                <h4>${rightTeam.manager} <span class="score-record-team-score">${rightTeam.score.toFixed(2)}</span></h4>
                <p class="score-record-team-name">${rightTeam.teamName}</p>
                ${renderLineupTable(rightTeam.lineup, rightTeam.score)}
            </div>
        </div>
    `;
}

export {
    getTeamInfo,
    parseRosterLineup,
    renderLineupTable,
    renderTwoTeamBoxscore,
};
