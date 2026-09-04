/**
 * Metric Correlation Component
 * Same-season correlations with interactive metric cards + scatter plot
 */

import {
    METRICS,
    LAB_DEFAULT_METRIC_IDS,
    CORRELATION_TARGET_KEY,
    buildTeamSeasonRows,
    computeCorrelationsForMode,
    getCorrelationTarget,
    getLabMetricIds,
    getLabMetricCategories,
    linearRegression,
    formatRSquared,
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

let selectedMetricIds = new Set(LAB_DEFAULT_METRIC_IDS);
let focusMetricId = LAB_DEFAULT_METRIC_IDS[0];
let cachedAllSeasonsData = {};
let cachedRows = [];
let cachedResults = [];

function formatCorrelation(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return value.toFixed(3);
}

function pickDefaultFocusMetric(results) {
    const sorted = sortCorrelationResults(
        results.filter((row) => selectedMetricIds.has(row.id) && row.valid)
    );
    if (sorted.length) return sorted[0].id;

    const fallback = sortCorrelationResults([...results]);
    return fallback[0]?.id || LAB_DEFAULT_METRIC_IDS[0];
}

function rStrengthClass(result) {
    if (!result?.valid || result.r == null) return 'lab-r-none';
    const abs = Math.abs(result.r);
    if (abs >= 0.35) return 'lab-r-strong';
    if (abs >= 0.2) return 'lab-r-modest';
    return 'lab-r-weak';
}

function renderMetricToolbar() {
    const toolbar = document.getElementById('correlation-metric-toolbar');
    if (!toolbar) return;

    const activeCount = selectedMetricIds.size;
    const totalCount = getLabMetricIds().length;

    toolbar.innerHTML = `
        <div class="lab-toolbar-copy">
            <span class="lab-toolbar-title">Metrics</span>
            <span class="lab-toolbar-count">${activeCount} of ${totalCount} active</span>
        </div>
        <div class="correlation-metric-toggle-group" role="group" aria-label="Toggle metrics">
            <button type="button" class="correlation-toggle-btn" data-action="all-on">All on</button>
            <button type="button" class="correlation-toggle-btn" data-action="all-off">All off</button>
        </div>
    `;

    toolbar.querySelector('[data-action="all-on"]')?.addEventListener('click', () => {
        selectedMetricIds = new Set(getLabMetricIds());
        if (!selectedMetricIds.has(focusMetricId)) {
            focusMetricId = pickDefaultFocusMetric(cachedResults);
        }
        refreshCorrelationWidget();
    });

    toolbar.querySelector('[data-action="all-off"]')?.addEventListener('click', () => {
        selectedMetricIds = new Set();
        refreshCorrelationWidget();
    });
}

function renderMetricCards(results) {
    const container = document.getElementById('correlation-metric-cards');
    if (!container) return;

    if (!results.length) {
        container.innerHTML = '<p class="correlation-empty-hint">No metrics available for correlation analysis.</p>';
        return;
    }

    const categories = getLabMetricCategories();
    const byCategory = Object.fromEntries(categories.map((cat) => [cat, []]));
    results.forEach((row) => {
        if (byCategory[row.category]) byCategory[row.category].push(row);
    });

    container.innerHTML = `<div class="lab-metric-flow">${categories.map((category) => {
        const cards = byCategory[category];
        if (!cards?.length) return '';

        return `
            <span class="lab-category-label">${category}</span>
            ${cards.map((row) => {
                const metric = METRICS.find((entry) => entry.id === row.id);
                const isSelected = selectedMetricIds.has(row.id);
                const isFocused = focusMetricId === row.id;
                const strengthClass = rStrengthClass(row);
                const tooltip = [metric?.description, row.direction].filter(Boolean).join(' · ');
                return `
                    <article
                        class="lab-metric-card ${strengthClass}${isSelected ? ' lab-metric-card-active' : ' lab-metric-card-inactive'}${isFocused ? ' lab-metric-card-focused' : ''}"
                        data-metric-id="${row.id}"
                    >
                        <div class="lab-metric-card-inner">
                            <button
                                type="button"
                                class="lab-metric-toggle"
                                aria-pressed="${isSelected ? 'true' : 'false'}"
                                aria-label="${isSelected ? 'Remove' : 'Add'} ${row.label}"
                                title="${isSelected ? 'Remove from analysis' : 'Add to analysis'}"
                            >
                                <span class="lab-metric-toggle-icon" aria-hidden="true">${isSelected ? '−' : '+'}</span>
                            </button>
                            <button
                                type="button"
                                class="lab-metric-card-body"
                                aria-pressed="${isFocused ? 'true' : 'false'}"
                                title="${tooltip}"
                            >
                                <span class="lab-metric-name">${row.label}</span>
                                <span class="lab-metric-card-stats">
                                    <span class="lab-stat-inline"><span class="lab-stat-label">r</span> ${formatCorrelation(row.r)}</span>
                                    <span class="lab-stat-sep" aria-hidden="true">·</span>
                                    <span class="lab-stat-inline"><span class="lab-stat-label">R²</span> ${formatRSquared(row.r)}</span>
                                    <span class="lab-stat-sep" aria-hidden="true">·</span>
                                    <span class="lab-stat-inline"><span class="lab-stat-label">n</span> ${row.n || '—'}</span>
                                </span>
                                ${row.valid ? `<span class="lab-strength-badge">${row.strength}</span>` : ''}
                            </button>
                        </div>
                    </article>
                `;
            }).join('')}
        `;
    }).join('')}</div>`;

    container.querySelectorAll('.lab-metric-card').forEach((cardEl) => {
        const metricId = cardEl.dataset.metricId;

        cardEl.querySelector('.lab-metric-toggle')?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (selectedMetricIds.has(metricId)) {
                selectedMetricIds.delete(metricId);
            } else {
                selectedMetricIds.add(metricId);
            }
            if (!selectedMetricIds.has(focusMetricId)) {
                focusMetricId = selectedMetricIds.size
                    ? pickDefaultFocusMetric(cachedResults.filter((row) => selectedMetricIds.has(row.id)))
                    : null;
            }
            refreshCorrelationWidget();
        });

        cardEl.querySelector('.lab-metric-card-body')?.addEventListener('click', () => {
            if (!selectedMetricIds.has(metricId)) {
                selectedMetricIds.add(metricId);
            }
            focusMetricId = metricId;
            refreshCorrelationWidget();
        });
    });
}

