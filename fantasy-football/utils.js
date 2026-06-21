/**
 * Fantasy Football Utility Functions
 * Helper functions for team data, calculations, and data transformations
 */

/**
 * Whether a season has completed or in-progress games (excludes pre-draft future years).
 * @param {Object} seasonData - Single season data
 * @returns {boolean}
 */
function isSeasonActive(seasonData) {
    const entries = seasonData?.mStandings?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return false;

    const totalGames = entries.reduce((sum, entry) => {
        const record = entry.overallWinLossTie || {};
        return sum + (record.wins || 0) + (record.losses || 0) + (record.ties || 0);
    }, 0);

    return totalGames > 0;
}

/**
 * Season years that have recorded games, sorted ascending.
 * @param {Object} allSeasonsData - Data for all seasons
 * @returns {string[]}
 */
function getActiveSeasons(allSeasonsData) {
    return Object.keys(allSeasonsData)
        .filter((season) => isSeasonActive(allSeasonsData[season]))
        .sort();
}

/**
 * Owner aliases for the same person across seasons (e.g. alternate ESPN account names).
 * Keys and values are normalized lowercase owner names.
 */
const OWNER_ALIASES = {
    'brenda schultz': 'kenyon schultz',
};

/** Preferred display names for normalized owner keys. */
const OWNER_DISPLAY_NAMES = {
    'kenyon schultz': 'Kenyon Schultz',
};

function normalizeOwnerKey(rawOwnerName) {
    const key = rawOwnerName.trim().toLowerCase();
    return OWNER_ALIASES[key] || key;
}

function getCanonicalOwnerName(ownerName) {
    if (!ownerName) return ownerName;
    const key = normalizeOwnerKey(ownerName);
    return OWNER_DISPLAY_NAMES[key] || ownerName;
}

/**
 * Get team name by ID
 * @param {number} teamId - Team ID
 * @param {Array} teams - Array of team objects
 * @returns {string} Team name
 */
function getTeamName(teamId, teams) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return `Team ${teamId}`;
    return team.name || team.abbreviation || `Team ${teamId}`;
}

/**
 * Get team name from team object (handles npm package structure)
 * @param {Object} team - Team object
 * @returns {string} Team name
 */
function getTeamNameFromObject(team) {
    if (!team) return 'Unknown Team';
    return team.name || team.abbreviation || `Team ${team.id}`;
}

/**
 * Stable key for a league manager across seasons.
 * Uses ownerName when available (survives team renames); falls back to team slot ID.
 * @param {Object} team - Team object
 * @returns {string} Owner key
 */
function getOwnerKey(team) {
    if (!team) return 'unknown';
    if (team.ownerName) {
        return normalizeOwnerKey(team.ownerName);
    }
    if (team.id != null) return `team-${team.id}`;
    return 'unknown';
}

/**
 * Display name for a manager, preferring ownerName over team name.
 * @param {Object} team - Team object
 * @returns {string} Manager display name
 */
function getOwnerDisplayName(team) {
    if (!team) return 'Unknown Manager';
    if (team.ownerName) return getCanonicalOwnerName(team.ownerName);
    return getTeamNameFromObject(team);
}

/**
 * Build a registry of managers keyed by stable team slot ID across all seasons.
 * @param {Object} allSeasonsData - Data for all seasons
 * @returns {Object} Map of ownerKey -> { id, ownerName, latestTeamName }
 */
function buildOwnerMap(allSeasonsData) {
    const owners = {};

    Object.values(allSeasonsData).forEach((seasonData) => {
        getTeams(seasonData).forEach((team) => {
            const key = getOwnerKey(team);
            if (!owners[key]) {
                owners[key] = {
                    id: team.id,
                    ownerName: getOwnerDisplayName(team),
                    latestTeamName: team.name || team.abbreviation || null,
                };
                return;
            }

            owners[key].ownerName = getOwnerDisplayName(team);
            if (team.name || team.abbreviation) {
                owners[key].latestTeamName = team.name || team.abbreviation;
            }
        });
    });

    return owners;
}

