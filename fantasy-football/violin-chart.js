/**
 * Canvas horizontal violin plot (kernel density + median/mean markers).
 */

const violinInstances = new Map();

/** Scott's rule multiplier; lower = less smoothing, sharper violins. */
const KDE_BANDWIDTH_FACTOR = 0.55;

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function kdeBandwidth(values) {
    const n = values.length;
    if (n < 2) return 1;
    const avg = mean(values);
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    return KDE_BANDWIDTH_FACTOR * Math.max(std, 0.5) * n ** -0.2;
}

function kdeAt(values, x, bandwidth) {
    const n = values.length;
    if (!n) return 0;
    let sum = 0;
    for (const value of values) {
        const z = (x - value) / bandwidth;
        sum += Math.exp(-0.5 * z * z);
    }
    return sum / (n * bandwidth * Math.sqrt(2 * Math.PI));
}

function buildViolinProfile(values, xMin, xMax, sampleCount = 80) {
    if (!values.length) return [];

    const bandwidth = kdeBandwidth(values);
    const step = (xMax - xMin) / Math.max(sampleCount - 1, 1);
    const profile = [];

    for (let i = 0; i < sampleCount; i += 1) {
        const x = xMin + step * i;
        profile.push({ x, density: kdeAt(values, x, bandwidth) });
    }

    const maxDensity = Math.max(...profile.map((point) => point.density), 0.0001);
    return profile.map((point) => ({
        x: point.x,
        halfWidth: point.density / maxDensity,
    }));
}

