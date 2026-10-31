# BindaasRaah — two-day demo completion checklist

## Already implemented in v0.2

- [x] Mobile-friendly responsive PWA running on macOS with Python, no dependencies to install.
- [x] Actual interactive OpenStreetMap map on load when online and Leaflet CDN loads.
- [x] Origin/destination selection by explicit place search and map clicks.
- [x] Walking/driving road directions via keyless, rate-limited Valhalla public demo or ORS key.
- [x] Actual OSM listed help services near chosen start or along selected real route.
- [x] Optional mapped road lighting tags with explicit limited coverage warning.
- [x] Journey timer/check-in and manual trusted-contact sharing; local data export/deletion.
- [x] Rate-limited upstream requests, source labels, no bogus gender counts or safety grades.
- [x] Mock-provider unit tests and local HTTP smoke checks.

## On your Mac, day 1 — must physically verify

- [ ] Extract v0.2, stop v0.1 server, start v0.2.
- [ ] Confirm OSM map tiles appear and both pins are visible.
- [ ] Search two real locations in Delhi/Gurugram; confirm Nominatim results.
- [ ] Fetch a driving and walking route. If Valhalla demo fails, set your ORS_API_KEY and retry.
- [ ] Open Find assistance and query real listings along route. Check at least two results manually against a second source.
- [ ] Try mapped lighting tags; ensure absence of data shows unknown, not a false 'dark' rating.
- [ ] Test denied geolocation and no-internet states.

## On your Mac, day 2 — ready for a small demonstration

- [ ] Test narrow pilot corridor (e.g. campus gate to metro) on a real phone over a secure HTTPS testing deployment; raw LAN HTTP won't reliably support GPS/PWA.
- [ ] Verify provider quotas and legal terms for your expected users.
- [ ] Test touch target usability, browser back, keyboard, small screen, and PWA install behavior.
- [ ] Confirm the demo cannot reveal other users' movement (currently there is no other-user database).
- [ ] Explain honestly: map and route *real*, lighting condition / road crowds / staff readiness *not verified*.
- [ ] Document incidents, timeouts, UX problems; fix before inviting testers.

## Not feasible to responsibly promise in two days

Production-ready women-only identity verification; live men/women smartphone counts; integrations with police/telecom/government; verified service staff availability; a fully audited encrypted chat, location sharing and abuse-handling system; verified safety scoring; real emergency response, or true background alerting. These require partnerships, consent, data agreements, real-user testing and security review.
