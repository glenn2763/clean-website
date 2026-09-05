/**
 * Tests for utility functions
 */

import {
    buildTeamSeasonRows,
    computeCorrelations,
    computeCombinedSignalCorrelations,
    getLabMetricIds,
    interpretSignalVerdict,
    linearRegression,
    pearsonCorrelation,
} from '../metrics.js';
import { 
    getTeamNameFromObject,
    getOwnerDisplayName,
    getOwnerKey,
    isSeasonActive,
    computeRegularSeasonRecords,
    getWinnersBracketChampion,
    analyzeSeasonPlayoffs,
    calculateConsistency, 
    calculateAverage,
    calculatePointsAgainst,
    countWireAddsAndDrops,
    collectWeeklyPointsAgainst,
    collectWeeklyRelativePointsAgainst,
    isExecutedTrade,
    parseExecutedTrades,
    buildTradeSociogramData,
    buildTradePairKey,
} from '../utils.js';

/**
 * Simple test runner
 */
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('Running tests...\n');
        
        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`✓ ${name}`);
                this.passed++;
            } catch (error) {
                console.error(`✗ ${name}`);
                console.error(`  ${error.message}`);
                this.failed++;
            }
        }
        
        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
}

const runner = new TestRunner();

// Test getTeamNameFromObject
runner.test('getTeamNameFromObject returns name when available', () => {
    const team = { id: 1, name: 'Test Team' };
    const result = getTeamNameFromObject(team);
    if (result !== 'Test Team') {
        throw new Error(`Expected 'Test Team', got '${result}'`);
    }
});

runner.test('getTeamNameFromObject returns abbreviation when name missing', () => {
    const team = { id: 1, abbreviation: 'TT' };
    const result = getTeamNameFromObject(team);
    if (result !== 'TT') {
        throw new Error(`Expected 'TT', got '${result}'`);
    }
});

runner.test('getTeamNameFromObject returns fallback for null team', () => {
    const result = getTeamNameFromObject(null);
    if (result !== 'Unknown Team') {
        throw new Error(`Expected 'Unknown Team', got '${result}'`);
    }
});

runner.test('getOwnerDisplayName prefers ownerName over team name', () => {
    const team = { id: 1, name: 'Bijan Peter Dixon', ownerName: 'Nick Conrad' };
    const result = getOwnerDisplayName(team);
    if (result !== 'Nick Conrad') {
        throw new Error(`Expected 'Nick Conrad', got '${result}'`);
    }
});

runner.test('getOwnerKey uses ownerName for cross-season identity', () => {
    const team = { id: 11, name: 'Lisan al-Brooksib', ownerName: 'Glenn Wysen' };
    const result = getOwnerKey(team);
    if (result !== 'glenn wysen') {
        throw new Error(`Expected 'glenn wysen', got '${result}'`);
    }
});

runner.test('getOwnerKey falls back to team slot when ownerName missing', () => {
    const team = { id: 3, name: 'BIN Reaper' };
    const result = getOwnerKey(team);
    if (result !== 'team-3') {
        throw new Error(`Expected 'team-3', got '${result}'`);
    }
});

runner.test('isSeasonActive returns false for pre-season year with 0-0 records', () => {
    const seasonData = {
        mStandings: {
            entries: [
                { overallWinLossTie: { wins: 0, losses: 0 } },
                { overallWinLossTie: { wins: 0, losses: 0 } },
            ],
        },
    };
    if (isSeasonActive(seasonData)) {
        throw new Error('Expected inactive season');
    }
});

runner.test('isSeasonActive returns true when games have been played', () => {
    const seasonData = {
        mStandings: {
            entries: [
                { overallWinLossTie: { wins: 8, losses: 6 } },
            ],
        },
    };
    if (!isSeasonActive(seasonData)) {
        throw new Error('Expected active season');
    }
});

runner.test('getOwnerKey merges Brenda Schultz into Kenyon Schultz', () => {
    const brenda = { id: 4, name: 'Ave Rats', ownerName: 'Brenda Schultz' };
    const kenyon = { id: 4, name: 'End Zone Edgers', ownerName: 'Kenyon Schultz' };
    if (getOwnerKey(brenda) !== getOwnerKey(kenyon)) {
        throw new Error('Expected Brenda and Kenyon to share the same owner key');
    }
    if (getOwnerDisplayName(brenda) !== 'Kenyon Schultz') {
        throw new Error(`Expected canonical name Kenyon Schultz, got '${getOwnerDisplayName(brenda)}'`);
    }
});

