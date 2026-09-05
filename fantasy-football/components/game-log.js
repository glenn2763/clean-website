/**
 * Game Log Component
 * Week-by-week matchup results with expandable box scores
 */

import {
    buildOwnerMap,
    getMatchups,
    getOwnerDisplayName,
    getPlayoffConfig,
    getTeamNameFromObject,
    getTeams,
} from '../utils.js';
import { getTeamInfo, parseRosterLineup, renderTwoTeamBoxscore } from './boxscore.js';

/**
 * @param {Object} matchup
 * @param {Object[]} teams
 * @param {Object} ownerMap
 * @param {number} [regularSeasonWeeks=14]
 */
function parseMatchupGame(matchup, teams, ownerMap, regularSeasonWeeks = 14) {
    const week = matchup.matchupPeriodId || 0;
    const homeInfo = getTeamInfo(teams, matchup.homeTeamId, ownerMap);
    const awayInfo = getTeamInfo(teams, matchup.awayTeamId, ownerMap);

    let winnerSide = null;
    if (matchup.homeScore > matchup.awayScore) winnerSide = 'home';
    else if (matchup.awayScore > matchup.homeScore) winnerSide = 'away';

    return {
        week,
        isPlayoff: week > regularSeasonWeeks,
        winnerSide,
        margin: Math.abs(matchup.homeScore - matchup.awayScore),
        home: {
            ...homeInfo,
            score: matchup.homeScore,
            projected: matchup.homeProjectedScore,
            lineup: parseRosterLineup(matchup.homeRoster),
        },
        away: {
            ...awayInfo,
            score: matchup.awayScore,
            projected: matchup.awayProjectedScore,
            lineup: parseRosterLineup(matchup.awayRoster),
        },
    };
}

/**
 * @param {Object} seasonData
 * @returns {Array<{ week: number, isPlayoff: boolean, home: Object, away: Object, winnerSide: string|null, margin: number }>}
 */
function buildGameLog(seasonData) {
    const matchups = getMatchups(seasonData);
    const teams = getTeams(seasonData);
    const ownerMap = buildOwnerMap({ season: seasonData });
    const { regularSeasonWeeks } = getPlayoffConfig(seasonData?.mSettings || {});

    return matchups
        .filter(
            (matchup) =>
                matchup?.homeScore != null &&
                matchup?.awayScore != null &&
                matchup?.homeTeamId != null &&
                matchup?.awayTeamId != null
        )
        .map((matchup) => parseMatchupGame(matchup, teams, ownerMap, regularSeasonWeeks))
        .sort((a, b) => a.week - b.week || a.home.teamId - b.home.teamId);
}

function formatScore(score, projected) {
    const base = Number(score).toFixed(2);
    if (projected == null || Number.isNaN(projected)) return base;
    return `${base} <span class="game-log-projected">(${Number(projected).toFixed(2)} proj)</span>`;
}

function renderGameSummary(game) {
    const left = game.winnerSide === 'away' ? game.away : game.home;
    const right = game.winnerSide === 'away' ? game.home : game.away;
    const leftClass = game.winnerSide ? 'game-log-team game-log-team-winner' : 'game-log-team';
    const rightClass = game.winnerSide ? 'game-log-team game-log-team-loser' : 'game-log-team';

    const leftLabel = left.manager !== left.teamName
        ? `<span class="game-log-team-name">${left.teamName}</span><span class="game-log-manager">${left.manager}</span>`
        : `<span class="game-log-team-name">${left.teamName}</span>`;
    const rightLabel = right.manager !== right.teamName
        ? `<span class="game-log-team-name">${right.teamName}</span><span class="game-log-manager">${right.manager}</span>`
        : `<span class="game-log-team-name">${right.teamName}</span>`;

    return `
        <div class="game-log-summary">
            <div class="${leftClass}">
                ${leftLabel}
                <span class="game-log-score">${formatScore(left.score, left.projected)}</span>
            </div>
            <span class="game-log-vs">${game.winnerSide ? 'def.' : 'vs'}</span>
            <div class="${rightClass}">
                ${rightLabel}
                <span class="game-log-score">${formatScore(right.score, right.projected)}</span>
            </div>
        </div>
    `;
}

