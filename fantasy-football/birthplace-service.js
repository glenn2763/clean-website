/**
 * ESPN athlete birthPlace lookup + geocoding with on-disk cache.
 * Used by the Express proxy (CommonJS).
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_PATH = path.join(__dirname, 'data', 'birthplace-cache.json');
const ATHLETE_URL = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes';
const SITE_ATHLETE_URL = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const USA_ALIASES = new Set([
    'USA',
    'US',
    'UNITED STATES',
    'UNITED STATES OF AMERICA',
    'U.S.',
    'U.S.A.',
]);

/** Fallback when city geocode fails — approximate state/province centers. */
const REGION_CENTROIDS = {
    AL: [32.8, -86.8],
    AK: [64.2, -153.4],
    AZ: [34.3, -111.7],
    AR: [34.9, -92.4],
    CA: [37.2, -119.4],
    CO: [39.0, -105.5],
    CT: [41.6, -72.7],
    DE: [39.0, -75.5],
    FL: [27.8, -81.7],
    GA: [32.7, -83.2],
    HI: [20.5, -157.0],
    ID: [44.4, -114.6],
    IL: [40.3, -89.0],
    IN: [39.9, -86.3],
    IA: [42.0, -93.5],
    KS: [38.5, -98.3],
    KY: [37.5, -85.3],
    LA: [31.0, -92.0],
    ME: [45.3, -69.2],
    MD: [39.0, -76.7],
    MA: [42.2, -71.5],
    MI: [44.3, -85.4],
    MN: [46.3, -94.3],
    MS: [32.7, -89.7],
    MO: [38.4, -92.5],
    MT: [47.0, -109.6],
    NE: [41.5, -99.8],
    NV: [39.3, -116.6],
    NH: [43.7, -71.6],
    NJ: [40.1, -74.4],
    NM: [34.4, -106.1],
    NY: [42.9, -75.5],
    NC: [35.6, -79.4],
    ND: [47.5, -100.5],
    OH: [40.4, -82.8],
    OK: [35.6, -97.5],
    OR: [44.0, -120.5],
    PA: [40.9, -77.2],
    RI: [41.7, -71.5],
    SC: [33.9, -80.9],
    SD: [44.4, -100.2],
    TN: [35.9, -86.4],
    TX: [31.5, -99.3],
    UT: [39.3, -111.7],
    VT: [44.1, -72.6],
    VA: [37.5, -78.9],
    WA: [47.4, -120.5],
    WV: [38.6, -80.6],
    WI: [44.5, -89.9],
    WY: [43.0, -107.6],
    DC: [38.9, -77.0],
    ON: [50.0, -85.0],
    BC: [53.7, -127.6],
    AB: [53.9, -116.6],
    QC: [52.0, -71.7],
    MB: [53.8, -98.0],
    SK: [54.4, -105.5],
    NS: [45.0, -63.0],
    NB: [46.5, -66.1],
};

let cache = null;
let writeTimer = null;

function loadCache() {
    if (cache) return cache;
    try {
        if (fs.existsSync(CACHE_PATH)) {
            cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
        }
    } catch (error) {
        console.warn('Failed to load birthplace cache:', error.message);
    }
    if (!cache || typeof cache !== 'object') {
        cache = { players: {}, places: {} };
    }
    if (!cache.players) cache.players = {};
    if (!cache.places) cache.places = {};
    return cache;
}

function scheduleSave() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
        try {
            const dir = path.dirname(CACHE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
        } catch (error) {
            console.warn('Failed to save birthplace cache:', error.message);
        }
    }, 400);
}

function saveCacheNow() {
    if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
    }
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function normalizeCountry(country) {
    if (!country) return null;
    const trimmed = String(country).trim();
    if (USA_ALIASES.has(trimmed.toUpperCase())) return 'USA';
    return trimmed;
}

function isUsa(country) {
    return normalizeCountry(country) === 'USA';
}

