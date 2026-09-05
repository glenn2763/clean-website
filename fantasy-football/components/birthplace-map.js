/**
 * League History — birthplace / college heat map with manager filter.
 */

import {
    buildOwnerMap,
    getActiveSeasons,
    getOwnerKey,
    getOwnerLabel,
    getTeams,
} from '../utils.js';
import { fetchPlayerBirthplaces } from '../api.js';

const US_BOUNDS = [
    [24.5, -125],
    [49.5, -66.5],
];

const HEAT_GRADIENT = {
    0.2: '#2b83ba',
    0.45: '#abdda4',
    0.65: '#ffffbf',
    0.85: '#fdae61',
    1.0: '#d7191c',
};

const LOCATION_MODES = {
    birthplace: {
        key: 'birthplace',
        label: 'Birthplace',
        emptyList: 'Select a manager to see their roster birthplaces in the list.',
    },
    college: {
        key: 'college',
        label: 'College',
        emptyList: 'Select a manager to see their roster colleges in the list.',
    },
};

function managerColor(index) {
    const hue = (index * 33) % 360;
    return `hsl(${hue} 65% 48%)`;
}

function collectRosteredPlayers(allSeasonsData) {
    const byPlayer = new Map();
    const ownerMap = buildOwnerMap(allSeasonsData);

    getActiveSeasons(allSeasonsData).forEach((season) => {
        const seasonData = allSeasonsData[season];
        getTeams(seasonData).forEach((team) => {
            const ownerKey = getOwnerKey(team);
            const roster = Array.isArray(team.roster) ? team.roster : [];
            roster.forEach((entry) => {
                const playerId = entry.player?.id ?? entry.id;
                if (playerId == null || Number(playerId) <= 0) return;
                const fullName =
                    entry.fullName ||
                    entry.player?.fullName ||
                    [entry.firstName, entry.lastName].filter(Boolean).join(' ') ||
                    null;

                if (!byPlayer.has(playerId)) {
                    byPlayer.set(playerId, {
                        playerId: Number(playerId),
                        fullName,
                        owners: new Set(),
                        ownerSeasons: new Map(),
                    });
                }
                const row = byPlayer.get(playerId);
                row.owners.add(ownerKey);
                if (!row.ownerSeasons.has(ownerKey)) {
                    row.ownerSeasons.set(ownerKey, new Set());
                }
                row.ownerSeasons.get(ownerKey).add(String(season));
                if (!row.fullName && fullName) row.fullName = fullName;
            });
        });
    });

    return { byPlayer, ownerMap };
}