runner.test('getWinnersBracketChampion uses ESPN WINNERS_BRACKET championship game', () => {
    const seasonData = {
        mSettings: {
            scheduleSettings: {
                numberOfRegularSeasonMatchups: 14,
                numberOfPlayoffTeams: 6,
                numberOfPlayoffMatchups: 3,
            },
        },
        mMatchup: {
            schedule: [
                {
                    matchupPeriodId: 17,
                    homeTeamId: 13,
                    awayTeamId: 10,
                    homeScore: 142.32,
                    awayScore: 100.84,
                    playoffTierType: 'WINNERS_BRACKET',
                    winner: 'HOME',
                },
                {
                    matchupPeriodId: 17,
                    homeTeamId: 1,
                    awayTeamId: 9,
                    homeScore: 126.1,
                    awayScore: 110.14,
                    playoffTierType: 'WINNERS_CONSOLATION_LADDER',
                    winner: 'HOME',
                },
            ],
        },
    };

    const analysis = analyzeSeasonPlayoffs(seasonData);
    if (analysis?.championTeamId !== 13) {
        throw new Error(`Expected team 13 to win championship, got ${analysis?.championTeamId}`);
    }
});

runner.test('getWinnersBracketChampion ignores consolation games', () => {
    const matchups = [
        { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 100, awayScore: 90 },
        { matchupPeriodId: 1, homeTeamId: 3, awayTeamId: 4, homeScore: 80, awayScore: 70 },
        { matchupPeriodId: 1, homeTeamId: 5, awayTeamId: 6, homeScore: 60, awayScore: 50 },
        { matchupPeriodId: 2, homeTeamId: 1, awayTeamId: 4, homeScore: 110, awayScore: 100 },
        { matchupPeriodId: 2, homeTeamId: 3, awayTeamId: 2, homeScore: 95, awayScore: 85 },
        { matchupPeriodId: 2, homeTeamId: 5, awayTeamId: 6, homeScore: 55, awayScore: 45 },
        { matchupPeriodId: 3, homeTeamId: 1, awayTeamId: 3, homeScore: 120, awayScore: 115 },
        { matchupPeriodId: 3, homeTeamId: 5, awayTeamId: 6, homeScore: 50, awayScore: 40 },
    ];
    const config = { regularSeasonWeeks: 1, playoffWeekCount: 2 };
    const seeds = [1, 3, 4, 2];
    const champion = getWinnersBracketChampion(matchups, config, seeds);
    if (champion !== 1) {
        throw new Error(`Expected team 1 to win bracket, got ${champion}`);
    }
});

runner.test('analyzeSeasonPlayoffs uses numberOfPlayoffTeams from settings', () => {
    const seasonData = {
        mSettings: {
            scheduleSettings: {
                numberOfRegularSeasonMatchups: 1,
                numberOfPlayoffTeams: 2,
                numberOfPlayoffMatchups: 1,
            },
        },
        mMatchup: {
            schedule: [
                { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 100, awayScore: 90 },
                { matchupPeriodId: 1, homeTeamId: 3, awayTeamId: 4, homeScore: 80, awayScore: 70 },
                { matchupPeriodId: 2, homeTeamId: 1, awayTeamId: 3, homeScore: 110, awayScore: 105 },
                { matchupPeriodId: 2, homeTeamId: 2, awayTeamId: 4, homeScore: 95, awayScore: 85 },
            ],
        },
    };
    const analysis = analyzeSeasonPlayoffs(seasonData);
    if (!analysis || analysis.seedTeamIds.length !== 2) {
        throw new Error(`Expected 2 playoff seeds, got ${analysis?.seedTeamIds?.length}`);
    }
    if (!analysis.seedTeamIds.includes(1) || !analysis.seedTeamIds.includes(3)) {
        throw new Error('Expected top two regular-season teams to make the bracket');
    }
    if (analysis.championTeamId !== 1) {
        throw new Error(`Expected team 1 to be champion, got ${analysis.championTeamId}`);
    }
});

// Test calculateConsistency
runner.test('calculateConsistency returns 0 for empty array', () => {
    const result = calculateConsistency([]);
    if (result !== 0) {
        throw new Error(`Expected 0, got ${result}`);
    }
});

runner.test('calculateConsistency calculates standard deviation correctly', () => {
    const scores = [10, 20, 30, 40, 50];
    const result = calculateConsistency(scores);
    // Mean is 30, variance is 200, std dev is ~14.14
    const expected = Math.sqrt(200);
    if (Math.abs(result - expected) > 0.01) {
        throw new Error(`Expected ~${expected.toFixed(2)}, got ${result.toFixed(2)}`);
    }
});

runner.test('calculateConsistency returns 0 for single value', () => {
    const result = calculateConsistency([42]);
    if (result !== 0) {
        throw new Error(`Expected 0, got ${result}`);
    }
});

// Test calculateAverage
runner.test('calculateAverage returns 0 for empty array', () => {
    const result = calculateAverage([]);
    if (result !== 0) {
        throw new Error(`Expected 0, got ${result}`);
    }
});

runner.test('calculateAverage calculates mean correctly', () => {
    const numbers = [10, 20, 30];
    const result = calculateAverage(numbers);
    if (result !== 20) {
        throw new Error(`Expected 20, got ${result}`);
    }
});

