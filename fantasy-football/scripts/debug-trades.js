/**
 * Debug trade parsing against live ESPN proxy data.
 * Usage: node fantasy-football/scripts/debug-trades.js [season] [searchTerm]
 */

import { parseExecutedTrades, getTeams, buildTradeSociogramData } from '../utils.js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const LEAGUE_ID = process.env.TEST_LEAGUE_ID || '37892';
const SEASON = process.argv[2] || '2024';
const SEARCH = (process.argv[3] || 'saquon').toLowerCase();

async function fetchJson(path) {
    const response = await fetch(`${BASE_URL}${path}`);
    if (!response.ok) {
        throw new Error(`${path} → HTTP ${response.status}`);
    }
    return response.json();
}

function managerName(teams, teamId) {
    const team = teams.find((entry) => entry.id === teamId);
    return team?.ownerName || team?.name || `team ${teamId}`;
}

function summarizeTransaction(tx) {
    return {
        id: tx.id,
        relatedTransactionId: tx.relatedTransactionId,
        type: tx.type,
        status: tx.status,
        executionType: tx.executionType,
        isPending: tx.isPending,
        teamId: tx.teamId,
        scoringPeriodId: tx.scoringPeriodId,
        proposedDate: tx.proposedDate,
        processDate: tx.processDate,
        itemCount: tx.items?.length || 0,
        tradeItems: (tx.items || [])
            .filter((item) => item.type === 'TRADE')
            .map((item) => ({
                from: item.fromTeamId,
                to: item.toTeamId,
                playerId: item.playerId,
            })),
        teamActions: tx.teamActions ? Object.keys(tx.teamActions) : [],
    };
}

async function loadSeasonData(season) {
    const views = ['mTeam', 'mTransactions', 'mMatchup', 'mSettings', 'kona_player_info'];
    const entries = await Promise.all(
        views.map(async (view) => [view, await fetchJson(`/api/espn/league/${LEAGUE_ID}/${season}/${view}`)])
    );
    return Object.fromEntries(entries);
}

function findPlayerIds(seasonData, term) {
    const players = seasonData?.kona_player_info?.players || [];
    return players
        .filter((player) => player.fullName?.toLowerCase().includes(term))
        .map((player) => ({ id: player.id, name: player.fullName }));
}

async function run() {
    console.log(`League ${LEAGUE_ID}, season ${SEASON}, search "${SEARCH}"\n`);

    const seasonData = await loadSeasonData(SEASON);
    const teams = getTeams(seasonData);
    const transactions = seasonData.mTransactions?.transactions || [];

    console.log(`Teams: ${teams.map((t) => `${t.id}:${t.ownerName || t.name}`).join(', ')}`);
    console.log(`Raw transactions: ${transactions.length}\n`);

    const playerHits = findPlayerIds(seasonData, SEARCH);
    console.log('Player name matches:', playerHits.length ? playerHits : '(none)');

    const playerIds = new Set(playerHits.map((p) => p.id));
    const rawTradeTx = transactions.filter(
        (tx) =>
            (tx.items || []).some((item) => item.type === 'TRADE') ||
            tx.type?.includes('TRADE')
    );

    const saquonTx = rawTradeTx.filter((tx) =>
        (tx.items || []).some((item) => playerIds.has(item.playerId))
    );

    console.log(`\nRaw trade-ish transactions mentioning search players: ${saquonTx.length}`);
    saquonTx.forEach((tx) => {
        console.log(JSON.stringify(summarizeTransaction(tx), null, 2));
        (tx.items || [])
            .filter((item) => item.type === 'TRADE')
            .forEach((item) => {
                console.log(
                    `  TRADE item: ${managerName(teams, item.fromTeamId)} → ${managerName(teams, item.toTeamId)} player ${item.playerId}`
                );
            });
    });

    const parsed = parseExecutedTrades(seasonData);
    console.log(`\nParsed executed trades: ${parsed.length}`);
    parsed.forEach((trade) => {
        const label = trade.sides.map((s) => s.manager).join(' ↔ ');
        const players = trade.sides
            .flatMap((s) => [...s.sent, ...s.received])
            .join(', ');
        const hit = players.toLowerCase().includes(SEARCH);
        const alexNick =
            trade.sides.some((s) => /alex/i.test(s.manager)) &&
            trade.sides.some((s) => /nick/i.test(s.manager));
        if (hit || alexNick || trade.partial) {
            console.log('\n---');
            console.log(`Week ${trade.week} | ${label} | partial=${trade.partial} inferred=${trade.inferred || false}`);
            trade.sides.forEach((side) => {
                console.log(`  ${side.manager}: sent [${side.sent.join(', ')}] received [${side.received.join(', ')}]`);
            });
        }
    });

    const graph = buildTradeSociogramData(parsed);
    const alexNode = graph.nodes.find((n) => /alex/i.test(n.label));
    const nickNode = graph.nodes.find((n) => /nick/i.test(n.label));
    const alexNickLink = graph.links.find(
        (link) =>
            (link.source === alexNode?.id && link.target === nickNode?.id) ||
            (link.source === nickNode?.id && link.target === alexNode?.id)
    );

    console.log('\nGraph:');
    console.log(`  Alex node: ${alexNode ? `${alexNode.label} (${alexNode.tradeCount})` : 'missing'}`);
    console.log(`  Nick node: ${nickNode ? `${nickNode.label} (${nickNode.tradeCount})` : 'missing'}`);
    console.log(`  Alex↔Nick link: ${alexNickLink ? alexNickLink.count : 'missing'}`);

    const orphanCandidates = parsed.filter(
        (trade) => trade.partial && trade.sides.length === 1
    );
    if (orphanCandidates.length) {
        console.log(`\nSingle-side partial trades (orphans): ${orphanCandidates.length}`);
        orphanCandidates.forEach((trade) => {
            console.log(`  week ${trade.week}: ${trade.sides[0]?.manager}`);
        });
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