/** e.g. [2019, 2021, 2022, 2023] → "2019, 2021–2023" */
function formatSeasonYears(years) {
    const sorted = [...years].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (sorted.length === 0) return '';

    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? String(start) : `${start}–${end}`);
            start = end = sorted[i];
        }
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`);
    return ranges.join(', ');
}

function formatBirthPlace(birth) {
    if (!birth) return 'Unknown';
    const parts = [birth.city, birth.state].filter(Boolean);
    if (parts.length) {
        return birth.country && birth.country !== 'USA'
            ? `${parts.join(', ')} (${birth.country})`
            : parts.join(', ');
    }
    return birth.country || 'Unknown';
}

function formatCollegePlace(record) {
    if (!record) return 'Unknown';
    const school = record.collegeName;
    const cityState = [record.collegeCity, record.collegeState].filter(Boolean).join(', ');
    if (school && cityState) return `${school} · ${cityState}`;
    if (school) return school;
    if (cityState) return cityState;
    return 'Unknown college';
}

let mapInstance = null;
let heatLayer = null;
let resizeObserver = null;

function destroyMap() {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
    heatLayer = null;
}

function ensureLeaflet() {
    if (typeof window === 'undefined' || !window.L) {
        throw new Error('Leaflet is not loaded');
    }
    if (typeof window.L.heatLayer !== 'function') {
        throw new Error('Leaflet.heat is not loaded');
    }
    return window.L;
}

function locationBucketKey(lat, lng) {
    return `${lat.toFixed(2)}|${lng.toFixed(2)}`;
}

/**
 * @param {Object} allSeasonsData
 */
async function renderBirthplaceMap(allSeasonsData) {
    const section = document.getElementById('section-birthplace-map');
    const mapEl = document.getElementById('birthplace-map');
    const picker = document.getElementById('birthplace-manager-picker');
    const modePicker = document.getElementById('birthplace-location-mode');
    const summary = document.getElementById('birthplace-map-summary');
    const listEl = document.getElementById('birthplace-player-list');
    const notice = document.getElementById('birthplace-map-notice');

    if (!section || !mapEl || !picker) return;

    destroyMap();
    picker.innerHTML = '';
    if (listEl) listEl.innerHTML = '';
    if (summary) summary.textContent = '';
    if (notice) {
        notice.textContent = '';
        notice.classList.add('hidden');
    }

    const { byPlayer, ownerMap } = collectRosteredPlayers(allSeasonsData);
    const playerIds = [...byPlayer.keys()];

    if (playerIds.length === 0) {
        if (notice) {
            notice.textContent = 'No rostered players found across loaded seasons.';
            notice.classList.remove('hidden');
        }
        return;
    }

    let birthMap;
    try {
        birthMap = await fetchPlayerBirthplaces(playerIds);
    } catch (error) {
        if (notice) {
            notice.textContent = `Could not load player locations: ${error.message}`;
            notice.classList.remove('hidden');
        }
        return;
    }

    const L = ensureLeaflet();
    const ownerKeys = Object.keys(ownerMap).sort((a, b) =>
        getOwnerLabel(a, ownerMap).localeCompare(getOwnerLabel(b, ownerMap))
    );
    const colorByOwner = new Map(ownerKeys.map((key, index) => [key, managerColor(index)]));

    const players = [];
    playerIds.forEach((playerId) => {
        const meta = byPlayer.get(playerId);
        const record = birthMap[String(playerId)];
        if (!record) return;

        const birthOk = record.lat != null && record.lng != null;
        const collegeOk = record.collegeLat != null && record.collegeLng != null;

        players.push({
            playerId: Number(playerId),
            fullName: record.fullName || meta.fullName || `Player ${playerId}`,
            owners: [...meta.owners],
            ownerSeasons: Object.fromEntries(
                [...meta.ownerSeasons.entries()].map(([ownerKey, seasons]) => [
                    ownerKey,
                    [...seasons].sort(),
                ])
            ),
            birthplace: birthOk
                ? {
                      lat: record.lat,
                      lng: record.lng,
                      label: formatBirthPlace(record),
                      country: record.country,
                  }
                : null,
            college: collegeOk
                ? {
                      lat: record.collegeLat,
                      lng: record.collegeLng,
                      label: formatCollegePlace(record),
                      name: record.collegeName,
                  }
                : null,
        });
    });

    let locationMode = 'birthplace';
    let selectedOwnerKey = null;

    if (modePicker) {
        modePicker.innerHTML = '';
        Object.values(LOCATION_MODES).forEach((mode) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `birthplace-mode-btn${mode.key === locationMode ? ' is-selected' : ''}`;
            btn.dataset.mode = mode.key;
            btn.textContent = mode.label;
            modePicker.appendChild(btn);
        });
    }

    picker.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'birthplace-manager-btn is-selected';
    allBtn.dataset.ownerKey = '';
    allBtn.textContent = 'All managers';
    picker.appendChild(allBtn);

    ownerKeys.forEach((ownerKey) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'birthplace-manager-btn';
        btn.dataset.ownerKey = ownerKey;
        btn.style.setProperty('--manager-color', colorByOwner.get(ownerKey));
        btn.innerHTML = `<span class="birthplace-manager-swatch" aria-hidden="true"></span>${getOwnerLabel(ownerKey, ownerMap)}`;
        picker.appendChild(btn);
    });

    mapInstance = L.map(mapEl, {
        scrollWheelZoom: false,
        worldCopyJump: false,
        minZoom: 2,
        maxZoom: 12,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 12,
        minZoom: 2,
    }).addTo(mapInstance);

    function activeLocation(player) {
        return player[locationMode] || null;
    }

    function visiblePlayers() {
        return players.filter((p) => activeLocation(p));
    }

    function buildHeatPoints(ownerKey) {
        const buckets = new Map();

        visiblePlayers().forEach((player) => {
            if (ownerKey && !player.owners.includes(ownerKey)) return;

            const loc = activeLocation(player);
            if (!loc) return;

            const key = locationBucketKey(loc.lat, loc.lng);
            if (!buckets.has(key)) {
                buckets.set(key, { lat: loc.lat, lng: loc.lng, weight: 0 });
            }
            buckets.get(key).weight += 1;
        });

        return [...buckets.values()].map((bucket) => [bucket.lat, bucket.lng, bucket.weight]);
    }

    function heatOptions(ownerKey) {
        const pointCount = buildHeatPoints(ownerKey).length;
        const radius = ownerKey ? 22 : 28;
        const blur = ownerKey ? 16 : 20;

        return {
            radius,
            blur,
            maxZoom: 10,
            minOpacity: pointCount <= 3 ? 0.45 : 0.35,
            max: ownerKey ? 1.2 : 1.8,
            gradient: HEAT_GRADIENT,
        };
    }

    function updateSummary() {
        if (!summary) return;
        const visible = visiblePlayers();
        const filterNote = selectedOwnerKey
            ? ` · showing ${getOwnerLabel(selectedOwnerKey, ownerMap)}`
            : '';
        if (locationMode === 'birthplace') {
            const international = visible.filter(
                (p) => p.birthplace?.country && p.birthplace.country !== 'USA'
            ).length;
            const intlNote =
                international > 0
                    ? ` · ${international} born outside the U.S. (zoom out or pan to find them)`
                    : '';
            summary.textContent = `${visible.length} players with mapped birthplaces across ${ownerKeys.length} managers${filterNote}${intlNote}`;
        } else {
            const missing = players.length - visible.length;
            const missingNote = missing > 0 ? ` · ${missing} without a mapped college` : '';
            summary.textContent = `${visible.length} players with mapped colleges across ${ownerKeys.length} managers${filterNote}${missingNote}`;
        }
    }

    function renderPlayerList(ownerKey) {
        if (!listEl) return;
        if (!ownerKey) {
            listEl.innerHTML = `<p class="birthplace-list-empty">${LOCATION_MODES[locationMode].emptyList}</p>`;
            return;
        }

        const owned = players
            .filter((p) => p.owners.includes(ownerKey))
            .sort((a, b) => a.fullName.localeCompare(b.fullName));

        const label = getOwnerLabel(ownerKey, ownerMap);
        const rows = owned
            .map((p) => {
                const years = formatSeasonYears(p.ownerSeasons[ownerKey] || []);
                const loc = activeLocation(p);
                const place = loc?.label || (locationMode === 'college' ? 'No college mapped' : 'Unknown');
                return (
                    `<li>` +
                    `<div class="birthplace-list-main">` +
                    `<span class="birthplace-list-name">${escapeHtml(p.fullName)}</span>` +
                    `<span class="birthplace-list-years">${escapeHtml(years)}</span>` +
                    `</div>` +
                    `<span class="birthplace-list-place">${escapeHtml(place)}</span>` +
                    `</li>`
                );
            })
            .join('');

        listEl.innerHTML =
            `<div class="birthplace-list-header">` +
            `<span class="birthplace-list-title">${escapeHtml(label)}</span>` +
            `<span class="birthplace-list-count">${owned.length} players</span>` +
            `</div><ul class="birthplace-list">${rows}</ul>`;
    }

    function syncHeatLayer() {
        const points = buildHeatPoints(selectedOwnerKey);

        if (heatLayer) {
            mapInstance.removeLayer(heatLayer);
            heatLayer = null;
        }

        if (!points.length) return;

        heatLayer = L.heatLayer(points, heatOptions(selectedOwnerKey)).addTo(mapInstance);
    }

    function applySelection(ownerKey) {
        selectedOwnerKey = ownerKey || null;
        picker.querySelectorAll('.birthplace-manager-btn').forEach((btn) => {
            const key = btn.dataset.ownerKey || '';
            btn.classList.toggle('is-selected', key === (selectedOwnerKey || ''));
        });
        updateSummary();
        syncHeatLayer();
        renderPlayerList(selectedOwnerKey);
    }

    function applyLocationMode(mode) {
        if (!LOCATION_MODES[mode] || mode === locationMode) return;
        locationMode = mode;
        if (modePicker) {
            modePicker.querySelectorAll('.birthplace-mode-btn').forEach((btn) => {
                btn.classList.toggle('is-selected', btn.dataset.mode === locationMode);
            });
        }
        updateSummary();
        syncHeatLayer();
        renderPlayerList(selectedOwnerKey);
        mapInstance.fitBounds(US_BOUNDS);
    }

    updateSummary();
    syncHeatLayer();
    mapInstance.fitBounds(US_BOUNDS);

    picker.onclick = (event) => {
        const btn = event.target.closest('.birthplace-manager-btn');
        if (!btn) return;
        applySelection(btn.dataset.ownerKey || null);
    };

    if (modePicker) {
        modePicker.onclick = (event) => {
            const btn = event.target.closest('.birthplace-mode-btn');
            if (!btn) return;
            applyLocationMode(btn.dataset.mode);
        };
    }

    renderPlayerList(null);

    requestAnimationFrame(() => {
        mapInstance.invalidateSize();
    });

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            if (mapInstance) mapInstance.invalidateSize();
        });
        resizeObserver.observe(mapEl);
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export { renderBirthplaceMap, destroyMap as destroyBirthplaceMap };