function niceStep(rawStep) {
    if (rawStep <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

function computeXTicks(xMin, xMax, plotWidth, minLabelSpacing = 64) {
    const maxTicks = Math.max(3, Math.floor(plotWidth / minLabelSpacing));
    const range = xMax - xMin;
    const step = niceStep(range / maxTicks);
    const ticks = [];
    const start = Math.ceil(xMin / step) * step;
    for (let tick = start; tick <= xMax + step * 0.001; tick += step) {
        ticks.push(Math.round(tick * 10) / 10);
    }
    return ticks;
}

function formatAxisValue(value, format) {
    if (format === 'relative') {
        if (Math.abs(value) < 0.05) return '0';
        return value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0);
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function truncateLabel(label, maxChars = 16) {
    if (label.length <= maxChars) return label;
    return `${label.slice(0, maxChars - 1)}…`;
}

function getDeviceSize(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width < 2 || height < 2) {
        return { width: 0, height: 0, ctx: canvas.getContext('2d'), visible: false };
    }

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height, ctx, visible: true };
}

function drawViolinPlot(instance) {
    const {
        canvas,
        categories,
        xLabel,
        title,
        hiddenIndices,
        referenceValue = null,
        valueFormat = 'number',
    } = instance;
    const { width, height, ctx, visible } = getDeviceSize(canvas);

    if (!visible) return;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 28, right: 28, bottom: 52, left: 136 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    if (!categories.length || plotWidth <= 0 || plotHeight <= 0) return;

    const visibleCategories = categories.filter((_, index) => !hiddenIndices.has(index));
    const allValues = visibleCategories.flatMap((category) => category.values);
    if (!allValues.length) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No weekly scores to display', width / 2, height / 2);
        return;
    }

    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const xPadding = Math.max((dataMax - dataMin) * 0.12, valueFormat === 'relative' ? 2 : 4);
    let xMin = Math.floor((dataMin - xPadding) * 10) / 10;
    let xMax = Math.ceil((dataMax + xPadding) * 10) / 10;

    if (referenceValue != null) {
        xMin = Math.min(xMin, referenceValue - xPadding);
        xMax = Math.max(xMax, referenceValue + xPadding);
    }

    const xScale = (value) => padding.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const rowHeight = plotHeight / categories.length;

    ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, padding.left, 18);

    const ticks = computeXTicks(xMin, xMax, plotWidth);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ticks.forEach((tick) => {
        const x = xScale(tick);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
        ctx.stroke();
    });

    if (referenceValue != null && referenceValue >= xMin && referenceValue <= xMax) {
        const refX = xScale(referenceValue);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(refX, padding.top);
        ctx.lineTo(refX, padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.fillStyle = 'rgba(80, 80, 80, 0.85)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ticks.forEach((tick) => {
        ctx.fillText(formatAxisValue(tick, valueFormat), xScale(tick), height - padding.bottom + 8);
    });

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(xLabel, padding.left + plotWidth / 2, height - 10);

    categories.forEach((category, index) => {
        if (hiddenIndices.has(index)) return;

        const centerY = padding.top + rowHeight * index + rowHeight / 2;
        const maxHalfHeight = rowHeight * 0.42;

        ctx.fillStyle = 'rgba(60, 60, 60, 0.9)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncateLabel(category.label), padding.left - 12, centerY);

        if (!category.values.length) {
            return;
        }

        const strokeColor = category.color;
        const fillColor = category.color.replace(/^hsl\(/, 'hsla(').replace(/\)$/, ', 0.5)');
        const profile = buildViolinProfile(category.values, xMin, xMax);

        ctx.beginPath();
        profile.forEach((point, pointIndex) => {
            const x = xScale(point.x);
            const y = centerY - point.halfWidth * maxHalfHeight;
            if (pointIndex === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        for (let i = profile.length - 1; i >= 0; i -= 1) {
            const x = xScale(profile[i].x);
            const y = centerY + profile[i].halfWidth * maxHalfHeight;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const med = median(category.values);
        const avg = mean(category.values);
        const medX = xScale(med);
        const avgX = xScale(avg);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(medX, centerY - maxHalfHeight * 0.9);
        ctx.lineTo(medX, centerY + maxHalfHeight * 0.9);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(20, 20, 20, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(medX, centerY - maxHalfHeight * 0.9);
        ctx.lineTo(medX, centerY + maxHalfHeight * 0.9);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(20, 20, 20, 0.9)';
        ctx.lineWidth = 1.5;
        const cross = 3.5;
        ctx.beginPath();
        ctx.moveTo(avgX - cross, centerY);
        ctx.lineTo(avgX + cross, centerY);
        ctx.moveTo(avgX, centerY - cross);
        ctx.lineTo(avgX, centerY + cross);
        ctx.stroke();
    });

    instance._plotMeta = { padding, rowHeight, categories, xMin, xMax, plotWidth };
}

/**
 * @param {string} chartKey
 * @param {HTMLCanvasElement} canvas
 * @param {Object} config
 */
function createViolinChart(chartKey, canvas, config) {
    destroyViolinChart(chartKey);

    const instance = {
        chartKey,
        canvas,
        title: config.title,
        xLabel: config.xLabel,
        categories: config.categories,
        referenceValue: config.referenceValue ?? null,
        valueFormat: config.valueFormat ?? 'number',
        hiddenIndices: new Set(),
        _plotMeta: null,
    };

    instance._onResize = () => drawViolinPlot(instance);
    window.addEventListener('resize', instance._onResize);

    if (typeof ResizeObserver !== 'undefined') {
        instance._resizeObserver = new ResizeObserver(instance._onResize);
        instance._resizeObserver.observe(canvas.parentElement || canvas);
    }

    violinInstances.set(chartKey, instance);
    drawViolinPlot(instance);
    return instance;
}

function destroyViolinChart(chartKey) {
    const instance = violinInstances.get(chartKey);
    if (!instance) return;

    if (instance._onResize) {
        window.removeEventListener('resize', instance._onResize);
    }
    instance._resizeObserver?.disconnect();
    violinInstances.delete(chartKey);
}

function destroyAllViolinCharts() {
    [...violinInstances.keys()].forEach((key) => destroyViolinChart(key));
}

function refreshAllViolinCharts() {
    violinInstances.forEach((instance) => drawViolinPlot(instance));
}

function syncViolinFromLineChart(chartKey, lineChart) {
    const instance = violinInstances.get(chartKey);
    if (!instance || !lineChart) return;

    const hiddenIndices = new Set();
    lineChart.data.datasets.forEach((_, index) => {
        if (!lineChart.isDatasetVisible(index)) {
            hiddenIndices.add(index);
        }
    });

    instance.hiddenIndices = hiddenIndices;
    drawViolinPlot(instance);
}

export {
    createViolinChart,
    destroyViolinChart,
    destroyAllViolinCharts,
    refreshAllViolinCharts,
    syncViolinFromLineChart,
};