// Test calculatePointsAgainst
runner.test('calculatePointsAgainst calculates average correctly', () => {
    const teamId = 1;
    const matchups = [
        { homeTeamId: 1, awayTeamId: 2, homeScore: 100, awayScore: 90 },
        { homeTeamId: 2, awayTeamId: 1, homeScore: 80, awayScore: 110 },
        { homeTeamId: 1, awayTeamId: 3, homeScore: 120, awayScore: 100 }
    ];
    const teams = [];
    
    // Team 1 played 3 games: faced 90, 80, 100 = average 90
    const result = calculatePointsAgainst(teamId, matchups, teams);
    if (Math.abs(result - 90) > 0.01) {
        throw new Error(`Expected 90, got ${result}`);
    }
});

runner.test('calculatePointsAgainst returns 0 for no games', () => {
    const result = calculatePointsAgainst(1, [], []);
    if (result !== 0) {
        throw new Error(`Expected 0, got ${result}`);
    }
});

runner.test('countWireAddsAndDrops counts FA adds and drops only', () => {
    const transactions = [
        {
            type: 'FREEAGENT',
            status: 'EXECUTED',
            items: [
                { type: 'ADD', toTeamId: 1, fromTeamId: 0 },
                { type: 'DROP', fromTeamId: 1, toTeamId: 0 },
            ],
        },
        {
            type: 'DRAFT',
            status: 'EXECUTED',
            items: [{ type: 'DRAFT', toTeamId: 1, fromTeamId: 0 }],
        },
        {
            type: 'WAIVER',
            status: 'PENDING',
            items: [{ type: 'ADD', toTeamId: 1, fromTeamId: 0 }],
        },
    ];

    const teamOne = countWireAddsAndDrops(transactions, 1);
    if (teamOne.adds !== 1 || teamOne.drops !== 1) {
        throw new Error(`Expected 1 add and 1 drop for team 1, got ${teamOne.adds}/${teamOne.drops}`);
    }

    const league = countWireAddsAndDrops(transactions);
    if (league.adds !== 1 || league.drops !== 1) {
        throw new Error(`Expected league totals 1/1, got ${league.adds}/${league.drops}`);
    }

    const missing = countWireAddsAndDrops(null, 1);
    if (missing.adds !== 0 || missing.drops !== 0) {
        throw new Error('Expected zero counts when transactions are missing');
    }
});

runner.test('parseExecutedTrades returns executed trades with sides', () => {
    const seasonData = {
        mTransactions: {
            transactions: [
                {
                    id: 'trade-1',
                    status: 'EXECUTED',
                    scoringPeriodId: 3,
                    processDate: 1000,
                    items: [
                        { type: 'TRADE', fromTeamId: 1, toTeamId: 2, playerId: 100 },
                        { type: 'TRADE', fromTeamId: 2, toTeamId: 1, playerId: 200 },
                    ],
                },
                {
                    id: 'trade-2',
                    status: 'CANCELED',
                    items: [{ type: 'TRADE', fromTeamId: 1, toTeamId: 2, playerId: 300 }],
                },
            ],
        },
        mTeam: [
            { id: 1, ownerName: 'Alice Manager' },
            { id: 2, ownerName: 'Bob Manager' },
        ],
        kona_player_info: {
            players: [
                { id: 100, fullName: 'Player A' },
                { id: 200, fullName: 'Player B' },
            ],
        },
    };

    const trades = parseExecutedTrades(seasonData);
    if (trades.length !== 1) {
        throw new Error(`Expected 1 executed trade, got ${trades.length}`);
    }
    if (trades[0].week !== 3) {
        throw new Error(`Expected week 3, got ${trades[0].week}`);
    }
    if (trades[0].sides.length !== 2) {
        throw new Error('Expected two trade sides');
    }
});

runner.test('collectWeeklyPointsAgainst returns opponent scores per week', () => {
    const matchups = [
        { homeTeamId: 1, awayTeamId: 2, homeScore: 100, awayScore: 110 },
        { homeTeamId: 3, awayTeamId: 1, homeScore: 95, awayScore: 88 },
    ];
    const scores = collectWeeklyPointsAgainst(1, matchups);
    if (scores.length !== 2 || scores[0] !== 110 || scores[1] !== 95) {
        throw new Error(`Expected [110, 95], got ${JSON.stringify(scores)}`);
    }
});

runner.test('collectWeeklyRelativePointsAgainst centers around schedule luck', () => {
    const seasonData = {
        mSettings: { scheduleSettings: { numberOfRegularSeasonMatchups: 14 } },
        mMatchup: {
            schedule: [
                { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 120, awayScore: 80 },
                { matchupPeriodId: 1, homeTeamId: 3, awayTeamId: 4, homeScore: 100, awayScore: 100 },
                { matchupPeriodId: 2, homeTeamId: 1, awayTeamId: 3, homeScore: 90, awayScore: 110 },
            ],
        },
    };
    const relative = collectWeeklyRelativePointsAgainst(1, seasonData);
    if (relative.length !== 2) {
        throw new Error(`Expected 2 relative scores, got ${relative.length}`);
    }
    if (Math.abs(relative[0] - (-20)) > 0.01) {
        throw new Error(`Expected first week relative score -20, got ${relative[0]}`);
    }
});