function formatTargetValue(value) {
    return Number(value).toFixed(1);
}

function paddedAxisRange(values, { pad = 0.1 } = {}) {
    const finite = values.filter((v) => Number.isFinite(v));
    if (!finite.length) return undefined;

    let min = Math.min(...finite);
    let max = Math.max(...finite);
    const span = max - min || Math.max(Math.abs(max), 1) * 0.1;
    const margin = span * pad;

    return { min: min - margin, max: max + margin };
}

function renderScatterChart() {
    const canvas = document.getElementById('wins-correlation-scatter');
    const emptyEl = document.getElementById('correlation-scatter-empty');
    if (!canvas) return;

    if (!focusMetricId || !selectedMetricIds.has(focusMetricId)) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.textContent = selectedMetricIds.size
                ? 'Click a metric card to see its scatter plot.'
                : 'Turn on at least one metric card to begin.';
        }
        return;
    }

    if (emptyEl) emptyEl.hidden = true;

    const metric = METRICS.find((entry) => entry.id === focusMetricId);
    const target = getCorrelationTarget(CORRELATION_TARGET_KEY);
    const activeResult = cachedResults.find((row) => row.id === focusMetricId);

    const points = cachedRows
        .map((row) => ({
            x: row.metrics[focusMetricId],
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
            pointRadius: 6,
            pointHoverRadius: 8,
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
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false,
        });
    }

    const trendYs = datasets.length > 1 ? datasets[1].data.map((point) => point.y) : [];
    const xRange = paddedAxisRange(xValues);
    const yRange = paddedAxisRange([...yValues, ...trendYs]);

    createChart('winsCorrelationScatter', canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { bottom: 20, top: 8, left: 4, right: 8 },
            },
            plugins: {
                title: {
                    display: true,
                    text: `${metric?.label || 'Metric'} vs ${target.yAxisTitle}`,
                    font: { family: '"Barlow Condensed", sans-serif', size: 16, weight: '700' },
                },
                subtitle: {
                    display: Boolean(activeResult?.r != null),
                    text: activeResult?.r != null
                        ? `Same-season r = ${formatCorrelation(activeResult.r)} · R² = ${formatRSquared(activeResult.r)} · n = ${activeResult.n}`
                        : '',
                },
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const raw = context.raw;
                            if (!raw.manager) {
                                return `${context.dataset.label}: (${raw.x?.toFixed(2)}, ${raw.y})`;
                            }
                            return `${raw.manager} (${raw.season}): ${raw.x?.toFixed(2)} → ${formatTargetValue(raw.y)} pts`;
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
                    ticks: { padding: 8, font: CORRELATION_AXIS_TICK_FONT },
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
                    ticks: { font: CORRELATION_AXIS_TICK_FONT, padding: 6 },
                },
            },
        },
    });
}

function renderSampleNote(allSeasonsData) {
    const note = document.getElementById('correlation-sample-note');
    if (!note) return;

    const seasons = getActiveSeasons(allSeasonsData);
    note.textContent = [
        `${cachedRows.length} manager-season${cachedRows.length === 1 ? '' : 's'} across ${seasons.length} season${seasons.length === 1 ? '' : 's'}.`,
        'Each dot is one manager in one season. Pearson r measures how closely the metric tracks with regular-season points scored that same year.',
        'Use +/− to toggle metrics; click a card to update the scatter plot.',
        'Correlation shows co-movement, not causation.',
    ].join(' ');
}

function refreshCorrelationWidget() {
    cachedResults = computeCorrelationsForMode(
        cachedRows,
        getLabMetricIds(),
        'sameSeason',
        CORRELATION_TARGET_KEY
    );

    if (!focusMetricId || !getLabMetricIds().includes(focusMetricId)) {
        focusMetricId = pickDefaultFocusMetric(cachedResults);
    }
    if (focusMetricId && !selectedMetricIds.has(focusMetricId)) {
        selectedMetricIds.add(focusMetricId);
    }

    renderMetricToolbar();
    renderMetricCards(cachedResults);
    renderScatterChart();
    renderSampleNote(cachedAllSeasonsData);
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
            notice.textContent = seasons.length < MIN_SEASONS
                ? 'Need at least two seasons of data for meaningful correlation.'
                : `Need at least ${MIN_ROWS} manager-season rows (currently ${cachedRows.length}).`;
        }
    }

    if (unavailable) {
        const cards = document.getElementById('correlation-metric-cards');
        const canvas = document.getElementById('wins-correlation-scatter');
        if (cards) cards.innerHTML = '';
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        renderSampleNote(allSeasonsData);
        return;
    }

    refreshCorrelationWidget();
}

export { renderWinsCorrelation };
