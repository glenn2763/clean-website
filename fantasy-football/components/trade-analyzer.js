/**
 * Trade Analyzer Component
 * Executed trade list + network insights (single season or league-wide).
 */

import {
    analyzeTradePointsOverReplacement,
    buildTradeSociogramData,
    getActiveSeasons,
    hasTransactionView,
    parseAllExecutedTrades,
    parseExecutedTrades,
    summarizeTradeNetwork,
} from '../utils.js';
import { renderTradeSociogram } from './trade-sociogram.js';

function formatTradeDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function renderTradeSide(side) {
    if (side.detailsUnavailable) {
        return `
        <div class="trade-side">
            <div class="trade-side-manager">${side.manager}</div>
            <div class="trade-side-detail trade-side-unavailable">Player details not available from ESPN for this trade</div>
        </div>
    `;
    }

    const sent = side.sent.length ? side.sent.join(', ') : '—';
    const received = side.received.length ? side.received.join(', ') : '—';
    return `
        <div class="trade-side">
            <div class="trade-side-manager">${side.manager}</div>
            <div class="trade-side-detail"><span class="trade-label">Sent:</span> ${sent}</div>
            <div class="trade-side-detail"><span class="trade-label">Received:</span> ${received}</div>
        </div>
    `;
}

function renderTradeInferredNote(trade) {
    if (!trade.inferred) return '';
    return '<span class="trade-inferred-badge" title="Player details inferred from weekly roster changes">Inferred</span>';
}

function renderTradeCard(trade, showSeason = false) {
    const por = analyzeTradePointsOverReplacement(trade, null);
    return `
        <article class="trade-card${trade.inferred ? ' trade-card-inferred' : ''}">
            <header class="trade-card-header">
                <span class="trade-card-week">${showSeason ? `${trade.season} · ` : ''}Week ${trade.week || '—'} ${renderTradeInferredNote(trade)}</span>
                <span class="trade-card-date">${formatTradeDate(trade.processedAt)}</span>
            </header>
            <div class="trade-card-body">
                ${trade.sides.map(renderTradeSide).join('')}
            </div>
            ${
                por == null
                    ? ''
                    : `<footer class="trade-card-footer"><span class="trade-por-value">${por}</span></footer>`
            }
        </article>
    `;
}

function getMissingTransactionSeasons(allSeasonsData) {
    return getActiveSeasons(allSeasonsData).filter((season) => !hasTransactionView(allSeasonsData[season]));
}

function renderManagerRankings(managers, maxTrades) {
    if (!managers.length) return '';

    return `
        <ol class="trade-network-manager-list">
            ${managers
                .map((manager, index) => {
                    const width = Math.round((manager.tradeCount / maxTrades) * 100);
                    return `
                        <li class="trade-network-manager-row">
                            <span class="trade-network-rank">${index + 1}</span>
                            <span class="trade-network-manager-name">${manager.label}</span>
                            <span class="trade-network-manager-bar" aria-hidden="true">
                                <span class="trade-network-manager-bar-fill" style="width: ${width}%"></span>
                            </span>
                            <span class="trade-network-manager-count">${manager.tradeCount}</span>
                        </li>
                    `;
                })
                .join('')}
        </ol>
    `;
}

