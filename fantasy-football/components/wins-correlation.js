/**
 * Metric Correlation Component
 * Pearson r vs regular-season wins or points scored
 */

import {
    METRICS,
    DEFAULT_METRIC_IDS,
    CORRELATION_TARGETS,
    buildTeamSeasonRows,
    computeCorrelations,
    getCorrelationTarget,
    getMetricCategories,
    linearRegression,
} from '../metrics.js';
import { getActiveSeasons } from '../utils.js';
import { createChart } from '../charts.js';

const MIN_ROWS = 8;
const MIN_SEASONS = 2;

let selectedMetricIds = [...DEFAULT_METRIC_IDS];
let scatterMetricId = DEFAULT_METRIC_IDS[0];
let targetKey = 'wins';
let cachedRows = [];
let cachedAllSeasonsData = {};

function formatCorrelation(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return value.toFixed(3);
}

function getSelectedTargetKey() {
    const selected = document.querySelector('input[name="correlation-target"]:checked');
    return selected?.value || targetKey;
}

function getSelectedMetricIdsFromPicker() {
    const picker = document.getElementById('correlation-metric-picker');
    if (!picker) return selectedMetricIds;

    const checked = [...picker.querySelectorAll('input[type="checkbox"]:checked')].map(
        (input) => input.value
    );
    return checked.length > 0 ? checked : [...DEFAULT_METRIC_IDS];
}

function isMetricExcludedForTarget(metricId, currentTargetKey) {
    const target = getCorrelationTarget(currentTargetKey);
    return target.excludeMetricIds.includes(metricId);
}

function renderTargetPicker() {
    const container = document.getElementById('correlation-target-picker');
    if (!container) return;

    container.innerHTML = Object.entries(CORRELATION_TARGETS)
        .map(
            ([key, target]) => `
            <label class="correlation-target-option">
                <input
                    type="radio"
                    name="correlation-target"
                    value="${key}"
                    ${key === targetKey ? 'checked' : ''}
                />
                <span>${target.label}</span>
            </label>
        `
        )
        .join('');

    container.querySelectorAll('input[name="correlation-target"]').forEach((input) => {
        input.addEventListener('change', () => {
            targetKey = getSelectedTargetKey();
            refreshCorrelationWidget(cachedRows);
        });
    });
}

function renderMetricPicker() {
    const picker = document.getElementById('correlation-metric-picker');
    if (!picker) return;

    const target = getCorrelationTarget(targetKey);
    const categories = getMetricCategories();
    picker.innerHTML = categories
        .map((category) => {
            const metrics = METRICS.filter((metric) => metric.category === category);
            return `
                <div class="correlation-metric-group">
                    <h4>${category}</h4>
                    <div class="correlation-metric-options">
                        ${metrics
                            .map((metric) => {
                                const excluded = target.excludeMetricIds.includes(metric.id);
                                return `
                            <label class="correlation-metric-option${excluded ? ' correlation-metric-excluded' : ''}">
                                <input
                                    type="checkbox"
                                    value="${metric.id}"
                                    ${selectedMetricIds.includes(metric.id) && !excluded ? 'checked' : ''}
                                    ${excluded ? 'disabled' : ''}
                                />
                                <span>${metric.label}${excluded ? ' (outcome)' : ''}</span>
                            </label>
                        `;
                            })
                            .join('')}
                    </div>
                </div>
            `;
        })
        .join('');

    picker.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((input) => {
        input.addEventListener('change', () => {
            selectedMetricIds = getSelectedMetricIdsFromPicker();
            if (!selectedMetricIds.includes(scatterMetricId)) {
                scatterMetricId = selectedMetricIds[0] || DEFAULT_METRIC_IDS.find(
                    (id) => !isMetricExcludedForTarget(id, targetKey)
                ) || DEFAULT_METRIC_IDS[0];
            }
            refreshCorrelationWidget(cachedRows);
        });
    });
}

function renderScatterMetricSelect(metricIds) {
    const select = document.getElementById('correlation-scatter-metric');
    if (!select) return;

    const options = (metricIds.length > 0 ? metricIds : DEFAULT_METRIC_IDS).filter(
        (id) => !isMetricExcludedForTarget(id, targetKey)
    );
    select.innerHTML = options
        .map((id) => {
            const metric = METRICS.find((entry) => entry.id === id);
            return `<option value="${id}">${metric?.label || id}</option>`;
        })
        .join('');

    if (!options.includes(scatterMetricId)) {
        scatterMetricId = options[0] || DEFAULT_METRIC_IDS[0];
    }
    select.value = scatterMetricId;

    select.onchange = () => {
        scatterMetricId = select.value;
        renderScatterChart(cachedRows, scatterMetricId, targetKey);
    };
}

