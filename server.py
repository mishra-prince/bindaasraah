"""BindaasRaah v0.2 local research server (stdlib only).

Routing: OpenRouteService when ORS_API_KEY set, otherwise rate-limited public
Valhalla *demo* service. Public demo servers are NOT production infrastructure.
Search: Nominatim ONLY after an explicit search click; global <= 1 req/sec.
POIs: Overpass ONLY after an explicit click. Locations are not persisted.
No users/accounts/chats, no claims that a route is safe or help is available.
"""
import json
import math
import os
import sys
import time
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'web'
ORS_KEY = os.getenv('ORS_API_KEY', '').strip()
ORS_URL = 'https://api.openrouteservice.org/v2/directions'
VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'
NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
USER_AGENT = 'BindaasRaah/0.2 (local educational navigation beta; +https://github.com/mishra-prince)'
LOCK = threading.Lock()
CACHE = {}  # RAM only, no personal location histories on disk
LAST = {'geocode': None, 'places': None, 'routes': None, 'lighting': None}


def parse_number(value, lower, upper, label):
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'Invalid {label}')
    if not math.isfinite(result) or not lower <= result <= upper:
        raise ValueError(f'{label} must be between {lower} and {upper}')
    return result


def coordinates(params, prefix):
    return (
        parse_number(params.get(prefix + '_lat', [None])[0], -90, 90, prefix + ' latitude'),
        parse_number(params.get(prefix + '_lon', [None])[0], -180, 180, prefix + ' longitude'),
    )


def rate_limit(kind, seconds):
    with LOCK:
        now = time.monotonic()
        if LAST[kind] is not None and now - LAST[kind] < seconds:
            raise RuntimeError(f'{kind.title()} service cooling down. Retry shortly.')
        LAST[kind] = now


def cached(key, ttl):
    with LOCK:
        item = CACHE.get(key)
        if item and time.monotonic() - item[0] < ttl:
            return item[1]
    return None


def cache_put(key, value):
    with LOCK:
        if len(CACHE) > 90:
            CACHE.clear()
        CACHE[key] = (time.monotonic(), value)


def safe_json_request(url, payload=None, extra_headers=None, timeout=18):
    headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json', **(extra_headers or {})}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, data=data, headers=headers, method='POST' if data else 'GET')
    with urllib.request.urlopen(request, timeout=timeout) as resp:
        if int(resp.headers.get('Content-Length', '0') or 0) > 4_000_000:
            raise ValueError('Provider response too large')
        raw = resp.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError('Provider response too large')
        return json.loads(raw)


def decode_polyline6(shape):
    if not isinstance(shape, str) or len(shape) > 500_000:
        raise ValueError('Invalid route geometry')
    index, lat, lon, points = 0, 0, 0, []
    while index < len(shape):
        deltas = []
        for _ in range(2):
            result, shift = 0, 0
            while True:
                if index >= len(shape) or shift > 40:
                    raise ValueError('Truncated route geometry')
                byte = ord(shape[index]) - 63
                index += 1
                if byte < 0 or byte > 63:
                    raise ValueError('Invalid route geometry character')
                result |= (byte & 0x1f) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lon += deltas[1]
        if not (-90 <= lat/1e6 <= 90 and -180 <= lon/1e6 <= 180):
            raise ValueError('Route geometry outside coordinates')
        points.append([lat / 1e6, lon / 1e6])
        if len(points) > 50_000:
            raise ValueError('Route geometry too long')
    return points


def route_label(index, points, mins, km, source, demo_server=False):
    return {
        'id': f'live-{index}', 'title': f'Route {chr(65 + index)}',
        'durationMin': max(1, round(mins)), 'distanceKm': round(km, 2),
        'points': points, 'source': source, 'sourceType': 'live',
        'fetchedAt': datetime.now(timezone.utc).isoformat(),
        'publicDemoServer': demo_server,
        'evidence': [], 'warnings': [
            'Streetlight condition is unknown.',
            'Numbers of people and gender activity are unknown.',
            'Nearby services are listings, not verified operational assistance.',
        ],
    }


