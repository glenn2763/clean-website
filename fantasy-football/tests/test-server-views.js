/**
 * Smoke tests for ESPN proxy view quality.
 * Requires: npm start (server on localhost:3000) and valid espn-config.json
 *
 * Usage: node fantasy-football/tests/test-server-views.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const LEAGUE_ID = process.env.TEST_LEAGUE_ID || '37892';
const SEASON = process.env.TEST_SEASON || '2024';

async function fetchView(view) {
    const response = await fetch(`${BASE_URL}/api/espn/league/${LEAGUE_ID}/${SEASON}/${view}`);
    if (!response.ok) {
        throw new Error(`${view} returned ${response.status}`);
    }
    return response.json();
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function run() {
    console.log(`Testing ESPN views for league ${LEAGUE_ID}, season ${SEASON}...\n`);

    const settings = await fetchView('mSettings');
    assert(settings.name, 'mSettings should include league name');
    assert(
        settings.scheduleSettings?.numberOfPlayoffTeams != null,
        'mSettings should include numberOfPlayoffTeams'
    );
    console.log('✓ mSettings');

    const transactions = await fetchView('mTransactions');
    assert(Array.isArray(transactions.transactions), 'mTransactions should return transactions array');
    assert(transactions.transactions.length > 0, 'mTransactions should not be empty');
    console.log(`✓ mTransactions (${transactions.transactions.length} transactions)`);

    const players = await fetchView('kona_player_info');
    assert(Array.isArray(players.players), 'kona_player_info should return players array');
    assert(players.players.length > 100, 'kona_player_info should return player pool');
    assert(players.players[0].fullName, 'players should include fullName');
    console.log(`✓ kona_player_info (${players.players.length} players)`);

    const matchups = await fetchView('mMatchup');
    assert(Array.isArray(matchups.schedule), 'mMatchup should return schedule array');
    const withProjected = matchups.schedule.filter(
        (matchup) => matchup.homeProjectedScore > 0 && matchup.awayProjectedScore > 0
    );
    assert(withProjected.length > 0, 'mMatchup should include projected scores');
    const projectedRate = withProjected.length / matchups.schedule.length;
    assert(projectedRate >= 0.5, `expected most matchups to have projections (got ${(projectedRate * 100).toFixed(0)}%)`);
    console.log(`✓ mMatchup (${withProjected.length}/${matchups.schedule.length} with projected scores)`);

    console.log('\nAll server view checks passed.');
}

run().catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
});
