# Auth

Who is using the app: trusted-header operation behind an authenticating
proxy, the `user` binding, and server-enforced `requiresGroup` guards.

> Deutsch: [../de/guides/auth.md](../de/guides/auth.md)

## Goal

Run an app behind an authenticating reverse proxy, show the signed-in
user in the UI, and protect a route so that only members of a group can
reach it — with the guard enforced on the server, not just hidden in the
UI.

## Prerequisites

- [Bindings & State](bindings-state.md) (the `user` binding source) and
  [Navigation & Dialogs](navigation-dialogs.md) (routes).

## The model in one paragraph

The framework never stores or checks passwords. Instead, an
**authenticating reverse proxy** (oauth2-proxy, Authelia + Traefik, …) in
front of Node-RED forces the login and passes the identity to the app as
HTTP headers. The app reads those headers into **one** internal user
object — `user.id`, `user.name`, `user.email`, `user.groups` — and
everything else (bindings, guards) works against that object, regardless
of which identity provider sits behind the proxy.

## Enabling it: `auth` on the app

The `ui-app` node carries an **Auth** configuration:

| Setting | Default | Meaning |
|---|---|---|
| Mode | `none` | `none` = open app (no identity); `trusted-header` = identity from proxy headers, enforced |
| User header | `X-Forwarded-User` | header that carries `user.id` |
| Email header | `X-Forwarded-Email` | header for `user.email` |
| Groups header | `X-Forwarded-Groups` | header for `user.groups` (comma-separated) |
| Redirect | — (401) | URL to redirect unauthenticated requests to (e.g. `/oauth2/sign_in`) instead of a bare 401 |

With `trusted-header` active, **every** app endpoint (page, live stream,
events, snapshot, assets) runs through one auth guard: requests without
the user header get a 401 (or the redirect); requests with it carry the
user identity through rendering and events.

> **Warning — headers are only trustworthy behind the proxy.** Any client
> can set `X-Forwarded-*` headers itself. Trusted-header mode is only
> safe when the app is reachable **exclusively** through the proxy (the
> Node-RED port is not directly exposed) and the proxy strips/overwrites
> incoming identity headers from outside. The guard checks the header's
> *presence* — its *trustworthiness* is a property of your deployment.

### Proxy example (oauth2-proxy)

```yaml
# oauth2-proxy.cfg — in front of Node-RED, any OIDC provider
http_address = "0.0.0.0:4180"
upstreams = [ "http://127.0.0.1:1880/" ]
provider = "oidc"
oidc_issuer_url = "https://idp.example.com/realms/main"
client_id = "webapp"
client_secret = "…"
cookie_secret = "…"
email_domains = [ "*" ]
pass_user_headers = true      # X-Forwarded-User / X-Forwarded-Email
set_xauthrequest = true
oidc_groups_claim = "groups"  # groups as a header (provider-specific)
```

If your proxy uses different header names (Authelia sets `Remote-User` /
`Remote-Email` / `Remote-Groups`), configure them in the app's auth
settings. Full operational detail (including a Traefik/Authelia example
and the per-endpoint enforcement matrix) lives in the contract doc
[`docs/nodes/concepts/auth.md`](../../nodes/concepts/auth.md).

## Showing the user: the `user` binding

Bind any value field to the **User** source: `user.id`, `user.name`,
`user.email`, or `user.groups` (a string array — `user.groups.0` reads
one entry). Without an identity (`mode: none`) the binding resolves to
its **fallback**. In reactive expressions the same identity is available
as the `user` global — read it defensively:

```js
(user?.groups ?? []).includes("admins")
```

## Protecting pages: `requiresGroup`

Routes and dialogs carry an optional **Requires Group** list
(comma-separated in the editor):

- **empty** — signed-in users may enter (with `trusted-header`, being
  authenticated is enough).
- **set** — the user needs **at least one** of the listed groups
  (ANY-of against `user.groups`).
- with `mode: none` nobody satisfies a set guard — guarded pages
  require an identity source.

The guard is enforced **on the server**, at every surface: direct URL
access answers 403 with a neutral access-denied page (no content leaks),
the snapshot omits guarded routes/dialogs entirely, navigation commands
to a guarded route are not delivered, and events from components of a
guarded page are rejected before they reach your flow.

**"visibleIf is UX, the guard is security."** Hiding a menu item or
button via the reactive `user` pattern is a courtesy for the user — it is
*not* protection. Do both: hide the entry (`visibleIf` with the
expression above) *and* set `requiresGroup` on the route. Even a user who
guesses the URL then gets a 403 and an empty snapshot.

## Steps

1. Import the example below. It ships with auth mode `none`: the home
   page renders for everyone, the "signed in as" text shows its fallback,
   and the admin button is hidden (no identity → no `admins` group).
2. Open the `ui-app`, switch auth mode to `trusted-header`, deploy — now
   requests need the user header. Verify: a plain browser request gets
   `401`; with a header-setting proxy (or a curl with
   `-H "X-Forwarded-User: alice" -H "X-Forwarded-Groups: admins"`) the
   page renders and shows `alice`.
3. Visit `/webapp/authApp/admin` without the `admins` group: **403** with
   the access-denied page. With the group: the admin content renders and
   the admin button appears on the home page.

## Example flow

[`examples/guide/auth.json`](../../../examples/guide/auth.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/auth.json` (or paste its JSON) →
   **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/authApp/` — then follow the
   steps above to activate trusted-header mode.

## Where next

- Contract doc with the full enforcement matrix and proxy recipes:
  [`docs/nodes/concepts/auth.md`](../../nodes/concepts/auth.md)
- [Bindings & State](bindings-state.md) — the `user` source among the
  other binding kinds.
