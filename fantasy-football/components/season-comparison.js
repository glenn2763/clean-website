/**
 * Season Comparison Component
 * Shows manager performance across multiple completed or in-progress seasons
 */

import { buildOwnerMap, getActiveSeasons, getOwnerKey, getOwnerLabel, getTeams } from '../utils.js';
import { createChart, seriesColor, seriesFill } from '../charts.js';

/**
 * Build owner → per-season records for comparison views.
 * @param {Object} allSeasonsData
 * @returns {{ seasons: number[], ownerMap: Object, ownerSeasons: Object, ownerList: string[] }}
 */
function buildSeasonComparisonModel(allSeasonsData) {
    const seasons = getActiveSeasons(allSeasonsData);
    const ownerMap = buildOwnerMap(allSeasonsData);
    const ownerSeasons = {};

    seasons.forEach((season) => {
        const data = allSeasonsData[season];
        const standings = data?.mStandings;
        const teams = getTeams(data);

        if (!standings || !Array.isArray(standings.entries)) return;

        standings.entries.forEach((entry) => {
            const team = teams.find((t) => t.id === entry.teamId);
            if (!team) return;

            const ownerKey = getOwnerKey(team);
            if (!ownerSeasons[ownerKey]) {
                ownerSeasons[ownerKey] = {};
            }
            ownerSeasons[ownerKey][season] = {
                wins: entry.overallWinLossTie?.wins || 0,
                losses: entry.overallWinLossTie?.losses || 0,
                pointsFor: entry.overallPointsFor || 0,
            };
        });
    });

    const ownerList = Object.keys(ownerSeasons).sort((a, b) => {
        const totalA = seasons.reduce((sum, season) => sum + (ownerSeasons[a][season]?.wins || 0), 0);
        const totalB = seasons.reduce((sum, season) => sum + (ownerSeasons[b][season]?.wins || 0), 0);
        return totalB - totalA;
    });

    return { seasons, ownerMap, ownerSeasons, ownerList };
}

/**
 * Compact career W-L totals for the Pulse hub.
 * @param {Object} allSeasonsData
 */
