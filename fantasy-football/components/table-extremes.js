/**
 * Highlight absolute min/max numeric cells in comparison tables.
 */

/**
 * @param {Array<number|null|undefined>} values
 * @returns {Map<number, 'high'|'low'>}
 */
function collectTableExtremes(values) {
    const indexed = values
        .map((value, index) => ({ value, index }))
        .filter(({ value }) => value != null && Number.isFinite(value));

    if (indexed.length < 2) return new Map();

    const min = Math.min(...indexed.map((entry) => entry.value));
    const max = Math.max(...indexed.map((entry) => entry.value));
    if (min === max) return new Map();

    const extremes = new Map();
    indexed.forEach(({ value, index }) => {
        if (value === max) extremes.set(index, 'high');
        if (value === min) extremes.set(index, 'low');
    });
    return extremes;
}

/**
 * @param {string} content
 * @param {Map<number, 'high'|'low'>} extremes
 * @param {number} cellIndex
 * @returns {string}
 */
function renderExtremeTd(content, extremes, cellIndex, { bold = false } = {}) {
    const kind = extremes.get(cellIndex);
    const cls = kind === 'high'
        ? 'table-cell-extreme table-cell-extreme-high'
        : kind === 'low'
            ? 'table-cell-extreme table-cell-extreme-low'
            : '';
    const inner = bold ? `<strong>${content}</strong>` : content;
    return cls ? `<td class="${cls}">${inner}</td>` : `<td>${inner}</td>`;
}

export { collectTableExtremes, renderExtremeTd };
