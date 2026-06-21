/**
 * Luck Quadrant Component
 * Scatter plot of avg points for vs avg points against, one point per manager-season
 */

import {
    buildOwnerMap,
    calculatePointsAgainst,
    calculatePointsFor,
    computeRegularSeasonRecords,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getPlayoffConfig,
    getRegularSeasonMatchups,
    getMatchups,
    getTeams,
} from '../utils.js';
import { createChart } from '../charts.js';

const QUADRANT_COLORS = {
    topLeft: 'rgba(255, 193, 7, 0.22)',
    topRight: 'rgba(76, 175, 80, 0.22)',
    bottomLeft: 'rgba(244, 67, 54, 0.18)',
    bottomRight: 'rgba(118, 199, 192, 0.22)',
};

const QUADRANT_LABELS = {
    topLeft: 'Cold Offense\nTough Matchups',
    topRight: 'Strong Offense\nTough Matchups',
    bottomLeft: 'Cold Offense\nSoft Matchups',
    bottomRight: 'Strong Offense\nSoft Matchups',
};

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function formatRecord(wins, losses, ties) {
    if (ties > 0) return `${wins}-${losses}-${ties}`;
    return `${wins}-${losses}`;
}

function collectManagerSeasonPoints(allSeasonsData) {
    const ownerMap = buildOwnerMap(allSeasonsData);
    const seasons = getActiveSeasons(allSeasonsData);
    const points = [];

    seasons.forEach((season) => {
        const seasonData = allSeasonsData[season];
        const matchups = getRegularSeasonMatchups(seasonData);
        const teams = getTeams(seasonData);
        const config = getPlayoffConfig(seasonData?.mSettings || {});
        const recordByTeamId = new Map(
            computeRegularSeasonRecords(getMatchups(seasonData), config.regularSeasonWeeks).map((record) => [
                record.teamId,
                record,
            ])
        );

        teams.forEach((team) => {
            const pf = calculatePointsFor(team.id, matchups);
            const pa = calculatePointsAgainst(team.id, matchups, teams);
            if (pf <= 0 && pa <= 0) return;

            const record = recordByTeamId.get(team.id) || { wins: 0, losses: 0, ties: 0 };
            const ownerKey = getOwnerKey(team);
            points.push({
                ownerKey,
                manager: getOwnerLabel(ownerKey, ownerMap),
                season,
                pointsFor: pf,
                pointsAgainst: pa,
                wins: record.wins,
                losses: record.losses,
                ties: record.ties,
                record: formatRecord(record.wins, record.losses, record.ties),
            });
        });
    });

    const byManager = new Map();
    points.forEach((entry) => {
        if (!byManager.has(entry.ownerKey)) {
            byManager.set(entry.ownerKey, {
                ownerKey: entry.ownerKey,
                name: entry.manager,
                seasons: [],
            });
        }
        byManager.get(entry.ownerKey).seasons.push(entry);
    });

    return {
        points,
        managers: [...byManager.values()].sort((a, b) => a.name.localeCompare(b.name)),
        midX: median(points.map((entry) => entry.pointsFor)),
        midY: median(points.map((entry) => entry.pointsAgainst)),
    };
}

function getAxisBounds(values) {
    if (!values.length) return { min: 0, max: 120 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.08, 2);
    return {
        min: Math.floor((min - padding) * 10) / 10,
        max: Math.ceil((max + padding) * 10) / 10,
    };
}

