/**
 * Tests for utility functions
 */

import { 
    getTeamNameFromObject, 
    calculateConsistency, 
    calculateAverage,
    calculatePointsAgainst 
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

// Run tests if in Node.js environment
if (typeof window === 'undefined') {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { runner };

