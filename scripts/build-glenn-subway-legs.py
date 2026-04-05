#!/usr/bin/env python3
"""
Rebuild data/glenn-mta-subway-legs.geojson from the official MTA NYCT GTFS feed.

1. Download: https://web.mta.info/developers/data/nyct/subway/google_transit.zip
2. Run from repo root: python3 scripts/build-glenn-subway-legs.py /path/to/google_transit.zip

Output: data/glenn-mta-subway-legs.geojson

Subway legs are slices of shapes.txt between closest points to each crawl leg.
The walk segment (KABIN → Prince St) is approximate and not from GTFS.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile

OUTPUT = "data/glenn-mta-subway-legs.geojson"
FEED_URL = "https://web.mta.info/developers/data/nyct/subway/google_transit.zip"

STOPS = {
    "g0": (40.68926, -73.94972),
    "g1": (40.71418, -73.95438),
    "l0": (40.71418, -73.95438),
    "l1": (40.74095, -73.99789),
    "e0": (40.74095, -73.99789),
    "e1": (40.72489, -74.00818),
}
PRINCE = (40.724329, -73.997702)
HERALD = (40.749567, -73.987950)  # 34 St–Herald Sq (N/Q/R/W), shapes end here
ELECTRIC_SHUFFLE = (40.74692, -73.98897)
KABIN = (40.72489, -74.00818)

# Dominant shape_id per route from trips.txt (same geometry either direction for these slices)
SHAPE_IDS = {"G": "G..S16R", "L": "L..S01R", "E": "E..S69R", "N": "N..N34R"}


def load_shape(z: zipfile.ZipFile, sid: str) -> list[tuple[float, float]]:
    rows: list[tuple[int, float, float]] = []
    with z.open("shapes.txt") as f:
        for row in csv.DictReader(io.TextIOWrapper(f)):
            if row["shape_id"] == sid:
                rows.append(
                    (
                        int(row["shape_pt_sequence"]),
                        float(row["shape_pt_lat"]),
                        float(row["shape_pt_lon"]),
                    )
                )
    rows.sort(key=lambda x: x[0])
    return [(lat, lng) for _, lat, lng in rows]


def closest_idx(pts: list[tuple[float, float]], lat: float, lng: float) -> int:
    best_i, best_d = 0, 1e18
    for i, (plat, plng) in enumerate(pts):
        d = (plat - lat) ** 2 + (plng - lng) ** 2
        if d < best_d:
            best_d, best_i = d, i
    return best_i


def slice_between(
    pts: list[tuple[float, float]], a: tuple[float, float], b: tuple[float, float]
) -> list[tuple[float, float]]:
    ia, ib = closest_idx(pts, *a), closest_idx(pts, *b)
    if ia <= ib:
        return pts[ia : ib + 1]
    return list(reversed(pts[ib : ia + 1]))


def to_geojson_line(latlngs: list[tuple[float, float]]) -> list[list[float]]:
    return [[lng, lat] for lat, lng in latlngs]


def main() -> None:
    zpath = sys.argv[1] if len(sys.argv) > 1 else "google_transit.zip"
    with zipfile.ZipFile(zpath) as z:
        features: list[dict] = []

        pts = load_shape(z, SHAPE_IDS["G"])
        seg = slice_between(pts, STOPS["g0"], STOPS["g1"])
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "line": "G",
                    "shape_id": SHAPE_IDS["G"],
                    "source": "MTA GTFS shapes.txt",
                },
                "geometry": {"type": "LineString", "coordinates": to_geojson_line(seg)},
            }
        )

        pts = load_shape(z, SHAPE_IDS["L"])
        seg = slice_between(pts, STOPS["l0"], STOPS["l1"])
        features.append(
            {
                "type": "Feature",
                "properties": {"line": "L", "shape_id": SHAPE_IDS["L"], "source": "MTA GTFS shapes.txt"},
                "geometry": {"type": "LineString", "coordinates": to_geojson_line(seg)},
            }
        )

        pts = load_shape(z, SHAPE_IDS["E"])
        seg = slice_between(pts, STOPS["e0"], STOPS["e1"])
        features.append(
            {
                "type": "Feature",
                "properties": {"line": "E", "shape_id": SHAPE_IDS["E"], "source": "MTA GTFS shapes.txt"},
                "geometry": {"type": "LineString", "coordinates": to_geojson_line(seg)},
            }
        )

        walk = [KABIN, (40.7250, -74.0055), (40.72445, -74.0012), PRINCE]
        features.append(
            {
                "type": "Feature",
                "properties": {"line": "walk", "note": "Approximate walking path (not MTA data)"},
                "geometry": {"type": "LineString", "coordinates": to_geojson_line(walk)},
            }
        )

        pts = load_shape(z, SHAPE_IDS["N"])
        seg = slice_between(pts, PRINCE, HERALD)
        # Short surface link from station to venue (not in GTFS)
        if seg and (abs(seg[-1][0] - ELECTRIC_SHUFFLE[0]) > 1e-4 or abs(seg[-1][1] - ELECTRIC_SHUFFLE[1]) > 1e-4):
            seg = seg + [ELECTRIC_SHUFFLE]
        features.append(
            {
                "type": "Feature",
                "properties": {"line": "N", "shape_id": SHAPE_IDS["N"], "source": "MTA GTFS shapes.txt"},
                "geometry": {"type": "LineString", "coordinates": to_geojson_line(seg)},
            }
        )

    fc = {
        "type": "FeatureCollection",
        "name": "glenn-day-mta-legs",
        "properties": {
            "attribution": "Subway LineString geometries excerpted from MTA GTFS shapes.txt.",
            "feed": FEED_URL,
        },
        "features": features,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2)
        f.write("\n")
    print("Wrote", OUTPUT)


if __name__ == "__main__":
    main()
