/**
 * Trade Sociogram
 * Force-directed network of managers; edge weight = executed trades between them.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { buildTradeSociogramData } from '../utils.js';

function managerColor(index) {
    return d3.hsl((index * 41) % 360, 0.62, 0.5);
}

function truncateLabel(label, maxLength = 16) {
    if (!label || label.length <= maxLength) return label;
    return `${label.slice(0, maxLength - 1)}…`;
}

function nodeRadius(node) {
    return 14 + Math.min(node.tradeCount, 5) * 2;
}

function labelOffset(node) {
    return 28 + Math.min(node.tradeCount, 5) * 2;
}

function renderTradeSociogram(container, trades, renderTradeDetail) {
    container.innerHTML = '';

    const graphData = buildTradeSociogramData(trades);
    if (graphData.nodes.length === 0 || graphData.links.length === 0) {
        container.innerHTML =
            '<p class="trade-sociogram-empty">Could not build the trade network from this data. If trade cards appear below, try clearing saved data and re-running analysis.</p>';
        return;
    }

    const nodes = graphData.nodes.map((node) => ({ ...node }));
    const links = graphData.links.map((link) => ({ ...link }));
    const width = Math.min(Math.max(container.clientWidth || 640, 480), 900);
    const height = Math.min(560, Math.max(360, Math.round(width * 0.55), nodes.length * 48));
    const maxCount = d3.max(graphData.links, (link) => link.count) || 1;

    const wrapper = d3.select(container).append('div').attr('class', 'trade-sociogram-layout');

    const graphHost = wrapper.append('div').attr('class', 'trade-sociogram-graph');
    const detailHost = wrapper.append('div').attr('class', 'trade-sociogram-detail trade-sociogram-detail-hidden');

    const svg = graphHost
        .append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('width', '100%')
        .attr('height', height)
        .attr('class', 'trade-sociogram-svg');

    const content = svg.append('g').attr('class', 'trade-sociogram-content');

    const tooltip = graphHost
        .append('div')
        .attr('class', 'trade-sociogram-tooltip')
        .style('opacity', 0);

    const colors = new Map(nodes.map((node, index) => [node.id, managerColor(index)]));

    const simulation = d3
        .forceSimulation(nodes)
        .force(
            'link',
            d3
                .forceLink(links)
                .id((node) => node.id)
                .distance((link) => 120 - Math.min(link.count, 6) * 6)
        )
        .force('charge', d3.forceManyBody().strength(-280))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((node) => nodeRadius(node) + 22));

    let selectedLinkId = null;

    const fitGraph = (animate = true) => {
        const bounds = content.node()?.getBBox();
        if (!bounds?.width || !bounds?.height) return;

        const padding = 52;
        const scale = Math.min(
            (width - padding * 2) / bounds.width,
            (height - padding * 2) / bounds.height,
            2
        );
        const translateX = width / 2 - scale * (bounds.x + bounds.width / 2);
        const translateY = height / 2 - scale * (bounds.y + bounds.height / 2);
        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

        if (animate) {
            svg.transition().duration(350).call(zoom.transform, transform);
        } else {
            svg.call(zoom.transform, transform);
        }
    };

    const zoom = d3
        .zoom()
        .scaleExtent([0.2, 4])
        .filter((event) => {
            if (event.type === 'wheel') return true;
            if (event.type === 'dblclick') return false;

            let target = event.target;
            while (target && target !== svg.node()) {
                if (target.classList?.contains('trade-sociogram-node')) return false;
                target = target.parentNode;
            }
            return true;
        })
        .on('zoom', (event) => {
            content.attr('transform', event.transform);
        });

    svg.call(zoom).on('dblclick.zoom', null);

    const resetLinkStyles = () => {
        linkGroups
            .select('.trade-sociogram-link-visible')
            .attr('stroke-opacity', (link) => (selectedLinkId && link.id !== selectedLinkId ? 0.25 : 0.85));
        nodeGroups.attr('opacity', (node) => {
            if (!selectedLinkId) return 1;
            const selected = links.find((link) => link.id === selectedLinkId);
            if (!selected) return 1;
            return node.id === selected.source.id || node.id === selected.target.id ? 1 : 0.35;
        });
    };

    const hideDetail = () => {
        selectedLinkId = null;
        detailHost.classed('trade-sociogram-detail-hidden', true).html('');
        resetLinkStyles();
    };

    const showDetail = (link) => {
        selectedLinkId = link.id;
        const sourceLabel = link.source.label || link.source.id;
        const targetLabel = link.target.label || link.target.id;
        const tradeLabel = link.count === 1 ? 'trade' : 'trades';

        detailHost
            .classed('trade-sociogram-detail-hidden', false)
            .html(`
                <div class="trade-sociogram-detail-header">
                    <h4 class="trade-sociogram-detail-title">${sourceLabel} ↔ ${targetLabel}</h4>
                    <span class="trade-sociogram-detail-count">${link.count} ${tradeLabel}</span>
                    <button type="button" class="trade-sociogram-detail-close" aria-label="Close trade details">×</button>
                </div>
                <div class="trade-list trade-sociogram-detail-list">
                    ${link.trades.map((trade) => renderTradeDetail(trade)).join('')}
                </div>
            `);

        detailHost.select('.trade-sociogram-detail-close').on('click', hideDetail);
        resetLinkStyles();
    };

    const linkGroups = content
        .append('g')
        .attr('class', 'trade-sociogram-links')
        .selectAll('g')
        .data(links)
        .join('g')
        .attr('class', 'trade-sociogram-link-group')
        .style('cursor', 'pointer')
        .on('click', (event, link) => {
            event.stopPropagation();
            showDetail(link);
        })
        .on('mouseenter', (event, link) => {
            tooltip
                .style('opacity', 1)
                .html(
                    `<strong>${link.source.label} ↔ ${link.target.label}</strong><br>` +
                        `${link.count} trade${link.count === 1 ? '' : 's'} — click to view`
                )
                .style('left', `${event.offsetX + 12}px`)
                .style('top', `${event.offsetY + 12}px`);
        })
        .on('mousemove', (event) => {
            tooltip.style('left', `${event.offsetX + 12}px`).style('top', `${event.offsetY + 12}px`);
        })
        .on('mouseleave', () => {
            tooltip.style('opacity', 0);
        });

    linkGroups
        .append('line')
        .attr('class', 'trade-sociogram-link-hit')
        .attr('stroke', 'transparent')
        .attr('stroke-width', (link) => 10 + (link.count / maxCount) * 14);

    linkGroups
        .append('line')
        .attr('class', 'trade-sociogram-link-visible')
        .attr('stroke', '#76c7c0')
        .attr('stroke-width', (link) => 1.5 + (link.count / maxCount) * 7)
        .attr('stroke-opacity', 0.85);

    linkGroups
        .append('text')
        .attr('class', 'trade-sociogram-link-label')
        .attr('text-anchor', 'middle')
        .attr('dy', -6)
        .text((link) => link.count);

    const nodeGroups = content
        .append('g')
        .attr('class', 'trade-sociogram-nodes')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', 'trade-sociogram-node')
        .call(
            d3
                .drag()
                .on('start', (event, node) => {
                    event.sourceEvent?.stopPropagation();
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    node.fx = node.x;
                    node.fy = node.y;
                })
                .on('drag', (event, node) => {
                    node.fx = event.x;
                    node.fy = event.y;
                })
                .on('end', (event, node) => {
                    if (!event.active) simulation.alphaTarget(0);
                    node.fx = null;
                    node.fy = null;
                })
        );

    nodeGroups
        .append('circle')
        .attr('r', (node) => nodeRadius(node))
        .attr('fill', (node) => colors.get(node.id))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);

    nodeGroups
        .append('text')
        .attr('class', 'trade-sociogram-node-label')
        .attr('text-anchor', 'middle')
        .attr('dy', (node) => labelOffset(node))
        .text((node) => truncateLabel(node.label));

    nodeGroups.append('title').text((node) => `${node.label} (${node.tradeCount} trade${node.tradeCount === 1 ? '' : 's'})`);

    svg.on('click', hideDetail);
    svg.on('dblclick', (event) => {
        if (event.target === svg.node()) {
            fitGraph(true);
        }
    });

    let hasFit = false;
    simulation.on('tick', () => {
        linkGroups.selectAll('line').each(function updateLinkPosition(link) {
            const line = d3.select(this);
            line.attr('x1', link.source.x)
                .attr('y1', link.source.y)
                .attr('x2', link.target.x)
                .attr('y2', link.target.y);
        });

        linkGroups
            .select('.trade-sociogram-link-label')
            .attr('x', (link) => (link.source.x + link.target.x) / 2)
            .attr('y', (link) => (link.source.y + link.target.y) / 2);

        nodeGroups.attr('transform', (node) => `translate(${node.x},${node.y})`);
    });

    simulation.on('end', () => {
        if (hasFit) return;
        hasFit = true;
        fitGraph(true);
    });
}

export { renderTradeSociogram, buildTradeSociogramData };
