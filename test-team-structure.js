// Test team data structure in detail
const { Client } = require('espn-fantasy-football-api/node');
const fs = require('fs');

let espnConfig = {};
try {
    espnConfig = JSON.parse(fs.readFileSync('espn-config.json', 'utf8'));
} catch (e) {
    console.error('Failed to load config:', e.message);
    process.exit(1);
}

const leagueId = espnConfig.defaultLeagueId || 37892;
const clientConfig = { leagueId };
if (espnConfig.espnS2 && espnConfig.SWID) {
    clientConfig.espnS2 = espnConfig.espnS2;
    clientConfig.SWID = espnConfig.SWID;
}

const client = new Client(clientConfig);

async function testTeamStructure() {
    console.log(`\n=== Testing Team Data Structure ===`);
    console.log(`League ID: ${leagueId}\n`);
    
    const season = 2024;
    
    // Test different scoring periods
    const periods = [0, 1, 17, 19]; // 0 = preseason, 1 = week 1, 17 = week 17, 19 = end of season
    
    for (const period of periods) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Scoring Period ${period}:`);
        console.log('='.repeat(80));
        
        try {
            const teams = await client.getTeamsAtWeek({ seasonId: season, scoringPeriodId: period });
            
            if (teams.length > 0) {
                const team = teams[0];
                console.log('\nFirst Team Full Structure:');
                console.log(JSON.stringify(team, null, 2).substring(0, 2000));
                
                console.log('\nKey Properties:');
                console.log(`  id: ${team.id}`);
                console.log(`  name: ${team.name}`);
                console.log(`  abbreviation: ${team.abbreviation}`);
                console.log(`  ownerName: ${team.ownerName}`);
                console.log(`  location: ${team.location}`);
                console.log(`  nickname: ${team.nickname}`);
                console.log(`  wins: ${team.wins}`);
                console.log(`  losses: ${team.losses}`);
                console.log(`  ties: ${team.ties}`);
                console.log(`  totalPointsScored: ${team.totalPointsScored}`);
                console.log(`  regularSeasonPointsFor: ${team.regularSeasonPointsFor}`);
                console.log(`  regularSeasonPointsAgainst: ${team.regularSeasonPointsAgainst}`);
                console.log(`  record:`, team.record);
                console.log(`  roster length: ${team.roster?.length || 0}`);
                
                if (team.roster && team.roster.length > 0) {
                    console.log('\nFirst Roster Player:');
                    const player = team.roster[0];
                    console.log(`  Keys: ${Object.keys(player).join(', ')}`);
                    console.log(`  Player: ${player.player?.fullName || 'N/A'}`);
                    console.log(`  Position: ${player.rosteredPosition || 'N/A'}`);
                    console.log(`  Total Points: ${player.totalPoints || 'N/A'}`);
                }
                
                break; // Only need to check one period
            }
        } catch (e) {
            console.log(`  ✗ Error: ${e.message}`);
        }
    }
}

testTeamStructure().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

