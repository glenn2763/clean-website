// Express server to proxy ESPN Fantasy Football API requests
// Handles CORS and rate limiting

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Client } = require('espn-fantasy-football-api/node');

const ESPN_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';

const app = express();
const PORT = process.env.PORT || 3000;

// Load ESPN config (cookies) from environment variables or file
let espnConfig = {};
try {
    // First try environment variables (for production)
    if (process.env.ESPN_S2 && process.env.ESPN_SWID) {
        espnConfig.espnS2 = process.env.ESPN_S2;
        espnConfig.SWID = process.env.ESPN_SWID;
        console.log('Loaded ESPN config from environment variables');
    } else if (fs.existsSync('espn-config.json')) {
        // Fall back to file (for local development)
        espnConfig = JSON.parse(fs.readFileSync('espn-config.json', 'utf8'));
        console.log('Loaded ESPN config from espn-config.json');
    }
} catch (error) {
    console.warn('Could not load ESPN config:', error.message);
}

if (!espnConfig.espnS2 || !espnConfig.SWID) {
    console.warn(
        'No ESPN credentials (espn-config.json or ESPN_S2 + ESPN_SWID). ' +
            'Private fantasy leagues will return 401 until you add them.'
    );
}

// Middleware
app.use(express.json());
app.use(express.static('.'));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Rate limiting (simple in-memory store)
const requestCounts = {};
const RATE_LIMIT = 100; // requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts[ip]) {
        requestCounts[ip] = { count: 0, resetTime: now + RATE_WINDOW };
    }
    
    if (now > requestCounts[ip].resetTime) {
        requestCounts[ip] = { count: 0, resetTime: now + RATE_WINDOW };
    }
    
    if (requestCounts[ip].count >= RATE_LIMIT) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    requestCounts[ip].count++;
    next();
}

function createEspnClient(leagueId, query = {}) {
    const cookieEspnS2 = query.espnS2 || espnConfig.espnS2;
    const cookieSWID = query.SWID || espnConfig.SWID;
    const clientConfig = { leagueId: parseInt(leagueId) };
    if (cookieEspnS2 && cookieSWID) {
        clientConfig.espnS2 = cookieEspnS2;
        clientConfig.SWID = cookieSWID;
    }
    return new Client(clientConfig);
}

async function discoverSeasons(client) {
    const seasons = [];
    const maxYear = new Date().getFullYear() + 1;
    const minYear = 2018; // ESPN v3 API does not support seasons before 2018

    for (let year = maxYear; year >= minYear; year--) {
        try {
            await client.getLeagueInfo({ seasonId: year });
            seasons.push(year);
        } catch (error) {
            // Library throws synchronously for years before 2018 — skip quietly.
            if (String(error.message || '').includes('prior to 2018')) {
                continue;
            }
            if (seasons.length > 0) break;
        }
    }

    return seasons;
}

async function fetchRawLeagueView(client, seasonId, leagueId, { views, scoringPeriodId, fantasyFilter }) {
    const url = `${ESPN_BASE}/${seasonId}/segments/0/leagues/${leagueId}`;
    const headers = fantasyFilter ? { 'x-fantasy-filter': JSON.stringify(fantasyFilter) } : {};
    try {
        const { data } = await axios.get(url, {
            ...client._buildAxiosConfig({ headers }),
            params: {
                view: views,
                ...(scoringPeriodId != null && { scoringPeriodId }),
            },
        });
        return data;
    } catch (error) {
        error.espnStatus = error.response?.status;
        throw error;
    }
}

function getMaxScoringPeriod(leagueInfo) {
    const schedule = leagueInfo?.scheduleSettings || {};
    const regularWeeks = schedule.numberOfRegularSeasonMatchups ?? 14;
    const playoffWeeks = schedule.numberOfPlayoffMatchups ?? 3;
    const currentWeek = leagueInfo?.currentScoringPeriodId ?? 0;
    return Math.min(18, Math.max(currentWeek, regularWeeks + playoffWeeks, 1));
}

function normalizePlayerPool(players) {
    return (players || []).map((entry) => {
        const player = entry.player || entry;
        return {
            id: entry.id || player.id,
            fullName: player.fullName,
            defaultPositionId: player.defaultPositionId,
        };
    });
}

function sumProjected(roster) {
    return (roster || []).reduce((total, p) => {
        const breakdown = p.projectedPointBreakdown || {};
        return total + Object.entries(breakdown)
            .filter(([key, value]) => key !== 'usesPoints' && typeof value === 'number')
            .reduce((sum, [, value]) => sum + value, 0);
    }, 0);
}

