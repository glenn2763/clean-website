/**
 * Team-season metrics and correlation helpers for wins analysis.
 */

import {
    buildOwnerMap,
    calculateAverage,
    calculateConsistency,
    calculatePointsAgainst,
    calculatePointsFor,
    collectWeeklyRelativePointsAgainst,
    computeRegularSeasonRecords,
    countWireAddsAndDrops,
    getActiveSeasons,
    getMatchups,
    getOwnerKey,
    getOwnerLabel,
    getPlayoffConfig,
    getRegularSeasonMatchups,
    getTeams,
    getTransactions,
    parseExecutedTrades,
    buildSeasonRosterPointsByTeam,
} from './utils.js';

const POSITION_IDS = {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 4,
    K: 5,
    DST: 16,
};

function isValidNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {{ r: number, n: number } | null}
 */
function pearsonCorrelation(xs, ys) {
    const pairs = [];
    for (let i = 0; i < xs.length; i += 1) {
        if (isValidNumber(xs[i]) && isValidNumber(ys[i])) {
            pairs.push([xs[i], ys[i]]);
        }
    }

    const n = pairs.length;
    if (n < 2) return null;

    const xValues = pairs.map(([x]) => x);
    const yValues = pairs.map(([, y]) => y);
    const xMean = calculateAverage(xValues);
    const yMean = calculateAverage(yValues);

    let numerator = 0;
    let xDenom = 0;
    let yDenom = 0;

    for (let i = 0; i < n; i += 1) {
        const xDiff = xValues[i] - xMean;
        const yDiff = yValues[i] - yMean;
        numerator += xDiff * yDiff;
        xDenom += xDiff * xDiff;
        yDenom += yDiff * yDiff;
    }

    if (xDenom === 0 || yDenom === 0) {
        return { r: 0, n };
    }

    return { r: numerator / Math.sqrt(xDenom * yDenom), n };
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {{ slope: number, intercept: number } | null}
 */
function linearRegression(xs, ys) {
    const pairs = [];
    for (let i = 0; i < xs.length; i += 1) {
        if (isValidNumber(xs[i]) && isValidNumber(ys[i])) {
            pairs.push([xs[i], ys[i]]);
        }
    }

    const n = pairs.length;
    if (n < 2) return null;

    const xValues = pairs.map(([x]) => x);
    const yValues = pairs.map(([, y]) => y);
    const xMean = calculateAverage(xValues);
    const yMean = calculateAverage(yValues);

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i += 1) {
        const xDiff = xValues[i] - xMean;
        numerator += xDiff * (yValues[i] - yMean);
        denominator += xDiff * xDiff;
    }

    if (denominator === 0) return null;

    const slope = numerator / denominator;
    return { slope, intercept: yMean - slope * xMean };
}

function collectWeeklyScores(teamId, matchups) {
    const actual = [];
    const projected = [];

    matchups.forEach((matchup) => {
        if (matchup.homeTeamId === teamId) {
            if (matchup.homeScore != null) actual.push(matchup.homeScore);
            if (matchup.homeProjectedScore != null) projected.push(matchup.homeProjectedScore);
        } else if (matchup.awayTeamId === teamId) {
            if (matchup.awayScore != null) actual.push(matchup.awayScore);
            if (matchup.awayProjectedScore != null) projected.push(matchup.awayProjectedScore);
        }
    });

    return { actual, projected };
}

function collectMatchupOutcomes(teamId, matchups) {
    const closeGames = { wins: 0, total: 0 };
    const winMargins = [];

    matchups.forEach((matchup) => {
        if (matchup.homeScore == null || matchup.awayScore == null) return;

        const isHome = matchup.homeTeamId === teamId;
        const isAway = matchup.awayTeamId === teamId;
        if (!isHome && !isAway) return;

        const teamScore = isHome ? matchup.homeScore : matchup.awayScore;
        const oppScore = isHome ? matchup.awayScore : matchup.homeScore;
        const margin = teamScore - oppScore;
        const absMargin = Math.abs(margin);

        if (absMargin <= 5) {
            closeGames.total += 1;
            if (margin > 0) closeGames.wins += 1;
        }

        if (margin > 0) {
            winMargins.push(margin);
        }
    });

    return { closeGames, winMargins };
}

