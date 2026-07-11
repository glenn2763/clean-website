/**
 * Catalog JSON field paths from ESPN proxy views.
 * Requires: npm start and espn-config.json (or ESPN_S2 + ESPN_SWID env vars)
 *
 * Usage: node fantasy-football/scripts/explore-api-fields.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const LEAGUE_ID = process.env.TEST_LEAGUE_ID || '37892';
const SEASON = process.env.TEST_SEASON || '2024';

const ALL_VIEWS = [
    'mSettings',
    'mTeam',
    'mStandings',
    'mMatchup',
    'mRoster',
    'mTransactions',
    'kona_player_info',
];

const EXTRA_VIEWS = [
    'mDraftDetail',
    'mMatchupScore',
    'mPendingTransactions',
];

const MAX_SAMPLE_LENGTH = 80;
const MAX_DEPTH = 12;

function sampleValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === 'object') return 'object';
    const text = String(value);
    if (text.length <= MAX_SAMPLE_LENGTH) return text;
    return `${text.slice(0, MAX_SAMPLE_LENGTH)}…`;
}

function walkFields(value, prefix, catalog, depth = 0) {
    if (depth > MAX_DEPTH) return;

    if (Array.isArray(value)) {
        const arrayPath = `${prefix}[]`;
        if (!catalog.has(arrayPath)) {
            catalog.set(arrayPath, { type: 'array', sample: sampleValue(value) });
        }
        if (value.length > 0) {
            walkFields(value[0], arrayPath, catalog, depth + 1);
        }
        return;
    }

    if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, child]) => {
            const childPath = prefix ? `${prefix}.${key}` : key;
            const childType = Array.isArray(child) ? 'array' : typeof child;
            if (!catalog.has(childPath)) {
                catalog.set(childPath, { type: childType, sample: sampleValue(child) });
            }
            walkFields(child, childPath, catalog, depth + 1);
        });
    }
}

async function fetchView(view) {
    const url = `${BASE_URL}/api/espn/league/${LEAGUE_ID}/${SEASON}/${view}`;
    const response = await fetch(url);
    const body = await response.text();
    let json;
    try {
        json = JSON.parse(body);
    } catch {
        json = { _parseError: body.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, json };
}

function catalogToSortedObject(catalog) {
    return Object.fromEntries(
        [...catalog.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
}

async function run() {
    console.log(`Exploring ESPN views for league ${LEAGUE_ID}, season ${SEASON}...\n`);

    const viewsToFetch = [...ALL_VIEWS, ...EXTRA_VIEWS];
    const output = {
        leagueId: LEAGUE_ID,
        season: SEASON,
        fetchedAt: new Date().toISOString(),
        views: {},
    };

    for (const view of viewsToFetch) {
        try {
            const { ok, status, json } = await fetchView(view);
            const catalog = new Map();
            walkFields(json, '', catalog);

            output.views[view] = {
                ok,
                status,
                fieldCount: catalog.size,
                fields: catalogToSortedObject(catalog),
            };

            const statusLabel = ok ? '✓' : '✗';
            console.log(`${statusLabel} ${view} (${status}) — ${catalog.size} field paths`);
        } catch (error) {
            output.views[view] = { ok: false, error: error.message, fields: {} };
            console.log(`✗ ${view} — ${error.message}`);
        }
    }

    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `field-catalog-${LEAGUE_ID}-${SEASON}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

    console.log(`\nField catalog written to ${outputPath}`);

    console.log('\nTop-level keys per view:');
    Object.entries(output.views).forEach(([view, meta]) => {
        if (!meta.fields) return;
        const topKeys = Object.keys(meta.fields).filter((key) => !key.includes('.'));
        console.log(`  ${view}: ${topKeys.join(', ') || '(none)'}`);
    });
}

run().catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
});