const quadrantBackgroundPlugin = {
    id: 'quadrantBackground',
    beforeDraw(chart) {
        const options = chart.options.plugins?.quadrantBackground;
        if (!options) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;

        const { midX, midY, colors } = options;
        const xMid = scales.x.getPixelForValue(midX);
        const yMid = scales.y.getPixelForValue(midY);
        const { left, right, top, bottom } = chartArea;

        ctx.save();
        ctx.fillStyle = colors.topLeft;
        ctx.fillRect(left, top, xMid - left, yMid - top);
        ctx.fillStyle = colors.topRight;
        ctx.fillRect(xMid, top, right - xMid, yMid - top);
        ctx.fillStyle = colors.bottomLeft;
        ctx.fillRect(left, yMid, xMid - left, bottom - yMid);
        ctx.fillStyle = colors.bottomRight;
        ctx.fillRect(xMid, yMid, right - xMid, bottom - yMid);
        ctx.restore();
    },
    afterDraw(chart) {
        const options = chart.options.plugins?.quadrantBackground;
        if (!options?.labels || !chart.chartArea) return;

        const { ctx, chartArea, scales } = chart;
        const xMid = scales.x.getPixelForValue(options.midX);
        const yMid = scales.y.getPixelForValue(options.midY);
        const { left, right, top, bottom } = chartArea;

        const centers = [
            { text: options.labels.topLeft, x: (left + xMid) / 2, y: (top + yMid) / 2 },
            { text: options.labels.topRight, x: (xMid + right) / 2, y: (top + yMid) / 2 },
            { text: options.labels.bottomLeft, x: (left + xMid) / 2, y: (yMid + bottom) / 2 },
            { text: options.labels.bottomRight, x: (xMid + right) / 2, y: (yMid + bottom) / 2 },
        ];

        ctx.save();
        ctx.fillStyle = 'rgba(60, 60, 60, 0.55)';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        centers.forEach(({ text, x, y }) => {
            text.split('\n').forEach((line, index) => {
                const lineOffset = (index - (text.split('\n').length - 1) / 2) * 14;
                ctx.fillText(line, x, y + lineOffset);
            });
        });
        ctx.restore();
    },
};

/**
 * Render luck quadrant scatter chart
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderLuckQuadrantChart(allSeasonsData) {
    const canvas = document.getElementById('luck-quadrant-chart');
    if (!canvas) return;

    const { points, managers, midX, midY } = collectManagerSeasonPoints(allSeasonsData);
    if (!points.length) return;

    const xBounds = getAxisBounds(points.map((entry) => entry.pointsFor));
    const yBounds = getAxisBounds(points.map((entry) => entry.pointsAgainst));

    const datasets = managers.map((manager, idx) => ({
        label: manager.name,
        data: manager.seasons.map((entry) => ({
            x: entry.pointsFor,
            y: entry.pointsAgainst,
            season: entry.season,
            manager: entry.manager,
            record: entry.record,
        })),
        borderColor: `hsl(${idx * 33}, 65%, 42%)`,
        backgroundColor: `hsla(${idx * 33}, 65%, 42%, 0.85)`,
        pointStyle: 'rectRot',
        pointRadius: 6,
        pointHoverRadius: 8,
        borderWidth: 1.5,
    }));

    createChart('luckQuadrant', canvas, {
        type: 'scatter',
        data: { datasets },
        plugins: [quadrantBackgroundPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Scoring vs. Opponent Strength (Each Dot = One Manager-Season)',
                },
                legend: {
                    position: 'bottom',
                },
                quadrantBackground: {
                    midX,
                    midY,
                    colors: QUADRANT_COLORS,
                    labels: QUADRANT_LABELS,
                },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const point = items[0]?.raw;
                            return point ? `${point.manager} · ${point.season}` : '';
                        },
                        label(context) {
                            const point = context.raw;
                            return [
                                `Record: ${point.record ?? '—'}`,
                                `Avg PF: ${context.parsed.x.toFixed(2)}`,
                                `Avg PA: ${context.parsed.y.toFixed(2)}`,
                            ];
                        },
                    },
                },
            },
            scales: {
                x: {
                    min: xBounds.min,
                    max: xBounds.max,
                    title: {
                        display: true,
                        text: 'Avg Points For (per game)',
                    },
                    grid: {
                        color: (context) =>
                            context.tick.value === midX ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.06)',
                        lineWidth: (context) => (context.tick.value === midX ? 1.5 : 1),
                    },
                },
                y: {
                    min: yBounds.min,
                    max: yBounds.max,
                    title: {
                        display: true,
                        text: 'Avg Points Against (per game)',
                    },
                    grid: {
                        color: (context) =>
                            context.tick.value === midY ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.06)',
                        lineWidth: (context) => (context.tick.value === midY ? 1.5 : 1),
                    },
                },
            },
        },
    });
}

export { renderLuckQuadrantChart };
