# Data provenance and evidence limitations — v0.2

| Data | Provider | Request mode | What it establishes | What it cannot establish |
|---|---|---|---|---|
| Map tiles | OSMF standard map tiles | Interactive viewport only | Geographical base map | Current walkability, lighting, safety |
| Geocoded places | Public Nominatim | Explicit search; global 1.2-second throttle | Search-indexed OSM place coordinates | Verified business identity or safety |
| Real road route | FOSSGIS Valhalla public demo | Explicit route search; global 4-second throttle | Best-effort route geometry and estimated travel time | Live traffic, crime risk, women's activity, guaranteed passability |
| Alternative real routing | ORS API with user's key | Explicit search | Provider route geometry; alternatives where offered | Actual safety or certainty of road condition |
| Listed help places | OSM Overpass | Explicit search near start or sampled route; 60-second throttle | Community database entries for medical, fuel, police, pharmacy, repair | Whether the listing is open, staffed, genuine, or able to respond |
| Street lighting | OSM `lit` tags on nearby mapped road ways | Explicit query near 1–4 sampled route points; 90-second throttle | Which *sampled mapped ways* have tagged lighting values | Complete route coverage or whether lamps actually function now |
| Road reports | Local user text only | Only on explicit submit | User's unverified observation | An independently confirmed incident |
| Crowds, genders, police/doctor live positions | Unavailable | No request | Nothing | Any real-time road-level person counts or status |
| Women's-only matching and chat | Not implemented | No request | Nothing | Verified membership, protected messaging or live matching |

When upstream provider fails, the UI explicitly says so and falls back to DEMO cards; it does not launder fictional geometry into the real map.

Public providers are not production services. Applicable terms: [OSMF Tile Policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim Policy](https://operations.osmfoundation.org/policies/nominatim/), [Valhalla demo fair use](https://github.com/valhalla/valhalla#demo-server), [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