/**
 * Resolve a manager label from the cross-season owner registry.
 * @param {string|number} ownerKey - Stable owner key (team slot ID)
 * @param {Object} ownerMap - Output from buildOwnerMap
 * @returns {string} Manager display name
 */
function getOwnerLabel(ownerKey, ownerMap) {
    const owner = ownerMap[ownerKey];
    if (owner) return owner.ownerName;
    if (OWNER_DISPLAY_NAMES[ownerKey]) return OWNER_DISPLAY_NAMES[ownerKey];
    if (ownerKey.startsWith('team-')) return `Team ${ownerKey.slice(5)}`;
    return ownerKey;
}

/**
 * Get team total points (handles npm package structure)
 * @param {Object} team - Team object
 * @returns {number} Total points
 */
function getTeamTotalPoints(team) {
    if (!team) return 0;
    return team.totalPointsScored || team.regularSeasonPointsFor || team.totalPoints || 0;
}

/**
 * Calculate average points scored per game for a team
 * @param {number} teamId - Team ID
 * @param {Array} matchups - Array of matchup objects
 * @returns {number} Average points for
 */
function calculatePointsFor(teamId, matchups) {
    let totalPF = 0;
    let games = 0;

    matchups.forEach((matchup) => {
        if (matchup.homeTeamId === teamId && matchup.homeScore != null) {
            totalPF += matchup.homeScore;
            games += 1;
        } else if (matchup.awayTeamId === teamId && matchup.awayScore != null) {
            totalPF += matchup.awayScore;
            games += 1;
        }
    });

    return games > 0 ? totalPF / games : 0;
}

/**
 * Regular-season matchups with scored results.
 * @param {Object} seasonData - Single season data
 * @returns {Array}
 */
function getRegularSeasonMatchups(seasonData) {
    const config = getPlayoffConfig(seasonData?.mSettings || {});
    return getMatchups(seasonData).filter((matchup) => {
        const week = matchup.matchupPeriodId || 0;
        return (
            week >= 1 &&
            week <= config.regularSeasonWeeks &&
            matchup.homeScore != null &&
            matchup.awayScore != null &&
            matchup.homeTeamId != null &&
            matchup.awayTeamId != null
        );
    });
}

/**
 * Calculate points against for a team
 * @param {number} teamId - Team ID
 * @param {Array} matchups - Array of matchup objects
 * @param {Array} teams - Array of team objects (unused but kept for API compatibility)
 * @returns {number} Average points against
 */
