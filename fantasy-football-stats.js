// ESPN Fantasy Football API Client and Data Processing

// Use environment-specific backend URL
// For local development: use relative path
// For production: use deployed backend URL
const PROXY_BASE_URL = window.BACKEND_URL || '/api/espn';

// Chart instances storage
const charts = {};

/**
 * Fetch data from ESPN API (via proxy if needed)
 */
async function fetchESPNData(leagueId, season, view = '') {
    const cacheKey = `${leagueId}-${season}-${view}`;
    
    // Check localStorage cache (skip for large data views)
    const largeViews = ['mMatchup', 'mSchedule', 'mRoster', 'kona_player_info'];
    const skipCache = largeViews.includes(view);
    
    if (!skipCache) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.warn('Failed to parse cached data', e);
            }
        }
    }

    const url = view 
        ? `${PROXY_BASE_URL}/league/${leagueId}/${season}/${view}`
        : `${PROXY_BASE_URL}/league/${leagueId}/${season}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Cache the data (skip for large views to avoid quota issues)
        if (!skipCache) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(data));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.warn(`Cache quota exceeded for ${cacheKey}, skipping cache`);
                    // Clear old cache entries if quota exceeded
                    try {
                        const keys = Object.keys(localStorage);
                        // Remove oldest entries (assuming they start with leagueId)
                        for (let i = 0; i < Math.min(10, keys.length); i++) {
                            if (keys[i].startsWith(`${leagueId}-`)) {
                                localStorage.removeItem(keys[i]);
                            }
                        }
                    } catch (clearError) {
                        console.warn('Failed to clear old cache entries', clearError);
                    }
                } else {
                    throw e;
                }
            }
        }
        return data;
    } catch (error) {
        console.error(`Error fetching ${view || 'league'} data:`, error);
        throw error;
    }
}

/**
 * Fetch all views for a league/season
 */
async function fetchAllLeagueData(leagueId, season) {
    const views = [
        'mSettings',
        'mRoster',
        'mMatchup',
        'mSchedule',
        'mStandings',
        'mScoreboard',
        'mTeam',
        'mDraftDetail',
        'mTransactions',
        'kona_player_info'
    ];

    const data = {};
    
    for (const view of views) {
        try {
            data[view] = await fetchESPNData(leagueId, season, view);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.warn(`Failed to fetch ${view}:`, error);
            data[view] = null;
        }
    }

    return data;
}

/**
 * Fetch data for multiple seasons
 */
async function fetchAllSeasons(leagueId, seasons) {
    const allData = {};
    
    for (const season of seasons) {
        allData[season] = await fetchAllLeagueData(leagueId, season);
    }
    
    return allData;
}

/**
 * Get team name by ID
 */
function getTeamName(teamId, teams) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return `Team ${teamId}`;
    // npm package uses 'name' property directly, not location/nickname
    return team.name || team.abbreviation || `Team ${teamId}`;
}

/**
 * Get team name from team object (handles npm package structure)
 */
function getTeamNameFromObject(team) {
    if (!team) return 'Unknown Team';
    return team.name || team.abbreviation || `Team ${team.id}`;
}

/**
 * Get team total points (handles npm package structure)
 */
function getTeamTotalPoints(team) {
    if (!team) return 0;
    return team.totalPointsScored || team.regularSeasonPointsFor || team.totalPoints || 0;
}

/**
 * Calculate points against for a team
 */
function calculatePointsAgainst(teamId, matchups, teams) {
    let totalPA = 0;
    let games = 0;
    
    matchups.forEach(matchup => {
        // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
        if (matchup.homeTeamId === teamId) {
            totalPA += matchup.awayScore || 0;
            games++;
        } else if (matchup.awayTeamId === teamId) {
            totalPA += matchup.homeScore || 0;
            games++;
        }
    });
    
    return games > 0 ? totalPA / games : 0;
}

/**
 * Calculate consistency (standard deviation) of scores
 */
function calculateConsistency(scores) {
    if (scores.length === 0) return 0;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
}

/**
 * Render League Overview
 */
function renderLeagueOverview(data) {
    const settings = data?.mSettings;
    const standings = data?.mStandings;
    const teams = data?.mTeam || [];
    
    if (!settings || !standings) {
        document.getElementById('league-overview').innerHTML = 
            '<p>League overview data not available.</p>';
        return;
    }
    
    const container = document.getElementById('league-overview');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-value">${settings.name || 'Unknown League'}</span>
                <span class="stat-label">League Name</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${teams.length}</span>
                <span class="stat-label">Teams</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${settings.scoringSettings?.scoringItems?.length || 'N/A'}</span>
                <span class="stat-label">Scoring Rules</span>
            </div>
        </div>
        <h3>Current Standings</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>W-L-T</th>
                    <th>Points For</th>
                    <th>Points Against</th>
                </tr>
            </thead>
            <tbody>
                ${(standings.entries || []).slice(0, 10).map((entry, idx) => {
                    const team = teams.find(t => t.id === entry.teamId);
                    const record = entry.overallWinLossTie || { wins: 0, losses: 0, ties: 0 };
                    const teamName = team ? (team.name || team.abbreviation || `Team ${entry.teamId}`) : `Team ${entry.teamId}`;
                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${teamName}</td>
                            <td>${record.wins}-${record.losses}-${record.ties}</td>
                            <td>${entry.overallPointsFor?.toFixed(2) || '0.00'}</td>
                            <td>${entry.overallPointsAgainst?.toFixed(2) || '0.00'}</td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="5">No standings data available</td></tr>'}
            </tbody>
        </table>
    `;
}

