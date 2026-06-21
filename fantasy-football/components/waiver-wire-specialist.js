/**
 * Waiver Wire Specialist Component
 * Tracks waiver/FA add (claim) counts by manager across seasons
 */

import {
    buildOwnerMap,
    countWireAddsAndDrops,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getTeams,
    getTransactions,
    hasTransactionView,
} from '../utils.js';
import { createChart } from '../charts.js';

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
    const nextVisible = !chart.isDatasetVisible(datasetIndex);

    (chart.$linkedCharts || [chart]).forEach((linkedChart) => {
        linkedChart.setDatasetVisibility(datasetIndex, nextVisible);
        linkedChart.update();
        syncTableLineVisibility(linkedChart, linkedChart.$wireTable);
    });
}

function collectManagerWireMoves(allSeasonsData) {
    const seasons = getActiveSeasons(allSeasonsData);
    const ownerMap = buildOwnerMap(allSeasonsData);
    const ownerSeasons = {};
    let seasonsMissingTransactions = 0;
    let leagueAdds = 0;

    seasons.forEach((season) => {
        const seasonData = allSeasonsData[season];
        const transactions = getTransactions(seasonData);
        const teams = getTeams(seasonData);

        if (!hasTransactionView(seasonData)) {
            seasonsMissingTransactions += 1;
        }

        teams.forEach((team) => {
            const ownerKey = getOwnerKey(team);
            if (!ownerSeasons[ownerKey]) {
                ownerSeasons[ownerKey] = {};
            }

            const { adds } = countWireAddsAndDrops(transactions, team.id);
            ownerSeasons[ownerKey][season] = { adds };
            leagueAdds += adds;
        });
    });

    const ownerList = Object.keys(ownerSeasons).sort((a, b) => {
        const totalA = seasons.reduce((sum, season) => sum + (ownerSeasons[a][season]?.adds || 0), 0);
        const totalB = seasons.reduce((sum, season) => sum + (ownerSeasons[b][season]?.adds || 0), 0);
        return totalB - totalA;
    });

    return {
        seasons,
        ownerMap,
        ownerSeasons,
        ownerList,
        seasonsMissingTransactions,
        leagueAdds,
    };
}

function buildWireChart({
    canvasId,
    chartKey,
    seasons,
    ownerList,
    ownerMap,
    ownerSeasons,
    metric,
    title,
    yLabel,
    tableEl,
}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const datasets = ownerList.map((ownerKey, idx) => ({
        label: getOwnerLabel(ownerKey, ownerMap),
        data: seasons.map((season) => ownerSeasons[ownerKey][season]?.[metric] ?? null),
        borderColor: `hsl(${idx * 33}, 65%, 45%)`,
        backgroundColor: `hsla(${idx * 33}, 65%, 45%, 0.08)`,
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.25,
    }));
    buildLineStyleState(datasets);

    const highlightHandlers = createLineHighlightHandlers();
    const chart = createChart(chartKey, canvas, {
        type: 'line',
        data: { labels: seasons, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'dataset', intersect: false },
            onHover: highlightHandlers.onHover,
            plugins: {
                title: { display: true, text: title },
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
                            return `${context.label}: ${value} claim${value === 1 ? '' : 's'}`;
                        },
                    },
                },
            },
            scales: {
                x: { title: { display: true, text: 'Season' } },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: yLabel },
                },
            },
        },
    });

    highlightHandlers.attachLeaveReset(chart);
    chart.$lineHighlightHandlers = highlightHandlers;
    chart.$wireTable = tableEl;
    return chart;
}

function renderWireTable(tableEl, seasons, ownerList, ownerMap, ownerSeasons, chart) {
    tableEl.innerHTML = `
        <table class="season-comp-table">
            <thead>
                <tr>
                    <th>Manager</th>
                    ${seasons.map((season) => `<th>${season}<br><span class="table-subhead">claims</span></th>`).join('')}
                    <th>Career claims</th>
                </tr>
            </thead>
            <tbody>
                ${ownerList.map((ownerKey, datasetIndex) => {
                    const careerAdds = seasons.reduce(
                        (sum, season) => sum + (ownerSeasons[ownerKey][season]?.adds || 0),
                        0
                    );
                    return `
                        <tr data-dataset-index="${datasetIndex}" role="button" tabindex="0" aria-pressed="true" title="Click to show or hide this manager">
                            <td>${getOwnerLabel(ownerKey, ownerMap)}</td>
                            ${seasons.map((season) => {
                                const record = ownerSeasons[ownerKey][season];
                                if (!record) return '<td>—</td>';
                                return `<td>${record.adds}</td>`;
                            }).join('')}
                            <td><strong>${careerAdds}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    const toggleFromRow = (datasetIndex) => {
        if (chart) toggleDatasetLine(chart, datasetIndex);
    };

    tableEl.onclick = (event) => {
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        toggleFromRow(Number(row.dataset.datasetIndex));
    };

    tableEl.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-dataset-index]');
        if (!row) return;
        event.preventDefault();
        toggleFromRow(Number(row.dataset.datasetIndex));
    };
}

/**
 * @param {Object} allSeasonsData
 */
function renderWaiverWireSpecialist(allSeasonsData) {
    const tableEl = document.getElementById('waiver-wire-table');
    const noticeEl = document.getElementById('waiver-wire-notice');
    if (!tableEl) return;

    const {
        seasons,
        ownerMap,
        ownerSeasons,
        ownerList,
        seasonsMissingTransactions,
        leagueAdds,
    } = collectManagerWireMoves(allSeasonsData);

    if (noticeEl) {
        if (seasonsMissingTransactions > 0) {
            noticeEl.innerHTML = `
                <p><strong>Transaction data not loaded</strong> for ${seasonsMissingTransactions} season(s).
                Click <strong>Clear Saved Data</strong>, then run <strong>Analyze All Seasons</strong> again to re-download <code>mTransactions</code>.</p>
            `;
            noticeEl.classList.remove('hidden');
        } else if (leagueAdds === 0) {
            noticeEl.innerHTML = `
                <p>No executed waiver or free-agent claims were found across these seasons.
                Most activity in this league is draft picks; wire moves are relatively rare.</p>
            `;
            noticeEl.classList.remove('hidden');
        } else {
            noticeEl.innerHTML = '';
            noticeEl.classList.add('hidden');
        }
    }

    if (!seasons.length || !ownerList.length) {
        tableEl.innerHTML = '<p>No seasons with team data yet.</p>';
        return;
    }

    const claimsChart = buildWireChart({
        canvasId: 'waiver-claims-chart',
        chartKey: 'waiverClaims',
        seasons,
        ownerList,
        ownerMap,
        ownerSeasons,
        metric: 'adds',
        title: 'Waiver / FA Claims by Manager',
        yLabel: 'Claims',
        tableEl,
    });

    renderWireTable(tableEl, seasons, ownerList, ownerMap, ownerSeasons, claimsChart);
}

export { renderWaiverWireSpecialist };