runner.test('isExecutedTrade ignores non-trade transactions', () => {
    if (isExecutedTrade({ status: 'EXECUTED', items: [{ type: 'ADD' }] })) {
        throw new Error('ADD transaction should not count as trade');
    }
    if (!isExecutedTrade({ status: 'EXECUTED', items: [{ type: 'TRADE' }] })) {
        throw new Error('Executed TRADE item should count as trade');
    }
    if (!isExecutedTrade({ type: 'TRADE_ACCEPT', executionType: 'EXECUTE', isPending: false, items: [] })) {
        throw new Error('Executed TRADE_ACCEPT stub should count as trade');
    }
});

runner.test('parseExecutedTrades groups ESPN trade copies by relatedTransactionId', () => {
    const seasonData = {
        mTransactions: {
            transactions: [
                {
                    id: 'accept-team-1',
                    relatedTransactionId: 'trade-group-1',
                    type: 'TRADE_ACCEPT',
                    executionType: 'EXECUTE',
                    isPending: false,
                    scoringPeriodId: 5,
                    teamId: 11,
                    proposedDate: 1000,
                    items: [],
                },
                {
                    id: 'accept-team-15',
                    relatedTransactionId: 'trade-group-2',
                    type: 'TRADE_ACCEPT',
                    executionType: 'EXECUTE',
                    isPending: false,
                    scoringPeriodId: 5,
                    teamId: 15,
                    proposedDate: 1200000,
                    items: [],
                },
                {
                    id: 'executed-with-items',
                    relatedTransactionId: 'trade-group-3',
                    type: 'TRADE_ACCEPT',
                    status: 'EXECUTED',
                    scoringPeriodId: 4,
                    teamId: 6,
                    processDate: 500,
                    items: [
                        { type: 'TRADE', fromTeamId: 1, toTeamId: 6, playerId: 100 },
                        { type: 'TRADE', fromTeamId: 6, toTeamId: 1, playerId: 200 },
                    ],
                },
                {
                    id: 'declined-trade',
                    relatedTransactionId: 'trade-group-4',
                    type: 'TRADE_DECLINE',
                    scoringPeriodId: 6,
                    teamId: 9,
                    items: [],
                },
            ],
        },
        mTeam: [
            { id: 1, ownerName: 'Alice Manager' },
            { id: 6, ownerName: 'Bob Manager' },
            { id: 11, ownerName: 'Chris Manager' },
            { id: 15, ownerName: 'Dana Manager' },
        ],
        kona_player_info: {
            players: [
                { id: 100, fullName: 'Player A' },
                { id: 200, fullName: 'Player B' },
            ],
        },
    };

    const trades = parseExecutedTrades(seasonData);
    if (trades.length !== 1) {
        throw new Error(`Expected 1 executed trade, got ${trades.length}`);
    }

    const detailedTrade = trades.find((trade) => trade.id === 'trade-group-3');
    if (!detailedTrade || detailedTrade.partial || detailedTrade.sides.length !== 2) {
        throw new Error('Expected one detailed trade with two sides');
    }
});

runner.test('parseExecutedTrades infers players from roster diffs when TRADE_ACCEPT has no items', () => {
    const roster = (playerIds) => playerIds.map((id) => ({ id, totalPoints: 10 }));

    const seasonData = {
        mSettings: { scheduleSettings: { numberOfRegularSeasonMatchups: 14 } },
        mTransactions: {
            transactions: [
                {
                    id: 'nick-accept',
                    relatedTransactionId: 'stub-trade-9',
                    type: 'TRADE_ACCEPT',
                    status: 'EXECUTED',
                    scoringPeriodId: 9,
                    teamId: 1,
                    proposedDate: 2000,
                    items: [],
                },
                {
                    id: 'nick-waiver',
                    type: 'WAIVER',
                    status: 'EXECUTED',
                    scoringPeriodId: 9,
                    items: [{ type: 'ADD', toTeamId: 1, playerId: 900 }],
                },
            ],
        },
        mTeam: [
            { id: 1, ownerName: 'Nick Manager' },
            { id: 3, ownerName: 'Alex Manager' },
        ],
        mMatchup: {
            schedule: [
                {
                    matchupPeriodId: 8,
                    homeTeamId: 1,
                    awayTeamId: 3,
                    homeScore: 100,
                    awayScore: 90,
                    homeRoster: roster([100, 200]),
                    awayRoster: roster([3929630, 300]),
                },
                {
                    matchupPeriodId: 9,
                    homeTeamId: 1,
                    awayTeamId: 3,
                    homeScore: 110,
                    awayScore: 95,
                    homeRoster: roster([3929630, 200, 900]),
                    awayRoster: roster([100, 300]),
                },
            ],
        },
        kona_player_info: {
            players: [
                { id: 3929630, fullName: 'Saquon Barkley' },
                { id: 100, fullName: 'Player A' },
                { id: 200, fullName: 'Player B' },
                { id: 300, fullName: 'Player C' },
                { id: 900, fullName: 'Waiver Pickup' },
            ],
        },
    };

    const trades = parseExecutedTrades(seasonData);
    if (trades.length !== 1) {
        throw new Error(`Expected 1 inferred trade, got ${trades.length}`);
    }

    const trade = trades[0];
    if (!trade.inferred || trade.partial) {
        throw new Error('Expected a completed inferred trade');
    }

    const nick = trade.sides.find((side) => side.teamId === 1);
    const alex = trade.sides.find((side) => side.teamId === 3);
    if (!nick || !alex) {
        throw new Error('Expected Nick and Alex trade sides');
    }
    if (!nick.received.includes('Saquon Barkley') || !alex.sent.includes('Saquon Barkley')) {
        throw new Error(`Expected Saquon traded from Alex to Nick, got ${JSON.stringify(trade.sides)}`);
    }
    if (nick.received.includes('Waiver Pickup')) {
        throw new Error('Waiver pickup should not appear in inferred trade');
    }
});

