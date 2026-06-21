/**
 * Trade Analyzer Component
 * Executed trade list + sociogram network (single season or league-wide).
 */

import {
    analyzeTradePointsOverReplacement,
    getActiveSeasons,
    hasTransactionView,
    parseAllExecutedTrades,
    parseExecutedTrades,
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

function renderTradeCard(trade, showSeason = false) {
    const por = analyzeTradePointsOverReplacement(trade, null);
    return `
        <article class="trade-card">
            <header class="trade-card-header">
                <span class="trade-card-week">${showSeason ? `${trade.season} · ` : ''}Week ${trade.week || '—'}</span>
                <span class="trade-card-date">${formatTradeDate(trade.processedAt)}</span>
            </header>
            <div class="trade-card-body">
                ${trade.sides.map(renderTradeSide).join('')}
            </div>
            <footer class="trade-card-footer">
                <span class="trade-por-badge trade-por-pending">POR impact: coming soon</span>
                ${por == null ? '' : `<span class="trade-por-value">${por}</span>`}
            </footer>
        </article>
    `;
}

function getMissingTransactionSeasons(allSeasonsData) {
    return getActiveSeasons(allSeasonsData).filter((season) => !hasTransactionView(allSeasonsData[season]));
}

function mountTradeSociogram(host, trades, showSeason) {
    if (!host) return;

    const renderDetail = (trade) => renderTradeCard(trade, showSeason);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderTradeSociogram(host, trades, renderDetail);
        });
    });
}

function renderTradeNetwork(container, trades, options = {}) {
    if (!container) return;

    const {
        scopeLabel = 'this season',
        showSeason = false,
        showPorNotice = true,
        showNetwork = true,
        missingSeasons = [],
    } = options;

    const missingNotice =
        missingSeasons.length > 0
            ? `<div class="trade-analyzer-notice trade-analyzer-cache-notice">
                <strong>Transaction data may be incomplete</strong>
                <p>Trade counts for ${missingSeasons.join(', ')} are missing from saved data. Use <em>Clear Saved Data</em> and re-run analysis to refresh.</p>
               </div>`
            : '';

    container.innerHTML = `
        ${missingNotice}
        ${
            showPorNotice
                ? `<div class="trade-analyzer-notice">
            <strong>Trade analyzer (preview)</strong>
            <p>
                Each trade will eventually be scored with points over replacement (POR):
                how much a player outperformed a baseline at their position after the deal,
                so a TE upgrade can outweigh a smaller QB downgrade. Replacement levels and
                post-trade scoring windows are not wired up yet.
            </p>
        </div>`
                : ''
        }
        <div class="trade-analyzer-summary">
            <span><strong>${trades.length}</strong> executed trade${trades.length === 1 ? '' : 's'} ${scopeLabel}</span>
        </div>
        ${
            trades.length
                ? `
            ${
                showNetwork
                    ? `
            <div class="trade-sociogram-section">
                <h3 class="trade-sociogram-heading">Trade network</h3>
                <p class="trade-sociogram-hint">Each dot is a manager. Line thickness shows how many trades happened between that pair. Click a line to see every deal between them. Scroll to zoom, drag the background to pan, double-click to reset the view.</p>
                <div class="trade-sociogram-host"></div>
            </div>`
                    : ''
            }
            <div class="trade-list-heading">${showNetwork ? 'All trades' : 'Trades this season'}</div>
            <div class="trade-list">${trades.map((trade) => renderTradeCard(trade, showSeason)).join('')}</div>`
                : `<p class="trade-analyzer-empty">No executed trades recorded ${scopeLabel}. Most leagues don't trade much in a single year — use <strong>League History</strong> mode to see the all-time trade network across every season.</p>`
        }
    `;

    if (trades.length && showNetwork) {
        mountTradeSociogram(container.querySelector('.trade-sociogram-host'), trades, showSeason);
    }
}

/**
 * Single-season trade section (#trade-analyzer in Single Season view).
 * @param {Object} allSeasonsData
 */
function renderTradeAnalyzer(allSeasonsData) {
    const container = document.getElementById('trade-analyzer');
    const seasonData = Object.values(allSeasonsData)[0] || {};
    const season = Object.keys(allSeasonsData)[0];
    const trades = parseExecutedTrades(seasonData);
    const missingSeasons = season && !hasTransactionView(seasonData) ? [season] : [];

    renderTradeNetwork(container, trades, {
        scopeLabel: 'this season',
        showSeason: false,
        showPorNotice: false,
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
        showPorNotice: false,
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
