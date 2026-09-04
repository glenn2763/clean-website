/**
 * League Snapshot — fun all-time highlights for the Pulse hub
 */

import {
    analyzeSeasonPlayoffs,
    buildOwnerMap,
    calculateAverage,
    calculateConsistency,
    getActiveSeasons,
    getMatchups,
    getOwnerKey,
    getOwnerLabel,
    getTeams,
} from '../utils.js';
import { getTeamInfo } from './boxscore.js';

function formatPoints(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatScore(value) {
    return Number(value).toFixed(2);
}

function ensureH2HPair(h2h, ownerA, ownerB) {
    if (!h2h[ownerA]) h2h[ownerA] = {};
    if (!h2h[ownerA][ownerB]) {
        h2h[ownerA][ownerB] = { wins: 0, losses: 0, ties: 0 };
    }
}

function updateH2H(h2h, homeKey, awayKey, homeScore, awayScore) {
    if (homeKey === awayKey) return;

    ensureH2HPair(h2h, homeKey, awayKey);
    ensureH2HPair(h2h, awayKey, homeKey);

    if (homeScore > awayScore) {
        h2h[homeKey][awayKey].wins += 1;
        h2h[awayKey][homeKey].losses += 1;
    } else if (awayScore > homeScore) {
        h2h[awayKey][homeKey].wins += 1;
        h2h[homeKey][awayKey].losses += 1;
    } else {
        h2h[homeKey][awayKey].ties += 1;
        h2h[awayKey][homeKey].ties += 1;
    }
}

function findNemesis(h2h, ownerMap) {
    const MIN_GAMES = 3;
    let worst = null;

    Object.entries(h2h).forEach(([ownerKey, opponents]) => {
        Object.entries(opponents).forEach(([opponentKey, record]) => {
            const games = record.wins + record.losses + record.ties;
            if (games < MIN_GAMES) return;

            const winPct = record.wins / games;
            if (worst == null || winPct < worst.winPct || (winPct === worst.winPct && games > worst.games)) {
                worst = {
                    ownerKey,
                    opponentKey,
                    owner: getOwnerLabel(ownerKey, ownerMap),
                    opponent: getOwnerLabel(opponentKey, ownerMap),
                    wins: record.wins,
                    losses: record.losses,
                    ties: record.ties,
                    games,
                    winPct,
                };
            }
        });
    });

    if (!worst) return null;

    const recordLabel = worst.ties > 0
        ? `${worst.wins}-${worst.losses}-${worst.ties}`
        : `${worst.wins}-${worst.losses}`;

    return { ...worst, recordLabel };
}

function findPaperChampion(careerPoints, championships, ownerMap) {
    let best = null;

    Object.entries(careerPoints).forEach(([ownerKey, points]) => {
        if ((championships[ownerKey] || 0) > 0) return;
        if (!best || points > best.points || (points === best.points && ownerKey.localeCompare(best.ownerKey) < 0)) {
            best = { ownerKey, points };
        }
    });

    if (!best || best.points <= 0) return null;
    return {
        name: getOwnerLabel(best.ownerKey, ownerMap),
        points: best.points,
    };
}

function findSnakeBitten(playoffBerths, championships, ownerMap) {
    let worst = null;

    Object.entries(playoffBerths).forEach(([ownerKey, berths]) => {
        if ((championships[ownerKey] || 0) > 0 || berths <= 0) return;
        if (!worst || berths > worst.berths) {
            worst = { ownerKey, berths };
        }
    });

    if (!worst) return null;
    return {
        name: getOwnerLabel(worst.ownerKey, ownerMap),
        berths: worst.berths,
    };
}

function findSteadyEddie(weeklyScoresByOwner, ownerMap) {
    let best = null;

    Object.entries(weeklyScoresByOwner).forEach(([ownerKey, scores]) => {
        if (scores.length < 4) return;
        const stdDev = calculateConsistency(scores);
        if (!best || stdDev < best.stdDev) {
            best = { ownerKey, stdDev, games: scores.length };
        }
    });

    if (!best) return null;
    return {
        name: getOwnerLabel(best.ownerKey, ownerMap),
        stdDev: best.stdDev,
        games: best.games,
    };
}

function findClutch(closeGamesByOwner, ownerMap) {
    const MIN_CLOSE_GAMES = 4;
    let best = null;

    Object.entries(closeGamesByOwner).forEach(([ownerKey, record]) => {
        if (record.total < MIN_CLOSE_GAMES) return;
        const winPct = record.wins / record.total;
        if (!best || winPct > best.winPct) {
            best = { ownerKey, winPct, wins: record.wins, total: record.total };
        }
    });

    if (!best) return null;
    return {
        name: getOwnerLabel(best.ownerKey, ownerMap),
        winPct: best.winPct,
        wins: best.wins,
        total: best.total,
    };
}

function findBeatTheBook(projectionDiffByOwner, ownerMap) {
    let best = null;

    Object.entries(projectionDiffByOwner).forEach(([ownerKey, diffs]) => {
        if (diffs.length < 4) return;
        const avg = calculateAverage(diffs);
        if (!best || avg > best.avg) {
            best = { ownerKey, avg, weeks: diffs.length };
        }
    });

    if (!best || best.avg <= 0) return null;
    return {
        name: getOwnerLabel(best.ownerKey, ownerMap),
        avg: best.avg,
        weeks: best.weeks,
    };
}

function findUnlucky(careerPointsAgainst, ownerMap) {
    const entry = Object.entries(careerPointsAgainst)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

    if (!entry || entry[1] <= 0) return null;
    return {
        name: getOwnerLabel(entry[0], ownerMap),
        points: entry[1],
    };
}

function getBenchPoints(roster) {
    if (!Array.isArray(roster)) return 0;

    return roster.reduce((sum, entry) => {
        const slot = entry?.rosteredPosition;
        if (slot === 'Bench' || slot === 'IR') {
            return sum + (entry.totalPoints || 0);
        }
        return sum;
    }, 0);
}

function recordCloseGame(closeGamesByOwner, ownerKey, won) {
    if (!closeGamesByOwner[ownerKey]) {
        closeGamesByOwner[ownerKey] = { wins: 0, total: 0 };
    }
    closeGamesByOwner[ownerKey].total += 1;
    if (won) closeGamesByOwner[ownerKey].wins += 1;
}

function recordProjectionDiff(projectionDiffByOwner, ownerKey, actual, projected) {
    if (projected == null || actual == null) return;
    if (!projectionDiffByOwner[ownerKey]) projectionDiffByOwner[ownerKey] = [];
    projectionDiffByOwner[ownerKey].push(actual - projected);
}

function findBoomOrBust(weeklyScoresByOwner, ownerMap) {
    let best = null;

    Object.entries(weeklyScoresByOwner).forEach(([ownerKey, scores]) => {
        if (scores.length < 4) return;
        const stdDev = calculateConsistency(scores);
        if (!best || stdDev > best.stdDev) {
            best = { ownerKey, stdDev, games: scores.length };
        }
    });

    if (!best) return null;
    return {
        name: getOwnerLabel(best.ownerKey, ownerMap),
        stdDev: best.stdDev,
        games: best.games,
    };
}

function buildMatchupGame(season, matchup, teams, ownerMap) {
    const homeScore = matchup.homeScore;
    const awayScore = matchup.awayScore;
    const home = getTeamInfo(teams, matchup.homeTeamId, ownerMap);
    const away = getTeamInfo(teams, matchup.awayTeamId, ownerMap);
    const homeWon = homeScore > awayScore;

    return {
        season,
        week: matchup.matchupPeriodId || 0,
        margin: Math.abs(homeScore - awayScore),
        winner: homeWon ? home : away,
        loser: homeWon ? away : home,
        winnerScore: homeWon ? homeScore : awayScore,
        loserScore: homeWon ? awayScore : homeScore,
    };
}

function buildLeagueSnapshot(allSeasonsData) {
    const seasons = getActiveSeasons(allSeasonsData);
    const ownerMap = buildOwnerMap(allSeasonsData);

    let totalGames = 0;
    let totalPoints = 0;
    const championships = {};
    const playoffBerths = {};
    const careerPoints = {};
    const careerPointsAgainst = {};
    const weeklyScoresByOwner = {};
    const closeGamesByOwner = {};
    const projectionDiffByOwner = {};
    const h2h = {};

    let ceiling = null;
    let floor = null;
    let blowout = null;
    let badBeat = null;
    let shootout = null;
    let benchBlunder = null;

    seasons.forEach((season) => {
        const data = allSeasonsData[season];
        const teams = getTeams(data);
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const matchups = getMatchups(data);

        const analysis = analyzeSeasonPlayoffs(data);
        if (analysis?.championTeamId != null) {
            const champion = teams.find((team) => team.id === analysis.championTeamId);
            if (champion) {
                const ownerKey = getOwnerKey(champion);
                championships[ownerKey] = (championships[ownerKey] || 0) + 1;
            }
        }

        (analysis?.seedTeamIds || []).forEach((teamId) => {
            const team = teamById.get(teamId);
            if (!team) return;
            const ownerKey = getOwnerKey(team);
            playoffBerths[ownerKey] = (playoffBerths[ownerKey] || 0) + 1;
        });

        (data?.mStandings?.entries || []).forEach((entry) => {
            const team = teamById.get(entry.teamId);
            if (!team) return;
            const ownerKey = getOwnerKey(team);
            careerPoints[ownerKey] = (careerPoints[ownerKey] || 0) + (entry.overallPointsFor || 0);
            careerPointsAgainst[ownerKey] = (careerPointsAgainst[ownerKey] || 0) + (entry.overallPointsAgainst || 0);
        });

        matchups.forEach((matchup) => {
            if (matchup.homeScore == null || matchup.awayScore == null) return;

            totalGames += 1;
            totalPoints += matchup.homeScore + matchup.awayScore;

            const week = matchup.matchupPeriodId || 0;
            const homeTeam = teamById.get(matchup.homeTeamId);
            const awayTeam = teamById.get(matchup.awayTeamId);
            const homeInfo = getTeamInfo(teams, matchup.homeTeamId, ownerMap);
            const awayInfo = getTeamInfo(teams, matchup.awayTeamId, ownerMap);
            const combinedScore = matchup.homeScore + matchup.awayScore;

            if (!shootout || combinedScore > shootout.combined) {
                shootout = {
                    combined: combinedScore,
                    season,
                    week,
                    home: homeInfo,
                    away: awayInfo,
                    homeScore: matchup.homeScore,
                    awayScore: matchup.awayScore,
                };
            }

            [
                {
                    teamId: matchup.homeTeamId,
                    score: matchup.homeScore,
                    projected: matchup.homeProjectedScore,
                    roster: matchup.homeRoster,
                    teamInfo: homeInfo,
                    won: matchup.homeScore > matchup.awayScore,
                    oppScore: matchup.awayScore,
                },
                {
                    teamId: matchup.awayTeamId,
                    score: matchup.awayScore,
                    projected: matchup.awayProjectedScore,
                    roster: matchup.awayRoster,
                    teamInfo: awayInfo,
                    won: matchup.awayScore > matchup.homeScore,
                    oppScore: matchup.homeScore,
                },
            ].forEach(({ teamId, score, projected, roster, teamInfo, won, oppScore }) => {
                if (!ceiling || score > ceiling.score) {
                    ceiling = { season, week, score, team: teamInfo };
                }
                if (!floor || score < floor.score) {
                    floor = { season, week, score, team: teamInfo };
                }

                const team = teamById.get(teamId);
                if (team) {
                    const sideOwnerKey = getOwnerKey(team);
                    if (!weeklyScoresByOwner[sideOwnerKey]) weeklyScoresByOwner[sideOwnerKey] = [];
                    weeklyScoresByOwner[sideOwnerKey].push(score);
                    recordProjectionDiff(projectionDiffByOwner, sideOwnerKey, score, projected);
                }

                if (!won && matchup.homeScore !== matchup.awayScore) {
                    const benchPts = getBenchPoints(roster);
                    if (benchPts > 0 && (!benchBlunder || benchPts > benchBlunder.benchPts)) {
                        benchBlunder = {
                            benchPts,
                            season,
                            week,
                            manager: teamInfo.manager,
                            score,
                            oppScore,
                            margin: oppScore - score,
                        };
                    }
                }
            });

            if (homeTeam && awayTeam) {
                updateH2H(
                    h2h,
                    getOwnerKey(homeTeam),
                    getOwnerKey(awayTeam),
                    matchup.homeScore,
                    matchup.awayScore
                );

                const margin = Math.abs(matchup.homeScore - matchup.awayScore);
                if (margin <= 5 && matchup.homeScore !== matchup.awayScore) {
                    const homeKey = getOwnerKey(homeTeam);
                    const awayKey = getOwnerKey(awayTeam);
                    const homeWon = matchup.homeScore > matchup.awayScore;
                    recordCloseGame(closeGamesByOwner, homeKey, homeWon);
                    recordCloseGame(closeGamesByOwner, awayKey, !homeWon);
                }
            }

            if (matchup.homeScore !== matchup.awayScore) {
                const homeWon = matchup.homeScore > matchup.awayScore;
                const loserInfo = homeWon ? awayInfo : homeInfo;
                const winnerInfo = homeWon ? homeInfo : awayInfo;
                const loserScore = homeWon ? matchup.awayScore : matchup.homeScore;
                const winnerScore = homeWon ? matchup.homeScore : matchup.awayScore;

                if (!badBeat || loserScore > badBeat.score) {
                    badBeat = {
                        season,
                        week,
                        score: loserScore,
                        loser: loserInfo,
                        winner: winnerInfo,
                        winnerScore,
                    };
                }
            }

            const game = buildMatchupGame(season, matchup, teams, ownerMap);
            if (!blowout || game.margin > blowout.margin) blowout = game;
        });
    });

    const dynastyEntry = Object.entries(championships)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

    return {
        seasons: seasons.length,
        totalGames,
        totalPoints,
        avgPointsPerGame: totalGames > 0 ? totalPoints / (totalGames * 2) : 0,
        dynasty: dynastyEntry && dynastyEntry[1] > 0
            ? { name: getOwnerLabel(dynastyEntry[0], ownerMap), value: dynastyEntry[1] }
            : null,
        paperChampion: findPaperChampion(careerPoints, championships, ownerMap),
        snakeBitten: findSnakeBitten(playoffBerths, championships, ownerMap),
        ceiling,
        floor,
        badBeat,
        blowout,
        shootout,
        benchBlunder,
        nemesis: findNemesis(h2h, ownerMap),
        boomOrBust: findBoomOrBust(weeklyScoresByOwner, ownerMap),
        steadyEddie: findSteadyEddie(weeklyScoresByOwner, ownerMap),
        clutch: findClutch(closeGamesByOwner, ownerMap),
        beatTheBook: findBeatTheBook(projectionDiffByOwner, ownerMap),
        unlucky: findUnlucky(careerPointsAgainst, ownerMap),
    };
}

function renderHighlightCard({ kicker, name, metric, detail, tone = 'default' }) {
    return `
        <article class="highlight-card highlight-card-${tone}">
            <div class="highlight-card-row">
                <div class="highlight-card-copy">
                    <span class="highlight-kicker">${kicker}</span>
                    <span class="highlight-value">${name}</span>
                </div>
                ${metric ? `<span class="highlight-metric">${metric}</span>` : ''}
            </div>
            ${detail ? `<p class="highlight-detail">${detail}</p>` : ''}
        </article>
    `;
}

function renderHighlightGroup(title, cards) {
    const visible = cards.filter(Boolean);
    if (!visible.length) return '';

    return `
        <h3 class="highlights-group-label">${title}</h3>
        ${visible.map(renderHighlightCard).join('')}
    `;
}

/**
 * Render league-wide highlight cards for the Pulse hub.
 * @param {Object} allSeasonsData
 */
function renderLeagueSnapshot(allSeasonsData) {
    const container = document.getElementById('pulse-league-snapshot');
    if (!container) return;

    const snapshot = buildLeagueSnapshot(allSeasonsData);
    if (!snapshot.seasons) {
        container.innerHTML = '<p class="empty-copy">No completed seasons with game data yet.</p>';
        return;
    }

    const heartbreakCards = [];

    if (snapshot.dynasty) {
        heartbreakCards.push({
            kicker: 'Dynasty',
            name: snapshot.dynasty.name,
            metric: `${snapshot.dynasty.value} title${snapshot.dynasty.value === 1 ? '' : 's'}`,
            detail: 'Most championships',
            tone: 'gold',
        });
    }

    if (snapshot.paperChampion) {
        heartbreakCards.push({
            kicker: 'Paper champion',
            name: snapshot.paperChampion.name,
            metric: `${formatPoints(snapshot.paperChampion.points)} pts`,
            detail: 'Most career points, no title',
            tone: 'amber',
        });
    }

    if (snapshot.snakeBitten) {
        heartbreakCards.push({
            kicker: 'Snake bitten',
            name: snapshot.snakeBitten.name,
            metric: `${snapshot.snakeBitten.berths} berth${snapshot.snakeBitten.berths === 1 ? '' : 's'}`,
            detail: 'Most playoff trips, no title',
            tone: 'amber',
        });
    }

    const scoringCards = [];

    if (snapshot.ceiling) {
        scoringCards.push({
            kicker: 'Scoring ceiling',
            name: snapshot.ceiling.team.manager,
            metric: `${formatScore(snapshot.ceiling.score)} pts`,
            detail: `${snapshot.ceiling.season} wk ${snapshot.ceiling.week}`,
            tone: 'teal',
        });
    }

    if (snapshot.floor) {
        scoringCards.push({
            kicker: 'Rock bottom',
            name: snapshot.floor.team.manager,
            metric: `${formatScore(snapshot.floor.score)} pts`,
            detail: `${snapshot.floor.season} wk ${snapshot.floor.week}`,
            tone: 'muted',
        });
    }

    if (snapshot.badBeat) {
        scoringCards.push({
            kicker: 'Bad beat',
            name: snapshot.badBeat.loser.manager,
            metric: `${formatScore(snapshot.badBeat.score)} pts`,
            detail: `Lost to ${snapshot.badBeat.winner.manager} (${formatScore(snapshot.badBeat.winnerScore)}) · ${snapshot.badBeat.season} wk ${snapshot.badBeat.week}`,
            tone: 'red',
        });
    }

    if (snapshot.blowout) {
        scoringCards.push({
            kicker: 'Massacre',
            name: snapshot.blowout.winner.manager,
            metric: `${formatScore(snapshot.blowout.margin)} pt margin`,
            detail: `${formatScore(snapshot.blowout.winnerScore)}–${formatScore(snapshot.blowout.loserScore)} vs ${snapshot.blowout.loser.manager} · ${snapshot.blowout.season} wk ${snapshot.blowout.week}`,
            tone: 'teal',
        });
    }

    if (snapshot.shootout) {
        scoringCards.push({
            kicker: 'Shootout',
            name: `${snapshot.shootout.home.manager} vs ${snapshot.shootout.away.manager}`,
            metric: `${formatScore(snapshot.shootout.combined)} pts`,
            detail: `${formatScore(snapshot.shootout.homeScore)}–${formatScore(snapshot.shootout.awayScore)} · ${snapshot.shootout.season} wk ${snapshot.shootout.week}`,
            tone: 'teal',
        });
    }

    const volatilityCards = [];

    if (snapshot.boomOrBust) {
        volatilityCards.push({
            kicker: 'Boom or bust',
            name: snapshot.boomOrBust.name,
            metric: `${formatScore(snapshot.boomOrBust.stdDev)} σ`,
            detail: `${snapshot.boomOrBust.games} games · wildest weekly swings`,
            tone: 'purple',
        });
    }

    if (snapshot.steadyEddie) {
        volatilityCards.push({
            kicker: 'Steady Eddie',
            name: snapshot.steadyEddie.name,
            metric: `${formatScore(snapshot.steadyEddie.stdDev)} σ`,
            detail: `${snapshot.steadyEddie.games} games · steadiest scorer`,
            tone: 'purple',
        });
    }

    if (snapshot.clutch) {
        volatilityCards.push({
            kicker: 'Clutch',
            name: snapshot.clutch.name,
            metric: `${Math.round(snapshot.clutch.winPct * 100)}%`,
            detail: `${snapshot.clutch.wins}-${snapshot.clutch.total - snapshot.clutch.wins} in games ≤5 pts`,
            tone: 'purple',
        });
    }

    if (snapshot.beatTheBook) {
        volatilityCards.push({
            kicker: 'Beat the book',
            name: snapshot.beatTheBook.name,
            metric: `+${formatScore(snapshot.beatTheBook.avg)} /wk`,
            detail: `Avg actual over projection · ${snapshot.beatTheBook.weeks} weeks`,
            tone: 'purple',
        });
    }

    const rivalryCards = [];

    if (snapshot.nemesis) {
        rivalryCards.push({
            kicker: 'Nemesis',
            name: snapshot.nemesis.owner,
            metric: `${snapshot.nemesis.recordLabel} vs ${snapshot.nemesis.opponent}`,
            detail: `Worst H2H · ${snapshot.nemesis.games} games`,
            tone: 'red',
        });
    }

    if (snapshot.benchBlunder) {
        rivalryCards.push({
            kicker: 'Bench blunder',
            name: snapshot.benchBlunder.manager,
            metric: `${formatScore(snapshot.benchBlunder.benchPts)} bench`,
            detail: `Lost ${formatScore(snapshot.benchBlunder.score)}–${formatScore(snapshot.benchBlunder.oppScore)} · ${snapshot.benchBlunder.season} wk ${snapshot.benchBlunder.week}`,
            tone: 'red',
        });
    }

    if (snapshot.unlucky) {
        rivalryCards.push({
            kicker: 'Unlucky',
            name: snapshot.unlucky.name,
            metric: `${formatPoints(snapshot.unlucky.points)} PA`,
            detail: 'Most career points allowed',
            tone: 'amber',
        });
    }

    container.innerHTML = `
        <div class="league-snapshot-banner">
            <span class="league-snapshot-stat"><strong>${snapshot.seasons}</strong> seasons</span>
            <span class="league-snapshot-stat"><strong>${formatPoints(snapshot.totalGames)}</strong> games</span>
            <span class="league-snapshot-stat"><strong>${formatPoints(snapshot.totalPoints)}</strong> pts</span>
            <span class="league-snapshot-stat"><strong>${formatScore(snapshot.avgPointsPerGame)}</strong> avg / wk</span>
        </div>
        <div class="league-highlights-grid">
            ${renderHighlightGroup('Champions & heartbreak', heartbreakCards)}
            ${renderHighlightGroup('Scoring extremes', scoringCards)}
            ${renderHighlightGroup('Volatility & luck', volatilityCards)}
            ${renderHighlightGroup('Rivalries & misfortune', rivalryCards)}
        </div>
    `;
}

export { buildLeagueSnapshot, renderLeagueSnapshot };
