/**
 * Season Comparison Component
 * Shows manager performance across multiple completed or in-progress seasons
 */

import { buildOwnerMap, getActiveSeasons, getOwnerKey, getOwnerLabel, getTeams } from '../utils.js';
import { createChart, getChart, seriesColor, seriesFill } from '../charts.js';

const METRICS = {
    points: {
        key: 'points',
        chartTitle: 'Regular-Season Points by Manager',
        yAxisTitle: 'Regular-Season Points',
        tableSeasonHeader: (season) => `${season} PF`,
        tableTotalHeader: 'Total PF',
        getValue: (record) => (record ? record.pointsFor : null),
        formatSeasonCell: (record) => (record ? record.pointsFor.toFixed(0) : '-'),
        formatTotal: (totals) => totals.pointsFor.toFixed(0),
        tooltipLabel: (season, record) => {
            if (!record) return `${season}: no data`;
            return `${season}: ${record.pointsFor.toFixed(0)} pts (${record.wins}-${record.losses})`;
        },
        accumulateTotal: (totals, record) => ({
            wins: totals.wins + (record?.wins || 0),
            losses: totals.losses + (record?.losses || 0),
            pointsFor: totals.pointsFor + (record?.pointsFor || 0),
        }),
        emptyTotal: () => ({ wins: 0, losses: 0, pointsFor: 0 }),
    },
    wins: {
        key: 'wins',
        chartTitle: 'Regular-Season Wins by Manager',
        yAxisTitle: 'Regular-Season Wins',
        tableSeasonHeader: (season) => `${season} W-L`,
        tableTotalHeader: 'Total Record',
        getValue: (record) => (record ? record.wins : null),
        formatSeasonCell: (record) => (record ? `${record.wins}-${record.losses}` : '-'),
        formatTotal: (totals) => `${totals.wins}-${totals.losses}`,
        tooltipLabel: (season, record) => {
            if (!record) return `${season}: no data`;
            return `${season}: ${record.wins}-${record.losses} · ${record.pointsFor.toFixed(0)} pts`;
        },
        accumulateTotal: (totals, record) => ({
            wins: totals.wins + (record?.wins || 0),
            losses: totals.losses + (record?.losses || 0),
            pointsFor: totals.pointsFor + (record?.pointsFor || 0),
        }),
        emptyTotal: () => ({ wins: 0, losses: 0, pointsFor: 0 }),
    },
};

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
        const totalPfA = seasons.reduce((sum, season) => sum + (ownerSeasons[a][season]?.pointsFor || 0), 0);
        const totalPfB = seasons.reduce((sum, season) => sum + (ownerSeasons[b][season]?.pointsFor || 0), 0);
        return totalPfB - totalPfA || a.localeCompare(b);
    });

    return { seasons, ownerMap, ownerSeasons, ownerList };
}

