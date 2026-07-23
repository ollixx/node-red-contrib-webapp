---
id: P261
node: ui-app
title: "Trusted-Header-Identität: EINE Guard-Middleware über alle 7 App-Endpoints (401/Redirect), `user` im Snapshot-Kontext + neue Binding-Quelle `user` — E2E via gefakte Header"
epic: aspects/auth
status: done
dependencies: [P260, P259]
verify: browser
spec: docs/nodes/concepts/auth.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P261 — Trusted-Header-Identität (Tier 1)

> Rationale: **[ADR 0041](../../../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)**
> §2/§3. `dependencies: [P259]` ist **Kollisionsvermeidung**: dieses Paket arbeitet
> massiv in `webapp.js` und im Renderer — erst nach Abschluss des Feld-Modell-Zuges
> (P229→P228→P259), der dieselben Dateien umbaut.

## findings

- P260 liefert Contract + `ui-app.auth`-Feld (konfigurierbar, noch wirkungslos).
- Die 7 Endpoints (webapp.js:4579–4830) haben **keinerlei** Zugangskontrolle;
  `/snapshot` liefert den vollen App-Zustand, `/event`+`/dynamic-state` nehmen
  Schreibbefehle an.
- Renderer löst heute die Binding-Quellen state/store/query/routeParam/… auf
  ([[renderer-resolves-five-binding-kinds]]) — `user` fehlt.

## acceptance

- **EINE Middleware, alle 7 Endpoints.** Bei `ui-app.auth.mode = "trusted-header"`:
  jede Anfrage an Page, `/stream`, `/snapshot`, `/event`, `/dynamic-state`,
  `/asset/:id`, `/*` der App wird geprüft — Header (konfigurierte Namen, Defaults
  `X-Forwarded-User`/`-Email`/`-Groups`) vorhanden ⇒ `user`-Objekt im
  Request-Kontext (Groups: kommasepariert → `string[]`); fehlend ⇒ **401** bzw.
  `auth.redirect` (302). Browser-Beweis je Endpoint-Klasse (Page, SSE, POST,
  Asset): ohne Header 401/Redirect, mit Header Inhalt. `mode:"none"` ⇒ exakt
  heutiges Verhalten (Regressionsbeweis: volle Suite grün ohne Header).
- **Registrierungs-Regel erzwungen:** die Endpoints laufen durch eine gemeinsame
  Registrierungs-Funktion (z. B. `registerAppEndpoint(path, handler)`), sodass ein
  künftiger Endpoint die Guard **nicht vergessen kann**; die Enforcement-Matrix in
  `auth.md` wird auf „erzwungen via <Funktion>" aktualisiert.
- **`user` als Binding-Quelle.** `user.id/name/email/groups` (+ `groups`-Zugriff
  als Array) sind in Value-Bindings auflösbar wie `state`/`routeParam`: Renderer-
  Auflösung aus dem Request-/Client-Kontext, SSE-Re-Render trägt die Identität des
  verbundenen Clients. Browser-Beweis: ein `ui-text` mit `user.name`-Binding zeigt
  den Header-Wert; ein zweiter Client mit anderem Header-User sieht **seinen**
  Namen (kein Identitäts-Leck zwischen SSE-Verbindungen).
- **Binding-Doku-Pflicht (ADR 0012):** `user` ist in `stores.md`/Binding-Vokabular
  + typedInput-Angebot dokumentiert; `check:binding-docs` bleibt grün (Schema-
  Wahrheit inkl. der neuen Quelle).
- **Vertrauens-Grenze:** dokumentierte Warnung (nur hinter Proxy betreiben) +
  optionaler Guard `auth.trustProxy`-Check (z. B. nur akzeptieren, wenn
  `X-Forwarded-*` von konfigurierter Upstream-Quelle — mindestens als
  dokumentierte Option; Umfang klein halten).
- **`clientId` unangetastet** — Geräte-Identität bleibt; `user` ist zusätzlicher
  Kontext. Ein Test belegt: zwei Tabs desselben Users behalten getrennte clientIds.
- **E2E-Muster:** Identität via Playwright `extraHTTPHeaders` gefakt — kein IdP im
  Test-Loop; das Muster ist im Test-Katalog als Referenz dokumentiert.
- Volle E2E-Suite + `pnpm validate` + Tripwires grün (Haupt-Checkout).

## verify

`browser` — 401/Redirect + Inhalt je Endpoint-Klasse gemessen; `user.name`-Binding
im DOM; Zwei-Client-Isolationsbeweis; `mode:"none"`-Regression über die volle Suite.

## spec

