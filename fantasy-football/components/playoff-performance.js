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
    getSeasonChampionshipGame,
    getTeamNameFromObject,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';
import { getTeamInfo, parseRosterLineup, renderTwoTeamBoxscore } from './boxscore.js';

function getMatchupWinnerTeamId(matchup) {
    if (matchup?.homeScore == null || matchup?.awayScore == null) return null;
    if (matchup.winner === 'HOME') return matchup.homeTeamId;
    if (matchup.winner === 'AWAY') return matchup.awayTeamId;
    if (matchup.homeScore > matchup.awayScore) return matchup.homeTeamId;
    if (matchup.awayScore > matchup.homeScore) return matchup.awayTeamId;
    return null;
}

function formatTeamLabel(team, ownerMap) {
    if (!team) return 'Unknown';
    const owner = getOwnerLabel(getOwnerKey(team), ownerMap);
    const teamName = getTeamNameFromObject(team);
    return owner && owner !== teamName ? `${owner} (${teamName})` : teamName;
}

function renderChampionshipGames(allSeasonsData, ownerMap) {
    const listEl = document.getElementById('playoff-championships');
    if (!listEl) return;

    const games = getActiveSeasons(allSeasonsData)
        .map((season) => {
            const seasonData = allSeasonsData[season];
            const matchup = getSeasonChampionshipGame(seasonData);
            if (!matchup) return null;

            const teams = getTeams(seasonData);
            const winnerId = getMatchupWinnerTeamId(matchup);
            if (winnerId == null) return null;

            const loserId = winnerId === matchup.homeTeamId ? matchup.awayTeamId : matchup.homeTeamId;
            const winnerTeam = teams.find((team) => team.id === winnerId);
            const loserTeam = teams.find((team) => team.id === loserId);
            const winnerScore = winnerId === matchup.homeTeamId ? matchup.homeScore : matchup.awayScore;
            const loserScore = winnerId === matchup.homeTeamId ? matchup.awayScore : matchup.homeScore;
            const margin = Math.abs(winnerScore - loserScore);

            const winnerSide = winnerId === matchup.homeTeamId ? 'home' : 'away';
            const loserSide = winnerSide === 'home' ? 'away' : 'home';
            const winnerInfo = getTeamInfo(teams, winnerId, ownerMap);
            const loserInfo = getTeamInfo(teams, loserId, ownerMap);

            return {
                season,
                week: matchup.matchupPeriodId || null,
                winner: formatTeamLabel(winnerTeam, ownerMap),
                loser: formatTeamLabel(loserTeam, ownerMap),
                winnerScore,
                loserScore,
                margin,
                boxscore: renderTwoTeamBoxscore(
                    {
                        manager: winnerInfo.manager,
                        teamName: winnerInfo.teamName,
                        score: winnerScore,
                        lineup: parseRosterLineup(matchup[`${winnerSide}Roster`]),
                    },
                    {
                        manager: loserInfo.manager,
                        teamName: loserInfo.teamName,
                        score: loserScore,
                        lineup: parseRosterLineup(matchup[`${loserSide}Roster`]),
                    }
                ),
            };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.season) - Number(a.season));

    if (!games.length) {
        listEl.innerHTML = '<p class="subsection-description">No completed championship games found.</p>';
        return;
    }

    listEl.innerHTML = `
        <h3 class="championship-games-heading">Championship Games</h3>
        <div class="championship-games-list">
            ${games.map((game) => `
                <details class="championship-game-details">
                    <summary class="championship-game-summary">
                        <span class="championship-game-season">${game.season}${game.week ? ` · Week ${game.week}` : ''}</span>
                        <span class="championship-game-result">
                            <strong>${game.winner}</strong> def. ${game.loser}
                            · ${game.winnerScore.toFixed(2)}–${game.loserScore.toFixed(2)}
                            (${game.margin.toFixed(2)} pt margin)
                        </span>
                    </summary>
                    <div class="championship-game-boxscore">
                        ${game.boxscore}
                    </div>
                </details>
            `).join('')}
        </div>
    `;
}

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
                    backgroundColor: 'rgba(10, 122, 106, 0.65)',
                    borderColor: 'rgba(10, 122, 106, 1)',
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

    renderChampionshipGames(allSeasonsData, ownerMap);
}

export { renderPlayoffPerformance };