function getTeamRosterEntries(team, seasonData, teamIndex, rosterByTeam) {
    const fromMatchups = rosterByTeam?.get(team.id);
    if (fromMatchups?.size) {
        return [...fromMatchups.values()].map(({ playerId, points }) => ({
            playerId,
            points,
        }));
    }

    if (Array.isArray(team?.roster) && team.roster.length > 0) {
        return team.roster.map((entry) => ({
            playerId: entry.player?.id ?? entry.id,
            points: entry.totalPoints ?? entry.playerPoolEntry?.appliedStatTotal ?? 0,
        }));
    }

    const rosterBucket = seasonData?.mRoster?.rosters?.[teamIndex];
    if (!rosterBucket?.entries) return [];

    return rosterBucket.entries.map((entry) => ({
        playerId: entry.playerId ?? entry.playerPoolEntry?.player?.id,
        points: entry.playerPoolEntry?.appliedStatTotal ?? 0,
    }));
}

function buildPlayerPositionMap(seasonData) {
    const map = new Map();
    (seasonData?.kona_player_info?.players || []).forEach((player) => {
        map.set(player.id, player.defaultPositionId);
    });
    return map;
}

function rosterMetricsFromEntries(entries, positionMap) {
    const totals = { rosterTotalPoints: 0, topPlayerPoints: 0 };
    const byPosition = {
        topQBPoints: 0,
        topRBPoints: 0,
        topWRPoints: 0,
        topTEPoints: 0,
        topKPoints: 0,
        topDSTPoints: 0,
    };

    entries.forEach((entry) => {
        const points = entry.points || 0;
        totals.rosterTotalPoints += points;
        if (points > totals.topPlayerPoints) totals.topPlayerPoints = points;

        const positionId = positionMap.get(entry.playerId);
        if (positionId === POSITION_IDS.QB && points > byPosition.topQBPoints) byPosition.topQBPoints = points;
        if (positionId === POSITION_IDS.RB && points > byPosition.topRBPoints) byPosition.topRBPoints = points;
        if (positionId === POSITION_IDS.WR && points > byPosition.topWRPoints) byPosition.topWRPoints = points;
        if (positionId === POSITION_IDS.TE && points > byPosition.topTEPoints) byPosition.topTEPoints = points;
        if (positionId === POSITION_IDS.K && points > byPosition.topKPoints) byPosition.topKPoints = points;
        if (positionId === POSITION_IDS.DST && points > byPosition.topDSTPoints) byPosition.topDSTPoints = points;
    });

    return { ...totals, ...byPosition };
}

/**
 * @param {Object} seasonData
 * @param {number} teamId
 * @param {Array} transactions
 * @param {{ weekMin?: number|null, weekMax?: number|null }} [weekRange]
 */
function countTeamTradesInRange(teamId, seasonData, weekRange = {}) {
    const { weekMin = null, weekMax = null } = weekRange;
    return parseExecutedTrades(seasonData).filter((trade) => {
        if (!trade.sides.some((side) => side.teamId === teamId)) return false;
        if (weekMin == null && weekMax == null) return true;
        const week = trade.week || 0;
        if (weekMin != null && week < weekMin) return false;
        if (weekMax != null && week > weekMax) return false;
        return true;
    }).length;
}

function countTeamTrades(teamId, seasonData, ctx = {}) {
    if (ctx.partialSeason) return null;
    return countTeamTradesInRange(teamId, seasonData, getTransactions(seasonData), ctx);
}

