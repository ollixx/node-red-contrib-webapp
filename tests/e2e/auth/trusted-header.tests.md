# Auth: trusted-header — test catalogue (P261, ADR 0041 §2/§3)

Location: `tests/e2e/auth/trusted-header.spec.ts`

## Reference pattern: faking identity (no IdP in the test loop)

The trusted-header source reads identity from reverse-proxy headers, so **the
test IS the proxy** — it sets the identity headers itself:

- **API-level** (endpoint-class matrix):
  `request.get(url, { headers: { "X-Forwarded-User": "alice" } })`
- **Browser-level** (rendered bindings, SSE):
  `browser.newContext({ extraHTTPHeaders: { "X-Forwarded-User": "alice" } })` —
  every request of that context (page, EventSource, POSTs) carries the identity,
  exactly like a browser behind an authenticating proxy.
- **Two identities = two browser contexts** with different headers; two
  *devices* of the same user = two contexts with the *same* headers.

This is the documented pattern for every later auth spec (P262 route/dialog
guards, P263 per-user state). An IdP only enters the loop with P264 (OIDC).

## Tests

| Test | Goal |
|---|---|
| page GET — 401 without identity header, content with it | Guard on the page endpoint: no header → HTTP 401; with `X-Forwarded-User` → 200 + page HTML. |
| SPA fallback GET /webapp/:appId/* — 401 without header, route content with it | The catch-all page route is guarded too; with header the sub-route renders its content. |
| SSE GET /stream — 401 without identity header | The stream endpoint rejects an unidentified EventSource at connection time (positive case proven browser-side). |
| POST /event and /dynamic-state — 401 without header, guard passes with it | Both POST command endpoints are guarded; with header the handler's own validation answers (≠ 401/302). |
| GET /asset/:id — 401 without header, handler reached with it | Asset proxy guarded; with header the handler's own 404 (no media store) proves the guard passed. |
| GET /snapshot — 401 without header, snapshot with resolved user content with it | The full-state endpoint is guarded; with header the JSON snapshot contains the `user.name`-bound value ("alice"). |
| auth.redirect — 302 to the configured target instead of 401 | With `auth.redirect` set, an unidentified request gets `302 Location: <redirect>`. |
| custom header names — identity read from the configured headers | `headerUser: Remote-User` makes the default `X-Forwarded-User` non-authenticating and `Remote-User` authoritative (Authelia/ForwardAuth shape). |
| mode none — every endpoint class stays open without any header (regression) | `auth` absent (mode `none`) keeps today's open behaviour on page/snapshot/asset/event. |
| a ui-text bound to user.name shows the header identity; groups parse tolerantly | Browser proof of the `user` binding source: `user.name` renders the header value; `user.groups.0` renders the first entry of a `" admins, sales"` header (trim + drop-empties parsing). |
| two clients with different header users each see THEIR name — also through an SSE broadcast re-render | Isolation proof: alice and bob contexts each render their own name, and after a broadcast ui-store write the per-connection SSE re-render still uses EACH connection's bound identity (no leak). |
| clientId stays device identity — two sessions of the SAME user keep separate clientIds | `user` is additional context: two contexts with identical identity headers keep distinct `webapp:clientId:<appId>` values (P87 device identity untouched). |
