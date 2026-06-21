/**
 * Tests for utility functions
 */

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
    if (trades.length !== 2) {
        throw new Error(`Expected 2 executed trades, got ${trades.length}`);
    }

    const detailedTrade = trades.find((trade) => trade.id === 'trade-group-3');
    if (!detailedTrade || detailedTrade.partial || detailedTrade.sides.length !== 2) {
        throw new Error('Expected one detailed trade with two sides');
    }

    const pairedTrade = trades.find((trade) => trade.partial && trade.sides.length === 2);
    if (!pairedTrade) {
        throw new Error('Expected one paired partial trade between two managers');
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

// Run tests if in Node.js environment
if (typeof window === 'undefined') {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { runner };