runner.test('parseExecutedTrades discovers roster-only trades missing from ESPN transactions', () => {
    const roster = (playerIds) => playerIds.map((id) => ({ id, totalPoints: 10 }));

    const seasonData = {
        mSettings: { scheduleSettings: { numberOfRegularSeasonMatchups: 14 } },
        mTransactions: { transactions: [] },
        mTeam: [
            { id: 1, ownerName: 'Nick Manager' },
            { id: 5, ownerName: 'Isaac Manager' },
        ],
        mMatchup: {
            schedule: [
                {
                    matchupPeriodId: 1,
                    homeTeamId: 1,
                    awayTeamId: 5,
                    homeScore: 100,
                    awayScore: 90,
                    homeRoster: roster([100, 200]),
                    awayRoster: roster([300, 400]),
                },
                {
                    matchupPeriodId: 2,
                    homeTeamId: 1,
                    awayTeamId: 5,
                    homeScore: 110,
                    awayScore: 95,
                    homeRoster: roster([100, 400]),
                    awayRoster: roster([300, 200]),
                },
            ],
        },
        kona_player_info: {
            players: [
                { id: 200, fullName: 'Jarvis Landry' },
                { id: 400, fullName: 'Christian Kirk' },
                { id: 100, fullName: 'Player A' },
                { id: 300, fullName: 'Player B' },
            ],
        },
    };

    const trades = parseExecutedTrades(seasonData);
    if (trades.length !== 1) {
        throw new Error(`Expected 1 discovered trade, got ${trades.length}`);
    }

    const trade = trades[0];
    if (!trade.inferred || !trade.discoveredFromRosters) {
        throw new Error('Expected a roster-discovered trade');
    }

    const nick = trade.sides.find((side) => side.teamId === 1);
    const isaac = trade.sides.find((side) => side.teamId === 5);
    if (
        !nick.received.includes('Christian Kirk') ||
        !nick.sent.includes('Jarvis Landry') ||
        !isaac.received.includes('Jarvis Landry') ||
        !isaac.sent.includes('Christian Kirk')
    ) {
        throw new Error(`Expected Kirk/Landry swap, got ${JSON.stringify(trade.sides)}`);
    }
});

runner.test('parseExecutedTrades drops phantom partial stubs with no roster movement', () => {
    const seasonData = {
        mTransactions: {
            transactions: [
                {
                    id: 'phantom-accept',
                    type: 'TRADE_ACCEPT',
                    status: 'EXECUTED',
                    scoringPeriodId: 10,
                    teamId: 4,
                    proposedDate: 1000,
                    items: [],
                },
            ],
        },
        mTeam: [{ id: 4, ownerName: 'Kenyon Manager' }],
        mMatchup: {
            schedule: [
                {
                    matchupPeriodId: 9,
                    homeTeamId: 4,
                    awayTeamId: 5,
                    homeScore: 100,
                    awayScore: 90,
                    homeRoster: [{ id: 100, totalPoints: 10 }],
                    awayRoster: [{ id: 200, totalPoints: 10 }],
                },
                {
                    matchupPeriodId: 10,
                    homeTeamId: 4,
                    awayTeamId: 5,
                    homeScore: 110,
                    awayScore: 95,
                    homeRoster: [{ id: 100, totalPoints: 10 }],
                    awayRoster: [{ id: 200, totalPoints: 10 }],
                },
            ],
        },
    };

    const trades = parseExecutedTrades(seasonData);
    if (trades.length !== 0) {
        throw new Error(`Expected phantom partial to be dropped, got ${trades.length}`);
    }
});

runner.test('buildTradeSociogramData aggregates trades between manager pairs', () => {
    const trades = [
        {
            id: 't1',
            week: 2,
            sides: [
                { ownerKey: 'alice', manager: 'Alice', sent: ['A'], received: ['B'] },
                { ownerKey: 'bob', manager: 'Bob', sent: ['B'], received: ['A'] },
            ],
        },
        {
            id: 't2',
            week: 5,
            sides: [
                { ownerKey: 'alice', manager: 'Alice', sent: ['C'], received: ['D'] },
                { ownerKey: 'bob', manager: 'Bob', sent: ['D'], received: ['C'] },
            ],
        },
        {
            id: 't3',
            week: 7,
            sides: [
                { ownerKey: 'alice', manager: 'Alice', sent: ['E'], received: [] },
                { ownerKey: 'carol', manager: 'Carol', sent: [], received: ['E'] },
            ],
        },
    ];

    const graph = buildTradeSociogramData(trades);
    if (graph.nodes.length !== 3) {
        throw new Error(`Expected 3 nodes, got ${graph.nodes.length}`);
    }
    if (graph.links.length !== 2) {
        throw new Error(`Expected 2 links, got ${graph.links.length}`);
    }

    const aliceBob = graph.links.find((link) => link.id === buildTradePairKey('alice', 'bob'));
    if (!aliceBob || aliceBob.count !== 2 || aliceBob.trades.length !== 2) {
        throw new Error('Expected Alice-Bob link with 2 trades');
    }
});