function enrichBoxscore(box) {
    box.homeProjectedScore = sumProjected(box.homeRoster);
    box.awayProjectedScore = sumProjected(box.awayRoster);
    return box;
}

function matchupPairKey(homeTeamId, awayTeamId) {
    return `${homeTeamId}-${awayTeamId}`;
}

async function fetchPlayoffMetaByPair(client, seasonId, leagueId, week) {
    const raw = await fetchRawLeagueView(client, seasonId, leagueId, {
        views: 'mMatchupScore',
        scoringPeriodId: week,
    });
    const metaByPair = new Map();

    (raw.schedule || []).forEach((matchup) => {
        if (matchup.matchupPeriodId !== week) return;
        const homeTeamId = matchup.home?.teamId;
        const awayTeamId = matchup.away?.teamId;
        if (homeTeamId == null || awayTeamId == null) return;

        metaByPair.set(matchupPairKey(homeTeamId, awayTeamId), {
            playoffTierType: matchup.playoffTierType || null,
            winner: matchup.winner || null,
        });
    });

    return metaByPair;
}

/**
 * ESPN returns mTransactions2 per scoring period only. Merge all weeks and keep
 * the richest copy of each transaction (some EXECUTED trades only include items
 * in the week they processed, e.g. TRADE_ACCEPT).
 */
function mergeTransactionMaps(into, from) {
    for (const transaction of from) {
        if (!transaction?.id) continue;
        const existing = into.get(transaction.id);
        const existingItems = existing?.items?.length || 0;
        const incomingItems = transaction.items?.length || 0;
        if (!existing || incomingItems > existingItems) {
            into.set(transaction.id, transaction);
        }
    }
}

async function fetchAllSeasonTransactions(client, seasonId, leagueId, maxWeek = 18) {
    const byId = new Map();
    let emptyWeekStreak = 0;

    for (let week = 1; week <= maxWeek; week += 1) {
        try {
            const raw = await fetchRawLeagueView(client, seasonId, leagueId, {
                views: 'mTransactions2',
                scoringPeriodId: week,
            });
            const transactions = raw.transactions || [];
            if (transactions.length === 0) {
                emptyWeekStreak += 1;
                if (emptyWeekStreak >= 2) break;
            } else {
                emptyWeekStreak = 0;
                mergeTransactionMaps(byId, transactions);
            }
        } catch (error) {
            const status = error.espnStatus || error.response?.status;
            // Past the last scoring period ESPN returns 404 — stop quietly.
            if (week > 1 && (status === 404 || status === 400)) {
                break;
            }
            if (week > 1) break;
            throw error;
        }
    }

    return [...byId.values()];
}

// List seasons with available league data (must be before /:season route)
app.get('/api/espn/league/:leagueId/seasons', rateLimit, async (req, res) => {
    const { leagueId } = req.params;

    if (!leagueId) {
        return res.status(400).json({ error: 'League ID is required' });
    }

    try {
        const client = createEspnClient(leagueId, req.query);
        const seasons = await discoverSeasons(client);

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'No seasons found',
                message: 'Could not find league data for any season. Check the league ID and ESPN credentials.',
            });
        }

        res.json({ seasons });
    } catch (error) {
        console.error('Error discovering seasons:', error.message);
        res.status(500).json({
            error: 'Failed to discover seasons',
            message: error.message,
        });
    }
});

