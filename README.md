# BindaasRaah v0.2 — Real-map navigation beta

**Ghoomo Bindaas. Travel informed.** A mobile-friendly, installable **progressive web app** for night-journey preparation, based on real map tiles and optionally live routing/place data.

> **Not a safety-certified route planner, emergency service, or functioning women-only social network.** Streetlight conditions, people activity, gender counts, and staff availability are generally **unknown**. Do not use an unverified route recommendation as proof of safety. For an immediate emergency in India, call **112**.

## Run on your Mac in two commands

Unzip the file to Downloads, then run:

```bash
cd bindaasraah
python3 server.py
```

Open **http://localhost:8765**.

**If v0.1 is still running on port 8765:** go to its Terminal window and press **Control+C** first. Alternatively start v0.2 on another port:

```bash
PORT=8766 python3 server.py
```

Then visit **http://localhost:8766**.

There is **no npm install**, Python dependency install, or API key required just to run the app.

## What's new in v0.2

| Feature | Implemented | Data boundary |
|---|---|---|
| **Always-visible real map** | Leaflet and OpenStreetMap map tiles; select origin/destination by tapping map | Requires internet; tiles reflect the geographic map, not live safety |
| **Search any place** | Explicit search of OSM Nominatim via server; results can be selected as origin/destination | No autocomplete, global server throttle ≤1 request/sec, source displayed |
| **Real walking/driving directions** | Keyless Valhalla public demo backend; ORS with optional API key | Valhalla public server is best-effort and may provide only one route, rate limited |
| **Route-based assistance search** | Request OSM facilities around selected real route samples | Hospital, police, fuel, pharmacy, car repair; not verified open/staffed |
| **Mapped streetlight attributes** | Explicit on-demand OSM `lit` tag sampling near route points | Sparse tags, no inspection of whether any actual lamp works now |
| **Privacy-preserving basic journey UI** | Local timer/check-ins and user-controlled text sharing | No automatic monitoring, dispatch, or backend route history |
| **Issue reporting** | Unverified practice reports saved locally on device | No public reports, no municipal integration |
| **Companion Circle** | Future module screen only | No verification, matchmaking, or chat is active |

**What is genuinely live?** OpenStreetMap's map tiles, place searches, and provider-generated *street-network directions*, when internet and the upstream demo providers work. No fabricated road-activity data is inserted into the live results. Fictional example routes are labeled **DEMO ONLY** and *never drawn as real roads*.

## Real route instructions

1. On **Explore**, pick preset origin and destination, or search for locations using **Search** (explicit click) and select one result.
2. You can also tap the map to set the starting point. Press **Pick: Start** to switch to **Pick: Destination**, then tap the map.
3. Choose **Walking** or **Driving** and tap **Explore route options**.
4. The app contacts either:
   - **FOSSGIS Valhalla demo server** (`valhalla1.openstreetmap.de`) automatically, if no key is configured; or
   - **OpenRouteService**, if you set `ORS_API_KEY` on the server.
5. The map draws *only returned provider geometry*. Conditions are **unknown**. If the provider fails, the app switches to **clearly labeled fictional demo cards**; it never draws a synthetic path over the live map.

### Optional OpenRouteService key for more reliable demos

Get your own key at https://openrouteservice.org/dev/ and enter it only in your local Terminal:

```bash
export ORS_API_KEY='your_api_key_here'
python3 server.py
```

This improves control over the routing backend and may return alternatives. Providers can legitimately return only one valid route. Neither provider is a verified night-safety navigation service.

### Assistance *along the route*

After obtaining a **live route**:

1. Open **Find assistance**.
2. Tap **Find services along selected route** to search around a small number of route samples, or **Search real nearby services** for the selected starting point.
3. Results are actual OSM community **listings**, and can be opened on OpenStreetMap. The app does **not** confirm that listed businesses are operating or available now. Call the service to verify before relying on it.

Public Overpass servers are limited, can time out, and are shared community infrastructure. This server enforces a cooldown and an in-memory cache.