runner.test('pearsonCorrelation returns perfect positive correlation', () => {
    const xs = [1, 2, 3, 4, 5];
    const result = pearsonCorrelation(xs, xs);
    if (!result || Math.abs(result.r - 1) > 0.0001 || result.n !== 5) {
        throw new Error(`Expected r=1, n=5, got ${JSON.stringify(result)}`);
    }
});

runner.test('pearsonCorrelation returns perfect negative correlation', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [5, 4, 3, 2, 1];
    const result = pearsonCorrelation(xs, ys);
    if (!result || Math.abs(result.r + 1) > 0.0001) {
        throw new Error(`Expected r=-1, got ${JSON.stringify(result)}`);
    }
});

runner.test('pearsonCorrelation skips invalid pairs', () => {
    const result = pearsonCorrelation([1, null, 3], [2, 4, 6]);
    if (!result || result.n !== 2) {
        throw new Error(`Expected n=2, got ${JSON.stringify(result)}`);
    }
});

runner.test('linearRegression fits a line through y = 2x + 1', () => {
    const xs = [1, 2, 3, 4];
    const ys = [3, 5, 7, 9];
    const fit = linearRegression(xs, ys);
    if (!fit || Math.abs(fit.slope - 2) > 0.0001 || Math.abs(fit.intercept - 1) > 0.0001) {
        throw new Error(`Expected slope 2 intercept 1, got ${JSON.stringify(fit)}`);
    }
});

runner.test('buildTeamSeasonRows computes regular-season wins per manager-season', () => {
    const allSeasonsData = {
        2024: {
            mSettings: {
                scheduleSettings: {
                    numberOfRegularSeasonMatchups: 2,
                    numberOfPlayoffTeams: 2,
                    numberOfPlayoffMatchups: 1,
                },
            },
            mStandings: {
                entries: [{ overallWinLossTie: { wins: 1, losses: 1 } }],
            },
            mTeam: [
                { id: 1, ownerName: 'Alice Manager' },
                { id: 2, ownerName: 'Bob Manager' },
            ],
            mMatchup: {
                schedule: [
                    { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 110, awayScore: 90 },
                    { matchupPeriodId: 2, homeTeamId: 2, awayTeamId: 1, homeScore: 100, awayScore: 95 },
                ],
            },
            mRoster: { rosters: [{ entries: [] }, { entries: [] }] },
            mTransactions: { transactions: [] },
            kona_player_info: { players: [] },
        },
    };

    const rows = buildTeamSeasonRows(allSeasonsData);
    if (rows.length !== 2) {
        throw new Error(`Expected 2 rows, got ${rows.length}`);
    }

    const alice = rows.find((row) => row.manager === 'Alice Manager');
    const bob = rows.find((row) => row.manager === 'Bob Manager');
    if (!alice || alice.wins !== 1 || !bob || bob.wins !== 1) {
        throw new Error(`Expected 1 win each, got ${JSON.stringify(rows.map((row) => [row.manager, row.wins]))}`);
    }
    if (alice.metrics.avgPointsFor == null || bob.metrics.avgPointsFor == null) {
        throw new Error('Expected avgPointsFor to be computed');
    }
    if (Math.abs(alice.pointsFor - 205) > 0.01 || Math.abs(bob.pointsFor - 190) > 0.01) {
        throw new Error(`Expected pointsFor totals, got ${JSON.stringify(rows.map((row) => [row.manager, row.pointsFor]))}`);
    }
});

runner.test('computeCorrelations excludes tautological metrics for points target', () => {
    const rows = [
        { wins: 10, pointsFor: 1500, metrics: { avgPointsFor: 107.1, totalPointsFor: 1500, wireMoves: 2 } },
        { wins: 8, pointsFor: 1400, metrics: { avgPointsFor: 100, totalPointsFor: 1400, wireMoves: 5 } },
        { wins: 6, pointsFor: 1300, metrics: { avgPointsFor: 92.9, totalPointsFor: 1300, wireMoves: 8 } },
        { wins: 4, pointsFor: 1200, metrics: { avgPointsFor: 85.7, totalPointsFor: 1200, wireMoves: 10 } },
        { wins: 2, pointsFor: 1100, metrics: { avgPointsFor: 78.6, totalPointsFor: 1100, wireMoves: 12 } },
    ];
    const results = computeCorrelations(rows, ['avgPointsFor', 'totalPointsFor', 'wireMoves'], 'pointsFor');
    const avgPf = results.find((entry) => entry.id === 'avgPointsFor');
    const totalPf = results.find((entry) => entry.id === 'totalPointsFor');
    const wire = results.find((entry) => entry.id === 'wireMoves');
    if (!avgPf?.excluded || !totalPf?.excluded) {
        throw new Error('Expected scoring outcome metrics to be excluded for points target');
    }
    if (!wire?.valid || wire.r >= 0) {
        throw new Error(`Expected negative correlation for wireMoves vs points, got ${JSON.stringify(wire)}`);
    }
});