function renderResultsTable(rows, metricIds, currentTargetKey) {
    const container = document.getElementById('correlation-results-table');
    if (!container) return;

    const target = getCorrelationTarget(currentTargetKey);
    const results = computeCorrelations(rows, metricIds, currentTargetKey).sort((a, b) => {
        if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
        return Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0);
    });

    container.innerHTML = `
        <table class="correlation-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>r vs ${target.shortLabel.toLowerCase()}</th>
                    <th>n</th>
                    <th>Direction</th>
                </tr>
            </thead>
            <tbody>
                ${results
                    .map(
                        (result) => `
                    <tr class="${result.valid ? '' : 'correlation-row-muted'}">
                        <td>${result.label}</td>
                        <td>${formatCorrelation(result.r)}</td>
                        <td>${result.n}</td>
                        <td>${result.direction}</td>
                    </tr>
                `
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

function formatTargetValue(value, currentTargetKey) {
    const target = getCorrelationTarget(currentTargetKey);
    if (target.integerYAxis) return String(value);
    return Number(value).toFixed(1);
}

function renderScatterChart(rows, metricId, currentTargetKey) {
    const canvas = document.getElementById('wins-correlation-scatter');
    if (!canvas) return;

    const metric = METRICS.find((entry) => entry.id === metricId);
    const target = getCorrelationTarget(currentTargetKey);
    const points = rows
        .map((row) => ({
            x: row.metrics[metricId],
            y: row[target.key],
            manager: row.manager,
            season: row.season,
        }))
        .filter((point) => point.x != null && point.y != null);

    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const regression = linearRegression(xValues, yValues);

    const datasets = [
        {
            label: 'Manager-seasons',
            data: points,
            backgroundColor: 'rgba(118, 199, 192, 0.65)',
            borderColor: 'rgba(118, 199, 192, 1)',
            pointRadius: 5,
            pointHoverRadius: 7,
        },
    ];

    if (regression && points.length >= 2) {
        const xs = [...xValues].sort((a, b) => a - b);
        const xMin = xs[0];
        const xMax = xs[xs.length - 1];
        datasets.push({
            label: 'Trend line',
            data: [
                { x: xMin, y: regression.slope * xMin + regression.intercept },
                { x: xMax, y: regression.slope * xMax + regression.intercept },
            ],
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.9)',
            backgroundColor: 'rgba(255, 193, 7, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
        });
    }

    createChart('winsCorrelationScatter', canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: metric
                        ? `${metric.label} vs ${target.yAxisTitle}`
                        : `Metric vs ${target.shortLabel}`,
                },
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const raw = context.raw;
                            if (raw.manager) {
                                const outcome = formatTargetValue(raw.y, currentTargetKey);
                                const outcomeLabel = target.integerYAxis ? `${outcome} wins` : `${outcome} pts`;
                                return `${raw.manager} (${raw.season}): ${raw.x?.toFixed(2)} → ${outcomeLabel}`;
                            }
                            return `${context.dataset.label}: (${raw.x?.toFixed(2)}, ${raw.y})`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: metric?.label || 'Metric',
                    },
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: target.yAxisTitle,
                    },
                    ticks: target.integerYAxis ? { stepSize: 1 } : {},
                },
            },
        },
    });
}

function renderSampleNote(rows, allSeasonsData, currentTargetKey) {
    const note = document.getElementById('correlation-sample-note');
    if (!note) return;

    const seasons = getActiveSeasons(allSeasonsData);
    const target = getCorrelationTarget(currentTargetKey);
    note.textContent = `${rows.length} manager-season${rows.length === 1 ? '' : 's'} across ${seasons.length} season${seasons.length === 1 ? '' : 's'}. Pearson r compares each metric to ${target.label.toLowerCase()}; n is the number of paired observations with valid values. Points scored ignores opponent strength and schedule luck.`;
}

function refreshCorrelationWidget(rows) {
    targetKey = getSelectedTargetKey();
    const metricIds = getSelectedMetricIdsFromPicker().filter(
        (id) => !isMetricExcludedForTarget(id, targetKey)
    );
    selectedMetricIds = metricIds;
    renderMetricPicker();
    renderScatterMetricSelect(metricIds);
    renderResultsTable(rows, metricIds, targetKey);
    renderScatterChart(rows, scatterMetricId, targetKey);
    renderSampleNote(rows, cachedAllSeasonsData, targetKey);
}

function renderWinsCorrelation(allSeasonsData) {
    const section = document.getElementById('section-wins-correlation');
    if (!section) return;

    const seasons = getActiveSeasons(allSeasonsData);
    cachedAllSeasonsData = allSeasonsData;
    cachedRows = buildTeamSeasonRows(allSeasonsData);
    const unavailable = seasons.length < MIN_SEASONS || cachedRows.length < MIN_ROWS;

    section.classList.toggle('section-unavailable', unavailable);
    const notice = section.querySelector('.section-unavailable-notice');
    if (notice) {
        notice.classList.toggle('hidden', !unavailable);
        if (unavailable) {
            notice.textContent =
                seasons.length < MIN_SEASONS
                    ? 'Need at least two seasons of data for meaningful correlation.'
                    : `Need at least ${MIN_ROWS} manager-season rows (currently ${cachedRows.length}).`;
        }
    }

    renderTargetPicker();
    renderSampleNote(cachedRows, allSeasonsData, targetKey);

    if (unavailable) {
        const picker = document.getElementById('correlation-metric-picker');
        const table = document.getElementById('correlation-results-table');
        const canvas = document.getElementById('wins-correlation-scatter');
        if (picker) picker.innerHTML = '';
        if (table) table.innerHTML = '';
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    refreshCorrelationWidget(cachedRows);
    renderSampleNote(cachedRows, allSeasonsData, targetKey);
}

export { renderWinsCorrelation };