const METRICS = [
    {
        id: 'avgPointsFor',
        label: 'Avg weekly points scored',
        category: 'Scoring',
        description: 'Average regular-season points scored per game.',
        compute(team, seasonData, ctx) {
            return calculatePointsFor(team.id, ctx.matchups);
        },
    },
    {
        id: 'totalPointsFor',
        label: 'Total regular-season PF',
        category: 'Scoring',
        description: 'Total points scored during the regular season.',
        compute(team, seasonData, ctx) {
            return ctx.record?.pointsFor ?? 0;
        },
    },
    {
        id: 'avgPointsAgainst',
        label: 'Avg weekly points allowed',
        category: 'Scoring',
        description: 'Average opponent score per regular-season game.',
        compute(team, seasonData, ctx) {
            return calculatePointsAgainst(team.id, ctx.matchups, ctx.teams);
        },
    },
    {
        id: 'consistency',
        label: 'Score std dev',
        category: 'Scoring',
        description: 'Standard deviation of weekly scores (lower = steadier).',
        compute(team, seasonData, ctx) {
            const { actual } = collectWeeklyScores(team.id, ctx.matchups);
            return calculateConsistency(actual);
        },
    },
    {
        id: 'projectedVsActual',
        label: 'Actual − projected',
        category: 'Projections',
        description: 'Average weekly actual score minus projected score.',
        compute(team, seasonData, ctx) {
            const { actual, projected } = collectWeeklyScores(team.id, ctx.matchups);
            if (!actual.length || !projected.length) return null;
            return calculateAverage(actual) - calculateAverage(projected);
        },
    },
    {
        id: 'scheduleDifficulty',
        label: 'Schedule difficulty',
        category: 'Schedule',
        description: 'Average opponent score vs league median that week (positive = tougher).',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const relative = collectWeeklyRelativePointsAgainst(team.id, seasonData);
            if (!relative.length) return null;
            return calculateAverage(relative);
        },
    },
    {
        id: 'wireAdds',
        label: 'Waiver/FA adds',
        category: 'Activity',
        description: 'Count of executed waiver and free-agent adds.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            return countWireAddsAndDrops(getTransactions(seasonData), team.id).adds;
        },
    },
    {
        id: 'wireDrops',
        label: 'Waiver/FA drops',
        category: 'Activity',
        description: 'Count of executed waiver and free-agent drops.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            return countWireAddsAndDrops(getTransactions(seasonData), team.id).drops;
        },
    },
    {
        id: 'tradeCount',
        label: 'Executed trades',
        category: 'Activity',
        description: 'Number of completed trades involving this team.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            return countTeamTrades(team.id, seasonData, ctx);
        },
    },
    {
        id: 'closeGameWinPct',
        label: 'Close-game win %',
        category: 'Matchups',
        description: 'Win percentage in games decided by 5 points or fewer.',
        compute(team, seasonData, ctx) {
            const { closeGames } = collectMatchupOutcomes(team.id, ctx.matchups);
            if (closeGames.total === 0) return null;
            return closeGames.wins / closeGames.total;
        },
    },
    {
        id: 'avgWinMargin',
        label: 'Avg win margin',
        category: 'Matchups',
        description: 'Average point margin in regular-season wins.',
        compute(team, seasonData, ctx) {
            const { winMargins } = collectMatchupOutcomes(team.id, ctx.matchups);
            if (!winMargins.length) return null;
            return calculateAverage(winMargins);
        },
    },
    {
        id: 'rosterTotalPoints',
        label: 'Roster total points',
        category: 'Roster',
        description: 'Sum of season fantasy points across the roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            return ctx.rosterMetrics.rosterTotalPoints;
        },
    },
    {
        id: 'topPlayerPoints',
        label: 'Best player points',
        category: 'Roster',
        description: 'Highest single-player season point total on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            return ctx.rosterMetrics.topPlayerPoints;
        },
    },
    {
        id: 'topQBPoints',
        label: 'Best QB points',
        category: 'Roster',
        description: 'Highest QB season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topQBPoints;
            return value > 0 ? value : null;
        },
    },
    {
        id: 'topRBPoints',
        label: 'Best RB points',
        category: 'Roster',
        description: 'Highest RB season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topRBPoints;
            return value > 0 ? value : null;
        },
    },
    {
        id: 'topWRPoints',
        label: 'Best WR points',
        category: 'Roster',
        description: 'Highest WR season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topWRPoints;
            return value > 0 ? value : null;
        },
    },
    {
        id: 'topTEPoints',
        label: 'Best TE points',
        category: 'Roster',
        description: 'Highest TE season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topTEPoints;
            return value > 0 ? value : null;
        },
    },
    {
        id: 'topKPoints',
        label: 'Best K points',
        category: 'Roster',
        description: 'Highest kicker season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topKPoints;
            return value > 0 ? value : null;
        },
    },
    {
        id: 'topDSTPoints',
        label: 'Best D/ST points',
        category: 'Roster',
        description: 'Highest D/ST season points on roster.',
        compute(team, seasonData, ctx) {
            if (ctx.partialSeason) return null;
            const value = ctx.rosterMetrics.topDSTPoints;
            return value > 0 ? value : null;
        },
    },
];