/**
 * Render Most Unlucky Players Chart
 */
function renderUnluckyPlayersChart(allSeasonsData) {
    const canvas = document.getElementById('points-against-chart');
    if (!canvas) return;
    
    // Check if we have any data
    const hasData = Object.values(allSeasonsData).some(data => 
        data?.mMatchup?.schedule && data?.mTeam
    );
    if (!hasData) {
        document.getElementById('unlucky-table').innerHTML = 
            '<p>Matchup data not available for this analysis.</p>';
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (charts.pointsAgainst) {
        charts.pointsAgainst.destroy();
    }
    
    const teamPA = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = data?.mMatchup?.schedule || [];
        const teams = Array.isArray(data?.mTeam) ? data.mTeam : [];
        
        if (!Array.isArray(teams) || teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamPA[team.id]) {
                teamPA[team.id] = { name: getTeamNameFromObject(team), data: {} };
            }
            const pa = calculatePointsAgainst(team.id, matchups, teams);
            teamPA[team.id].data[season] = pa;
        });
    });
    
    // Get top 5 unluckiest teams (highest average PA)
    const avgPA = Object.entries(teamPA).map(([id, info]) => {
        const values = Object.values(info.data);
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return { id, ...info, avg };
    }).sort((a, b) => b.avg - a.avg).slice(0, 5);
    
    const labels = seasons;
    const datasets = avgPA.map((team, idx) => ({
        label: team.name,
        data: labels.map(season => team.data[season] || 0),
        borderColor: `hsl(${idx * 60}, 70%, 50%)`,
        backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`,
        tension: 0.4
    }));
    
    charts.pointsAgainst = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Points Against by Year (Top 5 Unluckiest)' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Points Against' } }
            }
        }
    });
    
    // Render table
    const tableContainer = document.getElementById('unlucky-table');
    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    ${seasons.map(s => `<th>${s}</th>`).join('')}
                    <th>Average</th>
                </tr>
            </thead>
            <tbody>
                ${avgPA.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        ${seasons.map(season => `<td>${(team.data[season] || 0).toFixed(2)}</td>`).join('')}
                        <td><strong>${team.avg.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Render Projected vs Actual Chart
 */
function renderProjectedVsActualChart(allSeasonsData) {
    const canvas = document.getElementById('projected-vs-actual-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.projectedVsActual) {
        charts.projectedVsActual.destroy();
    }
    
    const teamStats = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = data?.mMatchup?.schedule || [];
        const teams = Array.isArray(data?.mTeam) ? data.mTeam : [];
        
        if (!Array.isArray(teams) || teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamStats[team.id]) {
                teamStats[team.id] = { name: getTeamNameFromObject(team), actual: [], projected: [] };
            }
            
            matchups.forEach(matchup => {
                // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
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
        const avgActual = stats.actual.length > 0 
            ? stats.actual.reduce((a, b) => a + b, 0) / stats.actual.length 
            : 0;
        const avgProjected = stats.projected.length > 0
            ? stats.projected.reduce((a, b) => a + b, 0) / stats.projected.length
            : 0;
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
        const avgActual = stats.actual.length > 0 
            ? stats.actual.reduce((a, b) => a + b, 0) / stats.actual.length 
            : 0;
        const avgProjected = stats.projected.length > 0
            ? stats.projected.reduce((a, b) => a + b, 0) / stats.projected.length
            : 0;
        scatterData.push({ x: avgProjected, y: avgActual });
    });
    
    charts.projectedVsActual = new Chart(ctx, {
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

/**
 * Render Score Extremes Chart
 */
function renderScoreExtremesChart(allSeasonsData) {
    const canvas = document.getElementById('score-extremes-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.scoreExtremes) {
        charts.scoreExtremes.destroy();
    }
    
    const seasons = Object.keys(allSeasonsData).sort();
    const maxScores = [];
    const minScores = [];
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const matchups = data?.mMatchup?.schedule || [];
        
        if (!Array.isArray(matchups) || matchups.length === 0) return;
        
        let max = 0;
        let min = Infinity;
        
        matchups.forEach(matchup => {
            // Boxscore structure: homeScore, awayScore
            const scores = [matchup.homeScore, matchup.awayScore].filter(s => s !== undefined);
            scores.forEach(score => {
                if (score > max) max = score;
                if (score < min && score > 0) min = score;
            });
        });
        
        maxScores.push(max);
        minScores.push(min === Infinity ? 0 : min);
    });
    
    charts.scoreExtremes = new Chart(ctx, {
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

/**
 * Render Consistency Chart
 */
function renderConsistencyChart(allSeasonsData) {
    const canvas = document.getElementById('consistency-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.consistency) {
        charts.consistency.destroy();
    }
    
    const teamConsistency = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = seasonData?.mMatchup?.schedule || [];
        const teams = Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
        
        if (!Array.isArray(teams) || teams.length === 0) return;
        
        teams.forEach(team => {
            if (!teamConsistency[team.id]) {
                teamConsistency[team.id] = { 
                    name: getTeamNameFromObject(team), 
                    scores: [] 
                };
            }
            
            matchups.forEach(matchup => {
                // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
                if (matchup.homeTeamId === team.id) {
                    teamConsistency[team.id].scores.push(matchup.homeScore || 0);
                } else if (matchup.awayTeamId === team.id) {
                    teamConsistency[team.id].scores.push(matchup.awayScore || 0);
                }
            });
        });
    });
    
    const consistencyData = Object.entries(teamConsistency).map(([id, info]) => ({
        id,
        name: info.name,
        stdDev: calculateConsistency(info.scores),
        avgScore: info.scores.length > 0 
            ? info.scores.reduce((a, b) => a + b, 0) / info.scores.length 
            : 0
    })).sort((a, b) => a.stdDev - b.stdDev);
    
    charts.consistency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: consistencyData.map(t => t.name),
            datasets: [{
                label: 'Standard Deviation (Lower = More Consistent)',
                data: consistencyData.map(t => t.stdDev),
                backgroundColor: 'rgba(118, 199, 192, 0.6)',
                borderColor: 'rgba(118, 199, 192, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Team Consistency (Score Standard Deviation)' },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Standard Deviation' } }
            }
        }
    });
    
    document.getElementById('consistency-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Avg Score</th>
                    <th>Std Dev</th>
                    <th>Consistency</th>
                </tr>
            </thead>
            <tbody>
                ${consistencyData.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.avgScore.toFixed(2)}</td>
                        <td>${team.stdDev.toFixed(2)}</td>
                        <td>${team.stdDev < 15 ? 'Very Consistent' : team.stdDev < 25 ? 'Consistent' : 'Volatile'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Render Head-to-Head Matrix
 */
function renderH2HMatrix(allSeasonsData) {
    const container = document.getElementById('h2h-matrix');
    const teams = new Set();
    const h2hRecords = {};
    
    // Collect all teams
    Object.values(allSeasonsData).forEach(seasonData => {
        (seasonData.mTeam || []).forEach(team => {
            teams.add(JSON.stringify({ id: team.id, name: getTeamNameFromObject(team) }));
        });
    });
    
    const teamList = Array.from(teams).map(t => JSON.parse(t));
    
    // Initialize records
    teamList.forEach(team => {
        h2hRecords[team.id] = {};
        teamList.forEach(opponent => {
            if (team.id !== opponent.id) {
                h2hRecords[team.id][opponent.id] = { wins: 0, losses: 0 };
            }
        });
    });
    
    // Calculate records
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = seasonData?.mMatchup?.schedule || [];
        if (!Array.isArray(matchups)) return;
        matchups.forEach(matchup => {
            // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
            if (matchup.homeScore !== undefined && matchup.awayScore !== undefined) {
                const winner = matchup.homeScore > matchup.awayScore ? matchup.homeTeamId : matchup.awayTeamId;
                const loser = winner === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId;
                
                if (h2hRecords[winner] && h2hRecords[winner][loser]) {
                    h2hRecords[winner][loser].wins++;
                    h2hRecords[loser][winner].losses++;
                }
            }
        });
    });
    
    container.innerHTML = `
        <div class="h2h-matrix">
            <table>
                <thead>
                    <tr>
                        <th>Team</th>
                        ${teamList.map(team => `<th>${team.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${teamList.map(team => `
                        <tr>
                            <th>${team.name}</th>
                            ${teamList.map(opponent => {
                                if (team.id === opponent.id) {
                                    return '<td>-</td>';
                                }
                                const record = h2hRecords[team.id]?.[opponent.id] || { wins: 0, losses: 0 };
                                const total = record.wins + record.losses;
                                if (total === 0) return '<td>-</td>';
                                const winPct = (record.wins / total * 100).toFixed(0);
                                return `<td class="${record.wins > record.losses ? 'win' : 'loss'}">${record.wins}-${record.losses} (${winPct}%)</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render Playoff Performance
 */
function renderPlayoffPerformance(allSeasonsData) {
    const canvas = document.getElementById('playoff-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.playoff) {
        charts.playoff.destroy();
    }
    
    const playoffStats = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const settings = seasonData.mSettings;
        const standings = seasonData.mStandings;
        const teams = seasonData.mTeam || [];
        
        if (!settings || !standings) return;
        
        const playoffTeams = standings.entries
            ?.sort((a, b) => (b.overallWinLossTie?.wins || 0) - (a.overallWinLossTie?.wins || 0))
            .slice(0, settings.scheduleSettings?.playoffTeamCount || 4) || [];
        
        playoffTeams.forEach((entry, idx) => {
            const team = teams.find(t => t.id === entry.teamId);
            if (team) {
                const name = getTeamNameFromObject(team);
                if (!playoffStats[name]) {
                    playoffStats[name] = { appearances: 0, championships: 0 };
                }
                playoffStats[name].appearances++;
                if (idx === 0) {
                    playoffStats[name].championships++;
                }
            }
        });
    });
    
    const sorted = Object.entries(playoffStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.appearances - a.appearances);
    
    charts.playoff = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(t => t.name),
            datasets: [
                {
                    label: 'Playoff Appearances',
                    data: sorted.map(t => t.appearances),
                    backgroundColor: 'rgba(118, 199, 192, 0.6)',
                    borderColor: 'rgba(118, 199, 192, 1)'
                },
                {
                    label: 'Championships',
                    data: sorted.map(t => t.championships),
                    backgroundColor: 'rgba(255, 193, 7, 0.6)',
                    borderColor: 'rgba(255, 193, 7, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Playoff Appearances and Championships' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count' } }
            }
        }
    });
    
    document.getElementById('playoff-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Appearances</th>
                    <th>Championships</th>
                    <th>Win %</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.appearances}</td>
                        <td>${team.championships}</td>
                        <td>${team.appearances > 0 ? ((team.championships / team.appearances * 100).toFixed(0) + '%') : '0%'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Render Transaction Analysis
 */
function renderTransactionAnalysis(allSeasonsData) {
    const canvas = document.getElementById('transactions-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.transactions) {
        charts.transactions.destroy();
    }
    
    const transactionCounts = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const transactions = seasonData?.mTransactions?.transactions || [];
        const teams = Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
        
        if (!Array.isArray(transactions)) return;
        transactions.forEach(transaction => {
            const teamId = transaction.teamId;
            const team = teams.find(t => t.id === teamId);
            if (team) {
                const name = getTeamNameFromObject(team);
                if (!transactionCounts[name]) {
                    transactionCounts[name] = { waivers: 0, trades: 0, drops: 0 };
                }
                
                if (transaction.type === 'WAIVER') transactionCounts[name].waivers++;
                else if (transaction.type === 'TRADE') transactionCounts[name].trades++;
                else if (transaction.type === 'DROP') transactionCounts[name].drops++;
            }
        });
    });
    
    const sorted = Object.entries(transactionCounts)
        .map(([name, counts]) => ({ 
            name, 
            total: counts.waivers + counts.trades + counts.drops,
            ...counts 
        }))
        .sort((a, b) => b.total - a.total);
    
    charts.transactions = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(t => t.name),
            datasets: [
                {
                    label: 'Waivers',
                    data: sorted.map(t => t.waivers),
                    backgroundColor: 'rgba(33, 150, 243, 0.6)',
                    borderColor: 'rgba(33, 150, 243, 1)'
                },
                {
                    label: 'Trades',
                    data: sorted.map(t => t.trades),
                    backgroundColor: 'rgba(156, 39, 176, 0.6)',
                    borderColor: 'rgba(156, 39, 176, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Transaction Activity by Team' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count' } }
            }
        }
    });
    
    document.getElementById('transactions-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Waivers</th>
                    <th>Trades</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.waivers}</td>
                        <td>${team.trades}</td>
                        <td><strong>${team.total}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Render Positional Analysis
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

/**
 * Render Weekly Trends
 */
function renderWeeklyTrends(allSeasonsData) {
    const canvas = document.getElementById('weekly-trends-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.weeklyTrends) {
        charts.weeklyTrends.destroy();
    }
    
    const teamWeeklyAverages = {};
    const weeks = new Set();
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const matchups = seasonData?.mMatchup?.schedule || [];
        const teams = Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
        
        if (!Array.isArray(matchups)) return;
        matchups.forEach(matchup => {
            const week = matchup.matchupPeriodId || 0;
            weeks.add(week);
            
            // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
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
    
    charts.weeklyTrends = new Chart(ctx, {
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

/**
 * Render Matchup Analysis
 */
function renderMatchupAnalysis(allSeasonsData) {
    const container = document.getElementById('matchup-analysis');
    const matchups = [];
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const schedule = seasonData?.mMatchup?.schedule || [];
        const teams = Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
        
        if (!Array.isArray(schedule)) return;
        schedule.forEach(matchup => {
            // Boxscore structure: homeScore, awayScore, homeTeamId, awayTeamId
            if (matchup.homeScore !== undefined && matchup.awayScore !== undefined) {
                const margin = Math.abs(matchup.homeScore - matchup.awayScore);
                const winnerId = matchup.homeScore > matchup.awayScore ? matchup.homeTeamId : matchup.awayTeamId;
                const loserId = winnerId === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId;
                const winnerScore = matchup.homeScore > matchup.awayScore ? matchup.homeScore : matchup.awayScore;
                const loserScore = matchup.homeScore > matchup.awayScore ? matchup.awayScore : matchup.homeScore;
                
                const winnerTeam = teams.find(t => t.id === winnerId);
                const loserTeam = teams.find(t => t.id === loserId);
                
                matchups.push({
                    week: matchup.matchupPeriodId || 0,
                    winner: getTeamNameFromObject(winnerTeam || { id: winnerId }),
                    loser: getTeamNameFromObject(loserTeam || { id: loserId }),
                    winnerScore,
                    loserScore,
                    margin
                });
            }
        });
    });
    
    const closest = matchups.sort((a, b) => a.margin - b.margin).slice(0, 10);
    const blowouts = matchups.sort((a, b) => b.margin - a.margin).slice(0, 10);
    
    container.innerHTML = `
        <div class="tables-grid">
            <div>
                <h3>Closest Games</h3>
                ${closest.map(m => `
                    <div class="matchup-item">
                        <div class="matchup-header">Week ${m.week}: ${m.winner} vs ${m.loser}</div>
                        <div class="matchup-details">
                            ${m.winner}: ${m.winnerScore.toFixed(2)} | ${m.loser}: ${m.loserScore.toFixed(2)}<br>
                            Margin: ${m.margin.toFixed(2)} points
                        </div>
                    </div>
                `).join('')}
            </div>
            <div>
                <h3>Biggest Blowouts</h3>
                ${blowouts.map(m => `
                    <div class="matchup-item">
                        <div class="matchup-header">Week ${m.week}: ${m.winner} vs ${m.loser}</div>
                        <div class="matchup-details">
                            ${m.winner}: ${m.winnerScore.toFixed(2)} | ${m.loser}: ${m.loserScore.toFixed(2)}<br>
                            Margin: ${m.margin.toFixed(2)} points
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render Season Comparison
 */
function renderSeasonComparison(allSeasonsData) {
    const canvas = document.getElementById('season-comparison-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.seasonComparison) {
        charts.seasonComparison.destroy();
    }
    
    const teamSeasons = {};
    const seasons = Object.keys(allSeasonsData).sort();
    
    seasons.forEach(season => {
        const data = allSeasonsData[season];
        const standings = data?.mStandings;
        const teams = Array.isArray(data?.mTeam) ? data.mTeam : [];
        
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
    
    charts.seasonComparison = new Chart(ctx, {
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

/**
 * Render all visualizations
 */
function renderAllVisualizations(allSeasonsData) {
    renderLeagueOverview(Object.values(allSeasonsData)[0] || {});
    renderUnluckyPlayersChart(allSeasonsData);
    renderProjectedVsActualChart(allSeasonsData);
    renderScoreExtremesChart(allSeasonsData);
    renderConsistencyChart(allSeasonsData);
    renderH2HMatrix(allSeasonsData);
    renderPlayoffPerformance(allSeasonsData);
    renderTransactionAnalysis(allSeasonsData);
    renderPositionalAnalysis(allSeasonsData);
    renderWeeklyTrends(allSeasonsData);
    renderMatchupAnalysis(allSeasonsData);
    renderSeasonComparison(allSeasonsData);
}

/**
 * Clear localStorage cache
 */
function clearCache() {
    try {
        const keys = Object.keys(localStorage);
        let cleared = 0;
        keys.forEach(key => {
            if (key.match(/^\d+-\d{4}-/)) { // Match pattern: leagueId-year-view
                localStorage.removeItem(key);
                cleared++;
            }
        });
        console.log(`Cleared ${cleared} cache entries`);
        return cleared;
    } catch (e) {
        console.error('Failed to clear cache:', e);
        return 0;
    }
}

/**
 * Main initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const fetchAllBtn = document.getElementById('fetch-all-seasons-btn');
    const leagueIdInput = document.getElementById('league-id');
    const seasonSelect = document.getElementById('season-select');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('content');
    
    // Clear old cache on load if localStorage is getting full
    try {
        const testKey = '__cache_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old cache...');
            clearCache();
        }
    }
    
    async function fetchData(allSeasons = false) {
        const leagueId = leagueIdInput.value.trim();
        if (!leagueId) {
            errorEl.textContent = 'Please enter a league ID';
            errorEl.classList.remove('hidden');
            return;
        }
        
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        
        try {
            let allSeasonsData;
            
            if (allSeasons) {
                const seasons = ['2021', '2022', '2023', '2024'];
                allSeasonsData = await fetchAllSeasons(leagueId, seasons);
            } else {
                const season = seasonSelect.value;
                const data = await fetchAllLeagueData(leagueId, season);
                allSeasonsData = { [season]: data };
            }
            
            renderAllVisualizations(allSeasonsData);
            
            contentEl.classList.remove('hidden');
        } catch (error) {
            errorEl.textContent = `Error: ${error.message}. Make sure the server is running and the league ID is correct.`;
            errorEl.classList.remove('hidden');
        } finally {
            loadingEl.classList.add('hidden');
        }
    }
    
    fetchBtn.addEventListener('click', () => fetchData(false));
    fetchAllBtn.addEventListener('click', () => fetchData(true));
    
    // Clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            const cleared = clearCache();
            alert(`Cleared ${cleared} cached entries.`);
        });
    }
    
    // Allow Enter key to trigger fetch
    leagueIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchData(false);
        }
    });
});
