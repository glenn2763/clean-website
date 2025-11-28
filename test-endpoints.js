// Test script to analyze ESPN API endpoints and response data
const { Client } = require('espn-fantasy-football-api/node');
const fs = require('fs');

// Load config
let espnConfig = {};
try {
    if (fs.existsSync('espn-config.json')) {
        espnConfig = JSON.parse(fs.readFileSync('espn-config.json', 'utf8'));
    }
} catch (e) {
    console.error('Failed to load config:', e.message);
    process.exit(1);
}

const leagueId = espnConfig.defaultLeagueId || 37892;
const seasons = [2024, 2023, 2022, 2021];

async function testEndpoints() {
    console.log(`\n=== Testing ESPN API Endpoints ===`);
    console.log(`League ID: ${leagueId}\n`);
    
    const clientConfig = { leagueId };
    if (espnConfig.espnS2 && espnConfig.SWID) {
        clientConfig.espnS2 = espnConfig.espnS2;
        clientConfig.SWID = espnConfig.SWID;
    }
    
    const client = new Client(clientConfig);
    
    // Test each season
    for (const season of seasons) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SEASON ${season}`);
        console.log('='.repeat(80));
        
        try {
            // 1. Test getLeagueInfo (mSettings)
            console.log('\n1. getLeagueInfo (mSettings):');
            try {
                const leagueInfo = await client.getLeagueInfo({ seasonId: season });
                const size = JSON.stringify(leagueInfo).length;
                console.log(`   ✓ Size: ${(size / 1024).toFixed(2)} KB`);
                console.log(`   Keys: ${Object.keys(leagueInfo).join(', ')}`);
                console.log(`   League Name: ${leagueInfo.name || 'N/A'}`);
                console.log(`   Teams: ${leagueInfo.teams?.length || 0}`);
                console.log(`   Current Scoring Period: ${leagueInfo.currentScoringPeriodId || 'N/A'}`);
            } catch (e) {
                console.log(`   ✗ Error: ${e.message}`);
            }
            
            // 2. Test getTeamsAtWeek
            console.log('\n2. getTeamsAtWeek (mTeam):');
            try {
                const teams = await client.getTeamsAtWeek({ seasonId: season, scoringPeriodId: 0 });
                const size = JSON.stringify(teams).length;
                console.log(`   ✓ Size: ${(size / 1024).toFixed(2)} KB`);
                console.log(`   Teams Count: ${teams.length}`);
                if (teams.length > 0) {
                    const firstTeam = teams[0];
                    console.log(`   First Team Keys: ${Object.keys(firstTeam).join(', ')}`);
                    console.log(`   First Team: ${firstTeam.location || 'N/A'} ${firstTeam.nickname || 'N/A'}`);
                    console.log(`   Has Roster: ${!!firstTeam.roster}`);
                    console.log(`   Roster Size: ${firstTeam.roster?.length || 0}`);
                    console.log(`   Total Points: ${firstTeam.totalPoints || 'N/A'}`);
                    console.log(`   Record: ${firstTeam.record ? `${firstTeam.record.wins}-${firstTeam.record.losses}-${firstTeam.record.ties}` : 'N/A'}`);
                }
            } catch (e) {
                console.log(`   ✗ Error: ${e.message}`);
            }
            
            // 3. Test getBoxscoreForWeek (mMatchup/mSchedule)
            console.log('\n3. getBoxscoreForWeek (mMatchup/mSchedule) - Week 1:');
            try {
                const boxscores = await client.getBoxscoreForWeek({ 
                    seasonId: season, 
                    matchupPeriodId: 1, 
                    scoringPeriodId: 1 
                });
                const size = JSON.stringify(boxscores).length;
                console.log(`   ✓ Size: ${(size / 1024).toFixed(2)} KB`);
                console.log(`   Matchups Count: ${boxscores.length}`);
                if (boxscores.length > 0) {
                    const firstBox = boxscores[0];
                    console.log(`   First Boxscore Keys: ${Object.keys(firstBox).join(', ')}`);
                    console.log(`   Home Score: ${firstBox.homeScore || 'N/A'}`);
                    console.log(`   Away Score: ${firstBox.awayScore || 'N/A'}`);
                    console.log(`   Home Roster Size: ${firstBox.homeRoster?.length || 0}`);
                    console.log(`   Away Roster Size: ${firstBox.awayRoster?.length || 0}`);
                }
            } catch (e) {
                console.log(`   ✗ Error: ${e.message}`);
            }
            
            // 4. Test multiple weeks to see total data size
            console.log('\n4. Testing All Weeks (mMatchup/mSchedule):');
            try {
                const allMatchups = [];
                let totalSize = 0;
                let weeksFound = 0;
                
                for (let week = 1; week <= 18; week++) {
                    try {
                        const boxes = await client.getBoxscoreForWeek({ 
                            seasonId: season, 
                            matchupPeriodId: week, 
                            scoringPeriodId: week 
                        });
                        allMatchups.push(...boxes);
                        totalSize += JSON.stringify(boxes).length;
                        weeksFound++;
                    } catch (e) {
                        // Week doesn't exist, stop
                        break;
                    }
                }
                
                console.log(`   ✓ Weeks Found: ${weeksFound}`);
                console.log(`   Total Matchups: ${allMatchups.length}`);
                console.log(`   Total Size: ${(totalSize / 1024).toFixed(2)} KB`);
                console.log(`   Average per Week: ${weeksFound > 0 ? (totalSize / weeksFound / 1024).toFixed(2) : 0} KB`);
            } catch (e) {
                console.log(`   ✗ Error: ${e.message}`);
            }
            
            // 5. Test standings data structure
            console.log('\n5. Standings Data (from getTeamsAtWeek):');
            try {
                const teams = await client.getTeamsAtWeek({ seasonId: season, scoringPeriodId: 0 });
                if (teams.length > 0) {
                    const standingsData = teams.map(t => ({
                        teamId: t.id,
                        name: `${t.location} ${t.nickname}`,
                        wins: t.record?.wins || 0,
                        losses: t.record?.losses || 0,
                        ties: t.record?.ties || 0,
                        pointsFor: t.totalPoints || 0,
                        pointsAgainst: t.totalPointsAgainst || 0
                    }));
                    console.log(`   ✓ Standings entries: ${standingsData.length}`);
                    console.log(`   Sample entry:`, JSON.stringify(standingsData[0], null, 2));
                }
            } catch (e) {
                console.log(`   ✗ Error: ${e.message}`);
            }
            
        } catch (error) {
            console.error(`\n✗ Season ${season} failed:`, error.message);
        }
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('\nRecommendations:');
    console.log('- Large data views (mMatchup, mSchedule) should not be cached');
    console.log('- Consider fetching weeks on-demand rather than all at once');
    console.log('- Team data (mTeam) is relatively small and can be cached');
    console.log('- League settings (mSettings) is small and should be cached');
}

testEndpoints().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