const METRICS_BY_ID = Object.fromEntries(METRICS.map((metric) => [metric.id, metric]));

const DEFAULT_METRIC_IDS = [
    'avgPointsFor',
    'avgPointsAgainst',
    'consistency',
    'projectedVsActual',
    'wireAdds',
];

/** Hidden from Lab — tautological with points, luck-based, or not actionable */
const LAB_EXCLUDED_METRIC_IDS = [
    'avgPointsFor',
    'totalPointsFor',
    'rosterTotalPoints',
    'topPlayerPoints',
    'topQBPoints',
    'topRBPoints',
    'topWRPoints',
    'topTEPoints',
    'topKPoints',
    'topDSTPoints',
    'closeGameWinPct',
    'avgWinMargin',
];

const LAB_DEFAULT_METRIC_IDS = [
    'projectedVsActual',
    'consistency',
    'wireAdds',
    'tradeCount',
    'scheduleDifficulty',
];

const SIGNAL_STRONG_ABS_R = 0.35;
const SIGNAL_WEAK_ABS_R = 0.2;
const CORRELATION_TARGET_KEY = 'pointsFor';

/** @type {Record<string, { key: string, label: string, shortLabel: string, description: string, dotLabel: string, yAxisTitle: string, directionMore: string, directionLess: string, integerYAxis: boolean, excludeMetricIds: string[] }>} */
const CORRELATION_MODES = {
    sameSeason: {
        key: 'sameSeason',
        label: 'Same season',
        shortLabel: 'Same season',
        description: 'When a manager ranks high on a metric in a season, do they also score more that same season?',
        dotLabel: 'manager-season',
        scatterXHint: 'Metric value that season',
    },
    yoy: {
        key: 'yoy',
        label: 'Year-over-year',
        shortLabel: 'YoY carryover',
        description: 'Does a metric in one season predict points scored the next season for the same manager?',
        dotLabel: 'manager carryover',
        scatterXHint: 'Metric in prior season',
    },
    splitHalf: {
        key: 'splitHalf',
        label: 'Split-half stability',
        shortLabel: 'Split-half',
        description: 'Is the metric stable within a season? Compare each manager\'s first half vs second half (~7 games each).',
        dotLabel: 'manager-season half',
        scatterXHint: 'First-half value',
    },
};

/** @type {Record<string, { key: string, label: string, shortLabel: string, yAxisTitle: string, directionMore: string, directionLess: string, integerYAxis: boolean, excludeMetricIds: string[] }>} */
const CORRELATION_TARGETS = {
    wins: {
        key: 'wins',
        label: 'Regular-season wins',
        shortLabel: 'Wins',
        yAxisTitle: 'Regular-Season Wins',
        directionMore: 'more wins',
        directionLess: 'fewer wins',
        integerYAxis: true,
        excludeMetricIds: [],
    },
    pointsFor: {
        key: 'pointsFor',
        label: 'Total regular-season points scored',
        shortLabel: 'Points scored',
        yAxisTitle: 'Regular-Season Points Scored',
        directionMore: 'more points',
        directionLess: 'fewer points',
        integerYAxis: false,
        excludeMetricIds: ['avgPointsFor', 'totalPointsFor'],
    },
};