def get_routes(params):
    origin = coordinates(params, 'origin')
    dest = coordinates(params, 'dest')
    mode = params.get('mode', ['walk'])[0]
    if mode not in ('walk', 'drive'):
        raise ValueError('Mode must be walk or drive')
    if math.hypot(origin[0] - dest[0], origin[1] - dest[1]) < .00001:
        raise ValueError('Origin and destination are too close')
    if math.hypot(origin[0] - dest[0], origin[1] - dest[1]) > 2.5:
        raise ValueError('Routes over this distance are unsupported in the local beta')
    provider = 'ors' if ORS_KEY else 'valhalla'
    key = ('route', provider, mode, *(round(v, 5) for v in (*origin, *dest)))
    result = cached(key, 600)
    if result:
        return {**result, 'cached': True}
    rate_limit('routes', 2 if ORS_KEY else 4)
    if ORS_KEY:
        response = safe_json_request(f'{ORS_URL}/{"foot-walking" if mode == "walk" else "driving-car"}/geojson', {
            'coordinates': [[origin[1], origin[0]], [dest[1], dest[0]]],
            'alternative_routes': {'target_count': 3, 'weight_factor': 1.5, 'share_factor': .65},
            'instructions': False,
        }, {'Authorization': ORS_KEY})
        routes = []
        for i, feature in enumerate(response.get('features', [])[:3]):
            coords = feature.get('geometry', {}).get('coordinates', [])
            summary = feature.get('properties', {}).get('summary', {})
            if len(coords) < 2 or not isinstance(summary.get('distance'), (int, float)):
                continue
            points = [[c[1], c[0]] for c in coords if isinstance(c, list) and len(c) >= 2]
            routes.append(route_label(i, points, summary.get('duration', 0)/60, summary['distance']/1000, 'OpenRouteService / OpenStreetMap'))
    else:
        # Public FOSSGIS Valhalla demo: fair-use for small LOCAL tests only.
        response = safe_json_request(VALHALLA_URL, {
            'locations': [{'lat': origin[0], 'lon': origin[1]}, {'lat': dest[0], 'lon': dest[1]}],
            'costing': 'pedestrian' if mode == 'walk' else 'auto',
            'units': 'km', 'language': 'en-US',
        }, {'X-Client-Id': 'bindaasraah-local-beta'})
        trip = response.get('trip', {})
        summary = trip.get('summary', {})
        legs = trip.get('legs', [])
        points = []
        for leg in legs:
            segment = decode_polyline6(leg.get('shape', ''))
            points.extend(segment[1:] if points else segment)
        if len(points) < 2 or not isinstance(summary.get('length'), (int, float)):
            raise RuntimeError('Routing provider returned no usable road geometry')
        routes = [route_label(0, points, summary.get('time', 0)/60, summary['length'], 'FOSSGIS Valhalla demo / OpenStreetMap', demo_server=True)]
    if not routes:
        raise RuntimeError('Routing provider returned no usable route')
    result = {'routes': routes, 'dataMode': 'live',
              'notice': 'Real street-network directions. Lighting, crowds and safety are NOT verified.',
              'routingProvider': 'OpenRouteService' if ORS_KEY else 'FOSSGIS Valhalla public demo'}
    cache_put(key, result)
    return result


def get_geocode(params):
    term = params.get('q', [''])[0].strip()
    if len(term) < 4 or len(term) > 120:
        raise ValueError('Enter a place name between 4 and 120 characters')
    key = ('geo', term.casefold())
    found = cached(key, 86400)
    if found is not None:
        return {'results': found, 'cached': True}
    rate_limit('geocode', 1.2)
    url = NOMINATIM_URL + '?' + urllib.parse.urlencode({'q': term, 'format': 'jsonv2', 'limit': '5', 'addressdetails': '0'})
    response = safe_json_request(url)
    results = []
    for row in response[:5]:
        try:
            lat = parse_number(row.get('lat'), -90, 90, 'latitude')
            lon = parse_number(row.get('lon'), -180, 180, 'longitude')
        except ValueError:
            continue
        results.append({'name': str(row.get('display_name', 'Unnamed place'))[:150], 'lat': lat, 'lon': lon, 'source': 'OpenStreetMap Nominatim'})
    cache_put(key, results)
    return {'results': results, 'cached': False}


