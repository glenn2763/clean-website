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
    compareCorrelationResults,
    sortCorrelationResults,
} from '../metrics.js';
import { getActiveSeasons } from '../utils.js';
import { createChart } from '../charts.js';

const MIN_ROWS = 8;
const MIN_SEASONS = 2;

const CORRELATION_AXIS_TITLE_FONT = {
    family: '"Barlow Condensed", sans-serif',
    size: 13,
    weight: '600',
};

const CORRELATION_AXIS_TICK_FONT = {
    family: '"IBM Plex Mono", monospace',
    size: 10,
    weight: '500',
};

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

    return [...picker.querySelectorAll('input[type="checkbox"]:checked')].map(
        (input) => input.value
    );
}

function getSelectableMetricIds(currentTargetKey = targetKey) {
    const target = getCorrelationTarget(currentTargetKey);
    return METRICS
        .filter((metric) => !target.excludeMetricIds.includes(metric.id))
        .map((metric) => metric.id);
}

function getSelectableMetricIdsForCategory(category, currentTargetKey = targetKey) {
    const target = getCorrelationTarget(currentTargetKey);
    return METRICS
        .filter((metric) => metric.category === category && !target.excludeMetricIds.includes(metric.id))
        .map((metric) => metric.id);
}

function setAllMetricsSelected(on) {
    selectedMetricIds = on ? getSelectableMetricIds() : [];
    refreshCorrelationWidget(cachedRows);
}