function getCorrelationMode(modeKey = 'sameSeason') {
    return CORRELATION_MODES[modeKey] || CORRELATION_MODES.sameSeason;
}

function interpretCorrelationStrength(r) {
    if (r == null || !Number.isFinite(r)) return '—';
    const abs = Math.abs(r);
    if (abs < 0.2) return 'Weak';
    if (abs < 0.4) return 'Modest';
    if (abs < 0.6) return 'Moderate';
    if (abs < 0.8) return 'Strong';
    return 'Very strong';
}

function formatRSquared(r) {
    if (r == null || !Number.isFinite(r)) return '—';
    return `${(r * r * 100).toFixed(0)}%`;
}

function filterMatchupsByWeek(matchups, weekMin, weekMax) {
    return matchups.filter((matchup) => {
        const week = matchup.matchupPeriodId || 0;
        if (weekMin != null && week < weekMin) return false;
        if (weekMax != null && week > weekMax) return false;
        return true;
    });
}

/**
 * @param {string} season
 * @param {Object} seasonData
 * @param {Object} ownerMap
 * @param {{ weekMin?: number|null, weekMax?: number|null }} [weekRange]
 * @returns {Array<Object>}
 */
function buildRowsForSeason(season, seasonData, ownerMap, weekRange = {}) {
    const { weekMin = null, weekMax = null } = weekRange;
    const partialSeason = weekMin != null || weekMax != null;
    const teams = getTeams(seasonData);
    const allRegularMatchups = getRegularSeasonMatchups(seasonData);
    const matchups = partialSeason
        ? filterMatchupsByWeek(allRegularMatchups, weekMin, weekMax)
        : allRegularMatchups;
    const config = getPlayoffConfig(seasonData?.mSettings || {});
    const recordByTeamId = new Map(
        computeRegularSeasonRecords(matchups, config.regularSeasonWeeks).map((record) => [
            record.teamId,
            record,
        ])
    );
    const positionMap = buildPlayerPositionMap(seasonData);
    const rosterByTeam = buildSeasonRosterPointsByTeam(seasonData);
    const rows = [];

    teams.forEach((team, teamIndex) => {
        const record = recordByTeamId.get(team.id);
        if (!record || (record.wins === 0 && record.losses === 0 && record.ties === 0)) return;

        const rosterEntries = getTeamRosterEntries(team, seasonData, teamIndex, rosterByTeam);
        const rosterMetrics = rosterMetricsFromEntries(rosterEntries, positionMap);
        const ctx = {
            matchups,
            teams,
            record,
            rosterMetrics,
            partialSeason,
        };

        const ownerKey = getOwnerKey(team);
        const row = {
            ownerKey,
            manager: getOwnerLabel(ownerKey, ownerMap),
            season,
            teamId: team.id,
            wins: record.wins,
            losses: record.losses,
            ties: record.ties,
            pointsFor: record.pointsFor,
            metrics: {},
        };

        METRICS.forEach((metric) => {
            const value = metric.compute(team, seasonData, ctx);
            row.metrics[metric.id] = isValidNumber(value) ? value : null;
        });

        rows.push(row);
    });

    return rows;
}

/**
 * @param {Object} allSeasonsData
 * @returns {Array<Object>}
 */
function buildTeamSeasonRows(allSeasonsData) {
    const ownerMap = buildOwnerMap(allSeasonsData);
    const seasons = getActiveSeasons(allSeasonsData);

    return seasons.flatMap((season) =>
        buildRowsForSeason(season, allSeasonsData[season], ownerMap)
    );
}

/**
 * Prior-season metric vs next-season outcome for returning managers.
 * @param {Object} allSeasonsData
 * @returns {Array<Object>}
 */
