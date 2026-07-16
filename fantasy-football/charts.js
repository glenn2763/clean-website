/**
 * Chart Manager
 * Manages Chart.js instances and provides helper functions
 */

import { destroyAllViolinCharts, refreshAllViolinCharts } from './violin-chart.js';

const charts = {};

/** Field Report series hues — teal, red, blue, gold, green, orange, cyan, olive */
const FIELD_REPORT_HUES = [168, 8, 210, 42, 145, 24, 195, 85];

/**
 * @param {number} index
 * @param {number} [alpha=1]
 * @returns {string}
 */
function seriesColor(index, alpha = 1) {
    const hue = FIELD_REPORT_HUES[index % FIELD_REPORT_HUES.length];
    if (alpha >= 1) return `hsl(${hue}, 62%, 38%)`;
    return `hsla(${hue}, 62%, 38%, ${alpha})`;
}

/**
 * @param {number} index
 * @param {number} [alpha=0.12]
 * @returns {string}
 */
function seriesFill(index, alpha = 0.12) {
    return seriesColor(index, alpha);
}

/**
 * Destroy a chart if it exists
 * @param {string} chartKey - Key in charts object
 */
function destroyChart(chartKey) {
    if (charts[chartKey]) {
        charts[chartKey].destroy();
        delete charts[chartKey];
    }
}

/**
 * Create or update a chart
 * @param {string} chartKey - Key to store chart under
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Chart.js configuration
 * @returns {Chart} Chart instance
 */
function createChart(chartKey, canvas, config) {
    destroyChart(chartKey);
    
    const ctx = canvas.getContext('2d');
    charts[chartKey] = new Chart(ctx, config);
    return charts[chartKey];
}

/**
 * Get a chart instance
 * @param {string} chartKey - Key in charts object
 * @returns {Chart|null} Chart instance or null
 */
function getChart(chartKey) {
    return charts[chartKey] || null;
}

/**
 * Destroy all charts
 */
function destroyAllCharts() {
    Object.keys(charts).forEach(key => destroyChart(key));
    destroyAllViolinCharts();
}

/**
 * Re-measure charts after the layout becomes visible (fixes broken tooltips / hit targets).
 */
function refreshAllCharts() {
    Object.values(charts).forEach((chart) => {
        chart.resize();
        chart.update('none');
    });
    refreshAllViolinCharts();
}

export {
    charts,
    destroyChart,
    createChart,
    getChart,
    destroyAllCharts,
    refreshAllCharts,
    seriesColor,
    seriesFill,
    FIELD_REPORT_HUES,
};

