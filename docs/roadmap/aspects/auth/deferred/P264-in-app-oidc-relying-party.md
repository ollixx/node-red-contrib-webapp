---
id: P264
title: "In-App OIDC Relying Party: ui-app.auth mode `oidc` (Authorization Code + PKCE, Cookie-Session, /auth/login|callback|logout, CSRF) — Betrieb ohne Auth-Proxy"
epic: aspects/auth
status: deferred
deferred_reason: "Nur nötig, falls proxy-loser Betrieb ein Ziel wird (Tier 1 = trusted-header deckt 1.0). Bringt Cookie-Session + CSRF auf den POST-Endpoints + Session-Store — koppelt an P210; Mock-IdP für E2E nötig. Owner-Entscheid vor Aktivierung."
dependencies: [P261]
verify: browser
spec: docs/nodes/concepts/auth.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P264 — In-App OIDC RP (deferred)

`ui-app.auth.mode = "oidc"` (Issuer, ClientId, PKCE; `openid-client`): die App
führt den Login selbst — `/auth/login|callback|logout` unter der App, Cookie-
Session (httpOnly/Secure/SameSite), **CSRF-Schutz** auf `/event` +
`/dynamic-state`, Token-Refresh, Logout. Identität mappt in denselben
ADR-0041-`user`-Contract; Guards (P262) unverändert. E2E gegen Mock-IdP
(z. B. Dex) statt Header-Fake. Session-Store-Frage explizit mit P210 entscheiden.