def build_overpass_query(points, radius=700):
    if not 1 <= len(points) <= 4:
        raise ValueError('Select between 1 and 4 route samples')
    parts = []
    for lat, lon in points:
        lat = parse_number(lat, -90, 90, 'latitude')
        lon = parse_number(lon, -180, 180, 'longitude')
        area = f'around:{radius},{lat:.6f},{lon:.6f}'
        parts.append(f'nwr({area})[amenity~"^(hospital|police|fuel|pharmacy|clinic)$"]')
        parts.append(f'nwr({area})[shop="car_repair"]')
    return '[out:json][timeout:18];(' + ';'.join(parts) + ';);out center 80;'


def places_from_overpass(response):
    places, seen = [], set()
    for item in response.get('elements', [])[:150]:
        ident = f'{item.get("type", "")}{item.get("id", "")}'
        if ident in seen:
            continue
        tags = item.get('tags') or {}
        loc = item.get('center') or item
        if not isinstance(loc.get('lat'), (float, int)) or not isinstance(loc.get('lon'), (float, int)):
            continue
        seen.add(ident)
        category = tags.get('amenity') or tags.get('shop') or 'service'
        places.append({
            'id': ident, 'name': str(tags.get('name') or category.replace('_', ' ').title())[:90],
            'category': category, 'lat': loc['lat'], 'lon': loc['lon'],
            'hours': str(tags.get('opening_hours', 'Unknown / not verified'))[:85],
            'phone': str(tags.get('contact:phone') or tags.get('phone') or '')[:40],
            'source': 'OpenStreetMap community listing — not verified currently open or staffed',
        })
        if len(places) >= 45:
            break
    return places


def overpass_places(points):
    key = ('poi', tuple((round(a, 3), round(b, 3)) for a, b in points))
    found = cached(key, 900)
    if found is not None:
        return {'places': found, 'dataMode': 'live', 'cached': True}
    rate_limit('places', 60)
    query = build_overpass_query(points)
    req = urllib.request.Request(OVERPASS_URL, data=urllib.parse.urlencode({'data': query}).encode(), headers={
        'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json',
    }, method='POST')
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = resp.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('Place provider response too large')
        response = json.loads(raw)
    places = places_from_overpass(response)
    cache_put(key, places)
    return {'places': places, 'dataMode': 'live', 'cached': False}



