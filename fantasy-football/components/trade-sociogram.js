/**
 * Trade Sociogram — circular manager network; edge weight = trades between a pair.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

function managerColor(index) {
    return d3.hsl((index * 41) % 360, 0.62, 0.48);
}

function nodeRadius(node) {
    return 16 + Math.min(node.tradeCount, 6) * 1.5;
}

function labelAnchor(angle) {
    const cos = Math.cos(angle);
    if (cos > 0.35) return 'start';
    if (cos < -0.35) return 'end';
    return 'middle';
}

function labelOffsetX(angle, anchor) {
    if (anchor === 'start') return 8;
    if (anchor === 'end') return -8;
    return 0;
}

function layoutCircularNodes(nodes, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const ringRadius = Math.min(width, height) / 2 - 64;
    const labelRadius = ringRadius + 26;

    nodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
        node.x = cx + ringRadius * Math.cos(angle);
        node.y = cy + ringRadius * Math.sin(angle);
        node.angle = angle;
        node.labelAnchor = labelAnchor(angle);
        node.labelX = cx + labelRadius * Math.cos(angle) + labelOffsetX(angle, node.labelAnchor);
        node.labelY = cy + labelRadius * Math.sin(angle);
    });

    return { cx, cy, ringRadius };
}

function renderTradeSociogram(container, graphData, options = {}) {
    container.innerHTML = '';

    const {
        selectedPairId = null,
        selectedManagerId = null,
        onPairSelect = () => {},
        onManagerSelect = () => {},
    } = options;
    const nodes = graphData.nodes.map((node) => ({ ...node }));
    const links = graphData.links.map((link) => ({ ...link }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    if (!nodes.length || !links.length) {
        container.innerHTML =
            '<p class="trade-sociogram-empty">Not enough trading relationships to draw a network map.</p>';
        return;
    }

    const width = Math.max(container.clientWidth || 640, 480);
    const height = Math.min(460, Math.max(340, 280 + nodes.length * 12));
    layoutCircularNodes(nodes, width, height);

    links.forEach((link) => {
        link.sourceNode = nodeById.get(link.source);
        link.targetNode = nodeById.get(link.target);
    });

    const maxCount = d3.max(links, (link) => link.count) || 1;
    const colors = new Map(nodes.map((node, index) => [node.id, managerColor(index)]));

    const svg = d3
        .select(container)
        .append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('width', '100%')
        .attr('height', height)
        .attr('class', 'trade-sociogram-svg');

    const tooltip = d3
        .select(container)
        .append('div')
        .attr('class', 'trade-sociogram-tooltip')
        .style('opacity', 0);

    const content = svg.append('g').attr('class', 'trade-sociogram-content');

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
            onPairSelect(link);
        })
        .on('mouseenter', (event, link) => {
            tooltip
                .style('opacity', 1)
                .html(
                    `<strong>${link.sourceNode.label} ↔ ${link.targetNode.label}</strong><br>` +
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

    const linkInvolvesManager = (link) =>
        selectedManagerId &&
        (link.source === selectedManagerId || link.target === selectedManagerId);

    const linkOpacity = (link) => {
        if (selectedManagerId) {
            return linkInvolvesManager(link) ? 0.95 : 0.12;
        }
        if (!selectedPairId) return 0.82;
        return link.id === selectedPairId ? 0.95 : 0.22;
    };

    const linkLabelOpacity = (link) => {
        if (selectedManagerId) {
            return linkInvolvesManager(link) ? 1 : 0.25;
        }
        return selectedPairId && link.id !== selectedPairId ? 0.35 : 1;
    };

    const nodeOpacity = (node) => {
        if (selectedManagerId) {
            if (node.id === selectedManagerId) return 1;
            return links.some(
                (link) =>
                    linkInvolvesManager(link) &&
                    (link.source === node.id || link.target === node.id)
            )
                ? 1
                : 0.35;
        }
        if (!selectedPairId) return 1;
        const selected = links.find((link) => link.id === selectedPairId);
        if (!selected) return 1;
        return node.id === selected.source || node.id === selected.target ? 1 : 0.4;
    };

    const selectManager = (event, node) => {
        event.stopPropagation();
        onManagerSelect(node);
    };

    linkGroups
        .append('line')
        .attr('class', 'trade-sociogram-link-hit')
        .attr('x1', (link) => link.sourceNode.x)
        .attr('y1', (link) => link.sourceNode.y)
        .attr('x2', (link) => link.targetNode.x)
        .attr('y2', (link) => link.targetNode.y)
        .attr('stroke', 'transparent')
        .attr('stroke-width', (link) => 12 + (link.count / maxCount) * 12);

    linkGroups
        .append('line')
        .attr('class', 'trade-sociogram-link-visible')
        .attr('x1', (link) => link.sourceNode.x)
        .attr('y1', (link) => link.sourceNode.y)
        .attr('x2', (link) => link.targetNode.x)
        .attr('y2', (link) => link.targetNode.y)
        .attr('stroke', '#0a7a6a')
        .attr('stroke-width', (link) => 2 + (link.count / maxCount) * 8)
        .attr('stroke-opacity', linkOpacity);

    linkGroups
        .append('text')
        .attr('class', 'trade-sociogram-link-label')
        .attr('x', (link) => (link.sourceNode.x + link.targetNode.x) / 2)
        .attr('y', (link) => (link.sourceNode.y + link.targetNode.y) / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', -5)
        .attr('opacity', linkLabelOpacity)
        .text((link) => link.count);

    const nodeGroups = content
        .append('g')
        .attr('class', 'trade-sociogram-nodes')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', (node) =>
            `trade-sociogram-node${node.id === selectedManagerId ? ' trade-sociogram-node-selected' : ''}`
        )
        .attr('transform', (node) => `translate(${node.x},${node.y})`)
        .attr('opacity', nodeOpacity)
        .style('cursor', 'pointer')
        .on('click', selectManager)
        .on('mouseenter', (event, node) => {
            tooltip
                .style('opacity', 1)
                .html(
                    `<strong>${node.label}</strong><br>` +
                        `${node.tradeCount} trade${node.tradeCount === 1 ? '' : 's'} — click to view all`
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

    nodeGroups
        .append('circle')
        .attr('r', (node) => nodeRadius(node))
        .attr('fill', (node) => colors.get(node.id))
        .attr('stroke', (node) => (node.id === selectedManagerId ? '#0a7a6a' : '#ffffff'))
        .attr('stroke-width', (node) => (node.id === selectedManagerId ? 3.5 : 2.5));

    nodeGroups
        .append('text')
        .attr('class', 'trade-sociogram-node-count')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', '#fff')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .text((node) => node.tradeCount);

    content
        .selectAll('.trade-sociogram-node-name')
        .data(nodes)
        .join('text')
        .attr('class', (node) =>
            `trade-sociogram-node-name${node.id === selectedManagerId ? ' trade-sociogram-node-name-selected' : ''}`
        )
        .attr('x', (node) => node.labelX)
        .attr('y', (node) => node.labelY)
        .attr('text-anchor', (node) => node.labelAnchor)
        .attr('dy', '0.35em')
        .attr('opacity', nodeOpacity)
        .style('cursor', 'pointer')
        .text((node) => node.label)
        .on('click', selectManager)
        .on('mouseenter', (event, node) => {
            tooltip
                .style('opacity', 1)
                .html(
                    `<strong>${node.label}</strong><br>` +
                        `${node.tradeCount} trade${node.tradeCount === 1 ? '' : 's'} — click to view all`
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

    nodeGroups.append('title').text((node) => `${node.label} — ${node.tradeCount} trade${node.tradeCount === 1 ? '' : 's'}`);
}

export { renderTradeSociogram };
