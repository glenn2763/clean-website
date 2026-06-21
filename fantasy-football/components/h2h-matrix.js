/**
 * Head-to-Head Chord Diagram
 * All-time win flow between managers across every loaded season
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import {
    buildOwnerMap,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getMatchups,
    getTeams,
} from '../utils.js';

const LABEL_MARGIN = 44;
const LABEL_OFFSET = 10;

function chordLabelPosition(d, outerRadius) {
    const angle = (d.startAngle + d.endAngle) / 2;
    const x = Math.sin(angle) * (outerRadius + LABEL_OFFSET);
    const y = -Math.cos(angle) * (outerRadius + LABEL_OFFSET);
    const sin = Math.sin(angle);
    let anchor = 'middle';
    if (Math.abs(sin) >= 0.12) {
        anchor = sin > 0 ? 'start' : 'end';
    }
    return { x, y, anchor };
}

function collectH2HRecords(allSeasonsData, ownerKeys) {
    const h2hRecords = {};
    ownerKeys.forEach((ownerKey) => {
        h2hRecords[ownerKey] = {};
        ownerKeys.forEach((opponentKey) => {
            if (ownerKey !== opponentKey) {
                h2hRecords[ownerKey][opponentKey] = { wins: 0, losses: 0, ties: 0 };
            }
        });
    });

    getActiveSeasons(allSeasonsData).forEach((season) => {
        const seasonData = allSeasonsData[season];
        const matchups = getMatchups(seasonData);
        const teamById = new Map(getTeams(seasonData).map((team) => [team.id, team]));

        matchups.forEach((matchup) => {
            if (matchup.homeScore == null || matchup.awayScore == null) return;

            const homeTeam = teamById.get(matchup.homeTeamId);
            const awayTeam = teamById.get(matchup.awayTeamId);
            if (!homeTeam || !awayTeam) return;

            const homeKey = getOwnerKey(homeTeam);
            const awayKey = getOwnerKey(awayTeam);
            if (homeKey === awayKey || !h2hRecords[homeKey]?.[awayKey]) return;

            if (matchup.homeScore > matchup.awayScore) {
                h2hRecords[homeKey][awayKey].wins += 1;
                h2hRecords[awayKey][homeKey].losses += 1;
            } else if (matchup.awayScore > matchup.homeScore) {
                h2hRecords[awayKey][homeKey].wins += 1;
                h2hRecords[homeKey][awayKey].losses += 1;
            } else {
                h2hRecords[homeKey][awayKey].ties += 1;
                h2hRecords[awayKey][homeKey].ties += 1;
            }
        });
    });

    return h2hRecords;
}

function formatRecordLabel(record) {
    if (!record) return '—';
    const { wins, losses, ties } = record;
    return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function getOverallH2HWinRate(ownerKey, ownerKeys, h2hRecords) {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    ownerKeys.forEach((opponentKey) => {
        if (opponentKey === ownerKey) return;
        const record = h2hRecords[ownerKey][opponentKey];
        wins += record.wins;
        losses += record.losses;
        ties += record.ties;
    });

    const total = wins + losses + ties;
    return total > 0 ? wins / total : 0.5;
}

function getOverallH2HRecord(ownerKey, ownerKeys, h2hRecords) {
    let wins = 0;
    let losses = 0;
    let ties = 0;

    ownerKeys.forEach((opponentKey) => {
        if (opponentKey === ownerKey) return;
        const record = h2hRecords[ownerKey][opponentKey];
        wins += record.wins;
        losses += record.losses;
        ties += record.ties;
    });

    return { wins, losses, ties, total: wins + losses + ties };
}

function getPairGames(sourceKey, targetKey, h2hRecords) {
    const sourceRecord = h2hRecords[sourceKey][targetKey];
    const targetRecord = h2hRecords[targetKey][sourceKey];
    return sourceRecord.wins + targetRecord.wins + sourceRecord.ties;
}

/** Directed chords store flow on source.value, not a top-level value. */
function chordFlowValue(chord) {
    return chord?.source?.value ?? chord?.value ?? 0;
}

/**
 * One directed value per pair: winner -> loser, magnitude = winner's wins in the series.
 * Tied series produce no ribbon.
 */
function buildPairWinnerMatrix(ownerKeys, h2hRecords) {
    const matrix = ownerKeys.map(() => ownerKeys.map(() => 0));

    for (let i = 0; i < ownerKeys.length; i += 1) {
        for (let j = i + 1; j < ownerKeys.length; j += 1) {
            const recordI = h2hRecords[ownerKeys[i]][ownerKeys[j]];
            const recordJ = h2hRecords[ownerKeys[j]][ownerKeys[i]];
            const margin = recordI.wins - recordJ.wins;

            if (margin > 0) {
                matrix[i][j] = recordI.wins;
            } else if (margin < 0) {
                matrix[j][i] = recordJ.wins;
            }
        }
    }

    return matrix;
}

