/**
 * Tests for API functions
 */

import { clearCache, isLegacyCacheKey } from '../api.js';
import { clearLegacyLocalStorageCache } from '../cache.js';

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

const mockLocalStorage = (() => {
    const data = {};
    return {
        data,
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = String(value);
        },
        removeItem(key) {
            delete data[key];
        },
        clear() {
            Object.keys(data).forEach((key) => delete data[key]);
        },
        key(index) {
            return Object.keys(data)[index] ?? null;
        },
        get length() {
            return Object.keys(data).length;
        },
    };
})();

runner.test('isLegacyCacheKey matches per-view localStorage keys', () => {
    if (!isLegacyCacheKey('37892-2024-mSettings')) {
        throw new Error('Expected legacy ESPN cache key to match');
    }
    if (isLegacyCacheKey('theme')) {
        throw new Error('Non-cache key should not match');
    }
});

runner.test('clearLegacyLocalStorageCache removes fantasy football entries only', () => {
    const originalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();

    mockLocalStorage.setItem('123-2024-mSettings', '{}');
    mockLocalStorage.setItem('123-2023-mTeam', '{}');
    mockLocalStorage.setItem('other-key', 'value');

    const cleared = clearLegacyLocalStorageCache();

    global.localStorage = originalStorage;

    if (cleared !== 2) {
        throw new Error(`Expected 2 entries cleared, got ${cleared}`);
    }

    if (mockLocalStorage.getItem('other-key') !== 'value') {
        throw new Error('Non-cache entry should not be removed');
    }
});

runner.test('clearCache clears legacy localStorage entries', async () => {
    const originalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    mockLocalStorage.setItem('123-2024-mSettings', '{}');

    const cleared = await clearCache();

    global.localStorage = originalStorage;

    if (cleared < 1) {
        throw new Error(`Expected at least 1 entry cleared, got ${cleared}`);
    }
});

if (typeof window === 'undefined') {
    runner.run().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

export { runner };
