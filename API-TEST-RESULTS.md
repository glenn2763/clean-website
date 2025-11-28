# ESPN API Endpoint Test Results

## Test Summary for League 37892 ("Domination League")

### Response Sizes by Endpoint:

1. **mSettings (getLeagueInfo)**: ~2 KB
   - Small, safe to cache
   - Contains: league name, settings, roster config, scoring rules

2. **mTeam (getTeamsAtWeek)**: ~88-89 KB per season
   - Medium size, can cache
   - Contains: 10 teams with rosters, records, points
   - **Structure**: Returns array directly (not `{teams: [...]}`)
   - **Team properties**: `name`, `abbreviation`, `wins`, `losses`, `ties`, `totalPointsScored`, `regularSeasonPointsFor`, `regularSeasonPointsAgainst`
   - **Note**: No `location`/`nickname` properties - use `name` directly

3. **mMatchup/mSchedule (getBoxscoreForWeek)**: 
   - Single week: ~180-340 KB
   - **All 18 weeks: ~5-5.4 MB per season** ⚠️
   - **Too large for localStorage** - should NOT be cached
   - **Structure**: `{ schedule: [...] }` where schedule is array of boxscores
   - **Boxscore properties**: `homeScore`, `awayScore`, `homeTeamId`, `awayTeamId`, `homeRoster`, `awayRoster`
   - **Note**: No `matchupPeriodId` in boxscore - server adds it

### Data Structure Differences:

**npm package structure vs expected:**
- Teams: `team.name` (not `team.location + ' ' + team.nickname`)
- Points: `team.totalPointsScored` (not `team.totalPoints`)
- Record: `team.wins`, `team.losses`, `team.ties` (not `team.record.wins`)
- Matchups: `{homeScore, awayScore, homeTeamId, awayTeamId}` (not `matchup.teams[]`)

### Recommendations:

1. ✅ **Skip caching for large views**: mMatchup, mSchedule, mRoster, kona_player_info
2. ✅ **Use correct property names**: `team.name`, `team.totalPointsScored`, etc.
3. ✅ **Fix matchup structure**: Use `homeScore`/`awayScore` instead of `matchup.teams`
4. ✅ **Add week numbers**: Server adds `matchupPeriodId` to boxscores
5. ⚠️ **Multi-season fetching**: Fetching all seasons (2021-2024) = ~20+ MB total - consider fetching on-demand

### Fixed Issues:

- ✅ Team names now use `team.name` instead of undefined location/nickname
- ✅ Points now use `team.totalPointsScored` 
- ✅ Records now use `team.wins`/`losses`/`ties` directly
- ✅ Matchups now use `homeScore`/`awayScore` structure
- ✅ Server adds `matchupPeriodId` to boxscores
- ✅ All `data.mTeam?.teams` changed to `data.mTeam` (direct array)