### Sampled map lighting tags

On **Explore**, after getting a real route, tap **Check mapped lighting tags**. The app queries a handful of OSM road segments near sampled route points for mapped `lit=yes` / `lit=no` or related tags. This indicates only **what some OpenStreetMap contributors have mapped**, NOT actual operational streetlights, complete route coverage, nor the likelihood of harm. An absence of tags means **unknown**, never unlit.

## Local privacy and safety boundaries

- No login or identity verification yet; **do not advertise this as a women-only verified community**.
- No public women/person maps, exact counts, precise live social location, companion invitations, or chat.
- No background tracking; a selected device location is memory-only. Local journey/check-in records and issue reports remain in browser localStorage with export and erase controls.
- Map tiles are fetched from OpenStreetMap and will reveal the **visible map area** to its servers. Routes share selected endpoints with the routing provider; explicit place or lighting lookup shares limited coordinates with OSM services. The app does not persist these requests to a file, but upstream services have their own privacy policies.
- Local runs bind to `127.0.0.1`. Render runs bind to `0.0.0.0` behind the hosting provider’s HTTPS proxy. This is a public educational beta, not production emergency infrastructure. Free hosting can sleep when idle.
- For any real-user pilot, independent safety/privacy review and women participants' informed evaluation are necessary.

## API endpoints

- `GET /api/status` — selected routing provider, feature status.
- `GET /api/geocode?q=...` — explicit place search, rate-limited and cached.
- `GET /api/routes?origin_lat=...&origin_lon=...&dest_lat=...&dest_lon=...&mode=walk|drive` — actual route geometry; on failure returns an error, never synthetic route as live.
- `GET /api/places?origin_lat=...&origin_lon=...` — OSM assistance listings around start.
- `POST /api/route-places` JSON `{ "points": [[lat,lon], [lat,lon]] }` — OSM assistance listings around 1–4 selected route sample points.
- `POST /api/route-lighting` same JSON shape — raw mapped OSM `lit` tag counts near route samples.

All coordinate input is validated; queries are restricted in scope and rate limited. The development server deliberately does not log route coordinates or search phrases to stdout.

## Test the app

```bash
python3 -m unittest discover -s tests -v
node --test tests/model.test.mjs
node --check web/app.js
```

Python/Node unit tests use mocked upstream responses and require no internet. The static site and local HTTP endpoints were also tested. Provider availability and browser behavior must also be checked against the deployed service; unit tests do not establish upstream availability.

## Dependencies, policies and production limits

- Leaflet UI is loaded from an external CDN; map tiles from `tile.openstreetmap.org`, under [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Interactive viewing is allowed within terms; bulk or offline tile downloading is prohibited. Production scale should use licensed tile infrastructure.
- [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) forbids client-side autocomplete and limits requests to one per second; we provide explicit search only and throttle server-wide.
- [FOSSGIS Valhalla public demo](https://github.com/valhalla/valhalla#demo-server) is for fair-use experimentation, not a guaranteed commercial backend.
- [OpenRouteService API](https://openrouteservice.org/dev/) requires your own key and has request/profile limits.
- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) is public, best-effort, and rate-limited here. Do not scale a consumer app against public Overpass endpoints.
- All OSM-derived data is credited to **© OpenStreetMap contributors (ODbL)**.

**Next:** See [48_HOUR_PLAN.md](docs/48_HOUR_PLAN.md) for what is demonstrable within two days and what remains for the full BindaasRaah women-only release. MIT software license in `LICENSE`.

## GitHub & public deployment

Use the GitHub Actions test workflow and Render Blueprint supplied in this package. See [Publishing guide](docs/PUBLISH.md). The app must be deployed as a Python **web service**, not as a GitHub Pages static site, because `/api/*` needs the backend. Do not put API keys in the repository.

## Hosting privacy

The application does not write journey histories to the backend. The hosting provider and upstream map/data services may retain network and access logs under their own policies. Do not interpret local-only journey storage as a promise of anonymous network access.