function calculatePointsAgainst(teamId, matchups, teams) {
    let totalPA = 0;
    let games = 0;
    
    matchups.forEach(matchup => {
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
 * Weekly opponent scores faced by a team (regular-season matchups only).
 * @param {number} teamId
 * @param {Array} matchups
 * @returns {number[]}
 */
function collectWeeklyPointsAgainst(teamId, matchups) {
    const scores = [];

    matchups.forEach((matchup) => {
        if (matchup.homeTeamId === teamId && matchup.awayScore != null) {
            scores.push(matchup.awayScore);
        } else if (matchup.awayTeamId === teamId && matchup.homeScore != null) {
            scores.push(matchup.homeScore);
        }
    });

    return scores;
}

function calculateMedian(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/**
 * Opponent score minus the league median score that week (schedule-adjusted difficulty).
 * Positive = faced a hotter-than-usual opponent that week.
 * @param {number} teamId
 * @param {Object} seasonData
 * @returns {number[]}
 */
function collectWeeklyRelativePointsAgainst(teamId, seasonData) {
    const matchups = getRegularSeasonMatchups(seasonData);
    const scoresByWeek = new Map();

    matchups.forEach((matchup) => {
        const week = matchup.matchupPeriodId;
        if (!scoresByWeek.has(week)) scoresByWeek.set(week, []);
        scoresByWeek.get(week).push(matchup.homeScore, matchup.awayScore);
    });

    const weekMedians = new Map();
    scoresByWeek.forEach((scores, week) => {
        weekMedians.set(week, calculateMedian(scores));
    });

    const relative = [];
    matchups.forEach((matchup) => {
        const week = matchup.matchupPeriodId;
        const baseline = weekMedians.get(week) ?? 0;
        if (matchup.homeTeamId === teamId && matchup.awayScore != null) {
            relative.push(matchup.awayScore - baseline);
        } else if (matchup.awayTeamId === teamId && matchup.homeScore != null) {
            relative.push(matchup.homeScore - baseline);
        }
    });

    return relative;
}

/**
 * @param {Array<number>} scores - Array of scores
 * @returns {number} Standard deviation
 */
function calculateConsistency(scores) {
    if (scores.length === 0) return 0;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
}

/**
 * Calculate average of an array of numbers
 * @param {Array<number>} numbers - Array of numbers
 * @returns {number} Average value
 */
function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Get all teams from season data
 * @param {Object} allSeasonsData - Data for all seasons
 * @returns {Set} Set of unique team objects (as JSON strings)
 */
function getAllTeams(allSeasonsData) {
    const teams = new Set();
    Object.values(allSeasonsData).forEach(seasonData => {
        (seasonData.mTeam || []).forEach(team => {
            teams.add(JSON.stringify({ id: team.id, name: getTeamNameFromObject(team) }));
        });
    });
    return Array.from(teams).map(t => JSON.parse(t));
}

/**
 * Get matchups from season data
 * @param {Object} seasonData - Single season data
 * @returns {Array} Array of matchup objects
 */
function getMatchups(seasonData) {
    return seasonData?.mMatchup?.schedule || [];
}

/**
 * Get teams from season data
 * @param {Object} seasonData - Single season data
 * @returns {Array} Array of team objects
 */
function getTeams(seasonData) {
    return Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
}

/**
 * Read playoff configuration from league settings.
 * @param {Object} mSettings - League settings view
 * @returns {{ regularSeasonWeeks: number, playoffTeamCount: number, playoffWeekCount: number }}
 */
function getPlayoffConfig(mSettings) {
    const scheduleSettings = mSettings?.scheduleSettings || {};
    return {
        regularSeasonWeeks: scheduleSettings.numberOfRegularSeasonMatchups ?? 14,
        playoffTeamCount: scheduleSettings.numberOfPlayoffTeams ?? 4,
        playoffWeekCount: scheduleSettings.numberOfPlayoffMatchups ?? 2,
    };
}

/**
 * Build regular-season standings from weekly matchups.
 * @param {Array} matchups - Matchup schedule
 * @param {number} regularSeasonWeeks - Last regular-season matchup period
 * @returns {Array<{ teamId: number, wins: number, losses: number, ties: number, pointsFor: number }>}
 */
function computeRegularSeasonRecords(matchups, regularSeasonWeeks) {
    const records = {};

    const ensureRecord = (teamId) => {
        if (!records[teamId]) {
            records[teamId] = { teamId, wins: 0, losses: 0, ties: 0, pointsFor: 0 };
        }
        return records[teamId];
    };

    matchups.forEach((matchup) => {
        const week = matchup.matchupPeriodId || 0;
        if (week < 1 || week > regularSeasonWeeks) return;
        if (matchup.homeScore == null || matchup.awayScore == null) return;
        if (matchup.homeTeamId == null || matchup.awayTeamId == null) return;

        const home = ensureRecord(matchup.homeTeamId);
        const away = ensureRecord(matchup.awayTeamId);
        home.pointsFor += matchup.homeScore;
        away.pointsFor += matchup.awayScore;

        if (matchup.homeScore > matchup.awayScore) {
            home.wins += 1;
            away.losses += 1;
        } else if (matchup.awayScore > matchup.homeScore) {
            away.wins += 1;
            home.losses += 1;
        } else {
            home.ties += 1;
            away.ties += 1;
        }
    });

    return Object.values(records).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
    });
}

function isCompletedMatchup(matchup) {
    return (
        matchup?.homeScore != null &&
        matchup?.awayScore != null &&
        matchup?.homeTeamId != null &&
        matchup?.awayTeamId != null
    );
}

function getMatchupWinnerTeamId(matchup) {
    if (!isCompletedMatchup(matchup)) return null;
    if (matchup.winner === 'HOME') return matchup.homeTeamId;
    if (matchup.winner === 'AWAY') return matchup.awayTeamId;
    if (matchup.homeScore > matchup.awayScore) return matchup.homeTeamId;
    if (matchup.awayScore > matchup.homeScore) return matchup.awayTeamId;
    return null;
}

/**
 * Read the champion from ESPN's winners-bracket championship game when available.
 * @param {Array} matchups
 * @param {{ regularSeasonWeeks: number, playoffWeekCount: number }} config
 * @returns {number|null}
 */
function getChampionFromWinnersBracketGame(matchups, config) {
    const firstPlayoffWeek = config.regularSeasonWeeks + 1;
    const lastPlayoffWeek = config.regularSeasonWeeks + config.playoffWeekCount;

    for (let week = lastPlayoffWeek; week >= firstPlayoffWeek; week -= 1) {
        const championshipGames = matchups.filter(
            (matchup) =>
                matchup.matchupPeriodId === week &&
                matchup.playoffTierType === 'WINNERS_BRACKET' &&
                isCompletedMatchup(matchup)
        );

        if (championshipGames.length !== 1) continue;

        const winnerId = getMatchupWinnerTeamId(championshipGames[0]);
        if (winnerId != null) return winnerId;
    }

    return null;
}

/**
 * Fallback bracket simulation when ESPN playoff metadata is unavailable.
 * @param {Array} matchups
 * @param {{ regularSeasonWeeks: number, playoffWeekCount: number }} config
 * @param {number[]} seedTeamIds
 * @returns {number|null}
 */
function simulateWinnersBracketChampion(matchups, config, seedTeamIds) {
    let bracketTeams = new Set(seedTeamIds);
    let championId = null;
    const firstWeek = config.regularSeasonWeeks + 1;
    const lastWeek = config.regularSeasonWeeks + config.playoffWeekCount;

    for (let week = firstWeek; week <= lastWeek; week += 1) {
        const winnersGames = matchups.filter(
            (matchup) =>
                matchup.matchupPeriodId === week &&
                isCompletedMatchup(matchup) &&
                bracketTeams.has(matchup.homeTeamId) &&
                bracketTeams.has(matchup.awayTeamId)
        );

        if (!winnersGames.length) continue;

        const roundWinners = new Set();
        winnersGames.forEach((matchup) => {
            const winnerId = getMatchupWinnerTeamId(matchup);
            if (winnerId != null) roundWinners.add(winnerId);
        });

        bracketTeams = roundWinners;
        if (roundWinners.size === 1) {
            championId = [...roundWinners][0];
        }
    }

    if (!championId && bracketTeams.size === 1) {
        championId = [...bracketTeams][0];
    }

    return championId;
}

/**
 * Determine the champion from the winners bracket.
 * Prefers ESPN's tagged championship game; falls back to bracket simulation.
 * @param {Array} matchups - Full matchup schedule
 * @param {{ regularSeasonWeeks: number, playoffWeekCount: number }} config
 * @param {number[]} seedTeamIds - Championship bracket seeds
 * @returns {number|null} Champion team ID
 */
function getWinnersBracketChampion(matchups, config, seedTeamIds) {
    const taggedChampion = getChampionFromWinnersBracketGame(matchups, config);
    if (taggedChampion != null) return taggedChampion;
    return simulateWinnersBracketChampion(matchups, config, seedTeamIds);
}

/**
 * Derive championship-bracket seeds and champion for a season.
 * @param {Object} seasonData - Single season data
 * @returns {{ config: Object, seedTeamIds: number[], championTeamId: number|null }|null}
 */
function analyzeSeasonPlayoffs(seasonData) {
    const matchups = getMatchups(seasonData);
    if (!Array.isArray(matchups) || !matchups.length || !seasonData?.mSettings) {
        return null;
    }

    const config = getPlayoffConfig(seasonData.mSettings);
    const records = computeRegularSeasonRecords(matchups, config.regularSeasonWeeks);
    const seedTeamIds = records.slice(0, config.playoffTeamCount).map((record) => record.teamId);
    const championTeamId = getWinnersBracketChampion(matchups, config, seedTeamIds);

    return { config, seedTeamIds, championTeamId };
}

const WIRE_TRANSACTION_TYPES = new Set(['WAIVER', 'WAIVER_ERROR', 'FREEAGENT']);

/**
 * @param {Object} seasonData
 * @returns {Array|null} null when the view failed to load
 */
function getTransactions(seasonData) {
    const raw = seasonData?.mTransactions;
    if (raw == null) return null;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.transactions)) return raw.transactions;
    return [];
}