function buildManagerMatchupRows(managerIndex, ownerKeys, labels, h2hRecords) {
    const managerKey = ownerKeys[managerIndex];

    return ownerKeys
        .map((opponentKey, opponentIndex) => {
            if (opponentIndex === managerIndex) return null;

            const record = h2hRecords[managerKey][opponentKey];
            const games = record.wins + record.losses + record.ties;
            if (games === 0) return null;

            return {
                opponentIndex,
                opponentLabel: labels[opponentIndex],
                record: formatRecordLabel(record),
                wins: record.wins,
                losses: record.losses,
                ties: record.ties,
                games,
                winPct: record.wins / games,
                margin: record.wins - record.losses,
            };
        })
        .filter(Boolean)
        .sort(
            (a, b) =>
                b.margin - a.margin ||
                b.games - a.games ||
                a.opponentLabel.localeCompare(b.opponentLabel)
        );
}

function buildMatchupRankings(ownerKeys, labels, h2hRecords, minGames = 3) {
    const pairs = [];

    for (let i = 0; i < ownerKeys.length; i += 1) {
        for (let j = i + 1; j < ownerKeys.length; j += 1) {
            const keyA = ownerKeys[i];
            const keyB = ownerKeys[j];
            const recordA = h2hRecords[keyA][keyB];
            const recordB = h2hRecords[keyB][keyA];
            const total = getPairGames(keyA, keyB, h2hRecords);
            if (total < minGames) continue;

            const margin = recordA.wins - recordB.wins;
            const leaderIndex = margin > 0 ? i : margin < 0 ? j : null;
            const trailerIndex = margin > 0 ? j : margin < 0 ? i : null;

            pairs.push({
                keyA,
                keyB,
                indexA: i,
                indexB: j,
                labelA: labels[i],
                labelB: labels[j],
                recordA: formatRecordLabel(recordA),
                recordB: formatRecordLabel(recordB),
                winsA: recordA.wins,
                winsB: recordB.wins,
                ties: recordA.ties,
                total,
                margin: Math.abs(margin),
                lopsidedness: Math.abs(margin) / total,
                leaderIndex,
                trailerIndex,
                leaderLabel: leaderIndex != null ? labels[leaderIndex] : null,
                trailerLabel: trailerIndex != null ? labels[trailerIndex] : null,
                isTied: margin === 0,
            });
        }
    }

    return {
        pairs,
        lopsided: [...pairs]
            .sort((a, b) => b.lopsidedness - a.lopsidedness || b.margin - a.margin || b.total - a.total)
            .slice(0, 5),
        closest: [...pairs]
            .filter((pair) => !pair.isTied)
            .sort((a, b) => a.margin - b.margin || b.total - a.total)
            .slice(0, 5),
    };
}

function managerColor(index) {
    return d3.hsl((index * 33) % 360, 0.65, 0.48);
}

function recordClass(margin) {
    if (margin > 0) return 'h2h-record-winning';
    if (margin < 0) return 'h2h-record-losing';
    return 'h2h-record-even';
}

function renderManagerDetailPanel(detailHost, managerIndex, ownerKeys, labels, h2hRecords, colors, onClear) {
    detailHost.html('');

    const panel = detailHost.append('div').attr('class', 'h2h-manager-detail');

    if (managerIndex == null) {
        panel
            .append('p')
            .attr('class', 'h2h-manager-detail-empty')
            .text('Click a manager on the chart to see their record against every opponent.');
        return;
    }

    const managerKey = ownerKeys[managerIndex];
    const managerLabel = labels[managerIndex];
    const overall = getOverallH2HRecord(managerKey, ownerKeys, h2hRecords);
    const overallWinPct = overall.total > 0 ? Math.round((overall.wins / overall.total) * 100) : 0;
    const rows = buildManagerMatchupRows(managerIndex, ownerKeys, labels, h2hRecords);

    panel
        .append('div')
        .attr('class', 'h2h-manager-detail-header')
        .html(`
            <span class="h2h-manager-swatch" style="background:${colors[managerIndex]}"></span>
            <div>
                <h3 class="h2h-manager-detail-title">${managerLabel}</h3>
                <p class="h2h-manager-detail-summary">
                    ${formatRecordLabel(overall)} overall · ${overallWinPct}% win rate · ${rows.length} opponent${rows.length === 1 ? '' : 's'}
                </p>
            </div>
            <button type="button" class="h2h-manager-detail-close" aria-label="Clear selection">×</button>
        `);

    panel.select('.h2h-manager-detail-close').on('click', (event) => {
        event.stopPropagation();
        onClear();
    });

    if (!rows.length) {
        panel.append('p').attr('class', 'h2h-manager-detail-empty').text('No head-to-head games recorded yet.');
        return;
    }

    panel
        .append('table')
        .attr('class', 'season-comp-table h2h-manager-table')
        .html(`
            <thead>
                <tr>
                    <th>Opponent</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>Games</th>
                </tr>
            </thead>
            <tbody>
                ${rows
                    .map(
                        (row) => `
                    <tr class="${recordClass(row.margin)}">
                        <td>
                            <span class="h2h-opponent-swatch" style="background:${colors[row.opponentIndex]}"></span>
                            ${row.opponentLabel}
                        </td>
                        <td>${row.record}</td>
                        <td>${Math.round(row.winPct * 100)}%</td>
                        <td>${row.games}</td>
                    </tr>
                `
                    )
                    .join('')}
            </tbody>
        `);
}