function renderCareerSnapshot(allSeasonsData) {
    const snapshotEl = document.getElementById('pulse-career-snapshot');
    if (!snapshotEl) return;

    const { seasons, ownerMap, ownerSeasons, ownerList } = buildSeasonComparisonModel(allSeasonsData);
    if (!seasons.length) {
        snapshotEl.innerHTML = '<p class="empty-copy">No completed seasons with game data yet.</p>';
        return;
    }

    snapshotEl.innerHTML = `
        <table class="career-snapshot-table">
            <thead>
                <tr>
                    <th>Manager</th>
                    <th>Seasons</th>
                    <th>Record</th>
                    <th>Win %</th>
                </tr>
            </thead>
            <tbody>
                ${ownerList.map((ownerKey) => {
                    const name = getOwnerLabel(ownerKey, ownerMap);
                    const totals = seasons.reduce(
                        (acc, season) => {
                            const record = ownerSeasons[ownerKey][season];
                            if (!record) return acc;
                            return {
                                wins: acc.wins + record.wins,
                                losses: acc.losses + record.losses,
                                seasons: acc.seasons + 1,
                            };
                        },
                        { wins: 0, losses: 0, seasons: 0 }
                    );
                    const games = totals.wins + totals.losses;
                    const winPct = games ? ((totals.wins / games) * 100).toFixed(1) : '—';
                    return `
                        <tr>
                            <td>${name}</td>
                            <td class="mono">${totals.seasons}</td>
                            <td class="mono">${totals.wins}-${totals.losses}</td>
                            <td class="mono">${winPct}${games ? '%' : ''}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function fadeHslColor(hslColor, alpha) {
    if (hslColor.startsWith('hsla(')) {
        return hslColor.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    return hslColor.replace(/^hsl\(/, 'hsla(').replace(/\)$/, `, ${alpha})`);
}

function buildLineStyleState(datasets) {
    datasets.forEach((dataset) => {
        dataset._activeBorderColor = dataset.borderColor;
        dataset._activeBackgroundColor = dataset.backgroundColor;
        dataset._fadedBorderColor = fadeHslColor(dataset.borderColor, 0.12);
        dataset._fadedBackgroundColor = 'transparent';
    });
}

function applyLineHighlight(chart, datasetIndex) {
    chart.data.datasets.forEach((dataset, index) => {
        if (datasetIndex == null) {
            dataset.borderColor = dataset._activeBorderColor;
            dataset.backgroundColor = dataset._activeBackgroundColor;
            dataset.borderWidth = 1.5;
            dataset.pointRadius = 2;
            return;
        }

        const active = index === datasetIndex;
        dataset.borderColor = active ? dataset._activeBorderColor : dataset._fadedBorderColor;
        dataset.backgroundColor = active ? dataset._activeBackgroundColor : dataset._fadedBackgroundColor;
        dataset.borderWidth = active ? 2.5 : 1;
        dataset.pointRadius = active ? 4 : 1.5;
    });
}

function createLineHighlightHandlers() {
    let highlightedDatasetIndex = null;

    const resetHighlight = (chart) => {
        if (highlightedDatasetIndex == null) return;
        highlightedDatasetIndex = null;
        chart.$highlightedDatasetIndex = null;
        applyLineHighlight(chart, null);
        chart.update('none');
    };

    const updateHighlight = (chart, datasetIndex) => {
        if (datasetIndex != null && !chart.isDatasetVisible(datasetIndex)) return;
        if (datasetIndex === highlightedDatasetIndex) return;
        highlightedDatasetIndex = datasetIndex;
        chart.$highlightedDatasetIndex = datasetIndex;
        applyLineHighlight(chart, datasetIndex);
        chart.update('none');
    };

    return {
        resetHighlight,
        onHover(event, elements, chart) {
            const element = elements.find((entry) => chart.isDatasetVisible(entry.datasetIndex));
            chart.canvas.style.cursor = element ? 'pointer' : 'default';
            updateHighlight(chart, element ? element.datasetIndex : null);
        },
        attachLeaveReset(chart) {
            const container = chart.canvas.closest('.chart-container') || chart.canvas;
            container.addEventListener('mouseleave', () => resetHighlight(chart));
        },
        legend: {
            onHover(_event, legendItem, legend) {
                updateHighlight(legend.chart, legendItem.datasetIndex);
            },
            onLeave(_event, _legendItem, legend) {
                resetHighlight(legend.chart);
            },
            onClick(_event, legendItem, legend) {
                toggleDatasetLine(legend.chart, legendItem.datasetIndex);
            },
        },
    };
}

function syncTableLineVisibility(chart, tableEl) {
    tableEl.querySelectorAll('[data-dataset-index]').forEach((row) => {
        const index = Number(row.dataset.datasetIndex);
        row.classList.toggle('row-line-hidden', !chart.isDatasetVisible(index));
        row.setAttribute('aria-pressed', chart.isDatasetVisible(index) ? 'true' : 'false');
    });
}

function toggleDatasetLine(chart, datasetIndex) {
    const handlers = chart.$lineHighlightHandlers;
    handlers?.resetHighlight(chart);
    chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
    chart.update();
    syncTableLineVisibility(chart, chart.$seasonCompTable);
}

/**
 * Render season comparison chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderSeasonComparison(allSeasonsData) {
    const canvas = document.getElementById('season-comparison-chart');
    const tableEl = document.getElementById('season-comparison-table');
    if (!canvas || !tableEl) return;

    const { seasons, ownerMap, ownerSeasons, ownerList } = buildSeasonComparisonModel(allSeasonsData);
    if (seasons.length === 0) {
        tableEl.innerHTML = '<p>No completed seasons with game data yet.</p>';
        return;
    }

    const datasets = ownerList.map((ownerKey, idx) => ({
        label: getOwnerLabel(ownerKey, ownerMap),
        data: seasons.map((season) => ownerSeasons[ownerKey][season]?.wins ?? null),
        borderColor: seriesColor(idx),
        backgroundColor: seriesFill(idx, 0.08),
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.25,
    }));
    buildLineStyleState(datasets);

    const highlightHandlers = createLineHighlightHandlers();

    const chart = createChart('seasonComparison', canvas, {
        type: 'line',
        data: {
            labels: seasons,
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'dataset',
                intersect: false,
            },
            onHover: highlightHandlers.onHover,
            plugins: {
                title: { display: true, text: 'Regular-Season Wins by Manager' },
                legend: {
                    position: 'bottom',
                    onClick: highlightHandlers.legend.onClick,
                    onHover: highlightHandlers.legend.onHover,
                    onLeave: highlightHandlers.legend.onLeave,
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    displayColors: true,
                    filter(tooltipItem) {
                        const active = tooltipItem.chart.$highlightedDatasetIndex;
                        return active == null || tooltipItem.datasetIndex === active;
                    },
                    callbacks: {
                        title(items) {
                            if (!items.length) return '';
                            return items[0].dataset.label;
                        },
                        label(context) {
                            const ownerKey = ownerList[context.datasetIndex];
                            const record = ownerSeasons[ownerKey][context.label];
                            if (!record) return `${context.label}: no data`;
                            return `${context.label}: ${record.wins}-${record.losses}`;
                        },
                    },
                },
            },
            scales: {
                x: { title: { display: true, text: 'Season' } },
                y: { beginAtZero: true, title: { display: true, text: 'Regular-Season Wins' } },
            },
        },
    });
    highlightHandlers.attachLeaveReset(chart);
    chart.$lineHighlightHandlers = highlightHandlers;
    chart.$seasonCompTable = tableEl;

    tableEl.innerHTML = `
        <table class="season-comp-table">
            <thead>
                <tr>
                    <th>Manager</th>
                    ${seasons.map((s) => `<th>${s} W-L</th>`).join('')}
                    <th>Total Record</th>
                </tr>
            </thead>
            <tbody>
                ${ownerList.map((ownerKey, datasetIndex) => {
                    const name = getOwnerLabel(ownerKey, ownerMap);
                    const totalRecord = seasons.reduce(
                        (totals, season) => {
                            const record = ownerSeasons[ownerKey][season];
                            if (!record) return totals;
                            return {
                                wins: totals.wins + record.wins,
                                losses: totals.losses + record.losses,
                            };
                        },
                        { wins: 0, losses: 0 }
                    );
                    const totalRecordLabel = `${totalRecord.wins}-${totalRecord.losses}`;
                    return `
                        <tr data-dataset-index="${datasetIndex}" role="button" tabindex="0" aria-pressed="true" title="Click to show or hide this line">
                            <td>${name}</td>
                            ${seasons.map((season) => {
                                const record = ownerSeasons[ownerKey][season];
                                return `<td>${record ? `${record.wins}-${record.losses}` : '-'}</td>`;
                            }).join('')}
                            <td><strong>${totalRecordLabel}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    tableEl.onclick = (event) => {
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        toggleDatasetLine(chart, Number(row.dataset.datasetIndex));
    };

    tableEl.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        event.preventDefault();
        toggleDatasetLine(chart, Number(row.dataset.datasetIndex));
    };
}

export { renderSeasonComparison, renderCareerSnapshot };
