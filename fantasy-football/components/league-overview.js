/**
 * League Overview Component
 * Playoff bracket path and standings for teams outside the final four
 */

import {
    analyzeSeasonPlayoffs,
    getMatchups,
    getOwnerDisplayName,
    getTeamNameFromObject,
    getTeams,
} from '../utils.js';

/**
 * @param {Object} entry
 * @param {Object[]} teams
 * @param {number} rank
 */
function formatStandingsRow(entry, teams, rank) {
    const team = teams.find((t) => t.id === entry.teamId);
    const record = entry.overallWinLossTie || { wins: 0, losses: 0, ties: 0 };
    const teamName = team ? getTeamNameFromObject(team) : `Team ${entry.teamId}`;
    const managerName = team ? getOwnerDisplayName(team) : teamName;
    return {
        rank,
        teamId: entry.teamId,
        teamName,
        managerName,
        record: `${record.wins}-${record.losses}-${record.ties}`,
        pointsFor: entry.overallPointsFor?.toFixed(2) || '0.00',
        pointsAgainst: entry.overallPointsAgainst?.toFixed(2) || '0.00',
    };
}

function renderManagerLine(row, className) {
    if (row.managerName === row.teamName) return '';
    return `<span class="${className}">${row.managerName}</span>`;
}

function getMatchupWinnerId(matchup) {
    if (matchup?.homeScore == null || matchup?.awayScore == null) return null;
    if (matchup.winner === 'HOME') return matchup.homeTeamId;
    if (matchup.winner === 'AWAY') return matchup.awayTeamId;
    if (matchup.homeScore > matchup.awayScore) return matchup.homeTeamId;
    if (matchup.awayScore > matchup.homeScore) return matchup.awayTeamId;
    return null;
}

function isCompletedMatchup(matchup) {
    return (
        matchup?.homeScore != null &&
        matchup?.awayScore != null &&
        matchup?.homeTeamId != null &&
        matchup?.awayTeamId != null
    );
}

function buildWinnersBracketRounds(matchups, config, seedTeamIds) {
    const firstWeek = config.regularSeasonWeeks + 1;
    const lastWeek = config.regularSeasonWeeks + config.playoffWeekCount;
    let bracketTeams = new Set(seedTeamIds);
    const rounds = [];

    for (let week = firstWeek; week <= lastWeek; week += 1) {
        let games = matchups.filter(
            (matchup) =>
                matchup.matchupPeriodId === week &&
                matchup.playoffTierType === 'WINNERS_BRACKET' &&
                isCompletedMatchup(matchup)
        );

        if (!games.length) {
            games = matchups.filter(
                (matchup) =>
                    matchup.matchupPeriodId === week &&
                    isCompletedMatchup(matchup) &&
                    bracketTeams.has(matchup.homeTeamId) &&
                    bracketTeams.has(matchup.awayTeamId)
            );
        }

        if (!games.length) continue;

        rounds.push({ week, games });
        const roundWinners = new Set();
        games.forEach((matchup) => {
            const winnerId = getMatchupWinnerId(matchup);
            if (winnerId != null) roundWinners.add(winnerId);
        });
        if (roundWinners.size) bracketTeams = roundWinners;
    }

    return rounds;
}

function getSeedNumber(teamId, seedTeamIds) {
    const index = seedTeamIds.indexOf(teamId);
    return index >= 0 ? index + 1 : null;
}

function buildTeamNode(teamId, teams, seedTeamIds) {
    const team = teams.find((entry) => entry.id === teamId);
    const teamName = team ? getTeamNameFromObject(team) : `Team ${teamId}`;
    const managerName = team ? getOwnerDisplayName(team) : teamName;
    return {
        teamId,
        seed: getSeedNumber(teamId, seedTeamIds),
        teamName,
        managerName,
    };
}

function formatBracketMatchup(matchup, teams, seedTeamIds) {
    const winnerId = getMatchupWinnerId(matchup);
    return {
        week: matchup.matchupPeriodId,
        home: buildTeamNode(matchup.homeTeamId, teams, seedTeamIds),
        away: buildTeamNode(matchup.awayTeamId, teams, seedTeamIds),
        homeScore: matchup.homeScore,
        awayScore: matchup.awayScore,
        winnerId,
        complete: winnerId != null,
    };
}

function buildProjectedSemis(finalFourIds, teams, seedTeamIds) {
    if (finalFourIds.length < 4) return [];

    const ordered = [...finalFourIds].sort(
        (a, b) => seedTeamIds.indexOf(a) - seedTeamIds.indexOf(b)
    );

    return [
        {
            week: null,
            home: buildTeamNode(ordered[0], teams, seedTeamIds),
            away: buildTeamNode(ordered[3], teams, seedTeamIds),
            homeScore: null,
            awayScore: null,
            winnerId: null,
            complete: false,
            projected: true,
        },
        {
            week: null,
            home: buildTeamNode(ordered[1], teams, seedTeamIds),
            away: buildTeamNode(ordered[2], teams, seedTeamIds),
            homeScore: null,
            awayScore: null,
            winnerId: null,
            complete: false,
            projected: true,
        },
    ];
}