function buildYoYRows(allSeasonsData) {
    const sameSeasonRows = buildTeamSeasonRows(allSeasonsData);
    const rowByOwnerSeason = new Map(
        sameSeasonRows.map((row) => [`${row.ownerKey}|${row.season}`, row])
    );

    return sameSeasonRows.flatMap((row) => {
        const nextSeason = String(Number(row.season) + 1);
        const nextRow = rowByOwnerSeason.get(`${row.ownerKey}|${nextSeason}`);
        if (!nextRow) return [];

        return [{
            ownerKey: row.ownerKey,
            manager: row.manager,
            season: `${row.season}→${nextSeason}`,
            seasonFrom: row.season,
            seasonTo: nextSeason,
            teamId: row.teamId,
            wins: nextRow.wins,
            losses: nextRow.losses,
            ties: nextRow.ties,
            pointsFor: nextRow.pointsFor,
            metrics: row.metrics,
        }];
    });
}

/**
 * First-half vs second-half metric values within each manager-season.
 * @param {Object} allSeasonsData
 * @returns {Array<Object>}
 */
function buildSplitHalfRows(allSeasonsData) {
    const ownerMap = buildOwnerMap(allSeasonsData);
    const seasons = getActiveSeasons(allSeasonsData);
    const rows = [];

    seasons.forEach((season) => {
        const seasonData = allSeasonsData[season];
        const totalWeeks = getPlayoffConfig(seasonData?.mSettings || {}).regularSeasonWeeks;
        if (totalWeeks < 2) return;

        const mid = Math.floor(totalWeeks / 2);
        const firstHalf = buildRowsForSeason(season, seasonData, ownerMap, { weekMin: 1, weekMax: mid });
        const secondHalf = buildRowsForSeason(season, seasonData, ownerMap, {
            weekMin: mid + 1,
            weekMax: totalWeeks,
        });
        const secondHalfByTeam = new Map(secondHalf.map((row) => [row.teamId, row]));

        firstHalf.forEach((firstRow) => {
            const secondRow = secondHalfByTeam.get(firstRow.teamId);
            if (!secondRow) return;

            rows.push({
                ownerKey: firstRow.ownerKey,
                manager: firstRow.manager,
                season,
                teamId: firstRow.teamId,
                half1: firstRow.metrics,
                half2: secondRow.metrics,
            });
        });
    });

    return rows;
}

/**
 * @param {Object} allSeasonsData
 * @param {string} modeKey
 * @returns {Array<Object>}
 */
function buildCorrelationRows(allSeasonsData, modeKey = 'sameSeason') {
    switch (modeKey) {
        case 'yoy':
            return buildYoYRows(allSeasonsData);
        case 'splitHalf':
            return buildSplitHalfRows(allSeasonsData);
        default:
            return buildTeamSeasonRows(allSeasonsData);
    }
}

/**
 * @param {string} [targetKey='wins']
 * @returns {Object}
 */
function getCorrelationTarget(targetKey = 'wins') {
    return CORRELATION_TARGETS[targetKey] || CORRELATION_TARGETS.wins;
}

/**
 * Sort correlation rows by |r| (strongest first). Excluded and missing r sink to the bottom.
 * @param {{ excluded?: boolean, valid?: boolean, r: number|null, label?: string }} a
 * @param {{ excluded?: boolean, valid?: boolean, r: number|null, label?: string }} b
 * @returns {number}
 */
function compareCorrelationResults(a, b) {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;

    const aHasR = a.r != null && Number.isFinite(a.r);
    const bHasR = b.r != null && Number.isFinite(b.r);
    if (aHasR !== bHasR) return aHasR ? -1 : 1;

    if (aHasR && bHasR) {
        const absDiff = Math.abs(b.r) - Math.abs(a.r);
        if (absDiff !== 0) return absDiff;
        const signedDiff = b.r - a.r;
        if (signedDiff !== 0) return signedDiff;
    }

    return (a.label || '').localeCompare(b.label || '');
}

/**
 * @param {Array<{ excluded?: boolean, valid?: boolean, r: number|null, label?: string }>} results
 * @returns {Array}
 */
function sortCorrelationResults(results) {
    return [...results].sort(compareCorrelationResults);
}

