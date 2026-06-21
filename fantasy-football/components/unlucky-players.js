/**
 * Unluckiest Players Component
 * Shows managers who consistently face the highest-scoring opponents
 */

import {
    buildOwnerMap,
    calculatePointsAgainst,
    collectWeeklyRelativePointsAgainst,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getMatchups,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';
import { createViolinChart, syncViolinFromLineChart } from '../violin-chart.js';

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

function createLineHighlightHandlers(toggleDatasetLine) {
    let highlightedDatasetIndex = null;

    const updateHighlight = (chart, datasetIndex) => {
        if (datasetIndex != null && !chart.isDatasetVisible(datasetIndex)) return;
        if (datasetIndex === highlightedDatasetIndex) return;
        highlightedDatasetIndex = datasetIndex;
        chart.$highlightedDatasetIndex = datasetIndex;
        applyLineHighlight(chart, datasetIndex);
        chart.update('none');
        syncViolinFromLineChart('pointsAgainstViolin', chart);
    };

    const resetHighlight = (chart) => {
        if (highlightedDatasetIndex == null) return;
        highlightedDatasetIndex = null;
        chart.$highlightedDatasetIndex = null;
        applyLineHighlight(chart, null);
        chart.update('none');
        syncViolinFromLineChart('pointsAgainstViolin', chart);
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
    chart.$lineHighlightHandlers?.resetHighlight(chart);
    chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
    chart.update();
    syncTableLineVisibility(chart, chart.$unluckyTable);
    syncViolinFromLineChart('pointsAgainstViolin', chart);
}

function getPointsAgainstAxisBounds(datasets, seasons) {
    const values = seasons.flatMap((season, seasonIndex) =>
        datasets.map((dataset) => dataset.data[seasonIndex]).filter((value) => value != null)
    );

    if (!values.length) {
        return { min: 90, max: 120 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.12, 1.5);

    return {
        min: Math.floor((min - padding) * 10) / 10,
        max: Math.ceil((max + padding) * 10) / 10,
    };
}

/**
 * Render unluckiest players chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderUnluckyPlayersChart(allSeasonsData) {
    const canvas = document.getElementById('points-against-chart');
    const violinCanvas = document.getElementById('points-against-violin-chart');
    const tableContainer = document.getElementById('unlucky-table');
    if (!canvas || !tableContainer) return;

    const hasData = Object.values(allSeasonsData).some(
        (data) => data?.mMatchup?.schedule && data?.mTeam
    );
    if (!hasData) {
        tableContainer.innerHTML = '<p>Matchup data not available for this analysis.</p>';
        return;
    }

    const ownerMap = buildOwnerMap(allSeasonsData);
    const ownerPA = {};
    const seasons = getActiveSeasons(allSeasonsData);
    if (!seasons.length) {
        tableContainer.innerHTML = '<p>No completed seasons with game data yet.</p>';
        return;
    }

    seasons.forEach((season) => {
        const data = allSeasonsData[season];
        const matchups = getMatchups(data);
        const teams = getTeams(data);

        if (teams.length === 0) return;

        teams.forEach((team) => {
            const ownerKey = getOwnerKey(team);
            if (!ownerPA[ownerKey]) {
                ownerPA[ownerKey] = { data: {}, relativeWeeklyValues: [] };
            }
            ownerPA[ownerKey].data[season] = calculatePointsAgainst(team.id, matchups, teams);
            ownerPA[ownerKey].relativeWeeklyValues.push(
                ...collectWeeklyRelativePointsAgainst(team.id, data)
            );
        });
    });

    const owners = Object.entries(ownerPA)
        .map(([ownerKey, info]) => {
            const values = Object.values(info.data);
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            return {
                ownerKey,
                name: getOwnerLabel(ownerKey, ownerMap),
                ...info,
                avg,
            };
        })
        .sort((a, b) => b.avg - a.avg);

    const datasets = owners.map((owner, idx) => ({
        label: owner.name,
        data: seasons.map((season) => owner.data[season] ?? null),
        borderColor: `hsl(${idx * 33}, 65%, 45%)`,
        backgroundColor: `hsla(${idx * 33}, 65%, 45%, 0.08)`,
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.25,
    }));
    buildLineStyleState(datasets);

    const yBounds = getPointsAgainstAxisBounds(datasets, seasons);
    const highlightHandlers = createLineHighlightHandlers(toggleDatasetLine);

    const chart = createChart('pointsAgainst', canvas, {
        type: 'line',
        data: { labels: seasons, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'dataset',
                intersect: false,
            },
            onHover: highlightHandlers.onHover,
            plugins: {
                title: {
                    display: true,
                    text: 'Average Points Against by Manager',
                },
                legend: {
                    position: 'bottom',
                    onClick: highlightHandlers.legend.onClick,
                    onHover: highlightHandlers.legend.onHover,
                    onLeave: highlightHandlers.legend.onLeave,
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    filter(tooltipItem) {
                        const active = tooltipItem.chart.$highlightedDatasetIndex;
                        return active == null || tooltipItem.datasetIndex === active;
                    },
                    callbacks: {
                        title(items) {
                            return items[0]?.dataset.label ?? '';
                        },
                        label(context) {
                            const value = context.parsed.y;
                            if (value == null) return `${context.label}: no data`;
                            return `${context.label}: ${value.toFixed(2)} pts against`;
                        },
                    },
                },
            },
            scales: {
                x: { title: { display: true, text: 'Season' } },
                y: {
                    beginAtZero: false,
                    min: yBounds.min,
                    max: yBounds.max,
                    title: { display: true, text: 'Avg. Points Against' },
                },
            },
        },
    });

    highlightHandlers.attachLeaveReset(chart);
    chart.$lineHighlightHandlers = highlightHandlers;
    chart.$unluckyTable = tableContainer;

    if (violinCanvas) {
        const violinContainer = violinCanvas.closest('.chart-container-violin');
        if (violinContainer) {
            violinContainer.style.setProperty('--violin-rows', String(owners.length));
        }

        createViolinChart('pointsAgainstViolin', violinCanvas, {
            title: 'Schedule difficulty (vs weekly league median)',
            xLabel: 'Points above/below league median that week',
            referenceValue: 0,
            valueFormat: 'relative',
            categories: owners.map((owner, idx) => ({
                label: owner.name,
                values: owner.relativeWeeklyValues,
                color: `hsl(${idx * 33}, 65%, 45%)`,
            })),
        });
        syncViolinFromLineChart('pointsAgainstViolin', chart);
    }

    tableContainer.innerHTML = `
        <table class="season-comp-table">
            <thead>
                <tr>
                    <th>Manager</th>
                    ${seasons.map((s) => `<th>${s}</th>`).join('')}
                    <th>Average</th>
                </tr>
            </thead>
            <tbody>
                ${owners.map((owner, datasetIndex) => `
                    <tr data-dataset-index="${datasetIndex}" role="button" tabindex="0" aria-pressed="true" title="Click to show or hide this line">
                        <td>${owner.name}</td>
                        ${seasons.map((season) => `<td>${(owner.data[season] || 0).toFixed(2)}</td>`).join('')}
                        <td><strong>${owner.avg.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    tableContainer.onclick = (event) => {
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        toggleDatasetLine(chart, Number(row.dataset.datasetIndex));
    };

    tableContainer.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        event.preventDefault();
        toggleDatasetLine(chart, Number(row.dataset.datasetIndex));
    };
}

export { renderUnluckyPlayersChart };