function buildProjectedFinal(semiWinners, teams, seedTeamIds) {
    if (semiWinners.length < 2) return null;

    const ordered = [...semiWinners].sort(
        (a, b) => seedTeamIds.indexOf(a) - seedTeamIds.indexOf(b)
    );

    return {
        week: null,
        home: buildTeamNode(ordered[0], teams, seedTeamIds),
        away: buildTeamNode(ordered[1], teams, seedTeamIds),
        homeScore: null,
        awayScore: null,
        winnerId: null,
        complete: false,
        projected: true,
    };
}

function buildPlayoffView(seasonData, rows) {
    const matchups = getMatchups(seasonData);
    const teams = getTeams(seasonData);
    const analysis = analyzeSeasonPlayoffs(seasonData);

    if (!analysis?.seedTeamIds?.length) return null;

    const { config, seedTeamIds, championTeamId } = analysis;
    const finalFourIds = seedTeamIds.slice(0, 4);
    const rounds = buildWinnersBracketRounds(matchups, config, seedTeamIds);

    let semis = [];
    let finalMatch = null;
    let semiWeek = null;
    let finalWeek = null;

    if (rounds.length >= 2) {
        semis = rounds[rounds.length - 2].games.map((game) =>
            formatBracketMatchup(game, teams, seedTeamIds)
        );
        semiWeek = rounds[rounds.length - 2].week;
        finalWeek = rounds[rounds.length - 1].week;
        if (rounds[rounds.length - 1].games[0]) {
            finalMatch = formatBracketMatchup(rounds[rounds.length - 1].games[0], teams, seedTeamIds);
        }
    } else if (rounds.length === 1) {
        if (rounds[0].games.length >= 2) {
            semis = rounds[0].games.map((game) =>
                formatBracketMatchup(game, teams, seedTeamIds)
            );
            semiWeek = rounds[0].week;
        } else if (rounds[0].games.length === 1) {
            finalMatch = formatBracketMatchup(rounds[0].games[0], teams, seedTeamIds);
            finalWeek = rounds[0].week;
        }
    }

    if (!semis.length && finalFourIds.length >= 4) {
        semis = buildProjectedSemis(finalFourIds, teams, seedTeamIds);
    }

    if (!finalMatch && semis.length >= 2 && semis.every((game) => game.complete)) {
        const semiWinners = semis.map((game) => game.winnerId).filter(Boolean);
        finalMatch = buildProjectedFinal(semiWinners, teams, seedTeamIds);
    }

    const podium = [];
    if (championTeamId != null && finalMatch?.complete) {
        const runnerUpId = championTeamId === finalMatch.home.teamId
            ? finalMatch.away.teamId
            : finalMatch.home.teamId;

        let thirdId = null;
        if (semis.length >= 2) {
            const semiLosers = semis
                .map((game) => {
                    if (!game.complete) return null;
                    return game.winnerId === game.home.teamId ? game.away.teamId : game.home.teamId;
                })
                .filter(Boolean);
            thirdId = semiLosers.sort(
                (a, b) => seedTeamIds.indexOf(a) - seedTeamIds.indexOf(b)
            )[0];
        }

        [
            { place: 1, teamId: championTeamId },
            { place: 2, teamId: runnerUpId },
            { place: 3, teamId: thirdId },
        ].forEach(({ place, teamId }) => {
            if (teamId == null) return;
            const row = rows.find((entry) => entry.teamId === teamId);
            const node = buildTeamNode(teamId, teams, seedTeamIds);
            podium.push({
                place,
                ...node,
                record: row?.record || '—',
                pointsFor: row?.pointsFor || '—',
            });
        });
    }

    return {
        semis,
        finalMatch,
        podium,
        semiWeek,
        finalWeek,
    };
}

