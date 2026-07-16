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

function countTeamTrades(teamId, seasonData) {
    return parseExecutedTrades(seasonData).filter((trade) =>
        trade.sides.some((side) => side.teamId === teamId)
    ).length;
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
        compute(team, seasonData) {
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
        compute(team, seasonData) {
            return countWireAddsAndDrops(getTransactions(seasonData), team.id).adds;
        },
    },
    {
        id: 'wireDrops',
        label: 'Waiver/FA drops',
        category: 'Activity',
        description: 'Count of executed waiver and free-agent drops.',
        compute(team, seasonData) {
            return countWireAddsAndDrops(getTransactions(seasonData), team.id).drops;
        },
    },
    {
        id: 'tradeCount',
        label: 'Executed trades',
        category: 'Activity',
        description: 'Number of completed trades involving this team.',
        compute(team, seasonData) {
            return countTeamTrades(team.id, seasonData);
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
            return ctx.rosterMetrics.rosterTotalPoints;
        },
    },
    {
        id: 'topPlayerPoints',
        label: 'Best player points',
        category: 'Roster',
        description: 'Highest single-player season point total on roster.',
        compute(team, seasonData, ctx) {
            return ctx.rosterMetrics.topPlayerPoints;
        },
    },
    {
        id: 'topQBPoints',
        label: 'Best QB points',
        category: 'Roster',
        description: 'Highest QB season points on roster.',
        compute(team, seasonData, ctx) {
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

/**
 * @param {Object} allSeasonsData
 * @returns {Array<Object>}
 */
function buildTeamSeasonRows(allSeasonsData) {
    const ownerMap = buildOwnerMap(allSeasonsData);
    const seasons = getActiveSeasons(allSeasonsData);
    const rows = [];

    seasons.forEach((season) => {
        const seasonData = allSeasonsData[season];
        const teams = getTeams(seasonData);
        const matchups = getRegularSeasonMatchups(seasonData);
        const config = getPlayoffConfig(seasonData?.mSettings || {});
        const recordByTeamId = new Map(
            computeRegularSeasonRecords(getMatchups(seasonData), config.regularSeasonWeeks).map((record) => [
                record.teamId,
                record,
            ])
        );
        const positionMap = buildPlayerPositionMap(seasonData);
        const rosterByTeam = buildSeasonRosterPointsByTeam(seasonData);

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
    });

    return rows;
}

/**
 * @param {Array<Object>} rows
 * @param {string[]} metricIds
 * @param {string} [targetKey='wins']
 * @returns {Array<{ id: string, label: string, category: string, r: number|null, n: number, direction: string, valid: boolean }>}
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

function computeCorrelations(rows, metricIds, targetKey = 'wins') {
    const target = getCorrelationTarget(targetKey);
    const targetValues = rows.map((row) => row[target.key]);

    const results = metricIds.map((id) => {
        const metric = METRICS_BY_ID[id];
        if (!metric) {
            return {
                id,
                label: id,
                category: 'Unknown',
                r: null,
                n: 0,
                direction: '—',
                valid: false,
                excluded: false,
            };
        }

        if (target.excludeMetricIds.includes(id)) {
            return {
                id,
                label: metric.label,
                category: metric.category,
                r: null,
                n: 0,
                direction: 'Same as outcome',
                valid: false,
                excluded: true,
            };
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

        return {
            id,
            label: metric.label,
            category: metric.category,
            r,
            n,
            direction,
            valid,
            excluded: false,
        };
    });

    return sortCorrelationResults(results);
}

function getMetricCategories() {
    return [...new Set(METRICS.map((metric) => metric.category))];
}

export {
    METRICS,
    METRICS_BY_ID,
    DEFAULT_METRIC_IDS,
    CORRELATION_TARGETS,
    pearsonCorrelation,
    linearRegression,
    buildTeamSeasonRows,
    computeCorrelations,
    getCorrelationTarget,
    getMetricCategories,
    sortCorrelationResults,
    compareCorrelationResults,
};