function renderChordDiagram(container, ownerKeys, ownerMap, h2hRecords) {
    container.innerHTML = '';

    const labels = ownerKeys.map((key) => getOwnerLabel(key, ownerMap));
    const matrix = buildPairWinnerMatrix(ownerKeys, h2hRecords);
    const colors = ownerKeys.map((_, index) => managerColor(index));

    const totalGames = matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
    if (totalGames === 0) {
        container.innerHTML = '<p class="h2h-chord-empty">No head-to-head matchups found across loaded seasons.</p>';
        return;
    }

    const wrapper = d3.select(container).append('div').attr('class', 'h2h-chord-wrapper');

    wrapper
        .append('div')
        .attr('class', 'h2h-chord-legend')
        .html(`
            <span class="h2h-legend-item"><span class="h2h-legend-swatch h2h-legend-swatch-color"></span>Each manager has a unique color</span>
            <span class="h2h-legend-item">One ribbon per rivalry — flows from series leader toward opponent</span>
            <span class="h2h-legend-item">Ribbon width = leader's wins in that matchup</span>
        `);

    const chartHost = wrapper.append('div').attr('class', 'h2h-chord-chart');
    const detailHost = wrapper.append('div').attr('class', 'h2h-manager-detail-host');

    const chartWidth = Math.min(Math.max(chartHost.node().clientWidth || container.clientWidth || 640, 520), 880);
    const viewSize = chartWidth + LABEL_MARGIN * 2;
    const outerRadius = chartWidth * 0.38;
    const innerRadius = outerRadius - 22;

    const svg = chartHost
        .append('svg')
        .attr('viewBox', [-viewSize / 2, -viewSize / 2, viewSize, viewSize])
        .attr('width', '100%')
        .attr('height', chartWidth)
        .attr('class', 'h2h-chord-svg')
        .style('overflow', 'visible');

    const tooltip = chartHost
        .append('div')
        .attr('class', 'h2h-chord-tooltip')
        .style('opacity', 0);

    const chordLayout = d3.chordDirected().padAngle(0.06).sortSubgroups(d3.descending);
    const chords = chordLayout(matrix);
    const groups = chords.groups;

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbonArrow().radius(innerRadius).padAngle(0.02);

    let focusedManagerIndex = null;

    const applyManagerFocus = (index) => {
        if (index == null) {
            svg.selectAll('.h2h-chord-ribbon').attr('opacity', 0.72);
            svg.selectAll('.h2h-chord-group').attr('opacity', 1);
            svg.selectAll('.h2h-chord-arc').attr('stroke-width', 1.5);
            return;
        }

        svg.selectAll('.h2h-chord-ribbon').attr('opacity', (d) =>
            d.source.index === index || d.target.index === index ? 0.92 : 0.08
        );
        svg.selectAll('.h2h-chord-group').attr('opacity', (d) => (d.index === index ? 1 : 0.35));
        svg.selectAll('.h2h-chord-arc').attr('stroke-width', (d) => (d.index === index ? 2.5 : 1.5));
    };

    const selectManager = (index) => {
        focusedManagerIndex = index;
        applyManagerFocus(index);
        renderManagerDetailPanel(detailHost, index, ownerKeys, labels, h2hRecords, colors, clearSelection);
    };

    const clearSelection = () => {
        focusedManagerIndex = null;
        applyManagerFocus(null);
        renderManagerDetailPanel(detailHost, null, ownerKeys, labels, h2hRecords, colors, clearSelection);
        tooltip.style('opacity', 0);
    };

    detailHost.on('click', (event) => event.stopPropagation());

    const group = svg
        .append('g')
        .selectAll('g')
        .data(groups)
        .join('g')
        .attr('class', 'h2h-chord-group');

    group
        .append('path')
        .attr('class', 'h2h-chord-arc')
        .attr('d', arc)
        .attr('fill', (d) => colors[d.index])
        .attr('stroke', 'rgba(255, 255, 255, 0.85)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
            applyManagerFocus(d.index);
            const winPct = Math.round(getOverallH2HWinRate(ownerKeys[d.index], ownerKeys, h2hRecords) * 100);
            tooltip
                .style('opacity', 1)
                .html(`<strong>${labels[d.index]}</strong><br>${winPct}% all-time H2H win rate<br><span class="h2h-tooltip-hint">Click for full breakdown</span>`)
                .style('left', `${event.offsetX + 14}px`)
                .style('top', `${event.offsetY - 10}px`);
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 10}px`);
        })
        .on('mouseleave', () => {
            tooltip.style('opacity', 0);
            applyManagerFocus(focusedManagerIndex);
        })
        .on('click', (event, d) => {
            event.stopPropagation();
            if (focusedManagerIndex === d.index) {
                clearSelection();
            } else {
                selectManager(d.index);
            }
        });

    group
        .append('text')
        .attr('class', 'h2h-chord-label')
        .attr('transform', (d) => {
            const { x, y } = chordLabelPosition(d, outerRadius);
            return `translate(${x},${y})`;
        })
        .attr('text-anchor', (d) => chordLabelPosition(d, outerRadius).anchor)
        .attr('dominant-baseline', 'middle')
        .text((d) => labels[d.index])
        .style('pointer-events', 'none');

    svg
        .append('g')
        .attr('fill-opacity', 0.72)
        .selectAll('path')
        .data(chords.filter((d) => d.source.index !== d.target.index && chordFlowValue(d) > 0))
        .join('path')
        .attr('class', 'h2h-chord-ribbon')
        .attr('d', ribbon)
        .attr('fill', (d) => colors[d.source.index])
        .attr('stroke', (d) => d3.color(colors[d.source.index]).darker(0.4))
        .attr('stroke-width', 0.6)
        .attr('opacity', 0.72)
        .style('cursor', 'pointer')
        .on('mouseenter', function onRibbonEnter(event, d) {
            applyManagerFocus(d.source.index);
            d3.select(this).attr('opacity', 1);

            const sourceKey = ownerKeys[d.source.index];
            const targetKey = ownerKeys[d.target.index];
            const sourceRecord = h2hRecords[sourceKey][targetKey];
            const targetRecord = h2hRecords[targetKey][sourceKey];
            const ties = sourceRecord.ties;

            tooltip
                .style('opacity', 1)
                .html(`
                    <strong>${labels[d.source.index]}</strong> vs <strong>${labels[d.target.index]}</strong><br>
                    ${labels[d.source.index]}: ${formatRecordLabel(sourceRecord)}<br>
                    ${labels[d.target.index]}: ${formatRecordLabel(targetRecord)}<br>
                    ${ties > 0 ? `${ties} tie${ties === 1 ? '' : 's'}<br>` : ''}
                    Ribbon flows ${labels[d.source.index]} → ${labels[d.target.index]} (${chordFlowValue(d)} win${chordFlowValue(d) === 1 ? '' : 's'})
                `)
                .style('left', `${event.offsetX + 14}px`)
                .style('top', `${event.offsetY - 10}px`);
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 10}px`);
        })
        .on('mouseleave', () => {
            tooltip.style('opacity', 0);
            applyManagerFocus(focusedManagerIndex);
        });

    svg.on('click', clearSelection);

    renderManagerDetailPanel(detailHost, null, ownerKeys, labels, h2hRecords, colors, clearSelection);
}

/**
 * @param {Object} allSeasonsData
 */
function renderH2HMatrix(allSeasonsData) {
    const container = document.getElementById('h2h-matrix');
    if (!container) return;

    const ownerMap = buildOwnerMap(allSeasonsData);
    const ownerKeys = Object.keys(ownerMap).sort((a, b) =>
        getOwnerLabel(a, ownerMap).localeCompare(getOwnerLabel(b, ownerMap))
    );

    if (!ownerKeys.length) {
        container.innerHTML = '<p>No manager data available yet.</p>';
        return;
    }

    const h2hRecords = collectH2HRecords(allSeasonsData, ownerKeys);
    renderChordDiagram(container, ownerKeys, ownerMap, h2hRecords);
}

export {
    renderH2HMatrix,
    collectH2HRecords,
    buildMatchupRankings,
    buildManagerMatchupRows,
    getOverallH2HWinRate,
    buildPairWinnerMatrix,
};
