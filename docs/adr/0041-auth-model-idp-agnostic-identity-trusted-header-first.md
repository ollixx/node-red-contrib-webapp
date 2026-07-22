# ADR 0041: auth model — IdP-agnostic identity, trusted-header first, declarative guards; no owned credentials

- Status: accepted
- Date: 2026-07-22
- Resolves: the open point tracked as **P107** (ui-app.md „Offene Punkte":
  Auth/Authz nicht modelliert). Builds on [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (identity becomes a binding source like any other value source) and the
  per-client model (P87 `clientId`). Relates to **P210** (per-client state
  production scale — sessions/per-user state couple to it, deliberately deferred
  with it).
- Analysis source: the P107 auth analysis (session 2026-07-22): general auth
  landscape, fit assessment against the system's 7 runtime endpoints, staged
  package proposal — confirmed by the owner.

## Context

The framework serves each app over **seven runtime endpoints** under
`RED.httpNode` — page, `/stream` (SSE), `/snapshot`, `/event`,
`/dynamic-state`, `/asset/:id`, and the SPA fallback `/*`. All of them carry app
data or accept commands; `/snapshot` alone returns the full app state. The admin
surface (`RED.httpAdmin`: model, assets, apps list) is already covered by
Node-RED's `adminAuth`. There is **no user identity anywhere**: `clientId` (P87)
is a browser-generated, localStorage-persisted **device/tab identity** that keys
per-client state — it says nothing about *who* is using the app.

The auth landscape was surveyed (reverse-proxy/IAP with trusted headers; in-app
OIDC relying party; self-managed passwords/passkeys; token-based API auth;
Node-RED-native `httpNodeAuth`/`httpNodeMiddleware`). Assessment against this
system:

- A guard on the page alone is theatre — enforcement must cover **all seven
  endpoints** as one middleware.
- The system is declarative and backend-neutral; identity is most valuable as a
  **binding source** (`user.name`, `user.groups`), not as an imperative API.
- Owning passwords adds full credential liability with no advantage over
  delegating to an IdP.
- The reverse-proxy pattern (oauth2-proxy, Authelia, Authentik, ForwardAuth) is
  the established Node-RED community practice and is trivially E2E-testable
  (Playwright sets the headers).
- An in-app OIDC flow needs cookie sessions, CSRF protection on the POST
  endpoints, token refresh, and a session store — which couples to the
  in-memory-state question (P210) and should not be rushed for 1.0.

## Decision

### 1. One identity contract, IdP-agnostic

There is **one** internal user object, regardless of where identity comes from:

```
user = { id: string, name?: string, email?: string, groups: string[] }
```

Every auth source maps into this contract. Flows, bindings, and guards only ever
see `user` — never tokens, headers, or provider specifics.

### 2. `ui-app.auth` selects the source; `trusted-header` is the first source

`ui-app` gets an `auth` config (`none` default | `trusted-header`; `oidc`
reserved as a future value). In `trusted-header` mode the runtime reads identity
from configurable proxy headers (defaults `X-Forwarded-User`, `-Email`,
`-Groups`) and **rejects unauthenticated requests** (401 or configured redirect)
on **all seven** app endpoints. The deployment prerequisite — headers are only
trustworthy when the app is reachable exclusively through the authenticating
proxy — is a documented, prominent operating requirement.

### 3. Identity is a binding source

`user` joins the binding-kind family (like `state`/`store`/`routeParam`):
`user.name`, `user.email`, `user.groups` are resolvable in any value binding,
with the full ADR-0012 documentation duty (`check:binding-docs` applies).

### 4. Authorization is declarative and server-enforced

Routes (and dialogs) carry `requiresGroup[]`. Enforcement happens **server-side**
— page render, `/snapshot`, navigation, and event dispatch all honour it (403
semantics defined in the concept doc). Hiding UI via `visibleIf user.groups` is
**UX, never security**; the spec states this rule explicitly.

### 5. No owned credentials — ever

The framework never stores or verifies passwords. Password/passkey/MFA concerns
belong to the IdP behind the proxy (or, later, the OIDC issuer).

### 6. Staged delivery; what is deferred and why

- **1.0 scope:** contract + concept doc (P260), trusted-header source (P261),
  route/dialog guards (P262).
- **Deferred:** per-**user** state scope (P263) — couples to P210
  (persistence/scale), the two are decided together. In-app **OIDC RP** (P264) —
  only needed if proxy-less operation becomes a goal; brings cookie sessions +
  CSRF + session store (again P210).
- `clientId` stays what it is (device identity); `user` is orthogonal. Editor
  auth remains Node-RED `adminAuth` (documented, out of scope).

## Consequences

- **1.0 has an honest auth story** — „works with any IdP via an authenticating
  proxy; identity is first-class in bindings; routes are authorizable" — without
  the framework touching a password or building session infrastructure.
- **A new cross-cutting middleware** guards the seven endpoints in one place;
  any future endpoint MUST register through it (concept doc carries the rule +
  the endpoint matrix).
- **New binding kind `user`** ripples through the binding docs/guardrails
  (bindingSchema vocabulary, `check:binding-docs`) — P261 carries that duty.
- **Trusted-header mode is only as strong as the deployment** — the docs must be
  blunt about the proxy-only prerequisite; P261 ships an optional
  trust-boundary check (e.g. only accept headers from a configured upstream).
- **E2E stays cheap**: identity is faked by setting request headers in
  Playwright; no IdP in the test loop until P264 (which brings a mock IdP).
- **P107 is resolved** by this ADR + the P260–P264 packages; the ui-app spec's
  open point is closed by P260's concept doc.