function placeKey(city, state, country) {
    const c = (city || '').trim().toLowerCase();
    const s = (state || '').trim().toUpperCase();
    const nation = normalizeCountry(country) || '';
    return `${c}|${s}|${nation}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool(items, concurrency, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await fn(items[index], index);
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

async function fetchAthleteBirthPlace(playerId) {
    const { data } = await axios.get(`${ATHLETE_URL}/${playerId}`, { timeout: 12000 });
    const bp = data.birthPlace || {};
    return {
        playerId: Number(playerId),
        fullName: data.fullName || data.displayName || null,
        city: bp.city || null,
        state: bp.state || null,
        country: normalizeCountry(bp.country),
    };
}

async function fetchAthleteCollege(playerId) {
    const { data } = await axios.get(`${SITE_ATHLETE_URL}/${playerId}`, { timeout: 12000 });
    const athlete = data.athlete || data;
    const college = athlete.college || null;
    const venue = athlete.collegeTeam?.venue || null;
    const address = venue?.address || {};
    return {
        collegeName: college?.name || college?.shortName || college?.abbrev || null,
        collegeCity: address.city || null,
        collegeState: address.state || null,
        collegeCountry: normalizeCountry(address.country) || (address.city || address.state ? 'USA' : null),
    };
}

async function geocodePlace(city, state, country) {
    const key = placeKey(city, state, country);
    const store = loadCache();
    if (store.places[key]) return store.places[key];

    const nation = normalizeCountry(country);
    const countryCode = nation === 'USA' ? 'US' : nation === 'Canada' ? 'CA' : undefined;
    const queryName = city || state;
    let lat = null;
    let lng = null;
    let source = 'none';

    if (queryName) {
        try {
            const params = {
                name: queryName,
                count: 8,
                language: 'en',
                format: 'json',
            };
            if (countryCode) params.countryCode = countryCode;
            const { data } = await axios.get(GEOCODE_URL, { params, timeout: 12000 });
            const results = data.results || [];
            const stateUpper = (state || '').toUpperCase();
            let match = results.find((r) => {
                const admin = (r.admin1 || '').toUpperCase();
                if (!stateUpper) return true;
                return (
                    admin === stateUpper ||
                    admin.startsWith(stateUpper) ||
                    (r.admin1 && stateUpper.length === 2 && admin.includes(stateUpper))
                );
            });
            if (!match && results.length) match = results[0];
            if (match) {
                lat = match.latitude;
                lng = match.longitude;
                source = 'open-meteo';
            }
        } catch (error) {
            console.warn(`Geocode failed for ${key}:`, error.message);
        }
    }

    if (lat == null && state && REGION_CENTROIDS[state.toUpperCase()]) {
        const [cLat, cLng] = REGION_CENTROIDS[state.toUpperCase()];
        lat = cLat;
        lng = cLng;
        source = 'region-centroid';
    }

    const entry = { lat, lng, source };
    store.places[key] = entry;
    scheduleSave();
    await sleep(120);
    return entry;
}

/**
 * Ensure birthplace + college coords for each player id. Returns map keyed by string id.
 * @param {Array<number|string>} ids
 * @param {{ concurrency?: number }} [options]
 */
async function getBirthplacesForIds(ids, options = {}) {
    const concurrency = options.concurrency || 8;
    const store = loadCache();
    const unique = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];

    function needsEnrichment(playerId) {
        const existing = store.players[String(playerId)];
        if (!existing) return 'full';
        if (!Object.prototype.hasOwnProperty.call(existing, 'collegeName')) return 'college';
        return null;
    }

    const todo = unique
        .map((id) => ({ id, mode: needsEnrichment(id) }))
        .filter((row) => row.mode);

    if (todo.length) {
        await mapPool(todo, concurrency, async ({ id: playerId, mode }) => {
            try {
                let record = store.players[String(playerId)] ? { ...store.players[String(playerId)] } : null;

                if (mode === 'full' || !record) {
                    const athlete = await fetchAthleteBirthPlace(playerId);
                    let lat = null;
                    let lng = null;
                    let geoSource = null;
                    if (athlete.city || athlete.state) {
                        const geo = await geocodePlace(athlete.city, athlete.state, athlete.country);
                        lat = geo.lat;
                        lng = geo.lng;
                        geoSource = geo.source;
                    }
                    record = {
                        ...athlete,
                        lat,
                        lng,
                        geoSource,
                        fetchedAt: new Date().toISOString(),
                    };
                }

                const college = await fetchAthleteCollege(playerId);
                let collegeLat = null;
                let collegeLng = null;
                let collegeGeoSource = null;
                if (college.collegeCity || college.collegeState) {
                    const geo = await geocodePlace(
                        college.collegeCity,
                        college.collegeState,
                        college.collegeCountry
                    );
                    collegeLat = geo.lat;
                    collegeLng = geo.lng;
                    collegeGeoSource = geo.source;
                }

                store.players[String(playerId)] = {
                    ...record,
                    ...college,
                    collegeLat,
                    collegeLng,
                    collegeGeoSource,
                    fetchedAt: new Date().toISOString(),
                };
                scheduleSave();
            } catch (error) {
                const existing = store.players[String(playerId)] || {
                    playerId,
                    fullName: null,
                    city: null,
                    state: null,
                    country: null,
                    lat: null,
                    lng: null,
                    geoSource: null,
                };
                store.players[String(playerId)] = {
                    ...existing,
                    collegeName: existing.collegeName ?? null,
                    collegeCity: existing.collegeCity ?? null,
                    collegeState: existing.collegeState ?? null,
                    collegeCountry: existing.collegeCountry ?? null,
                    collegeLat: existing.collegeLat ?? null,
                    collegeLng: existing.collegeLng ?? null,
                    collegeGeoSource: existing.collegeGeoSource ?? null,
                    error: error.message,
                    fetchedAt: new Date().toISOString(),
                };
                scheduleSave();
            }
        });
        saveCacheNow();
    }

    const players = {};
    unique.forEach((id) => {
        players[String(id)] = store.players[String(id)] || null;
    });
    return players;
}

module.exports = {
    getBirthplacesForIds,
    loadCache,
    saveCacheNow,
    isUsa,
    normalizeCountry,
    placeKey,
    CACHE_PATH,
};