function hasTransactionView(seasonData) {
    return seasonData?.mTransactions != null;
}

function isExecutedTransaction(transaction) {
    return transaction?.status === 'EXECUTED';
}

function isWireTransaction(transaction) {
    return WIRE_TRANSACTION_TYPES.has(transaction?.type);
}

function countWireAddsAndDrops(transactions, teamId = null) {
    let adds = 0;
    let drops = 0;
    if (!Array.isArray(transactions)) return { adds, drops };

    const teamFilter = teamId == null ? null : Number(teamId);

    transactions.forEach((transaction) => {
        if (!isWireTransaction(transaction) || !isExecutedTransaction(transaction)) return;

        (transaction.items || []).forEach((item) => {
            if (item.type === 'ADD' && (teamFilter == null || Number(item.toTeamId) === teamFilter)) {
                adds += 1;
            } else if (item.type === 'DROP' && (teamFilter == null || Number(item.fromTeamId) === teamFilter)) {
                drops += 1;
            }
        });
    });

    return { adds, drops };
}

function isExecutedTrade(transaction) {
    if (!transaction) return false;
    if (transaction.type === 'TRADE_DECLINE' || transaction.type === 'TRADE_VETO') return false;
    if (transaction.status === 'EXECUTED') {
        return transaction.type === 'TRADE_ACCEPT' || (transaction.items || []).some((item) => item.type === 'TRADE');
    }
    return (
        transaction.type === 'TRADE_ACCEPT' &&
        transaction.executionType === 'EXECUTE' &&
        transaction.isPending === false
    );
}

