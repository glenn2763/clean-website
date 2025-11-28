/**
 * Tests for API functions
 * Note: These tests require mocking fetch/localStorage
 */

import { clearCache } from '../api.js';

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
        console.log('Running API tests...\n');
        
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

// Mock localStorage for testing
const mockLocalStorage = {
    data: {},
    getItem(key) {
        return this.data[key] || null;
    },
    setItem(key, value) {
        this.data[key] = value;
    },
    removeItem(key) {
        delete this.data[key];
    },
    clear() {
        this.data = {};
    },
    get keys() {
        return Object.keys(this.data);
    }
};

runner.test('clearCache removes fantasy football cache entries', () => {
    // Setup mock localStorage
    const originalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    
    // Add some cache entries
    mockLocalStorage.setItem('123-2024-mSettings', '{}');
    mockLocalStorage.setItem('123-2023-mTeam', '{}');
    mockLocalStorage.setItem('other-key', 'value');
    
    const cleared = clearCache();
    
    // Restore original
    global.localStorage = originalStorage;
    
    if (cleared !== 2) {
        throw new Error(`Expected 2 entries cleared, got ${cleared}`);
    }
    
    if (mockLocalStorage.getItem('other-key') !== 'value') {
        throw new Error('Non-cache entry should not be removed');
    }
});

// Run tests if in Node.js environment
if (typeof window === 'undefined') {
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { runner };