`docs/nodes/concepts/auth.md` (Enforcement-Matrix „erzwungen"), `stores.md`
(Binding-Quelle `user`), `docs/nodes/structure/ui-app.md` (`auth` wirkt jetzt).

## tests

Neue `tests/e2e/auth/trusted-header.spec.ts` (+ Katalog) + ui-app-Katalog;
Renderer-Unit für die `user`-Auflösung (Muster: bestehende Binding-Quellen-Tests).

## notes for the implementer

- **Nach P259 rebasen** — webapp.js/Editor haben sich durch den Feld-Zug bewegt.
- SSE beachten: die Guard prüft beim Verbindungsaufbau; die Identität wird an die
  Verbindung gebunden (kein Re-Read pro Event nötig, aber Re-Render nutzt sie).
- `groups`-Parsing tolerant (Leerzeichen, leere Einträge filtern).
- Kein Session-/Cookie-Code — das ist bewusst P264-Territorium.

## Result

**Done 2026-07-23.** Tier-1-Enforcement steht: EINE Guard-Middleware über alle 7
App-Endpoints, `user` als Binding-Quelle, Identität an die SSE-Verbindung gebunden.

### Die 7 Einheiten (je sofort committet — Ausfallschutz nach den Verbindungsabbrüchen des Tages)

1. `75defe1` — **`registerAppEndpoint`**: ein Registrierungs-Funnel für alle 7
   `RED.httpNode`-Endpoints (reiner Refactor, mode-none byte-identisch). Ein
   künftiger Endpoint KANN die Guard nicht mehr vergessen.
2. `df6d3ed` — **Guard-Middleware**: bei `mode:"trusted-header"` Header lesen
   (konfigurierte Namen, Defaults X-Forwarded-*), `userIdentitySchema`-Objekt bauen
   (Groups kommasepariert → string[], tolerant: trim, Leereinträge raus), an den
   Request-Kontext; fehlender User-Header ⇒ **401** bzw. **302** auf `auth.redirect`.
3. `ecf8bc8` — **SSE-Identität**: Guard prüft beim Verbindungsaufbau; Identität an
   die Verbindung gebunden; jeder Snapshot-Build (Page/Stream/Event/Snapshot/
   Re-Render-Push) trägt sie.
4. `dca8aed` — **Binding-Quelle `user`**: Schema-Kind, Renderer-Auflösung (+6
   Renderer-Unit-Tests → 169), Editor-typedInput-Typ, `stores.md`-Vokabular.
5. `dc8fab5` — **12 E2E** (`tests/e2e/auth/trusted-header.spec.ts` + Katalog mit dem
   Header-Fake-Referenzmuster): Guard-Matrix je Endpoint-Klasse (Page/SSE/POST/Asset:
   ohne Header 401/Redirect, mit Header Inhalt), Custom-Header-Namen, mode-none-
   Regression, `user.name`-Binding im DOM, **Zwei-Client-Isolation** (jeder sieht
   SEINEN Namen über SSE-Broadcast), **clientId-Trennung** (zwei Tabs desselben
   Users behalten getrennte clientIds — Geräte-Identität unangetastet).
6. `d6477b1` — **Doku**: auth.md-Matrix → „erzwungen via registerAppEndpoint",
   Guard-Semantik, user-Binding-Abschnitt, trustProxy-Option (klein, dokumentiert);
   die 5 P260-Inert-Disclaimer durch das wirksame Verhalten ersetzt +
   Vertrauensgrenzen-Warnung.
7. `b5a5fd9` — **Kanon-Set-Pins**: das erste Voll-Suite-Gate lief 876/5 — 4 veraltete
   E2E-Pins des kanonischen Binding-Typ-Sets (die neue `user`-Quelle erweitert das
   Set legitim auf 15: `store, query, routeParam, user, reactive, msg, jsonata, str,
   num, bool, json, date, flow, global, env`) + 1 echter ui-app-Hilfe-Link-Bruch aus
   Einheit 6. Alle 5 gefixt.

### Verifikation

**Voll-Suite (Worktree-Gate): 881 passed, 0 failed, `--retries=0`, 16,6 min** —
zugleich der mode-none-Regressionsbeweis (+14: die 12 Auth-E2E u. a.).
**Orchestrator-Merge-Gate (Haupt-Checkout):** Build grün; Auth-Spec **12 passed**;
alle Tripwires grün (`check:binding-docs` mit der neuen Quelle, leere
`check:fields`-Allowlist hält); Unit 2260 gesamt — wobei das Merge-Gate **5
Unit-Zwillinge** der Kanon-Set-Pins fing (`p113-value-binding-types.test.ts`
BASE_VALUE_SET), die das agentenseitige validate nicht mehr erreichte (Turn endete
vorher) — orchestrator-seitig gefixt (Commit im Merge-Zug): Set auf 15 Kinds,
`user` nach `routeParam`. Danach editor 196/196.

### Kein Session-/Cookie-Code — bewusst P264-Territorium. `clientId` bleibt Geräte-Scope.
