(function () {
  'use strict';

  /** @type {{ id: string; venue: string; address: string; mapsQuery?: string; leaveBy: string; activity: string; nextLeg: string; lat: number; lng: number }[]} */
  var STOPS = [
    {
      id: 'stop-1',
      venue: 'Chewy and Legos House',
      address: '296 Clifton Pl #1, Brooklyn, NY 11216',
      leaveBy: '1:00 PM',
      activity: 'Beer die',
      nextLeg: 'Ride the **G** toward Brooklyn and Manhattan to the next stop.',
      lat: 40.68926,
      lng: -73.94972,
    },
    {
      id: 'stop-2',
      venue: 'Alligator Lounge',
      address: '600 Metropolitan Ave, Brooklyn, NY 11211',
      mapsQuery: 'Alligator Lounge, Williamsburg, Brooklyn',
      leaveBy: '2:30 PM',
      activity: 'Drinks and pizza',
      nextLeg: 'Ride the **L** into Manhattan to the next stop.',
      lat: 40.71418,
      lng: -73.95438,
    },
    {
      id: 'stop-3',
      venue: "Shaffer's",
      address: '151 8th Ave, New York, NY 10011',
      mapsQuery: "Shaffer's bar, Chelsea, Manhattan",
      leaveBy: '3:30 PM',
      activity: 'Drinks',
      nextLeg: 'Ride the **E** downtown toward the next stop.',
      lat: 40.74095,
      lng: -73.99789,
    },
    {
      id: 'stop-4',
      venue: 'KABIN',
      address: '300 Spring St, New York, NY 10013',
      mapsQuery: 'KABIN Norwegian bar, Tribeca, New York',
      leaveBy: '4:15 PM',
      activity: 'Norwegian drinks',
      nextLeg:
        '**Walk** to the **N** and ride to the final stop.',
      lat: 40.72489,
      lng: -74.00818,
    },
    {
      id: 'stop-5',
      venue: 'Electric Shuffle',
      address: '44 W 30th St, New York, NY 10001',
      mapsQuery: 'Electric Shuffle, Herald Square, New York',
      leaveBy: 'Leave whenever',
      activity: 'Shuffleboard',
      nextLeg: 'When you wrap up — **take the N home** (or your preferred line).',
      lat: 40.74692,
      lng: -73.98897,
    },
  ];

  var GLENN_LETTERS = [
    { letter: 'G', pillIndex: 0, stopIndex: 1 },
    { letter: 'L', pillIndex: 1, stopIndex: 2 },
    { letter: 'E', pillIndex: 2, stopIndex: 3 },
    { letter: 'N', pillIndex: 3, stopIndex: 4, role: 'ride' },
    { letter: 'N', pillIndex: 4, stopIndex: 4, role: 'home' },
  ];

  var state = {
    selectedStopIndex: 0,
    nHomeMode: false,
  };

  var map;
  var markers = [];

  /** Line geometries sliced from MTA GTFS `shapes.txt`; bundled as GeoJSON. */
  var ROUTE_GEOJSON_URL = 'data/glenn-mta-subway-legs.geojson';

  var LINE_STYLES = {
    G: { color: '#6cbe45', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' },
    L: { color: '#a7a9ac', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' },
    E: { color: '#0039a6', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' },
    N: { color: '#fccc0a', weight: 6, opacity: 0.95, lineJoin: 'round', lineCap: 'round' },
    walk: {
      color: '#5a6570',
      weight: 4,
      opacity: 0.8,
      dashArray: '10 8',
      lineJoin: 'round',
      lineCap: 'round',
    },
  };

  var pillsEl = document.getElementById('glenn-pills');
  var stepsEl = document.getElementById('glenn-steps');
  var detailEl = document.getElementById('glenn-detail');

  function googleMapsUrl(searchQuery) {
    return (
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(searchQuery)
    );
  }

  function mapsSearchQuery(stop) {
    return stop.mapsQuery != null && stop.mapsQuery !== ''
      ? stop.mapsQuery
      : stop.address;
  }

  function simpleMarkdownBold(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function getActivePillIndex() {
    var i = state.selectedStopIndex;
    if (i <= 0) return -1;
    if (i === 4 && state.nHomeMode) return 4;
    if (i === 4) return 3;
    return i - 1;
  }

  function syncPills() {
    if (!pillsEl) return;
    var active = getActivePillIndex();
    var buttons = pillsEl.querySelectorAll('button[data-pill-index]');
    for (var k = 0; k < buttons.length; k++) {
      var btn = buttons[k];
      var idx = parseInt(btn.getAttribute('data-pill-index'), 10);
      var isActive = idx === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    }
  }

  function syncSteps() {
    if (!stepsEl) return;
    var items = stepsEl.querySelectorAll('.glenn-step');
    for (var s = 0; s < items.length; s++) {
      var on = s === state.selectedStopIndex;
      items[s].classList.toggle('is-active', on);
      items[s].setAttribute('aria-current', on ? 'step' : 'false');
    }
  }

  function renderDetail() {
    if (!detailEl) return;
    var stop = STOPS[state.selectedStopIndex];
    var stepLabel = 'Stop ' + (state.selectedStopIndex + 1) + ' of ' + STOPS.length;
    var mapsLink = googleMapsUrl(mapsSearchQuery(stop));
    var nextHtml = '';
    if (state.selectedStopIndex < STOPS.length - 1) {
      nextHtml =
        '<p class="glenn-detail-next"><span class="glenn-detail-next-label">Then</span> ' +
        simpleMarkdownBold(stop.nextLeg) +
        '</p>';
    } else if (state.nHomeMode) {
      nextHtml =
        '<p class="glenn-detail-callout glenn-detail-callout--home">' +
        simpleMarkdownBold(stop.nextLeg) +
        '</p>';
    } else {
      nextHtml =
        '<p class="glenn-detail-next"><span class="glenn-detail-next-label">After</span> ' +
        simpleMarkdownBold(stop.nextLeg) +
        '</p>';
    }

    var leaveByOpenEnded = stop.leaveBy === 'Leave whenever';
    var leaveByHtml = leaveByOpenEnded
      ? '<p class="glenn-detail-leave glenn-detail-leave--open-ended">' + stop.leaveBy + '</p>'
      : '<p class="glenn-detail-leave"><span class="glenn-detail-leave-label">Leave by</span> <span class="glenn-detail-leave-time">' +
        stop.leaveBy +
        '</span></p>';

    detailEl.innerHTML =
      '<p class="glenn-detail-step-label">' +
      stepLabel +
      '</p>' +
      '<h2 class="glenn-detail-venue">' +
      stop.venue +
      '</h2>' +
      '<p class="glenn-detail-address"><a href="' +
      mapsLink +
      '" target="_blank" rel="noopener noreferrer">' +
      stop.address +
      '</a></p>' +
      leaveByHtml +
      '<p class="glenn-detail-activity">' +
      simpleMarkdownBold(stop.activity) +
      '</p>' +
      nextHtml;
  }

  function focusMapOnStop(index) {
    if (!map || !markers[index]) return;
    var m = markers[index];
    var latLng = m.getLatLng();
    map.setView(latLng, map.getZoom(), { animate: true });
    m.openPopup();
  }

  function setSelection(stopIndex, nHomeMode) {
    var max = STOPS.length - 1;
    state.selectedStopIndex = Math.max(0, Math.min(max, stopIndex));
    state.nHomeMode = !!nHomeMode && state.selectedStopIndex === max;
    syncPills();
    syncSteps();
    renderDetail();
    focusMapOnStop(state.selectedStopIndex);
  }

  function renderPills() {
    if (!pillsEl) return;
    pillsEl.innerHTML = '';
    for (var p = 0; p < GLENN_LETTERS.length; p++) {
      var spec = GLENN_LETTERS[p];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'glenn-pill glenn-pill--' + spec.letter;
      btn.setAttribute('data-pill-index', String(spec.pillIndex));
      btn.setAttribute('role', 'tab');
      btn.textContent = spec.letter;
      if (spec.role === 'home') {
        btn.classList.add('glenn-pill--second-n');
        btn.setAttribute('aria-label', 'N — head home');
        btn.setAttribute('title', 'Head home on the N');
      } else if (spec.letter === 'N' && spec.role === 'ride') {
        btn.setAttribute('aria-label', 'N — ride to the final stop');
        btn.setAttribute('title', 'Walk to the N, then ride');
      }
      btn.addEventListener('click', function (pillIndex, stopIdx, isHome) {
        return function () {
          setSelection(stopIdx, isHome);
        };
      }(spec.pillIndex, spec.stopIndex, spec.role === 'home'));
      pillsEl.appendChild(btn);
    }
  }

  function renderSteps() {
    if (!stepsEl) return;
    stepsEl.innerHTML = '';
    for (var i = 0; i < STOPS.length; i++) {
      var stop = STOPS[i];
      var li = document.createElement('li');
      li.className = 'glenn-step';
      li.setAttribute('data-stop-index', String(i));
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'glenn-step-button';
      btn.innerHTML =
        '<span class="glenn-step-num">' +
        (i + 1) +
        '</span>' +
        '<span class="glenn-step-body">' +
        '<span class="glenn-step-venue">' +
        stop.venue +
        '</span>' +
        '<span class="glenn-step-meta">' +
        stop.activity +
        '</span>' +
        '</span>';
      btn.addEventListener(
        'click',
        (function (idx) {
          return function () {
            setSelection(idx, false);
          };
        })(i)
      );
      li.appendChild(btn);
      stepsEl.appendChild(li);
    }
  }

  function geoJsonLineToLatLngs(coords) {
    return coords.map(function (c) {
      return [c[1], c[0]];
    });
  }

  function addStopMarkers(routeGroup) {
    STOPS.forEach(function (stop, index) {
      var marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 11,
        weight: 3,
        color: '#0f1c2e',
        fillColor: '#76c7c0',
        fillOpacity: 0.95,
      });
      marker.bindPopup(
        '<strong>' +
          stop.venue +
          '</strong><br>' +
          '<a href="' +
          googleMapsUrl(mapsSearchQuery(stop)) +
          '" target="_blank" rel="noopener">Open in Maps</a>',
        { maxWidth: 280 }
      );
      marker.on('click', function () {
        setSelection(index, false);
      });
      markers.push(marker);
      routeGroup.addLayer(marker);
    });
  }

  function initMap(onReady) {
    var el = document.getElementById('glenn-map');
    if (!el || typeof L === 'undefined') {
      if (typeof onReady === 'function') onReady();
      return;
    }

    map = L.map(el, {
      scrollWheelZoom: true,
      tap: true,
      tapTolerance: 20,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    var routeGroup = L.featureGroup().addTo(map);

    function afterLayers() {
      var tight =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 840px)').matches;
      map.fitBounds(routeGroup.getBounds(), {
        padding: tight ? [14, 14] : [36, 36],
        maxZoom: tight ? 13 : 14,
      });
      function invalidateSoon() {
        if (map) map.invalidateSize();
      }
      invalidateSoon();
      setTimeout(invalidateSoon, 120);
      setTimeout(invalidateSoon, 450);
      if (typeof onReady === 'function') onReady();
    }

    window.addEventListener('resize', function () {
      if (map) map.invalidateSize();
    });

    fetch(ROUTE_GEOJSON_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (gj) {
        gj.features.forEach(function (feat) {
          var line = feat.properties && feat.properties.line;
          var style = line ? LINE_STYLES[line] : null;
          if (!style || !feat.geometry || feat.geometry.type !== 'LineString') return;
          var latlngs = geoJsonLineToLatLngs(feat.geometry.coordinates);
          if (line === 'N') {
            routeGroup.addLayer(
              L.polyline(latlngs, {
                color: '#2b260a',
                weight: style.weight + 3,
                opacity: 0.35,
                lineJoin: 'round',
                lineCap: 'round',
              })
            );
          }
          routeGroup.addLayer(L.polyline(latlngs, style));
        });
        addStopMarkers(routeGroup);
        afterLayers();
      })
      .catch(function (err) {
        console.error('Could not load route GeoJSON (' + ROUTE_GEOJSON_URL + '):', err);
        addStopMarkers(routeGroup);
        afterLayers();
      });
  }

  function onKeydown(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;

    var i = state.selectedStopIndex;
    if (e.key === 'ArrowRight') {
      if (i < STOPS.length - 1) setSelection(i + 1, false);
      else if (i === STOPS.length - 1 && !state.nHomeMode) setSelection(i, true);
    } else if (e.key === 'ArrowLeft') {
      if (state.nHomeMode) setSelection(i, false);
      else if (i > 0) setSelection(i - 1, false);
    }
    e.preventDefault();
  }

  renderPills();
  renderSteps();
  initMap(function () {
    setSelection(0, false);
  });
  document.addEventListener('keydown', onKeydown);
})();