runner.test('computeCorrelations ranks scoring metrics against wins', () => {
    const rows = [
        { wins: 10, metrics: { avgPointsFor: 120, wireMoves: 2 } },
        { wins: 8, metrics: { avgPointsFor: 110, wireMoves: 5 } },
        { wins: 6, metrics: { avgPointsFor: 100, wireMoves: 8 } },
        { wins: 4, metrics: { avgPointsFor: 90, wireMoves: 10 } },
        { wins: 2, metrics: { avgPointsFor: 80, wireMoves: 12 } },
    ];
    const results = computeCorrelations(rows, ['avgPointsFor', 'wireMoves'], 'wins');
    const pf = results.find((entry) => entry.id === 'avgPointsFor');
    const wire = results.find((entry) => entry.id === 'wireMoves');
    if (!pf?.valid || pf.r <= 0) {
        throw new Error(`Expected positive correlation for avgPointsFor, got ${JSON.stringify(pf)}`);
    }
    if (!wire?.valid || wire.r >= 0) {
        throw new Error(`Expected negative correlation for wireMoves, got ${JSON.stringify(wire)}`);
    }
});

runner.test('buildTeamSeasonRows aggregates roster metrics from matchup boxscores', () => {
    const allSeasonsData = {
        2024: {
            mSettings: {
                scheduleSettings: {
                    numberOfRegularSeasonMatchups: 2,
                    numberOfPlayoffTeams: 2,
                    numberOfPlayoffMatchups: 1,
                },
            },
            mStandings: {
                entries: [
                    { teamId: 1, overallWinLossTie: { wins: 1, losses: 1 } },
                    { teamId: 2, overallWinLossTie: { wins: 1, losses: 1 } },
                ],
            },
            mTeam: [
                { id: 1, ownerName: 'Alice Manager' },
                { id: 2, ownerName: 'Bob Manager' },
            ],
            mMatchup: {
                schedule: [
                    {
                        matchupPeriodId: 1,
                        homeTeamId: 1,
                        awayTeamId: 2,
                        homeScore: 110,
                        awayScore: 90,
                        homeRoster: [
                            { id: 101, totalPoints: 25, rosteredPosition: 'QB' },
                            { id: 102, totalPoints: 15, rosteredPosition: 'RB' },
                        ],
                        awayRoster: [
                            { id: 201, totalPoints: 20, rosteredPosition: 'QB' },
                            { id: 202, totalPoints: 10, rosteredPosition: 'WR' },
                        ],
                    },
                    {
                        matchupPeriodId: 2,
                        homeTeamId: 2,
                        awayTeamId: 1,
                        homeScore: 100,
                        awayScore: 95,
                        homeRoster: [
                            { id: 201, totalPoints: 22, rosteredPosition: 'QB' },
                            { id: 203, totalPoints: 12, rosteredPosition: 'TE' },
                        ],
                        awayRoster: [
                            { id: 101, totalPoints: 18, rosteredPosition: 'QB' },
                            { id: 102, totalPoints: 14, rosteredPosition: 'RB' },
                        ],
                    },
                ],
            },
            mRoster: { rosters: [{ entries: [] }, { entries: [] }] },
            mTransactions: { transactions: [] },
            kona_player_info: {
                players: [
                    { id: 101, fullName: 'QB One', defaultPositionId: 1 },
                    { id: 102, fullName: 'RB One', defaultPositionId: 2 },
                    { id: 201, fullName: 'QB Two', defaultPositionId: 1 },
                    { id: 202, fullName: 'WR One', defaultPositionId: 3 },
                    { id: 203, fullName: 'TE One', defaultPositionId: 4 },
                ],
            },
        },
    };

    const rows = buildTeamSeasonRows(allSeasonsData);
    const alice = rows.find((row) => row.manager === 'Alice Manager');
    const bob = rows.find((row) => row.manager === 'Bob Manager');

    if (!alice || !bob) {
        throw new Error(`Expected both managers, got ${JSON.stringify(rows.map((row) => row.manager))}`);
    }
    if (alice.metrics.rosterTotalPoints !== 72 || bob.metrics.rosterTotalPoints !== 64) {
        throw new Error(`Unexpected roster totals: ${JSON.stringify({
            alice: alice.metrics.rosterTotalPoints,
            bob: bob.metrics.rosterTotalPoints,
        })}`);
    }
    if (alice.metrics.topQBPoints !== 43 || bob.metrics.topQBPoints !== 42) {
        throw new Error(`Unexpected QB totals: ${JSON.stringify({
            alice: alice.metrics.topQBPoints,
            bob: bob.metrics.topQBPoints,
        })}`);
    }
    if (alice.metrics.topPlayerPoints !== 43 || bob.metrics.topPlayerPoints !== 42) {
        throw new Error(`Unexpected best-player totals: ${JSON.stringify({
            alice: alice.metrics.topPlayerPoints,
            bob: bob.metrics.topPlayerPoints,
        })}`);
    }
});

