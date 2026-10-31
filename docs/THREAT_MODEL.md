# Preliminary security and privacy threat model

**Protect:** precise location and destination, location history, identities, companion matches, personal messages, trusted-contact details, and SOS activity.

**Adversaries:** anonymous web users, abusive verified members, stolen phones/accounts, curious app moderators, compromised backend credentials, overly broad integrations, people repeatedly querying aggregate map cells to infer individual movement.

**v0.1 defenses:** no user database, no real-person matching, no chat or activity counts, no background movement collection, journey/check-in data stays local, server removes query strings from access logs, coordinates shared with external providers only for explicit user actions, route data never certified safe, report text HTML-escaped.

**v0.1 limitations:** browser device compromise can reveal local storage; hosting/proxy/CDN providers might log HTTP requests, third-party routing/POI providers can see selected coordinates, local-storage access is possible on shared browser profiles, development server has no auth or rate-limits for routes, browser local share is not cryptographically private.

**Before real user network:** audited women-only eligibility process that does not infer gender from faces, device-based credential/security policy, scoped authenticated API with RLS and backend tests, separate identity verification storage, approval/matching only with mutual consent, non-enumerable and expiring discovery requests, anti-stalking query budgets, human abuse handling, E2EE messages implemented using a reviewed protocol/library, opt-in and revocable short-lived location sharing, endpoint access tests, retention/deletion controls, legal review under applicable Indian privacy law, independent security review.

**Important:** even end-to-end encryption does not automatically hide connection metadata, IP addresses, or route overlap information. To claim developer-blind live trips, pursue a formally reviewed cryptographic and data-minimization design and validate against a threat model.