function setCategoryMetricsSelected(category, on) {
    const categoryIds = getSelectableMetricIdsForCategory(category);
    const categorySet = new Set(categoryIds);

    if (on) {
        selectedMetricIds = [...new Set([...selectedMetricIds, ...categoryIds])];
    } else {
        selectedMetricIds = selectedMetricIds.filter((id) => !categorySet.has(id));
    }
    refreshCorrelationWidget(cachedRows);
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

function renderMetricPicker(correlationById = {}) {
    const picker = document.getElementById('correlation-metric-picker');
    if (!picker) return;

    const target = getCorrelationTarget(targetKey);
    const categories = getMetricCategories();
    picker.innerHTML = `
        <div class="correlation-metric-toolbar">
            <span class="correlation-metric-toolbar-label">Metrics</span>
            <div class="correlation-metric-toggle-group" role="group" aria-label="Toggle all metrics">
                <button type="button" class="correlation-toggle-btn" data-action="all-on">All on</button>
                <button type="button" class="correlation-toggle-btn" data-action="all-off">All off</button>
            </div>
        </div>
        <div class="correlation-metric-groups">
            ${categories
        .map((category) => {
            const metrics = METRICS
                .filter((metric) => metric.category === category)
                .sort((a, b) => compareCorrelationResults(
                    correlationById[a.id] || {
                        label: a.label,
                        r: null,
                        valid: false,
                        excluded: target.excludeMetricIds.includes(a.id),
                    },
                    correlationById[b.id] || {
                        label: b.label,
                        r: null,
                        valid: false,
                        excluded: target.excludeMetricIds.includes(b.id),
                    }
                ));
            return `
                <div class="correlation-metric-group">
                    <div class="correlation-metric-group-header">
                        <h4>${category}</h4>
                        <div class="correlation-metric-toggle-group" role="group" aria-label="Toggle ${category} metrics">
                            <button type="button" class="correlation-toggle-btn" data-action="category-on" data-category="${category}">All on</button>
                            <button type="button" class="correlation-toggle-btn" data-action="category-off" data-category="${category}">All off</button>
                        </div>
                    </div>
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
        .join('')}
        </div>
    `;

    picker.querySelector('[data-action="all-on"]')?.addEventListener('click', () => setAllMetricsSelected(true));
    picker.querySelector('[data-action="all-off"]')?.addEventListener('click', () => setAllMetricsSelected(false));

    picker.querySelectorAll('[data-action="category-on"]').forEach((button) => {
        button.addEventListener('click', () => setCategoryMetricsSelected(button.dataset.category, true));
    });
    picker.querySelectorAll('[data-action="category-off"]').forEach((button) => {
        button.addEventListener('click', () => setCategoryMetricsSelected(button.dataset.category, false));
    });

    picker.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((input) => {
        input.addEventListener('change', () => {
            selectedMetricIds = getSelectedMetricIdsFromPicker();
            refreshCorrelationWidget(cachedRows);
        });
    });
}

function renderScatterMetricSelect(metricIds, correlationResults) {
    const select = document.getElementById('correlation-scatter-metric');
    if (!select) return;

    if (!metricIds.length) {
        select.innerHTML = '<option value="">Select a metric</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    const resultById = Object.fromEntries(correlationResults.map((result) => [result.id, result]));
    const options = (metricIds.length > 0 ? metricIds : DEFAULT_METRIC_IDS)
        .filter((id) => !isMetricExcludedForTarget(id, targetKey))
        .sort((a, b) => compareCorrelationResults(
            resultById[a] || { label: a, r: null, valid: false, excluded: false },
            resultById[b] || { label: b, r: null, valid: false, excluded: false }
        ));

    select.innerHTML = options
        .map((id) => {
            const metric = METRICS.find((entry) => entry.id === id);
            const r = resultById[id]?.r;
            const rLabel = r != null ? ` (r=${formatCorrelation(r)})` : '';
            return `<option value="${id}">${metric?.label || id}${rLabel}</option>`;
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

function renderResultsTable(correlationResults, currentTargetKey) {
    const container = document.getElementById('correlation-results-table');
    if (!container) return;

    if (!correlationResults.length) {
        container.innerHTML = '<p class="correlation-empty-hint">Select at least one metric to compare.</p>';
        return;
    }

    const target = getCorrelationTarget(currentTargetKey);
    const results = sortCorrelationResults(correlationResults);

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

/**
 * Tight axis bounds with padding so scatter data fills the plot area.
 * @param {number[]} values
 * @param {{ pad?: number, integer?: boolean, minFloor?: number|null }} [opts]
 * @returns {{ min: number, max: number }|undefined}
 */
function paddedAxisRange(values, { pad = 0.1, integer = false, minFloor = null } = {}) {
    const finite = values.filter((v) => Number.isFinite(v));
    if (!finite.length) return undefined;

    let min = Math.min(...finite);
    let max = Math.max(...finite);
    const span = max - min || Math.max(Math.abs(max), 1) * 0.1;
    const margin = span * pad;

    min -= margin;
    max += margin;

    if (minFloor != null) min = Math.max(minFloor, min);

    if (integer) {
        min = Math.floor(min);
        max = Math.ceil(max);
        if (max <= min) max = min + 1;
    }

    return { min, max };
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
            backgroundColor: 'rgba(10, 122, 106, 0.65)',
            borderColor: 'rgba(10, 122, 106, 1)',
            pointRadius: 5,
            pointHoverRadius: 7,
        },
    ];

    if (regression && points.length >= 2) {
        const xs = [...xValues].sort((a, b) => a - b);
        const xMin = xs[0];
        const xMax = xs[xs.length - 1];
        const yAtMin = regression.slope * xMin + regression.intercept;
        const yAtMax = regression.slope * xMax + regression.intercept;
        datasets.push({
            label: 'Trend line',
            data: [
                { x: xMin, y: yAtMin },
                { x: xMax, y: yAtMax },
            ],
            type: 'line',
            borderColor: 'rgba(255, 193, 7, 0.9)',
            backgroundColor: 'rgba(255, 193, 7, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
        });
    }

    const trendYs = datasets.length > 1
        ? datasets[1].data.map((point) => point.y)
        : [];
    const xRange = paddedAxisRange(xValues);
    const yRange = paddedAxisRange([...yValues, ...trendYs], {
        integer: target.integerYAxis,
        minFloor: target.integerYAxis ? 0 : null,
    });

    createChart('winsCorrelationScatter', canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 20,
                    top: 4,
                    left: 4,
                    right: 8,
                },
            },
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
                    ...(xRange ? { min: xRange.min, max: xRange.max } : {}),
                    title: {
                        display: true,
                        text: metric?.label || 'Metric',
                        font: CORRELATION_AXIS_TITLE_FONT,
                        padding: { top: 12, bottom: 4 },
                    },
                    ticks: {
                        padding: 8,
                        font: CORRELATION_AXIS_TICK_FONT,
                    },
                },
                y: {
                    beginAtZero: false,
                    ...(yRange ? { min: yRange.min, max: yRange.max } : {}),
                    title: {
                        display: true,
                        text: target.yAxisTitle,
                        font: CORRELATION_AXIS_TITLE_FONT,
                        padding: { bottom: 8 },
                    },
                    ticks: {
                        ...(target.integerYAxis ? { stepSize: 1 } : {}),
                        font: CORRELATION_AXIS_TICK_FONT,
                        padding: 6,
                    },
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
    const metricIds = selectedMetricIds.filter(
        (id) => !isMetricExcludedForTarget(id, targetKey)
    );
    selectedMetricIds = metricIds;

    const allCorrelations = computeCorrelations(rows, METRICS.map((metric) => metric.id), targetKey);
    const correlationById = Object.fromEntries(allCorrelations.map((result) => [result.id, result]));
    const selectedCorrelations = metricIds.length
        ? computeCorrelations(rows, metricIds, targetKey)
        : [];

    renderMetricPicker(correlationById);
    renderScatterMetricSelect(metricIds, selectedCorrelations);
    renderResultsTable(selectedCorrelations, targetKey);

    if (metricIds.length) {
        if (!metricIds.includes(scatterMetricId)) {
            scatterMetricId = metricIds[0];
        }
        renderScatterChart(rows, scatterMetricId, targetKey);
    } else {
        const canvas = document.getElementById('wins-correlation-scatter');
        canvas?.getContext('2d')?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
    }

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