def get_lighting(points):
    """Look up OSM lit tags near a *few* sampled route points.

    This is NEVER a statement about current streetlight operation or full route
    coverage. Unknown is the default, including when mapping is sparse.
    """
    key = ('lighting', tuple((round(a, 3), round(b, 3)) for a, b in points))
    previous = cached(key, 900)
    if previous is not None:
        return {**previous, 'cached': True}
    rate_limit('lighting', 90)
    statements = []
    for lat, lon in points:
        statements.append(f'way(around:110,{lat:.6f},{lon:.6f})[highway][lit]')
    query = '[out:json][timeout:15];(' + ';'.join(statements) + ';);out tags 80;'
    req = urllib.request.Request(OVERPASS_URL,
        data=urllib.parse.urlencode({'data': query}).encode(),
        headers={'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
        method='POST')
    with urllib.request.urlopen(req, timeout=23) as response:
        raw = response.read(800_001)
        if len(raw) > 800_000:
            raise ValueError('Lighting data response too large')
        result = json.loads(raw)
    observed = {}
    for item in result.get('elements', [])[:100]:
        if item.get('id') in observed:
            continue
        lit = (item.get('tags') or {}).get('lit', '').strip().lower()
        if lit in ('yes', 'no', 'automatic', 'limited', '24/7'):
            observed[item.get('id')] = lit
    counts = {value: sum(x == value for x in observed.values()) for value in ('yes', 'no', 'automatic', 'limited', '24/7')}
    output = {'source': 'OpenStreetMap mapped road lit tags, sampled only', 'taggedWayCount': len(observed),
              'tagCounts': counts, 'status': 'mapped-tags-only',
              'warning': 'These are incomplete mapped tags near route samples, NOT a current streetlight inspection, operational status, or measure of route safety.'}
    cache_put(key, output)
    return output


def get_places(params):
    return overpass_places([coordinates(params, 'origin')])


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/'):
            try:
                params = urllib.parse.parse_qs(parsed.query)
                if parsed.path == '/api/health':
                    data = {'status': 'ok', 'service': 'bindaasraah'}
                elif parsed.path == '/api/status':
                    data = {'routingConfigured': True, 'routingProvider': 'OpenRouteService' if ORS_KEY else 'Valhalla public demo',
                            'routingKeyRequired': False, 'placesAvailableOnDemand': True,
                            'storesJourneyData': False, 'storesChats': False}
                elif parsed.path == '/api/routes':
                    data = get_routes(params)
                elif parsed.path == '/api/geocode':
                    data = get_geocode(params)
                elif parsed.path == '/api/places':
                    data = get_places(params)
                else:
                    return self._json(404, {'error': 'Unknown endpoint'})
                return self._json(200, data)
            except ValueError as e:
                return self._json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                return self._json(502, {'error': f'Data provider unavailable (HTTP {e.code}); nothing invented.'})
            except (urllib.error.URLError, TimeoutError):
                return self._json(502, {'error': 'External data provider unavailable; nothing invented.'})
            except Exception as e:
                return self._json(503, {'error': str(e)[:180]})
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path not in ('/api/route-places','/api/route-lighting'):
            return self._json(404, {'error': 'Unknown endpoint'})
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n < 2 or n > 2048:
                raise ValueError('Invalid request size')
            request = json.loads(self.rfile.read(n))
            if not isinstance(request, dict):
                raise ValueError('JSON object required')
            points = request.get('points', [])
            if not isinstance(points, list) or not 1 <= len(points) <= 4:
                raise ValueError('One to four route sample coordinates required')
            safe = []
            for p in points:
                if not isinstance(p, list) or len(p) != 2:
                    raise ValueError('Invalid route sample')
                safe.append((parse_number(p[0], -90, 90, 'latitude'), parse_number(p[1], -180, 180, 'longitude')))
            if urllib.parse.urlparse(self.path).path == '/api/route-lighting':
                return self._json(200, get_lighting(safe))
            return self._json(200, overpass_places(safe))
        except ValueError as e:
            return self._json(400, {'error': str(e)})
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            return self._json(502, {'error': 'Place data provider unavailable; nothing invented.'})
        except Exception as e:
            return self._json(503, {'error': str(e)[:180]})

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        # Cross-origin map tiles REQUIRE a valid Referer; strict-origin still hides full journeys.
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'public, max-age=60')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def _json(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # Never log user-supplied search terms, query-string coordinates or request bodies.
        path = urllib.parse.urlsplit(self.path).path
        sys.stderr.write(f'{self.client_address[0]} {path} {args[-1] if args else ""}\n')


if __name__ == '__main__':
    port = int(os.getenv('PORT', '8765'))
    provider = 'OpenRouteService' if ORS_KEY else 'Valhalla public demo (fair-use)'
    print(f'BindaasRaah v0.2 http://localhost:{port} | Routing: {provider}', flush=True)
    host = os.getenv('BIND_HOST', '0.0.0.0' if os.getenv('RENDER') else '127.0.0.1')
    ThreadingHTTPServer((host, port), Handler).serve_forever()