function renderPairTable(pairs, selectedPairId) {
    if (!pairs.length) return '<p class="trade-analyzer-empty">No manager pairs have traded yet.</p>';

    return `
        <div class="trade-network-pair-table-wrap">
            <table class="trade-network-pair-table">
                <thead>
                    <tr>
                        <th scope="col">Managers</th>
                        <th scope="col">Trades</th>
                    </tr>
                </thead>
                <tbody>
                    ${pairs
                        .map(
                            (pair) => `
                        <tr
                            class="trade-network-pair-row${selectedPairId === pair.id ? ' trade-network-pair-row-selected' : ''}"
                            data-pair-id="${pair.id}"
                            tabindex="0"
                            role="button"
                            aria-pressed="${selectedPairId === pair.id ? 'true' : 'false'}"
                        >
                            <td>${pair.sourceLabel} ↔ ${pair.targetLabel}</td>
                            <td class="trade-network-pair-count">${pair.count}</td>
                        </tr>
                    `
                        )
                        .join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPairDetail(link, showSeason, renderDetail) {
    if (!link) return '';

    const tradeLabel = link.count === 1 ? 'trade' : 'trades';
    return `
        <div class="trade-sociogram-detail">
            <div class="trade-sociogram-detail-header">
                <h4 class="trade-sociogram-detail-title">${link.sourceLabel} ↔ ${link.targetLabel}</h4>
                <span class="trade-sociogram-detail-count">${link.count} ${tradeLabel}</span>
                <button type="button" class="trade-sociogram-detail-close" aria-label="Close trade details">×</button>
            </div>
            <div class="trade-list trade-sociogram-detail-list">
                ${link.trades.map((trade) => renderDetail(trade)).join('')}
            </div>
        </div>
    `;
}

function getTradesForManager(trades, managerId) {
    return trades.filter((trade) => (trade.sides || []).some((side) => side.ownerKey === managerId));
}

function renderManagerDetail(manager, trades, showSeason, renderDetail) {
    if (!manager) return '';

    const managerTrades = getTradesForManager(trades, manager.id);
    const tradeLabel = managerTrades.length === 1 ? 'trade' : 'trades';

    return `
        <div class="trade-sociogram-detail">
            <div class="trade-sociogram-detail-header">
                <h4 class="trade-sociogram-detail-title">${manager.label}</h4>
                <span class="trade-sociogram-detail-count">${managerTrades.length} ${tradeLabel}</span>
                <button type="button" class="trade-sociogram-detail-close" aria-label="Close trade details">×</button>
            </div>
            <div class="trade-list trade-sociogram-detail-list">
                ${managerTrades.map((trade) => renderDetail(trade)).join('')}
            </div>
        </div>
    `;
}

function renderTradeNetwork(container, trades, options = {}) {
    if (!container) return;

    const {
        scopeLabel = 'this season',
        showSeason = false,
        showNetwork = true,
        missingSeasons = [],
    } = options;

    const graphData = buildTradeSociogramData(trades);
    const summary = summarizeTradeNetwork(graphData);
    const renderDetail = (trade) => renderTradeCard(trade, showSeason);

    let selectedPairId = summary.pairs[0]?.id || null;
    let selectedManagerId = null;

    const missingNotice =
        missingSeasons.length > 0
            ? `<div class="trade-analyzer-notice trade-analyzer-cache-notice">
                <strong>Transaction data may be incomplete</strong>
                <p>Trade counts for ${missingSeasons.join(', ')} are missing from saved data. Use <em>Clear Saved Data</em> and re-run analysis to refresh.</p>
               </div>`
            : '';

    const topPairLabel = summary.topPair
        ? `${summary.topPair.sourceLabel} ↔ ${summary.topPair.targetLabel}`
        : '—';

    function getSelectedPair() {
        return summary.pairs.find((pair) => pair.id === selectedPairId) || null;
    }

    function getSelectedManager() {
        return summary.managers.find((manager) => manager.id === selectedManagerId) || null;
    }

    function pairInvolvesManager(pair, managerId) {
        return pair.source === managerId || pair.target === managerId;
    }

    function mountGraph() {
        const host = container.querySelector('.trade-sociogram-host');
        if (!host || !showNetwork) return;

        renderTradeSociogram(host, graphData, {
            selectedPairId: selectedManagerId ? null : selectedPairId,
            selectedManagerId,
            onPairSelect: (link) => {
                selectedManagerId = null;
                selectedPairId = link.id;
                refreshInteractiveSections();
            },
            onManagerSelect: (node) => {
                selectedPairId = null;
                selectedManagerId = selectedManagerId === node.id ? null : node.id;
                refreshInteractiveSections();
            },
        });
    }

    function refreshInteractiveSections() {
        const pairTable = container.querySelector('.trade-network-pair-table tbody');
        if (pairTable) {
            pairTable.querySelectorAll('.trade-network-pair-row').forEach((row) => {
                const pairId = row.dataset.pairId;
                const pair = summary.pairs.find((entry) => entry.id === pairId);
                const isSelected =
                    !selectedManagerId && row.dataset.pairId === selectedPairId;
                const isHighlighted =
                    selectedManagerId && pair && pairInvolvesManager(pair, selectedManagerId);
                row.classList.toggle('trade-network-pair-row-selected', isSelected);
                row.classList.toggle('trade-network-pair-row-highlighted', isHighlighted);
                row.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            });
        }

        const detailHost = container.querySelector('.trade-network-detail-host');
        if (detailHost) {
            if (selectedManagerId) {
                detailHost.innerHTML = renderManagerDetail(
                    getSelectedManager(),
                    trades,
                    showSeason,
                    renderDetail
                );
            } else {
                detailHost.innerHTML = renderPairDetail(getSelectedPair(), showSeason, renderDetail);
            }

            detailHost.querySelector('.trade-sociogram-detail-close')?.addEventListener('click', () => {
                selectedPairId = null;
                selectedManagerId = null;
                refreshInteractiveSections();
                mountGraph();
            });
        }

        mountGraph();
    }

    function bindPairRows() {
        container.querySelectorAll('.trade-network-pair-row').forEach((row) => {
            const activate = () => {
                selectedManagerId = null;
                selectedPairId = row.dataset.pairId;
                refreshInteractiveSections();
            };
            row.addEventListener('click', activate);
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        });
    }

    container.innerHTML = `
        ${missingNotice}
        ${
            trades.length
                ? `
            <div class="trade-network-summary">
                <div class="trade-network-stat">
                    <span class="trade-network-stat-value">${trades.length}</span>
                    <span class="trade-network-stat-label">Executed trades ${scopeLabel}</span>
                </div>
                <div class="trade-network-stat">
                    <span class="trade-network-stat-value">${summary.managerCount}</span>
                    <span class="trade-network-stat-label">Managers who traded</span>
                </div>
                <div class="trade-network-stat">
                    <span class="trade-network-stat-value">${summary.topManager?.label || '—'}</span>
                    <span class="trade-network-stat-label">Most active (${summary.topManager?.tradeCount || 0} trades)</span>
                </div>
                <div class="trade-network-stat">
                    <span class="trade-network-stat-value">${topPairLabel}</span>
                    <span class="trade-network-stat-label">Top pair (${summary.topPair?.count || 0} trades)</span>
                </div>
            </div>

            <div class="trade-network-panels">
                <section class="trade-network-panel">
                    <h3 class="trade-network-panel-title">Most active managers</h3>
                    ${renderManagerRankings(summary.managers, summary.maxManagerTrades)}
                </section>
                <section class="trade-network-panel">
                    <h3 class="trade-network-panel-title">Trading pairs</h3>
                    <p class="trade-network-panel-hint">Click a pair to see every deal between those managers.</p>
                    ${renderPairTable(summary.pairs, selectedPairId)}
                </section>
            </div>

            ${
                showNetwork && graphData.links.length
                    ? `
            <div class="trade-sociogram-section">
                <h3 class="trade-sociogram-heading">Network map</h3>
                <p class="trade-sociogram-hint">Click a manager name or node to see all their trades. Click a chord between two managers to filter to that pairing.</p>
                <div class="trade-sociogram-host"></div>
            </div>`
                    : ''
            }

            <div class="trade-network-detail-host">
                ${renderPairDetail(getSelectedPair(), showSeason, renderDetail)}
            </div>

            <details class="trade-network-all-trades">
                <summary>All ${trades.length} trade${trades.length === 1 ? '' : 's'}</summary>
                <div class="trade-list">${trades.map((trade) => renderTradeCard(trade, showSeason)).join('')}</div>
            </details>`
                : `<p class="trade-analyzer-empty">No executed trades recorded ${scopeLabel}. Most leagues don't trade much in a single year — load all seasons to see league-wide patterns.</p>`
        }
    `;

    if (!trades.length) return;

    bindPairRows();
    if (showNetwork && graphData.links.length) {
        requestAnimationFrame(() => {
            requestAnimationFrame(mountGraph);
        });
    }
}

/**
 * Single-season trade section (#trade-analyzer in Single Season view).
 * @param {Object} allSeasonsData
 */
function renderTradeAnalyzer(allSeasonsData) {
    const container = document.getElementById('trade-analyzer');
    if (!container) return;

    const seasonData = Object.values(allSeasonsData)[0] || {};
    const season = Object.keys(allSeasonsData)[0];
    const trades = parseExecutedTrades(seasonData);
    const missingSeasons = season && !hasTransactionView(seasonData) ? [season] : [];

    renderTradeNetwork(container, trades, {
        scopeLabel: 'this season',
        showSeason: false,
        showNetwork: false,
        missingSeasons,
    });
}

/**
 * League-wide trade section (#league-trade-network in League History view).
 * @param {Object} allSeasonsData
 */
function renderLeagueTradeNetwork(allSeasonsData) {
    const container = document.getElementById('league-trade-network');
    const trades = parseAllExecutedTrades(allSeasonsData);

    const seasons = getActiveSeasons(allSeasonsData);
    const seasonSpan =
        seasons.length >= 2
            ? `across ${seasons.length} seasons (${seasons[0]}–${seasons[seasons.length - 1]})`
            : 'across all loaded seasons';

    renderTradeNetwork(container, trades, {
        scopeLabel: seasonSpan,
        showSeason: true,
        showNetwork: true,
        missingSeasons: getMissingTransactionSeasons(allSeasonsData),
    });
}

export {
    renderTradeAnalyzer,
    renderLeagueTradeNetwork,
    renderTradeCard,
    parseExecutedTrades,
    analyzeTradePointsOverReplacement,
};