function buildCorrelationResult(id, metric, { r, n, direction, excluded = false, valid = false }) {
    return {
        id,
        label: metric?.label || id,
        category: metric?.category || 'Unknown',
        r,
        rSquared: r != null ? r * r : null,
        n,
        direction,
        strength: interpretCorrelationStrength(r),
        valid,
        excluded,
    };
}

function computeCorrelations(rows, metricIds, targetKey = 'wins') {
    const target = getCorrelationTarget(targetKey);
    const targetValues = rows.map((row) => row[target.key]);

    const results = metricIds.map((id) => {
        const metric = METRICS_BY_ID[id];
        if (!metric) {
            return buildCorrelationResult(id, null, {
                r: null,
                n: 0,
                direction: '—',
            });
        }

        if (target.excludeMetricIds.includes(id)) {
            return buildCorrelationResult(id, metric, {
                r: null,
                n: 0,
                direction: 'Same as outcome',
                excluded: true,
            });
        }

        const metricValues = rows.map((row) => row.metrics[id]);
        const result = pearsonCorrelation(metricValues, targetValues);
        const n = result?.n ?? 0;
        const r = result?.r ?? null;
        const valid = n >= 5 && r != null;

        let direction = '—';
        if (valid && r !== 0) {
            direction = r > 0
                ? `Higher → ${target.directionMore}`
                : `Higher → ${target.directionLess}`;
        }

        return buildCorrelationResult(id, metric, { r, n, direction, valid });
    });

    return sortCorrelationResults(results);
}

/**
 * Split-half repeatability: first-half metric vs second-half metric within each manager-season.
 * @param {Array<Object>} rows
 * @param {string[]} metricIds
 * @returns {Array<Object>}
 */
function computeSplitHalfCorrelations(rows, metricIds) {
    const results = metricIds.map((id) => {
        const metric = METRICS_BY_ID[id];
        if (!metric) {
            return buildCorrelationResult(id, null, {
                r: null,
                n: 0,
                direction: '—',
            });
        }

        const firstHalfValues = rows.map((row) => row.half1?.[id] ?? null);
        const secondHalfValues = rows.map((row) => row.half2?.[id] ?? null);
        const result = pearsonCorrelation(firstHalfValues, secondHalfValues);
        const n = result?.n ?? 0;
        const r = result?.r ?? null;
        const valid = n >= 5 && r != null;

        let direction = '—';
        if (valid && r !== 0) {
            direction = r > 0 ? 'Stable across halves' : 'Regresses across halves';
        }

        return buildCorrelationResult(id, metric, { r, n, direction, valid });
    });

    return sortCorrelationResults(results);
}

/**
 * @param {Array<Object>} rows
 * @param {string[]} metricIds
 * @param {string} modeKey
 * @param {string} targetKey
 * @returns {Array<Object>}
 */
function computeCorrelationsForMode(rows, metricIds, modeKey = 'sameSeason', targetKey = 'wins') {
    if (modeKey === 'splitHalf') {
        return computeSplitHalfCorrelations(rows, metricIds);
    }
    return computeCorrelations(rows, metricIds, targetKey);
}

function getMetricCategories() {
    return [...new Set(METRICS.map((metric) => metric.category))];
}

function getLabMetricIds() {
    return METRICS
        .map((metric) => metric.id)
        .filter((id) => !LAB_EXCLUDED_METRIC_IDS.includes(id));
}

function getLabMetrics() {
    return METRICS.filter((metric) => !LAB_EXCLUDED_METRIC_IDS.includes(metric.id));
}

function getLabMetricCategories() {
    return [...new Set(getLabMetrics().map((metric) => metric.category))];
}

function classifySignalStrength(r) {
    if (r == null || !Number.isFinite(r)) return 'none';
    const abs = Math.abs(r);
    if (abs < SIGNAL_WEAK_ABS_R) return 'weak';
    if (abs < SIGNAL_STRONG_ABS_R) return 'modest';
    return 'strong';
}

/**
 * @param {number|null} sameSeasonR
 * @param {number|null} splitHalfR
 * @param {number|null} yoyR
 * @returns {{ label: string, tone: 'positive'|'warn'|'muted'|'default' }}
 */