// ESPN API proxy endpoint
app.get('/api/espn/league/:leagueId/:season/:view?', rateLimit, async (req, res) => {
    const { leagueId, season, view } = req.params;
    
    if (!leagueId || !season) {
        return res.status(400).json({ error: 'League ID and season are required' });
    }
    
    try {
        const client = createEspnClient(leagueId, req.query);
        const seasonId = parseInt(season, 10);

        if (Number.isNaN(seasonId) || seasonId < 2018) {
            return res.status(400).json({
                error: 'Season not supported',
                message: 'ESPN only exposes fantasy data from 2018 onward.',
            });
        }
        
        // Map view names to client methods
        let data;
        
        try {
            // First get league info to determine current scoring period
            const leagueInfo = await client.getLeagueInfo({ seasonId });
            const currentScoringPeriod = leagueInfo.currentScoringPeriodId || 0;
            const maxScoringPeriod = getMaxScoringPeriod(leagueInfo);
            
            switch (view) {
                case 'mSettings':
                    data = leagueInfo;
                    break;
                case 'mTeam':
                    try {
                        data = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: currentScoringPeriod });
                    } catch (e) {
                        data = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: 0 });
                    }
                    break;
                case 'mMatchup': {
                    const matchups = [];
                    for (let week = 1; week <= maxScoringPeriod; week++) {
                        try {
                            const boxes = await client.getBoxscoreForWeek({
                                seasonId,
                                matchupPeriodId: week,
                                scoringPeriodId: week,
                            });
                            let playoffMetaByPair = new Map();
                            try {
                                playoffMetaByPair = await fetchPlayoffMetaByPair(
                                    client,
                                    seasonId,
                                    leagueId,
                                    week
                                );
                            } catch (metaError) {
                                // Playoff metadata is optional; boxscores still work without it.
                            }

                            boxes.forEach((box) => {
                                box.matchupPeriodId = week;
                                box.scoringPeriodId = week;
                                enrichBoxscore(box);

                                const meta = playoffMetaByPair.get(
                                    matchupPairKey(box.homeTeamId, box.awayTeamId)
                                );
                                if (meta) {
                                    box.playoffTierType = meta.playoffTierType;
                                    box.winner = meta.winner;
                                }
                            });
                            matchups.push(...boxes);
                        } catch (e) {
                            if (week > 1) break;
                        }
                    }
                    data = { schedule: matchups };
                    break;
                }
                case 'mTransactions': {
                    const transactions = await fetchAllSeasonTransactions(
                        client,
                        seasonId,
                        leagueId,
                        maxScoringPeriod
                    );
                    data = { transactions };
                    break;
                }
                case 'kona_player_info': {
                    const raw = await fetchRawLeagueView(client, seasonId, leagueId, {
                        views: 'kona_player_info',
                        scoringPeriodId: 0,
                        fantasyFilter: {
                            players: {
                                limit: 3000,
                                sortPercOwned: { sortAsc: false, sortPriority: 1 },
                            },
                        },
                    });
                    data = { players: normalizePlayerPool(raw.players) };
                    break;
                }
                case 'mStandings':
                    try {
                        const teams = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: currentScoringPeriod });
                        data = { entries: teams.map(t => ({
                            teamId: t.id,
                            overallWinLossTie: { 
                                wins: t.wins || 0, 
                                losses: t.losses || 0, 
                                ties: t.ties || 0 
                            },
                            overallPointsFor: t.totalPointsScored || t.regularSeasonPointsFor || 0,
                            overallPointsAgainst: t.regularSeasonPointsAgainst || 0
                        })) };
                    } catch (e) {
                        data = { entries: [] };
                    }
                    break;
                case 'mRoster':
                    try {
                        const teams = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: currentScoringPeriod });
                        data = { rosters: teams.map(t => ({ 
                            entries: (t.roster || []).map(p => ({
                                playerId: p.player?.id,
                                playerPoolEntry: {
                                    appliedStatTotal: p.totalPoints || 0
                                }
                            }))
                        })) };
                    } catch (e) {
                        data = { rosters: [] };
                    }
                    break;
                default:
                    data = leagueInfo;
            }
            
            res.json(data);
        } catch (apiError) {
            const statusCode = apiError.response?.status || 500;
            const message = apiError.message || 'Unknown ESPN API error';

            if (statusCode >= 500 || statusCode === 401 || statusCode === 403) {
                console.error('ESPN API error:', message);
            }
            
            if (statusCode === 401 || statusCode === 403) {
                res.status(statusCode).json({ 
                    error: 'League requires authentication',
                    message: 'This league is private and requires valid ESPN cookies. Please check your cookies in espn-config.json.',
                    help: 'Cookies may be expired. Get fresh ones from DevTools > Application > Cookies > espn.com'
                });
            } else {
                res.status(statusCode).json({ 
                    error: 'Failed to fetch data from ESPN API',
                    message: apiError.message
                });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from ESPN API',
            message: error.message 
        });
    }
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve fantasy-football-stats.html
app.get('/fantasy-football-stats', (req, res) => {
    res.sendFile(path.join(__dirname, 'fantasy-football-stats.html'));
});

// Health check for Render deploy probes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Start server — bind all interfaces so Render's proxy can reach the app
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Fantasy Football Stats: http://localhost:${PORT}/fantasy-football-stats.html`);
});
