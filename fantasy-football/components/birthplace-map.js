/**
 * League History — birthplace / college map with manager LED selection.
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

const LOCATION_MODES = {
    birthplace: {
        key: 'birthplace',
        label: 'Birthplace',
        emptyList: 'Select a manager to light up their roster birthplaces and see the full list.',
    },
    college: {
        key: 'college',
        label: 'College',
        emptyList: 'Select a manager to light up their roster colleges and see the full list.',
    },
};

/** Deterministic sub-pixel jitter so stacked city dots fan out slightly. */
function jitterForId(playerId) {
    const n = Math.abs(Number(playerId)) || 0;
    const angle = ((n * 47) % 360) * (Math.PI / 180);
    const radius = 0.04 + ((n * 13) % 17) * 0.005;
    return {
        dLat: Math.sin(angle) * radius,
        dLng: Math.cos(angle) * radius,
    };
}

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
let markerLayer = null;
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
    markerLayer = null;
}

function ensureLeaflet() {
    if (typeof window === 'undefined' || !window.L) {
        throw new Error('Leaflet is not loaded');
    }
    return window.L;
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

        const jitter = jitterForId(playerId);
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
                      lat: record.lat + jitter.dLat,
                      lng: record.lng + jitter.dLng,
                      label: formatBirthPlace(record),
                      country: record.country,
                  }
                : null,
            college: collegeOk
                ? {
                      lat: record.collegeLat + jitter.dLat,
                      lng: record.collegeLng + jitter.dLng,
                      label: formatCollegePlace(record),
                      name: record.collegeName,
                  }
                : null,
        });
    });

    let locationMode = 'birthplace';
    let selectedOwnerKey = null;
    const markersByPlayer = new Map();

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

    markerLayer = L.layerGroup().addTo(mapInstance);

    function activeLocation(player) {
        return player[locationMode] || null;
    }

    function visiblePlayers() {
        return players.filter((p) => activeLocation(p));
    }

    function updateSummary() {
        if (!summary) return;
        const visible = visiblePlayers();
        if (locationMode === 'birthplace') {
            const international = visible.filter(
                (p) => p.birthplace?.country && p.birthplace.country !== 'USA'
            ).length;
            const intlNote =
                international > 0
                    ? ` · ${international} born outside the U.S. (plotted — zoom out or pan to find them)`
                    : '';
            summary.textContent = `${visible.length} players with mapped birthplaces across ${ownerKeys.length} managers${intlNote}`;
        } else {
            const missing = players.length - visible.length;
            const missingNote = missing > 0 ? ` · ${missing} without a mapped college` : '';
            summary.textContent = `${visible.length} players with mapped colleges across ${ownerKeys.length} managers${missingNote}`;
        }
    }

    function circleStyle(player, ownerKey) {
        const isSelected = ownerKey && player.owners.includes(ownerKey);
        const isAll = !ownerKey;
        const ownerColor = ownerKey ? colorByOwner.get(ownerKey) : '#5b7c99';
        const base = { radius: 3, weight: 0.75 };

        if (isAll) {
            return {
                ...base,
                color: '#1c2a3a',
                fillColor: '#5b7c99',
                fillOpacity: 0.5,
                opacity: 0.65,
                className: 'birthplace-dot birthplace-dot-all',
            };
        }
        if (isSelected) {
            return {
                ...base,
                color: ownerColor,
                fillColor: ownerColor,
                fillOpacity: 0.92,
                opacity: 1,
                className: 'birthplace-dot birthplace-dot-lit',
            };
        }
        return {
            ...base,
            color: '#8a93a0',
            fillColor: '#b0b7c0',
            fillOpacity: 0.18,
            opacity: 0.3,
            className: 'birthplace-dot birthplace-dot-dim',
        };
    }

    function tooltipHtml(player, ownerKey) {
        const loc = activeLocation(player);
        const years = ownerKey ? formatSeasonYears(player.ownerSeasons[ownerKey] || []) : '';
        const yearsLine = years ? `<br>${escapeHtml(years)}` : '';
        return (
            `<strong>${escapeHtml(player.fullName)}</strong><br>` +
            `${escapeHtml(loc?.label || 'Unknown')}${yearsLine}`
        );
    }

    function syncMarkerTooltip(marker, player, ownerKey) {
        const loc = activeLocation(player);
        const showTooltip = Boolean(loc) && (!ownerKey || player.owners.includes(ownerKey));

        marker.unbindTooltip();
        if (marker._path) {
            marker._path.style.pointerEvents = showTooltip ? 'auto' : 'none';
        }
        if (!showTooltip) return;

        marker.bindTooltip(tooltipHtml(player, ownerKey || null), {
            sticky: true,
            className: 'birthplace-tooltip',
        });
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

    function syncMarkers() {
        players.forEach((player) => {
            const loc = activeLocation(player);
            let marker = markersByPlayer.get(player.playerId);

            if (!loc) {
                if (marker) {
                    markerLayer.removeLayer(marker);
                    markersByPlayer.delete(player.playerId);
                }
                return;
            }

            if (!marker) {
                marker = L.circleMarker([loc.lat, loc.lng], circleStyle(player, selectedOwnerKey));
                marker.addTo(markerLayer);
                markersByPlayer.set(player.playerId, marker);
            } else {
                marker.setLatLng([loc.lat, loc.lng]);
                marker.setStyle(circleStyle(player, selectedOwnerKey));
            }

            syncMarkerTooltip(marker, player, selectedOwnerKey);
            if (selectedOwnerKey && player.owners.includes(selectedOwnerKey)) {
                marker.bringToFront();
            }
        });
    }

    function applySelection(ownerKey) {
        selectedOwnerKey = ownerKey || null;
        picker.querySelectorAll('.birthplace-manager-btn').forEach((btn) => {
            const key = btn.dataset.ownerKey || '';
            btn.classList.toggle('is-selected', key === (selectedOwnerKey || ''));
        });
        syncMarkers();
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
        syncMarkers();
        renderPlayerList(selectedOwnerKey);
        mapInstance.fitBounds(US_BOUNDS);
    }

    updateSummary();
    syncMarkers();
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