function interpretSignalVerdict(sameSeasonR, splitHalfR, yoyR) {
    const same = classifySignalStrength(sameSeasonR);
    const split = classifySignalStrength(splitHalfR);
    const yoy = classifySignalStrength(yoyR);
    const strongish = (level) => level === 'modest' || level === 'strong';
    const weakOrNone = (level) => level === 'weak' || level === 'none';

    if (!strongish(same) && !strongish(split) && !strongish(yoy)) {
        if (same === 'none' && split === 'none' && yoy === 'none') {
            return { label: 'Insufficient data', tone: 'muted' };
        }
        return { label: 'Likely noise', tone: 'muted' };
    }

    if (strongish(same) && strongish(split)) {
        if (strongish(yoy)) return { label: 'Real & persistent', tone: 'positive' };
        return { label: 'Real signal', tone: 'positive' };
    }

    if (strongish(same) && weakOrNone(split)) {
        return { label: 'Streaky / noisy', tone: 'warn' };
    }

    if (strongish(same) && weakOrNone(yoy) && !strongish(split)) {
        return { label: 'Season-specific', tone: 'warn' };
    }

    if (strongish(yoy)) {
        return { label: 'Carries over', tone: 'positive' };
    }

    return { label: 'Mixed', tone: 'default' };
}

function compareSignalResults(a, b) {
    const maxAbs = (row) => Math.max(
        Math.abs(row.sameSeason?.r ?? 0),
        Math.abs(row.splitHalf?.r ?? 0),
        Math.abs(row.yoy?.r ?? 0)
    );
    const diff = maxAbs(b) - maxAbs(a);
    if (diff !== 0) return diff;
    return (a.label || '').localeCompare(b.label || '');
}

/**
 * Run same-season, split-half, and YoY correlations for every Lab metric at once.
 * @param {Object} allSeasonsData
 * @param {string} [targetKey='pointsFor']
 * @returns {Array<Object>}
 */
function computeCombinedSignalCorrelations(allSeasonsData, targetKey = CORRELATION_TARGET_KEY) {
    const sameRows = buildTeamSeasonRows(allSeasonsData);
    const yoyRows = buildYoYRows(allSeasonsData);
    const splitRows = buildSplitHalfRows(allSeasonsData);

    const results = getLabMetricIds().map((id) => {
        const metric = METRICS_BY_ID[id];
        const sameSeason = computeCorrelationsForMode(sameRows, [id], 'sameSeason', targetKey)[0];
        const yoy = computeCorrelationsForMode(yoyRows, [id], 'yoy', targetKey)[0];
        const splitHalf = computeSplitHalfCorrelations(splitRows, [id])[0];

        return {
            id,
            label: metric?.label || id,
            category: metric?.category || 'Unknown',
            sameSeason,
            yoy,
            splitHalf,
            verdict: interpretSignalVerdict(sameSeason?.r, splitHalf?.r, yoy?.r),
        };
    });

    return results.sort(compareSignalResults);
}

export {
    METRICS,
    METRICS_BY_ID,
    DEFAULT_METRIC_IDS,
    LAB_EXCLUDED_METRIC_IDS,
    LAB_DEFAULT_METRIC_IDS,
    CORRELATION_TARGET_KEY,
    CORRELATION_TARGETS,
    CORRELATION_MODES,
    pearsonCorrelation,
    linearRegression,
    buildTeamSeasonRows,
    buildYoYRows,
    buildSplitHalfRows,
    buildCorrelationRows,
    computeCorrelations,
    computeSplitHalfCorrelations,
    computeCorrelationsForMode,
    computeCombinedSignalCorrelations,
    getCorrelationTarget,
    getCorrelationMode,
    getMetricCategories,
    getLabMetricIds,
    getLabMetrics,
    getLabMetricCategories,
    sortCorrelationResults,
    compareCorrelationResults,
    compareSignalResults,
    interpretCorrelationStrength,
    interpretSignalVerdict,
    classifySignalStrength,
    formatRSquared,
    SIGNAL_STRONG_ABS_R,
};
