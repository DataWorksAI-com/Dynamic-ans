"""
agentns.server_selection
=========================
Rank a list of agent endpoints by health, geographic proximity,
protocol preference, and load.

Algorithm
---------
For each server compute a sort key:

    (health_status_score, protocol_score, geo_distance_km, response_time_ms, load)

Lower is better.

    health_status_score  0=healthy  1=degraded  2=unknown  3=unhealthy
    protocol_score       0=preferred_protocol_available  1=not
    geo_distance_km      haversine distance from requester; inf if no location
    response_time_ms     measured round-trip; 9999 if unknown
    load                 0–100

The unhealthy servers appear at the end; they are excluded from the result
by default (``include_unhealthy=False``).
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple


# ── well-known city coordinates ─────────────────────────────────────────────────
# Used to convert city names to lat/lon for geo-scoring
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    # North America
    "boston":          (42.3601,  -71.0589),
    "new york":        (40.7128,  -74.0060),
    "new york city":   (40.7128,  -74.0060),
    "nyc":             (40.7128,  -74.0060),
    "washington":      (38.9072,  -77.0369),
    "washington dc":   (38.9072,  -77.0369),
    "chicago":         (41.8781,  -87.6298),
    "dallas":          (32.7767,  -96.7970),
    "houston":         (29.7604,  -95.3698),
    "los angeles":     (34.0522, -118.2437),
    "la":              (34.0522, -118.2437),
    "san francisco":   (37.7749, -122.4194),
    "sf":              (37.7749, -122.4194),
    "seattle":         (47.6062, -122.3321),
    "denver":          (39.7392, -104.9903),
    "atlanta":         (33.7490,  -84.3880),
    "miami":           (25.7617,  -80.1918),
    "toronto":         (43.6532,  -79.3832),
    "montreal":        (45.5017,  -73.5673),
    "vancouver":       (49.2827, -123.1207),
    # Europe
    "london":          (51.5074,   -0.1278),
    "paris":           (48.8566,    2.3522),
    "berlin":          (52.5200,   13.4050),
    "frankfurt":       (50.1109,    8.6821),
    "amsterdam":       (52.3676,    4.9041),
    "madrid":          (40.4168,   -3.7038),
    "rome":            (41.9028,   12.4964),
    "milan":           (45.4654,    9.1859),
    "zurich":          (47.3769,    8.5417),
    "stockholm":       (59.3293,   18.0686),
    "oslo":            (59.9139,   10.7522),
    "copenhagen":      (55.6761,   12.5683),
    "helsinki":        (60.1695,   24.9354),
    "warsaw":          (52.2297,   21.0122),
    "vienna":          (48.2082,   16.3738),
    "prague":          (50.0755,   14.4378),
    "dublin":          (53.3498,   -6.2603),
    "brussels":        (50.8503,    4.3517),
    # Asia-Pacific
    "tokyo":           (35.6762,  139.6503),
    "beijing":         (39.9042,  116.4074),
    "shanghai":        (31.2304,  121.4737),
    "singapore":       (1.3521,   103.8198),
    "mumbai":          (19.0760,   72.8777),
    "delhi":           (28.6139,   77.2090),
    "bangalore":       (12.9716,   77.5946),
    "sydney":          (-33.8688, 151.2093),
    "melbourne":       (-37.8136, 144.9631),
    "seoul":           (37.5665,  126.9780),
    "hong kong":       (22.3193,  114.1694),
    "dubai":           (25.2048,   55.2708),
    # South America
    "sao paulo":       (-23.5505, -46.6333),
    "buenos aires":    (-34.6037, -58.3816),
    "santiago":        (-33.4489, -70.6693),
    "bogota":          (4.7110,   -74.0721),
    "lima":            (-12.0464, -77.0428),
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _resolve_location(ctx: Dict) -> Optional[Tuple[float, float]]:
    """
    Extract (lat, lon) from requester_context.

    Accepts:
        {"location": {"latitude": 42.3, "longitude": -71.0}}
        {"location": {"city": "Boston"}}
        {"city": "Boston"}
    """
    loc = ctx.get("location") or ctx
    lat = loc.get("latitude") or loc.get("lat")
    lon = loc.get("longitude") or loc.get("lon") or loc.get("lng")

    if lat is not None and lon is not None:
        return (float(lat), float(lon))

    city = (loc.get("city") or "").lower().strip()
    if city and city in CITY_COORDS:
        return CITY_COORDS[city]

    return None


def _health_score(status: str) -> int:
    return {"healthy": 0, "degraded": 1, "unknown": 2, "unhealthy": 3}.get(status, 2)


def _geo_distance(server: Dict, requester_latlon: Optional[Tuple[float, float]]) -> float:
    if requester_latlon is None:
        return math.inf
    server_loc = server.get("location") or {}
    slat = server_loc.get("latitude") or server_loc.get("lat")
    slon = server_loc.get("longitude") or server_loc.get("lon") or server_loc.get("lng")
    if slat is None or slon is None:
        return math.inf
    return _haversine(requester_latlon[0], requester_latlon[1], float(slat), float(slon))


def rank_servers(
    servers: List[Dict],
    health_map: Dict[str, Dict],
    requester_context: Optional[Dict] = None,
    include_unhealthy: bool = False,
) -> List[Tuple[Dict, Dict]]:
    """
    Rank *servers* and return ``[(server, health), ...]`` best-first.

    Parameters
    ----------
    servers:
        List of server dicts.  Required key: ``server_id``.
        Optional keys: ``protocols``, ``region``, ``location``.

    health_map:
        ``{server_id: health_dict}`` — output of health_checker.check_agent_health.

    requester_context:
        Optional dict with ``location`` and/or ``protocols`` preferences.

    include_unhealthy:
        If False (default), servers with status ``"unhealthy"`` are excluded
        from the ranked result (but the caller can still fall back to them).
    """
    ctx = requester_context or {}
    preferred = ctx.get("protocols") or []
    requester_latlon = _resolve_location(ctx)

    scored: List[Tuple] = []
    for server in servers:
        sid   = server["server_id"]
        health = health_map.get(sid, {"status": "unknown", "load": 50.0, "response_time_ms": 9999.0})
        status = health.get("status", "unknown")

        if not include_unhealthy and status == "unhealthy":
            continue

        # Protocol score — 0 if any preferred protocol is available
        server_protos = [p.upper() for p in (server.get("protocols") or [])]
        preferred_upper = [p.upper() for p in preferred]
        proto_score = 0 if any(p in server_protos for p in preferred_upper) else 1

        sort_key = (
            _health_score(status),
            proto_score,
            _geo_distance(server, requester_latlon),
            health.get("response_time_ms", 9999.0),
            health.get("load", 50.0),
        )
        scored.append((sort_key, server, health))

    scored.sort(key=lambda x: x[0])
    return [(s, h) for _, s, h in scored]


def select_protocol(server_protocols: List[str], preferred: List[str]) -> str:
    """
    Pick the best protocol from *server_protocols* given *preferred* order.
    Falls back to the first server protocol, or "http".
    """
    upper_server = [p.upper() for p in (server_protocols or [])]
    for p in preferred:
        if p.upper() in upper_server:
            return p.upper()
    return server_protocols[0] if server_protocols else "http"


def calculate_ttl(health: Dict) -> int:
    """
    Return a TTL (seconds) based on health status.

    healthy  → 60s   (cache for a minute)
    degraded → 15s   (recheck soon)
    unknown  → 10s
    unhealthy→  5s   (emergency; recheck almost immediately)
    """
    ttl_map = {"healthy": 60, "degraded": 15, "unknown": 10, "unhealthy": 5}
    return ttl_map.get(health.get("status", "unknown"), 10)