runner.test('getLabMetricIds excludes tautological roster and luck metrics', () => {
    const labIds = getLabMetricIds();
    const excluded = [
        'rosterTotalPoints',
        'avgPointsFor',
        'totalPointsFor',
        'topKPoints',
    ];
    excluded.forEach((id) => {
        if (labIds.includes(id)) {
            throw new Error(`Expected ${id} to be excluded from Lab metrics`);
        }
    });
    if (!labIds.includes('projectedVsActual') || !labIds.includes('wireMoves')) {
        throw new Error('Expected actionable metrics to remain in Lab set');
    }
    if (!labIds.includes('weeklyCeiling') || !labIds.includes('topRBPoints') || !labIds.includes('blowoutWinPct')) {
        throw new Error('Expected expanded Lab metrics to be available');
    }
});

runner.test('interpretSignalVerdict labels stable same-season metrics as real signal', () => {
    const verdict = interpretSignalVerdict(0.5, 0.45, 0.1);
    if (verdict.label !== 'Real signal') {
        throw new Error(`Expected Real signal, got ${verdict.label}`);
    }
});

runner.test('interpretSignalVerdict labels weak metrics as likely noise', () => {
    const verdict = interpretSignalVerdict(0.1, 0.05, 0.08);
    if (verdict.label !== 'Likely noise') {
        throw new Error(`Expected Likely noise, got ${verdict.label}`);
    }
});

runner.test('computeCombinedSignalCorrelations returns all three modes per lab metric', () => {
    const allSeasonsData = {
        2023: {
            mSettings: {
                scheduleSettings: {
                    numberOfRegularSeasonMatchups: 4,
                    numberOfPlayoffTeams: 2,
                    numberOfPlayoffMatchups: 1,
                },
            },
            mStandings: { entries: [{ overallWinLossTie: { wins: 1, losses: 1 } }] },
            mTeam: [
                { id: 1, ownerName: 'Alice Manager' },
                { id: 2, ownerName: 'Bob Manager' },
            ],
            mMatchup: {
                schedule: [
                    { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 110, awayScore: 90, homeProjectedScore: 100, awayProjectedScore: 95 },
                    { matchupPeriodId: 2, homeTeamId: 2, awayTeamId: 1, homeScore: 100, awayScore: 95, homeProjectedScore: 98, awayProjectedScore: 97 },
                    { matchupPeriodId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 120, awayScore: 85, homeProjectedScore: 105, awayProjectedScore: 90 },
                    { matchupPeriodId: 4, homeTeamId: 2, awayTeamId: 1, homeScore: 105, awayScore: 100, homeProjectedScore: 100, awayProjectedScore: 99 },
                ],
            },
            mRoster: { rosters: [{ entries: [] }, { entries: [] }] },
            mTransactions: { transactions: [] },
        },
        2024: {
            mSettings: {
                scheduleSettings: {
                    numberOfRegularSeasonMatchups: 4,
                    numberOfPlayoffTeams: 2,
                    numberOfPlayoffMatchups: 1,
                },
            },
            mStandings: { entries: [{ overallWinLossTie: { wins: 1, losses: 1 } }] },
            mTeam: [
                { id: 1, ownerName: 'Alice Manager' },
                { id: 2, ownerName: 'Bob Manager' },
            ],
            mMatchup: {
                schedule: [
                    { matchupPeriodId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 115, awayScore: 88, homeProjectedScore: 102, awayProjectedScore: 94 },
                    { matchupPeriodId: 2, homeTeamId: 2, awayTeamId: 1, homeScore: 98, awayScore: 96, homeProjectedScore: 97, awayProjectedScore: 96 },
                    { matchupPeriodId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 125, awayScore: 80, homeProjectedScore: 108, awayProjectedScore: 88 },
                    { matchupPeriodId: 4, homeTeamId: 2, awayTeamId: 1, homeScore: 102, awayScore: 99, homeProjectedScore: 99, awayProjectedScore: 98 },
                ],
            },
            mRoster: { rosters: [{ entries: [] }, { entries: [] }] },
            mTransactions: { transactions: [] },
        },
    };

    const results = computeCombinedSignalCorrelations(allSeasonsData);
    if (!results.length) {
        throw new Error('Expected combined signal results');
    }
    const projected = results.find((entry) => entry.id === 'projectedVsActual');
    if (!projected?.sameSeason || !projected?.yoy || !projected?.splitHalf || !projected?.verdict?.label) {
        throw new Error(`Expected full signal row for projectedVsActual, got ${JSON.stringify(projected)}`);
    }
});

// Run tests if in Node.js environment
if (typeof window === 'undefined') {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { runner };