function renderBracketTeam(team, score, { winner = false, loser = false } = {}) {
    const classes = ['bracket-team'];
    if (winner) classes.push('bracket-team-winner');
    if (loser) classes.push('bracket-team-loser');

    return `
        <div class="${classes.join(' ')}">
            ${team.seed ? `<span class="bracket-seed">#${team.seed}</span>` : ''}
            <div class="bracket-team-text">
                <span class="bracket-team-name">${team.teamName}</span>
                ${team.managerName !== team.teamName
                    ? `<span class="bracket-team-manager">${team.managerName}</span>`
                    : ''}
            </div>
            <span class="bracket-team-score">${score == null ? '—' : Number(score).toFixed(2)}</span>
        </div>
    `;
}

function renderBracketMatchup(matchup) {
    const homeWinner = matchup.winnerId === matchup.home.teamId;
    const awayWinner = matchup.winnerId === matchup.away.teamId;
    const hasResult = matchup.complete;

    return `
        <div class="bracket-matchup${matchup.projected ? ' bracket-matchup-projected' : ''}">
            ${renderBracketTeam(matchup.home, matchup.homeScore, {
                winner: hasResult && homeWinner,
                loser: hasResult && awayWinner,
            })}
            ${renderBracketTeam(matchup.away, matchup.awayScore, {
                winner: hasResult && awayWinner,
                loser: hasResult && homeWinner,
            })}
        </div>
    `;
}

function renderPodiumSpot(entry, place) {
    const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : '3rd';
    const label = entry.managerName !== entry.teamName
        ? `${placeLabel} place: ${entry.teamName}, ${entry.managerName}`
        : `${placeLabel} place: ${entry.teamName}`;

    return `
        <div class="podium-spot podium-spot-${place}" aria-label="${label}">
            <div class="podium-spot-card">
                <span class="podium-spot-rank">${place}</span>
                <span class="podium-spot-name">${entry.teamName}</span>
                ${entry.managerName !== entry.teamName
                    ? `<span class="podium-spot-manager">${entry.managerName}</span>`
                    : ''}
                <span class="podium-spot-record">${entry.record}</span>
                <span class="podium-spot-points">${entry.pointsFor} PF</span>
            </div>
            <div class="podium-block" aria-hidden="true">
                <span class="podium-block-label">${placeLabel}</span>
            </div>
        </div>
    `;
}

function renderCompactPodium(podium) {
    if (!podium.length) {
        return `
            <aside class="standings-podium-side" aria-label="Playoff results">
                <h4 class="standings-podium-side-title">Podium</h4>
                <p class="standings-podium-side-empty">Championship still in progress</p>
            </aside>
        `;
    }

    const byPlace = Object.fromEntries(podium.map((entry) => [entry.place, entry]));
    const order = [2, 1, 3].filter((place) => byPlace[place]);

    return `
        <aside class="standings-podium-side" aria-label="Playoff podium">
            <h4 class="standings-podium-side-title">Podium</h4>
            <div class="standings-podium-side-stage" role="list">
                ${order.map((place) => renderPodiumSpot(byPlace[place], place)).join('')}
            </div>
        </aside>
    `;
}

function renderPlayoffBracket(playoffView) {
    const semiLabel = playoffView.semiWeek ? `Semifinals · Week ${playoffView.semiWeek}` : 'Semifinals';
    const finalLabel = playoffView.finalWeek ? `Championship · Week ${playoffView.finalWeek}` : 'Championship';

    return `
        <div class="standings-bracket-layout">
            <div class="playoff-bracket" aria-label="Playoff bracket">
                <div class="bracket-round bracket-round-semis">
                    <h4 class="bracket-round-title">${semiLabel}</h4>
                    <div class="bracket-round-matchups">
                        ${playoffView.semis.map((matchup) => renderBracketMatchup(matchup)).join('')}
                    </div>
                </div>
                <div class="bracket-connector" aria-hidden="true"></div>
                <div class="bracket-round bracket-round-final">
                    <h4 class="bracket-round-title">${finalLabel}</h4>
                    <div class="bracket-round-matchups">
                        ${playoffView.finalMatch
                            ? renderBracketMatchup(playoffView.finalMatch)
                            : '<p class="standings-podium-side-empty">Final matchup TBD</p>'}
                    </div>
                </div>
            </div>
            ${renderCompactPodium(playoffView.podium)}
        </div>
    `;
}

function renderRestTable(rest) {
    if (!rest.length) return '';

    return `
        <div class="standings-rest">
            <h3 class="standings-rest-title">Rest of Standings</h3>
            <table class="standings-rest-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>W-L-T</th>
                        <th>PF</th>
                        <th>PA</th>
                    </tr>
                </thead>
                <tbody>
                    ${rest.map((row) => `
                        <tr>
                            <td>${row.rank}</td>
                            <td class="standings-team-cell">
                                <span class="standings-team-name">${row.teamName}</span>
                                ${renderManagerLine(row, 'standings-team-manager')}
                            </td>
                            <td>${row.record}</td>
                            <td>${row.pointsFor}</td>
                            <td>${row.pointsAgainst}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render league standings with playoff bracket
 * @param {Object} data - Single season data
 */
function renderLeagueOverview(data) {
    const container = document.getElementById('league-overview');
    if (!container) return;

    const standings = data?.mStandings;
    const teams = data?.mTeam || [];

    if (!standings?.entries?.length) {
        container.innerHTML = '<p>Standings data not available.</p>';
        return;
    }

    const rows = standings.entries.map((entry, idx) =>
        formatStandingsRow(entry, teams, idx + 1)
    );

    const playoffView = buildPlayoffView(data, rows);
    const rest = rows.slice(4);

    container.innerHTML = `
        ${playoffView ? renderPlayoffBracket(playoffView) : ''}
        ${renderRestTable(rest)}
    `;
}

export { renderLeagueOverview };