function formatPoints(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function buildPointLeaderStats(model) {
    const { seasons, ownerMap, ownerSeasons, ownerList } = model;

    const careerTotals = ownerList
        .map((ownerKey) => ({
            name: getOwnerLabel(ownerKey, ownerMap),
            total: seasons.reduce((sum, season) => sum + (ownerSeasons[ownerKey][season]?.pointsFor || 0), 0),
        }))
        .filter((entry) => entry.total > 0)
        .sort((a, b) => b.total - a.total);

    let bestSeason = null;
    seasons.forEach((season) => {
        ownerList.forEach((ownerKey) => {
            const record = ownerSeasons[ownerKey][season];
            if (!record || record.pointsFor <= 0) return;
            if (!bestSeason || record.pointsFor > bestSeason.pointsFor) {
                bestSeason = {
                    name: getOwnerLabel(ownerKey, ownerMap),
                    pointsFor: record.pointsFor,
                    season,
                };
            }
        });
    });

    return {
        careerTop: careerTotals.slice(0, 3),
        bestSeason,
    };
}

function renderPointLeaderStrip(model) {
    const container = document.getElementById('season-comparison-leaders');
    if (!container) return;

    const { careerTop, bestSeason } = buildPointLeaderStats(model);
    if (!careerTop.length && !bestSeason) {
        container.innerHTML = '';
        return;
    }

    const careerLine = careerTop.length
        ? `<span><strong>Career PF</strong> ${careerTop.map((entry) => `${entry.name} ${formatPoints(entry.total)}`).join(' · ')}</span>`
        : '';

    const seasonLine = bestSeason
        ? `<span><strong>Best season</strong> ${bestSeason.name} ${formatPoints(bestSeason.pointsFor)} (${bestSeason.season})</span>`
        : '';

    container.innerHTML = [careerLine, seasonLine].filter(Boolean).join('<span class="season-comp-leaders-divider">|</span>');
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

function computeYAxisBounds(chart, metricKey) {
    const values = chart.data.datasets.flatMap((dataset, index) => {
        if (!chart.isDatasetVisible(index)) return [];
        return dataset.data.filter((value) => value != null && Number.isFinite(value));
    });
    if (!values.length) return { min: 0, max: 1 };

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const span = Math.max(dataMax - dataMin, 1);
    const padding = span * 0.06;

    if (metricKey === 'points') {
        return {
            min: Math.floor((dataMin - padding) / 25) * 25,
            max: Math.ceil((dataMax + padding) / 25) * 25,
        };
    }

    return {
        min: Math.max(0, Math.floor(dataMin - padding)),
        max: Math.ceil(dataMax + padding),
    };
}

function applyYAxisBounds(chart, metricKey) {
    const { min, max } = computeYAxisBounds(chart, metricKey);
    chart.options.scales.y.min = min;
    chart.options.scales.y.max = max;
    chart.options.scales.y.beginAtZero = false;
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
    applyYAxisBounds(chart, chart.$seasonCompMetric || 'points');
    chart.update();
    syncTableLineVisibility(chart, chart.$seasonCompTable);
}

function buildComparisonTable(model, metricKey) {
    const metric = METRICS[metricKey];
    const { seasons, ownerMap, ownerSeasons, ownerList } = model;

    return `
        <table class="season-comp-table">
            <thead>
                <tr>
                    <th>Manager</th>
                    ${seasons.map((season) => `<th>${metric.tableSeasonHeader(season)}</th>`).join('')}
                    <th>${metric.tableTotalHeader}</th>
                </tr>
            </thead>
            <tbody>
                ${ownerList.map((ownerKey, datasetIndex) => {
                    const name = getOwnerLabel(ownerKey, ownerMap);
                    const total = seasons.reduce(
                        (totals, season) => metric.accumulateTotal(totals, ownerSeasons[ownerKey][season]),
                        metric.emptyTotal()
                    );
                    return `
                        <tr data-dataset-index="${datasetIndex}" role="button" tabindex="0" aria-pressed="true" title="Click to show or hide this line">
                            <td>${name}</td>
                            ${seasons.map((season) => {
                                const record = ownerSeasons[ownerKey][season];
                                return `<td>${metric.formatSeasonCell(record)}</td>`;
                            }).join('')}
                            <td><strong>${metric.formatTotal(total)}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function applyComparisonMetric(chart, model, metricKey, tableEl) {
    const metric = METRICS[metricKey];
    const { seasons, ownerSeasons, ownerList } = model;

    chart.data.datasets.forEach((dataset, index) => {
        const ownerKey = ownerList[index];
        dataset.data = seasons.map((season) => metric.getValue(ownerSeasons[ownerKey][season]));
    });

    chart.options.plugins.title.text = metric.chartTitle;
    chart.options.scales.y.title.text = metric.yAxisTitle;
    chart.$seasonCompMetric = metricKey;
    applyYAxisBounds(chart, metricKey);
    chart.update();

    if (tableEl) {
        tableEl.innerHTML = buildComparisonTable(model, metricKey);
        syncTableLineVisibility(chart, tableEl);
    }

    document.querySelectorAll('.season-comp-metric-btn').forEach((button) => {
        const active = button.dataset.metric === metricKey;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function setupMetricToggle(section, tableEl) {
    if (section.dataset.metricToggleBound === 'true') return;
    section.dataset.metricToggleBound = 'true';

    section.addEventListener('click', (event) => {
        const button = event.target.closest('.season-comp-metric-btn');
        if (!button || button.getAttribute('aria-pressed') === 'true') return;

        const chart = getChart('seasonComparison');
        const model = chart?.$seasonCompModel;
        if (!chart || !model) return;

        applyComparisonMetric(chart, model, button.dataset.metric, tableEl);
    });
}

/**
 * Render season comparison chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderSeasonComparison(allSeasonsData) {
    const canvas = document.getElementById('season-comparison-chart');
    const tableEl = document.getElementById('season-comparison-table');
    const section = document.getElementById('section-season-comparison');
    if (!canvas || !tableEl) return;

    const model = buildSeasonComparisonModel(allSeasonsData);
    const { seasons, ownerMap, ownerSeasons, ownerList } = model;

    if (seasons.length === 0) {
        tableEl.innerHTML = '<p>No completed seasons with game data yet.</p>';
        renderPointLeaderStrip(model);
        return;
    }

    renderPointLeaderStrip(model);

    const defaultMetric = METRICS.points;
    const datasets = ownerList.map((ownerKey, idx) => ({
        label: getOwnerLabel(ownerKey, ownerMap),
        data: seasons.map((season) => defaultMetric.getValue(ownerSeasons[ownerKey][season])),
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
                title: { display: true, text: defaultMetric.chartTitle },
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
                            const metric = METRICS[context.chart.$seasonCompMetric || 'points'];
                            return metric.tooltipLabel(context.label, record);
                        },
                    },
                },
            },
            scales: {
                x: { title: { display: true, text: 'Season' } },
                y: {
                    beginAtZero: false,
                    title: { display: true, text: defaultMetric.yAxisTitle },
                },
            },
        },
    });
    applyYAxisBounds(chart, 'points');
    chart.update();
    highlightHandlers.attachLeaveReset(chart);
    chart.$lineHighlightHandlers = highlightHandlers;
    chart.$seasonCompTable = tableEl;
    chart.$seasonCompModel = model;
    chart.$seasonCompMetric = 'points';

    tableEl.innerHTML = buildComparisonTable(model, 'points');

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

    if (section) {
        setupMetricToggle(section, tableEl);
    }
}

export { buildSeasonComparisonModel, renderSeasonComparison };
