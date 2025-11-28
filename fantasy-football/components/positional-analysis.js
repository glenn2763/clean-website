/**
 * Positional Analysis Component
 * Shows best performers by position
 */

/**
 * Render positional analysis tables
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderPositionalAnalysis(allSeasonsData) {
    const container = document.getElementById('positional-tables');
    const positionalStats = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DST: []
    };
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const rosters = seasonData?.mRoster?.rosters || [];
        const playerInfo = seasonData?.kona_player_info?.players || [];
        
        if (!Array.isArray(rosters)) return;
        
        rosters.forEach(roster => {
            roster.entries?.forEach(entry => {
                const player = playerInfo.find(p => p.id === entry.playerId);
                if (player) {
                    const position = player.defaultPositionId;
                    const posName = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'][position - 1] || 'UNK';
                    if (positionalStats[posName]) {
                        const existing = positionalStats[posName].find(p => p.id === player.id);
                        if (existing) {
                            existing.points += entry.playerPoolEntry?.appliedStatTotal || 0;
                        } else {
                            positionalStats[posName].push({
                                id: player.id,
                                name: player.fullName,
                                points: entry.playerPoolEntry?.appliedStatTotal || 0
                            });
                        }
                    }
                }
            });
        });
    });
    
    container.innerHTML = Object.entries(positionalStats).map(([pos, players]) => {
        const sorted = players.sort((a, b) => b.points - a.points).slice(0, 5);
        if (sorted.length === 0) return '';
        
        return `
            <div class="position-group">
                <h4>Top ${pos}s</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Total Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(player => `
                            <tr>
                                <td>${player.name}</td>
                                <td>${player.points.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');
}

export { renderPositionalAnalysis };