const TRADE_ACTIVITY_TYPES = new Set([
    'TRADE_ACCEPT',
    'TRADE_PROPOSAL',
    'TRADE_UPHOLD',
    'TRADE_VETO',
    'TRADE_DECLINE',
    'TRADE_REJECT',
]);

/** @param {number} ms */
const STUB_PAIR_WINDOW_MS = 45 * 60 * 1000;

function isTradeActivity(transaction) {
    if (!transaction) return false;
    if (TRADE_ACTIVITY_TYPES.has(transaction.type)) return true;
    return (transaction.items || []).some((item) => item.type === 'TRADE');
}

function getTradeGroupKey(transaction) {
    return transaction.relatedTransactionId || transaction.id;
}

function isDeclinedOrVetoedTradeGroup(copies) {
    const hasAccept = copies.some(
        (tx) => tx.type === 'TRADE_ACCEPT' && tx.executionType === 'EXECUTE' && tx.isPending === false
    );
    const hasExecuted = copies.some((tx) => tx.status === 'EXECUTED' && tx.type !== 'TRADE_DECLINE');
    if (hasAccept || hasExecuted) return false;
    return copies.some(
        (tx) => tx.type === 'TRADE_DECLINE' || tx.type === 'TRADE_VETO' || tx.status === 'CANCELED'
    );
}