function renderExpandableMatchup(game, { meta = '' } = {}) {
    return `
        <details class="game-log-game">
            <summary>
                ${meta ? `<span class="matchup-highlight-meta">${meta}</span>` : ''}
                ${renderGameSummary(game)}
            </summary>
            <div class="game-log-boxscore">
                ${renderTwoTeamBoxscore(
                    {
                        manager: game.home.manager,
                        teamName: game.home.teamName,
                        score: game.home.score,
                        lineup: game.home.lineup,
                    },
                    {
                        manager: game.away.manager,
                        teamName: game.away.teamName,
                        score: game.away.score,
                        lineup: game.away.lineup,
                    }
                )}
            </div>
        </details>
    `;
}

function renderWeekSection(week, games) {
    const isPlayoff = games.some((game) => game.isPlayoff);
    const weekLabel = isPlayoff ? `Week ${week} · Playoffs` : `Week ${week}`;

    return `
        <section class="game-log-week">
            <h3 class="game-log-week-title">${weekLabel}</h3>
            <div class="game-log-games">
                ${games.map((game) => renderExpandableMatchup(game)).join('')}
            </div>
        </section>
    `;
}

function getTeamFilterOptions(seasonData, games) {
    const teams = getTeams(seasonData);
    const teamIds = new Set();
    games.forEach((game) => {
        teamIds.add(game.home.teamId);
        teamIds.add(game.away.teamId);
    });

    return [...teamIds]
        .map((teamId) => {
            const team = teams.find((entry) => entry.id === teamId);
            const teamName = team ? getTeamNameFromObject(team) : `Team ${teamId}`;
            const manager = team ? getOwnerDisplayName(team) : teamName;
            return {
                teamId,
                label: manager !== teamName ? `${teamName} · ${manager}` : teamName,
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

function filterGames(games, teamId) {
    if (!teamId) return games;
    const id = Number(teamId);
    return games.filter(
        (game) => game.home.teamId === id || game.away.teamId === id
    );
}

function groupGamesByWeek(games) {
    const byWeek = new Map();
    games.forEach((game) => {
        if (!byWeek.has(game.week)) byWeek.set(game.week, []);
        byWeek.get(game.week).push(game);
    });
    return [...byWeek.entries()].sort(([a], [b]) => a - b);
}

function renderGameLogContent(games, selectedTeamId) {
    const filtered = filterGames(games, selectedTeamId);
    if (!filtered.length) {
        return '<p class="game-log-empty">No matchups for this filter.</p>';
    }

    const weeks = groupGamesByWeek(filtered);
    return weeks.map(([week, weekGames]) => renderWeekSection(week, weekGames)).join('');
}

/**
 * @param {Object} allSeasonsData
 * @param {string} [containerId='game-log']
 */
function renderGameLog(allSeasonsData, containerId = 'game-log') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const seasonData = Object.values(allSeasonsData)[0];
    if (!seasonData) {
        container.innerHTML = '<p class="game-log-empty">No season data available.</p>';
        return;
    }

    const games = buildGameLog(seasonData);
    if (!games.length) {
        container.innerHTML = '<p class="game-log-empty">No completed matchups yet.</p>';
        return;
    }

    const teamOptions = getTeamFilterOptions(seasonData, games);
    const selectedTeamId = container.dataset.selectedTeam || '';

    container.innerHTML = `
        <div class="game-log-toolbar">
            <label class="game-log-filter-label" for="${containerId}-team-filter">Team</label>
            <select id="${containerId}-team-filter" class="game-log-filter">
                <option value="">All teams</option>
                ${teamOptions.map((option) => `
                    <option value="${option.teamId}"${String(option.teamId) === selectedTeamId ? ' selected' : ''}>
                        ${option.label}
                    </option>
                `).join('')}
            </select>
        </div>
        <div class="game-log-body">
            ${renderGameLogContent(games, selectedTeamId)}
        </div>
    `;

    const filter = container.querySelector('.game-log-filter');
    const body = container.querySelector('.game-log-body');

    filter?.addEventListener('change', () => {
        container.dataset.selectedTeam = filter.value;
        if (body) {
            body.innerHTML = renderGameLogContent(games, filter.value);
        }
    });
}

export { renderGameLog, buildGameLog, renderExpandableMatchup };
