# Fantasy Football Stats

Modular ESPN fantasy football analysis app. Entry point: `fantasy-football-stats.html` → `main.js`.

## Structure

```
fantasy-football/
├── api.js                 # ESPN proxy client + IndexedDB cache
├── utils.js               # Trade parsing, standings, roster metrics
├── metrics.js             # Lab metric definitions + correlations
├── charts.js              # Chart.js wrapper
├── violin-chart.js        # Schedule difficulty violins
├── birthplace-service.js  # Player geocoding for roster origins map
├── main.js                # Scope UI, hub navigation, analysis orchestration
├── components/
│   ├── index.js           # Hub render dispatch
│   ├── league-overview.js
│   ├── game-log.js
│   ├── table-extremes.js
│   └── …                  # One file per visualization
├── tests/
│   ├── test-utils.js
│   ├── test-api.js
│   ├── test-server-views.js
│   └── run-tests.html
└── scripts/
    ├── debug-trades.js    # Dev CLI for trade parsing
    └── explore-api-fields.js
```

## Hubs

| Hub | Season scope | All-seasons scope |
|-----|--------------|-------------------|
| Pulse | Standings + playoff bracket | League highlights, playoff performance |
| Scoring | Weekly trends, consistency | Season comparison, scoring ceiling |
| Matchups | Game log | Head-to-head chord |
| Trades | Trade analyzer | Trade network sociogram |
| Roster | Positional leaders | Birthplace / college origins map |
| Luck | — | Points against, schedule difficulty, luck map |
| Waiver Wire | — | Waiver claim activity |
| Lab | — | Metric correlator |

Luck, Waiver Wire, and Lab require **Analyze All Seasons** with at least two seasons loaded.

## Running tests

```bash
node fantasy-football/tests/test-utils.js
node fantasy-football/tests/test-api.js
node fantasy-football/tests/test-server-views.js   # requires npm start
```

Browser runner: serve the repo and open `fantasy-football/tests/run-tests.html`.

## Data quality verification

After changing the ESPN proxy or components:

1. **Server smoke test** — `node fantasy-football/tests/test-server-views.js`
2. **Single season** — Network tab shows ESPN view requests per season
3. **Waiver Wire** — claim chart and table populate (or show a clear empty notice)
4. **Positional Analysis** — top players by position with real names
5. **Standings** — playoff bracket and rest-of-table render correctly
6. **Playoff Performance** — championships reflect bracket winners, not regular-season #1 seeds
7. **Trades** — executed trades list; sociogram renders in all-seasons mode

## Adding a component

1. Create `components/my-component.js` with an exported render function
2. Import it in `components/index.js` and call it from the appropriate hub renderer
3. Add DOM targets in `fantasy-football-stats.html`
4. Add styles in `fantasy-football-stats.css` if needed