function isCompletedTradeGroup(copies) {
    if (isDeclinedOrVetoedTradeGroup(copies)) return false;
    if (copies.some((tx) => tx.status === 'EXECUTED' && tx.type !== 'TRADE_DECLINE' && tx.type !== 'TRADE_VETO')) {
        return true;
    }
    return copies.some(
        (tx) => tx.type === 'TRADE_ACCEPT' && tx.executionType === 'EXECUTE' && tx.isPending === false
    );
}

function mergeTradeItems(copies) {
    const seen = new Set();
    const merged = [];

    copies.forEach((transaction) => {
        (transaction.items || []).forEach((item) => {
            if (item.type !== 'TRADE') return;
            const key = `${item.fromTeamId}|${item.toTeamId}|${item.playerId}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        });
    });

    return merged;
}

function participantTeamIdsFromCopies(copies) {
    const teams = new Set();

    copies.forEach((transaction) => {
        if (transaction.type === 'TRADE_ACCEPT' && transaction.teamId) {
            teams.add(transaction.teamId);
        }
        if (transaction.teamActions) {
            Object.keys(transaction.teamActions).forEach((teamId) => teams.add(Number(teamId)));
        }
    });

    teams.delete(0);
    return teams;
}

function buildTradeSidesFromMoves(teamMoves, teams) {
    return [...teamMoves.entries()].map(([teamId, moves]) => {
        const team = teams.find((entry) => entry.id === teamId);
        return {
            teamId,
            ownerKey: getOwnerKey(team),
            manager: getOwnerDisplayName(team),
            sent: moves.sent,
            received: moves.received,
        };
    });
}

function buildPartialTradeSides(teamIds, teams) {
    return teamIds.map((teamId) => {
        const team = teams.find((entry) => entry.id === teamId);
        return {
            teamId,
            ownerKey: getOwnerKey(team),
            manager: getOwnerDisplayName(team),
            sent: [],
            received: [],
            detailsUnavailable: true,
        };
    });
}

function buildTradeFromItems(groupKey, copies, tradeItems, teams, playerNameMap) {
    const teamMoves = new Map();

    tradeItems.forEach((item) => {
        if (!teamMoves.has(item.fromTeamId)) {
            teamMoves.set(item.fromTeamId, { sent: [], received: [] });
        }
        if (!teamMoves.has(item.toTeamId)) {
            teamMoves.set(item.toTeamId, { sent: [], received: [] });
        }

        const playerName = resolvePlayerName(item.playerId, playerNameMap);
        teamMoves.get(item.fromTeamId).sent.push(playerName);
        teamMoves.get(item.toTeamId).received.push(playerName);
    });

    teamMoves.delete(0);

    const processedAt = copies.reduce((best, transaction) => {
        const timestamp = transaction.processDate || transaction.acceptedDate || transaction.proposedDate || 0;
        return timestamp > best ? timestamp : best;
    }, 0);

    return {
        id: groupKey,
        week: copies[0]?.scoringPeriodId || 0,
        processedAt: processedAt || null,
        sides: buildTradeSidesFromMoves(teamMoves, teams),
        partial: false,
    };
}

function pairOrphanTradeStubs(stubs, teams) {
    const trades = [];
    const byWeek = new Map();

    stubs.forEach((stub) => {
        if (!byWeek.has(stub.week)) byWeek.set(stub.week, []);
        byWeek.get(stub.week).push(stub);
    });

    byWeek.forEach((weekStubs) => {
        const unmatched = [...weekStubs];

        while (unmatched.length >= 2) {
            let bestPair = null;
            let bestDelta = Infinity;

            for (let i = 0; i < unmatched.length; i += 1) {
                for (let j = i + 1; j < unmatched.length; j += 1) {
                    const left = unmatched[i];
                    const right = unmatched[j];
                    const sharedTeam = [...left.participantTeams].some((teamId) => right.participantTeams.has(teamId));
                    if (sharedTeam) continue;

                    const delta = Math.abs(left.proposedDate - right.proposedDate);
                    if (delta <= STUB_PAIR_WINDOW_MS && delta < bestDelta) {
                        bestDelta = delta;
                        bestPair = [i, j];
                    }
                }
            }

            if (!bestPair) break;

            const [leftIndex, rightIndex] = bestPair;
            const second = unmatched.splice(Math.max(leftIndex, rightIndex), 1)[0];
            const first = unmatched.splice(Math.min(leftIndex, rightIndex), 1)[0];
            const teamIds = [...new Set([...first.participantTeams, ...second.participantTeams])];

            trades.push({
                id: `paired-${first.groupKey}-${second.groupKey}`,
                week: first.week,
                processedAt: Math.max(first.proposedDate, second.proposedDate) || null,
                sides: buildPartialTradeSides(teamIds, teams),
                partial: true,
            });
        }

        unmatched.forEach((stub) => {
            const teamIds = [...stub.participantTeams];
            if (!teamIds.length) return;

            trades.push({
                id: stub.groupKey,
                week: stub.week,
                processedAt: stub.proposedDate || null,
                sides: buildPartialTradeSides(teamIds, teams),
                partial: true,
            });
        });
    });

    return trades;
}

/**
 * Build playerId -> name lookup from kona_player_info.
 * @param {Array} players
 * @returns {Map<number, string>}
 */
function buildPlayerNameMap(players) {
    const map = new Map();
    (players || []).forEach((player) => {
        if (player?.id != null && player.fullName) {
            map.set(player.id, player.fullName);
        }
    });
    return map;
}

function resolvePlayerName(playerId, playerNameMap) {
    if (playerNameMap.has(playerId)) {
        return playerNameMap.get(playerId);
    }
    if (playerId < 0) {
        return `D/ST (${Math.abs(playerId)})`;
    }
    return `Player ${playerId}`;
}

/**
 * Parse executed trades for a season (player names when kona_player_info is available).
 * @param {Object} seasonData
 * @returns {Array<{ id: string, week: number, processedAt: number|null, sides: Array }>}
 */
function parseExecutedTrades(seasonData) {
    const teams = getTeams(seasonData);
    const playerNameMap = buildPlayerNameMap(seasonData?.kona_player_info?.players);
    const tradeActivity = (getTransactions(seasonData) || []).filter(isTradeActivity);

    const groups = new Map();
    tradeActivity.forEach((transaction) => {
        const groupKey = getTradeGroupKey(transaction);
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(transaction);
    });

    const trades = [];
    const orphanStubs = [];

    groups.forEach((copies, groupKey) => {
        if (!isCompletedTradeGroup(copies)) return;

        const tradeItems = mergeTradeItems(copies);
        if (tradeItems.length >= 2) {
            trades.push(buildTradeFromItems(groupKey, copies, tradeItems, teams, playerNameMap));
            return;
        }

        const participants = participantTeamIdsFromCopies(copies);
        const acceptTeams = new Set(
            copies
                .filter((transaction) => transaction.type === 'TRADE_ACCEPT')
                .map((transaction) => transaction.teamId)
                .filter(Boolean)
        );
        const mergedParticipants = participants.size ? participants : acceptTeams;

        if (mergedParticipants.size >= 2) {
            const processedAt = copies.reduce(
                (best, transaction) => Math.max(best, transaction.proposedDate || 0),
                0
            );
            trades.push({
                id: groupKey,
                week: copies[0]?.scoringPeriodId || 0,
                processedAt: processedAt || null,
                sides: buildPartialTradeSides([...mergedParticipants], teams),
                partial: true,
            });
            return;
        }

        if (mergedParticipants.size === 1) {
            orphanStubs.push({
                groupKey,
                week: copies[0]?.scoringPeriodId || 0,
                proposedDate: copies.reduce(
                    (best, transaction) => Math.max(best, transaction.proposedDate || 0),
                    0
                ),
                participantTeams: mergedParticipants,
            });
        }
    });

    trades.push(...pairOrphanTradeStubs(orphanStubs, teams));

    return trades.sort((left, right) => {
        if (left.week !== right.week) return left.week - right.week;
        return (left.processedAt || 0) - (right.processedAt || 0);
    });
}

/**
 * Stable key for an unordered pair of managers in a trade relationship.
 * @param {string} keyA
 * @param {string} keyB
 * @returns {string}
 */
function buildTradePairKey(keyA, keyB) {
    return [keyA, keyB].sort().join('|');
}

/**
 * Build node/link data for a trade sociogram from parsed trades.
 * Link weight is the number of executed trades between two managers.
 * @param {Array} trades - Output of parseExecutedTrades
 * @returns {{ nodes: Array, links: Array }}
 */
function buildTradeSociogramData(trades) {
    const nodeMap = new Map();
    const linkMap = new Map();

    (trades || []).forEach((trade) => {
        const sideByKey = new Map(
            (trade.sides || [])
                .filter((side) => side.ownerKey)
                .map((side) => [side.ownerKey, side])
        );
        const ownerKeys = [...sideByKey.keys()];

        ownerKeys.forEach((ownerKey) => {
            if (!nodeMap.has(ownerKey)) {
                const side = sideByKey.get(ownerKey);
                nodeMap.set(ownerKey, {
                    id: ownerKey,
                    label: side?.manager || ownerKey,
                    tradeCount: 0,
                });
            }
            nodeMap.get(ownerKey).tradeCount += 1;
        });

        for (let i = 0; i < ownerKeys.length; i += 1) {
            for (let j = i + 1; j < ownerKeys.length; j += 1) {
                const pairKey = buildTradePairKey(ownerKeys[i], ownerKeys[j]);
                if (!linkMap.has(pairKey)) {
                    linkMap.set(pairKey, {
                        id: pairKey,
                        source: ownerKeys[i],
                        target: ownerKeys[j],
                        count: 0,
                        trades: [],
                    });
                }
                const link = linkMap.get(pairKey);
                link.count += 1;
                link.trades.push(trade);
            }
        }
    });

    return {
        nodes: [...nodeMap.values()],
        links: [...linkMap.values()],
    };
}

/**
 * Parse executed trades across every loaded season.
 * @param {Object} allSeasonsData
 * @returns {Array}
 */
function parseAllExecutedTrades(allSeasonsData) {
    return getActiveSeasons(allSeasonsData).flatMap((season) =>
        parseExecutedTrades(allSeasonsData[season]).map((trade) => ({
            ...trade,
            season,
        }))
    );
}

/**
 * Points-over-replacement trade impact (not yet implemented).
 * @param {Object} _trade - Parsed trade from parseExecutedTrades
 * @param {Object} _seasonData
 * @returns {null}
 */
function analyzeTradePointsOverReplacement(_trade, _seasonData) {
    return null;
}

export {
    getTeamName,
    getTeamNameFromObject,
    getOwnerKey,
    getOwnerDisplayName,
    buildOwnerMap,
    getOwnerLabel,
    isSeasonActive,
    getActiveSeasons,
    getTeamTotalPoints,
    calculatePointsAgainst,
    calculatePointsFor,
    collectWeeklyPointsAgainst,
    collectWeeklyRelativePointsAgainst,
    calculateMedian,
    getRegularSeasonMatchups,
    calculateConsistency,
    calculateAverage,
    getAllTeams,
    getMatchups,
    getTeams,
    getPlayoffConfig,
    computeRegularSeasonRecords,
    getWinnersBracketChampion,
    analyzeSeasonPlayoffs,
    getTransactions,
    hasTransactionView,
    isWireTransaction,
    isExecutedTransaction,
    countWireAddsAndDrops,
    isExecutedTrade,
    buildPlayerNameMap,
    resolvePlayerName,
    parseExecutedTrades,
    parseAllExecutedTrades,
    buildTradePairKey,
    buildTradeSociogramData,
    analyzeTradePointsOverReplacement,
};

