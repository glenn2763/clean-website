/**
 * Chart Manager
 * Manages Chart.js instances and provides helper functions
 */

const charts = {};

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
}

export {
    charts,
    destroyChart,
    createChart,
    getChart,
    destroyAllCharts
};

