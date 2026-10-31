# BindaasRaah — 12-week solo development plan

## Product aim

Help women understand what is and isn't known about a walking or driving journey at night; compare alternatives, find relevant help locations, optionally share trip details, and, in a later verified phase, privately coordinate companionship with consenting members.

**Not:** a taxi platform, a real-time map of individual women, gender detection from phones, or a new emergency response service.

## Release boundaries

### v0.1 — delivered in this repository
- Mobile-first PWA, sample route comparisons, key-based true road geometry, on-demand OSM service listings, local observation forms, local journey timer/check-ins, explicit sharing, emergency call shortcut, and data export/deletion.
- No identities are verified. No messages or precise trip history are held server-side. No matching. No verified safety rating.

### v0.2 — next 3–5 weeks
- Institutional pilot area, sourced streetlight inspection status and dates, clearly distinct unverified citizen reports, source auditing and correction interface.
- Prefer a licensed maps/routing/places provider with accurate terms, cost limits, monitoring and server-side rate limits.
- Accessibility tests, timeouts, offline/error state handling, user research with participants.

### v0.3 — weeks 6–8
- Real-device supervised trip checks: permission controls, explicit time-limited sharing with chosen contacts, reliable background/foreground behavior, practical breakdown support contacts.
- Sensitive features require native development and dedicated privacy review. Test inability to track another user from a shared link after expiry.

### v0.4 — weeks 9–12 (gated)
- Institutional adult women-centered invitation-only membership policy, consent-based broad-route discovery, mutual acceptance, encryption using reviewed protocols, blocking and reporting, and handling false/abusive accounts.
- No public matchmaking until security testing, moderation plan and user-research consent are in place.

## Acceptance criteria for v0.1

- App starts with no API key in demo mode and the word **DEMO** remains visible on synthetic routes.
- Walking/driving segments change example ETAs; if configured, true routes use separate provider profiles.
- Real provider failure does **not** lead to fake route labeled live.
- User cannot see a gender heatmap, another user's location, or fake verified accounts.
- Places cannot be mistaken for confirmed available responders.
- Journey start, local check-in and end work without an account.
- A report is labelled unverified and remains local. Export and deletion work.
- Screen widths 390px and 1440px should be manually checked; browser smoke not yet verified in the restricted creation environment.

## Partner data requests

1. Universities and women's organizations: user research, supported pilot corridors and moderated feedback.
2. Municipal streetlight departments: work order statuses, inspection dates and fault closure records; never complainant identities.
3. Licensed routing/places providers: travel geometry, places and lawful commercial use.
4. Roadside assistance organizations: vetted contact, coverage and current availability interfaces.
5. Government emergency services: official guidance and contact information. **No assumption of responder tracking or dispatch API access.**
6. Telecom: only lawful, privacy-protecting broad mobility statistics when available; no individual gender or device monitoring.

## Milestone checklist

- [x] Product information architecture and six screens
- [x] Offline-safe demo sample without pretending it is real navigation
- [x] Real route provider adapter and true walking/driving modes
- [x] Selected-area assistance lookup
- [x] Local report/check-in/export/delete flow
- [x] Unit tests for model, validation and provider adapter
- [ ] Device usability test including 390px screen and offline
- [ ] Real ORS key integration smoke test
- [ ] Pilot area / women-participant interviews
- [ ] Sourced streetlight observation import
- [ ] Production API security architecture
- [ ] Native Android build / tested background handling
- [ ] Privacy-reviewed verified membership
- [ ] End-to-end encrypted companion chat after audit
