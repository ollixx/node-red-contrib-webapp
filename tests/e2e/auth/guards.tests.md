# Auth: route/dialog guards — test catalogue (P262, ADR 0041 §4)

Location: `tests/e2e/auth/guards.spec.ts`

Identity is faked via the P261 header-fake pattern (see
`trusted-header.tests.md`): the test IS the proxy — request-level `headers`,
browser-level `browser.newContext({ extraHTTPHeaders })`. `admin` holds the
required group (`admins`), `member` is authenticated but lacks it.

Semantics: absent/empty `requiresGroup` ⇒ authentication only (P261);
set ⇒ **ANY-of** — the user needs at least one of the listed groups.
Rule under proof: **„visibleIf ist UX, Guard ist Sicherheit."**

## Tests

| Test | Goal |
|---|---|
| direct URL of a guarded route: 200 + content WITH the group, 403 page WITHOUT | Page-render enforcement: the group holder gets the route content; without the group the defined 403 page ("Access denied") carries NO route content, no component ids, no client root (no leak in the HTML). |
| ANY-of semantics: holding ONE of several required groups suffices | `requiresGroup: "admins, sales"` admits a user with only `sales`; an authenticated user with neither group gets 403. |
| regression: a route WITHOUT requiresGroup stays open to every authenticated user | Empty/absent guard keeps the P261 behaviour (authentication only). |
| snapshot of a guarded route: 403 without the group, JSON carries neither structure nor data | `/snapshot?location=/secret` → 403; the response JSON contains neither the guarded text nor the guarded component ids. With the group → 200 + content. |
| guarded dialog: excluded from the snapshot JSON even when forced via `?dialog=` | The home snapshot stays 200, but the guarded dialog is absent ENTIRELY from the JSON (no structure, no data) for the group-less user; present for the holder. |
| browser: `?dialog=<guarded id>` renders the dialog for the group holder, nothing for others | Measured DOM: `.webapp-dialog` visible with content for the holder; count 0 and no dialog text anywhere in the page HTML for the group-less user. |
| ui-action navigate: the group holder is moved, the other client stays put | Navigation enforcement in the central command push: the holder's click lands on `/secret`; the group-less client's click pushes NO navigate command — URL and content stay put (no silent success; denial reported as `server.auth.navigation-denied`). |
| POST /event on a component of a guarded route: 403 structured error without the group | Event-dispatch enforcement: 403 with the structured error per logs-errors.md (`code: server.auth.event-denied`, `severity: warn`, `origin: server`, `context.nodeId`); accepted (200) with the group. |
| POST /event on a component of a guarded dialog: 403 without the group | Ownership walks the mount chain up to the guarded dialog — its children are protected too. |
| the guarded menu item is hidden via the documented reactive-user pattern (UX) — and the direct URL still 403s (security) | Menu consistency: `items` built with the reactive `user` global hides the guarded entry for the group-less user (UX); the SECURITY proof is the direct URL → 403 despite the hidden item, with no content leak. |
