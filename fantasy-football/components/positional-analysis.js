/**
 * Positional Analysis Component
 * Shows best performers by position
 */

import { buildSeasonRosterPointsByTeam } from '../utils.js';

/**
 * Render positional analysis tables
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderPositionalAnalysis(allSeasonsData) {
    const container = document.getElementById('positional-tables');
    if (!container) return;

    const positionalStats = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DST: [],
    };

    const POSITION_BY_ID = {
        1: 'QB',
        2: 'RB',
        3: 'WR',
        4: 'TE',
        5: 'K',
        16: 'DST',
    };

    Object.values(allSeasonsData).forEach((seasonData) => {
        const playerInfo = seasonData?.kona_player_info?.players || [];
        const rosterByTeam = buildSeasonRosterPointsByTeam(seasonData);

        rosterByTeam.forEach((playerMap) => {
            playerMap.forEach(({ playerId, points }) => {
                const player = playerInfo.find((p) => p.id === playerId);
                if (!player) return;

                const posName = POSITION_BY_ID[player.defaultPositionId];
                if (!posName || !positionalStats[posName]) return;

                const existing = positionalStats[posName].find((p) => p.id === player.id);
                if (existing) {
                    existing.points += points;
                } else {
                    positionalStats[posName].push({
                        id: player.id,
                        name: player.fullName,
                        points,
                    });
                }
            });
        });
    });

    const groups = Object.entries(positionalStats)
        .map(([pos, players]) => {
            const sorted = players.sort((a, b) => b.points - a.points).slice(0, 5);
            if (sorted.length === 0) return '';

            return `
            <div class="position-group">
                <h4>Top ${pos}s</h4>
                <table class="positional-leaders-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((player) => `
                            <tr>
                                <td>${player.name}</td>
                                <td>${player.points.toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        })
        .filter(Boolean);

    container.innerHTML = groups.length
        ? `<div class="positional-leaders-grid">${groups.join('')}</div>`
        : '<p class="game-log-empty">No positional data available.</p>';
}

export { renderPositionalAnalysis };
