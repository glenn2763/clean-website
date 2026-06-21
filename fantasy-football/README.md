# Fantasy Football Stats - Modular Structure

This directory contains the refactored fantasy football stats code, broken into smaller, testable components.

## Structure

```
fantasy-football/
├── api.js                 # API client (data fetching, caching)
├── utils.js               # Utility functions (calculations, helpers)
├── charts.js              # Chart manager (Chart.js wrapper)
├── main.js                 # Main entry point
├── components/            # Visualization components
│   ├── index.js           # Component exports
│   ├── league-overview.js
│   ├── unlucky-players.js
│   ├── consistency.js
│   └── ... (more components)
└── tests/                 # Test files
    ├── test-utils.js
    ├── test-api.js
    └── run-tests.html
```

## Components

### API (`api.js`)
- `fetchESPNData(leagueId, season, view)` - Fetch single view
- `fetchAllLeagueData(leagueId, season)` - Fetch all views for a season
- `fetchAllSeasons(leagueId, seasons)` - Fetch multiple seasons
- `clearCache()` - Clear localStorage cache

### Utils (`utils.js`)
- `getTeamNameFromObject(team)` - Get team name
- `calculatePointsAgainst(teamId, matchups, teams)` - Calculate PA
- `calculateConsistency(scores)` - Calculate standard deviation
- `calculateAverage(numbers)` - Calculate mean
- `getAllTeams(allSeasonsData)` - Get unique teams
- `getMatchups(seasonData)` - Get matchups from season
- `getTeams(seasonData)` - Get teams from season

### Charts (`charts.js`)
- `createChart(key, canvas, config)` - Create/update chart
- `destroyChart(key)` - Destroy chart
- `destroyAllCharts()` - Destroy all charts

### Components
Each component exports a render function:
- `renderLeagueOverview(data)` - League info and standings
- `renderUnluckyPlayersChart(allSeasonsData)` - Points against analysis
- `renderConsistencyChart(allSeasonsData)` - Consistency analysis
- ... (more components to be migrated)

## Migration Status

✅ **Completed:**
- API client module
- Utils module
- Chart manager
- League overview component
- Unlucky players component
- Consistency component
- Test framework
- Main entry point

⏳ **To Migrate:**
- Projected vs Actual component
- Score Extremes component
- Head-to-Head Matrix component
- Playoff Performance component
- Transaction Analysis component
- Positional Analysis component
- Weekly Trends component
- Matchup Analysis component
- Season Comparison component

## Running Tests

### Browser
Open `fantasy-football/tests/run-tests.html` in a browser.

### Node.js (if using test runner)
```bash
node fantasy-football/tests/test-utils.js
```

### Server view quality (requires `npm start`)
```bash
node fantasy-football/tests/test-server-views.js
```

## Data quality verification

After changing the ESPN proxy or components, verify:

1. **Server smoke test** — `node fantasy-football/tests/test-server-views.js` (7 views per season; transactions, players, projected scores)
2. **Single season fetch** — Network tab should show 7 `/api/espn/league/.../` requests
3. **Transaction Analysis** — chart shows waiver/trade activity (not empty)
4. **Positional Analysis** — top players listed by position with real names
5. **Projected vs Actual** — scatter plot spread; tables list over/underachievers
6. **League Overview** — “Active Scoring Rules” shows a number (not N/A)
7. **Playoff Performance** — championships reflect final-week winners, not regular-season #1 seeds

## Adding New Components

1. Create a new file in `components/` (e.g., `components/my-component.js`)
2. Import dependencies:
   ```javascript
   import { getTeamNameFromObject } from '../utils.js';
   import { createChart } from '../charts.js';
   ```
3. Export render function:
   ```javascript
   export function renderMyComponent(allSeasonsData) {
       // Component logic
   }
   ```
4. Add to `components/index.js`:
   ```javascript
   import { renderMyComponent } from './my-component.js';
   export { renderMyComponent };
   ```
5. Call in `renderAllVisualizations()`:
   ```javascript
   renderMyComponent(allSeasonsData);
   ```

## Benefits

- **Modularity**: Each component is self-contained
- **Testability**: Utils and API functions can be tested independently
- **Maintainability**: Easier to find and fix bugs
- **Reusability**: Components can be reused or composed
- **Scalability**: Easy to add new visualizations

