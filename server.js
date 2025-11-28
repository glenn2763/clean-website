// Express server to proxy ESPN Fantasy Football API requests
// Handles CORS and rate limiting

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Client } = require('espn-fantasy-football-api/node');

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

// ESPN API proxy endpoint
app.get('/api/espn/league/:leagueId/:season/:view?', rateLimit, async (req, res) => {
    const { leagueId, season, view } = req.params;
    const { espnS2, SWID } = req.query; // Allow override via query params
    
    if (!leagueId || !season) {
        return res.status(400).json({ error: 'League ID and season are required' });
    }
    
    try {
        // Use cookies from query params (override) or config file
        const cookieEspnS2 = espnS2 || espnConfig.espnS2;
        const cookieSWID = SWID || espnConfig.SWID;
        
        // Create client instance with cookies if available
        const clientConfig = { leagueId: parseInt(leagueId) };
        if (cookieEspnS2 && cookieSWID) {
            clientConfig.espnS2 = cookieEspnS2;
            clientConfig.SWID = cookieSWID;
        }
        
        const client = new Client(clientConfig);
        const seasonId = parseInt(season);
        
        // Map view names to client methods
        let data;
        
        try {
            // First get league info to determine current scoring period
            const leagueInfo = await client.getLeagueInfo({ seasonId });
            const currentScoringPeriod = leagueInfo.currentScoringPeriodId || 0;
            
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
                case 'mMatchup':
                case 'mSchedule':
                    const matchups = [];
                    for (let week = 1; week <= 18; week++) {
                        try {
                            const boxes = await client.getBoxscoreForWeek({ 
                                seasonId, 
                                matchupPeriodId: week, 
                                scoringPeriodId: week 
                            });
                            // Add week number to each boxscore
                            boxes.forEach(box => {
                                box.matchupPeriodId = week;
                                box.scoringPeriodId = week;
                            });
                            matchups.push(...boxes);
                        } catch (e) {
                            if (week > 1) break;
                        }
                    }
                    data = { schedule: matchups };
                    break;
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
                case 'mScoreboard':
                    try {
                        const currentWeek = await client.getBoxscoreForWeek({ 
                            seasonId, 
                            matchupPeriodId: leagueInfo.currentMatchupPeriodId || 1, 
                            scoringPeriodId: currentScoringPeriod 
                        });
                        data = { scoreboard: currentWeek };
                    } catch (e) {
                        const week1 = await client.getBoxscoreForWeek({ 
                            seasonId, 
                            matchupPeriodId: 1, 
                            scoringPeriodId: 1 
                        });
                        data = { scoreboard: week1 };
                    }
                    break;
                default:
                    data = leagueInfo;
            }
            
            res.json(data);
        } catch (apiError) {
            console.error('ESPN API error:', apiError.message);
            const statusCode = apiError.response?.status || 500;
            
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

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Fantasy Football Stats: http://localhost:${PORT}/fantasy-football-stats.html`);
});
