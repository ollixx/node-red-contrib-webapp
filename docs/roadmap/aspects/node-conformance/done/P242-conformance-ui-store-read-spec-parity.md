---
id: P242
node: ui-store-read
title: "Konformitäts-Pass ui-store-read (schlank) — Spec-Detail-Bar-Parität mit den Geschwistern: Fehler-Codes + Scope; scope-violation als E2E-Beleg"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/state/ui-store-read.md
tests: tests/e2e/nodes/state/ui-store-read.tests.md
---
# P242 — ui-store-read: Spec-Parität + scope-violation-Beleg (schlank)

> Audit 2026-07-17 (node-conformance). Die **state-Familie** (ui-store-read /
> ui-store-action / ui-query-action) wurde als Block auditiert und ist **in gutem
> Zustand** — Editor-Felder vollständig, Roundtrip-Clobber gefixt (leere Allowlist),
> Inline-Hilfen + Doku-Links vorhanden, Unit-Coverage stark (p209/p211/p212/p213/
> p214/p218), E2E outcome-basiert. **Kein voller Pass nötig.** Dieses Paket schließt
> die **eine** echte Lücke: `ui-store-read`s Spec hat nicht die Detail-Bar-Parität
> seiner beiden Geschwister.

## findings

**Asymmetrie in der Familie (Dimension 2 — Spec-Detail-Bar, AGENTS.md R11).**
`ui-store-action` und `ui-query-action` dokumentieren ihre Laufzeit-Fehler als
**Fehler-Code-Tabelle** und haben einen eigenen **Per-Client & Scope**-Abschnitt.
`ui-store-read` **nicht**, obwohl es dieselben Fehler emittiert:

- **`docs/nodes/state/ui-store-read.md`** hat **keine „Fehler-Codes"-Tabelle** und
  erwähnt Scope nur in einem Prosa-Halbsatz („*Scope-Regel wie beim Schreiben:
  `client-only` ohne clientId → Scope-Fehler*") — **ohne den Code zu nennen**.
- **Der Knoten emittiert diese Fehler nachweislich** (bewiesen in
  `packages/runtime/test/p209-store-read-node.test.ts`):
  - `client-only store read WITHOUT clientId → server.store.scope-violation, no send`
  - `broadcast-only store read WITH clientId → scope-violation`
  - `unknown referenced store → structured read-missing-store error`
- Der **konkrete Fehler-Code** für den fehlenden Store ist zu verifizieren und zu
  benennen (die Geschwister nutzen `server.store.action-missing-store` /
  `server.query.action-missing-query`; ui-store-read hat ein eigenes
  `read-missing-store`-Äquivalent — **exakten String aus dem Handler übernehmen**,
  nicht raten).

**Bewusst NICHT Teil dieses Pakets (Beleg, dass der Rest der Familie sitzt):**
- Editor-`defaults` aller drei Knoten vollständig inkl. `required`-Flags
  (`name/parent/store[/op/path/mode]` bzw. `[query/action/mode]`); Referenz-Picker
  + Parent-App-Selector installiert.
- `check:roundtrip`-Allowlist ist **leer** `{}`; je Knoten existiert ein echter
  open→save-Roundtrip-Test (P217/ADR 0031).
- Keine Base-Fields — korrekt (Logik-Knoten ohne Rendering; ADR-0015-Dimension N/A).
- ui-store-read-Unit deckt **alle vier** Pfad-Präzedenz-Stufen ab
  (`msg.ui.store.path` › `msg.path` › config-`path` › ganzes Slice).

## acceptance

- **Fehler-Codes-Tabelle in `ui-store-read.md`** — im Format der Geschwister
  (`ui-store-action.md` § „Fehler-Codes"): je Zeile Code + Auslöser. Enthält
  mindestens `server.store.scope-violation` (Scope-Regel verletzt) und den
  Store-nicht-gefunden-Code (**exakter String aus `storeReadInputHandler` in
  `nodes/webapp.js`**). Kein erfundener Code — jeder gelistete Code existiert im
  Handler.
- **Per-Client & Scope-Abschnitt** in `ui-store-read.md` (analog
  `ui-store-action.md`): `client-only` ohne clientId → Scope-Fehler;
  `broadcast-only` mit clientId → Scope-Fehler; beide `server.store.scope-violation`.
  Nicht-mutierend bleibt festgehalten.
- **Beobachtbarer Beleg (E2E, gemessen).** Mindestens **ein** neuer outcome-basierter
  Test hebt die heute nur unit-belegte **scope-violation** auf die Integrationsebene:
  ein `client-only`-Read **ohne** clientId erzeugt **keinen** Read-Output und den
  strukturierten `server.store.scope-violation`-Fehler (am `done(error)`/Catch
  gemessen, nicht an DOM-Präsenz — [[verify-rendering-by-measurement-not-tags]]).
  Falls sich das im Browser nicht deterministisch treiben lässt, ist ein
  Handler-Level-Assertion-Test zulässig, der den emittierten Fehler-Code prüft (der
  Katalog vermerkt die gewählte Ebene).
- **Katalog aktuell.** `tests/e2e/nodes/state/ui-store-read.tests.md` listet den/die
  neuen Test(s) mit Testziel.
- **Keine Regression.** Der bestehende Verhaltens-E2E (Read emittiert per-client
  Slice + `msg.path`-Override) und der Roundtrip-Test bleiben grün; `check:specs`/
  `check:fields`/`check:help`/`check:roundtrip`/`check:links` + `pnpm validate` grün.

## verify

`browser` — der scope-violation-Beleg läuft im echten App/Handler (emittierter
Fehler-Code gemessen); die Spec-Ergänzungen gegen den realen Handler geprüft
(kein erfundener Code); Tripwires grün.

## spec

`docs/nodes/state/ui-store-read.md` — Fehler-Codes-Tabelle + Per-Client & Scope-
Abschnitt, im Format von `docs/nodes/state/ui-store-action.md`.

## tests

`tests/e2e/nodes/state/ui-store-read.spec.ts` (+ ggf. Handler-Level-Unit) und
`ui-store-read.tests.md`.

## notes for the implementer

- **Exakte Fehler-Strings aus dem Code holen** — `storeReadInputHandler` in
  `nodes/webapp.js`; die p209-Unit-Testtitel nennen `scope-violation` und
  `read-missing-store` als Konzept, aber der zu dokumentierende String ist der im
  Handler tatsächlich gesetzte (`server.store.*`). `check:specs` erzwingt keine
  Fehler-Codes; sie sind Detail-Bar-Pflicht (AGENTS.md R11), nicht Wächter-geprüft.
- **Umfang strikt halten.** Das ist der schlanke Rest eines ansонsten konformen
  Knotens — **nicht** die Unit-Suite neu aufbauen (sie ist stark) und **nicht**
  ui-store-action/ui-query-action anfassen (die sind konform).
- Muster-Referenz für Tabellenform: `docs/nodes/state/ui-store-action.md`
  (§ „Fehler-Codes", § „Per-Client & Scope").

## Result

**Done 2026-07-19.** Die eine Familien-Asymmetrie ist geschlossen: `ui-store-read`
hat jetzt die Detail-Bar-Parität seiner Geschwister. Schlank gehalten — **kein**
Runtime-Code, **keine** Unit-Suite-Änderung, die Geschwister-Knoten unberührt.

### Fehler-Codes dokumentiert (verbatim aus `storeReadInputHandler`, `nodes/webapp.js`)

Kein erfundener Code — jeder existiert im Handler (Zeile geprüft):
- `server.store.read-missing-store` — **5598** (referenzierter Store nicht in der Registry)
- `server.store.scope-violation` — **5615** (`broadcast-only` + clientId) und **5629**
  (`client-only` ohne clientId)
- `server.store.no-active-app` — **5643** (kein aktives `ui-app`) — vom Agent
  zusätzlich gefunden; ebenfalls real.

Jeder emittiert ein strukturiertes `done(error)` **ohne** `send`.

### Spec (`docs/nodes/state/ui-store-read.md`)

- **„Fehler-Codes"-Tabelle** im Format von `ui-store-action.md` (Code + Auslöser),
  die drei/vier realen Codes.
- **„Per-Client & Scope"-Abschnitt** analog `ui-store-action.md`: `client-only` ohne
  clientId → Scope-Fehler; `broadcast-only` mit clientId → Scope-Fehler; beide
  `server.store.scope-violation`; Read bleibt bei Verletzung nicht-mutierender No-op.

### Test — **Browser-Ebene**, gemessen

`tests/e2e/nodes/state/ui-store-read.spec.ts` (neuer describe-Block; der bestehende
P209-Test unberührt) + Fixture `tests/e2e/fixtures/p242-store-read-scope.flow.json`.
Ein `client-only`-Store wird ohne clientId gelesen; `ui-app` leitet den strukturierten
Fehler per SSE weiter (P56/P57-Maschinerie), der Client rendert den Code in ein
`ui-log`-Panel. Gemessen:
- `.webapp-log-code` = **`server.store.scope-violation`** (emittierter Code)
- Ergebnis-Readout bleibt **`NONE`** → kein Read-Output (Handler kurzschließt vor `send`)

`2 passed` im Haupt-Checkout (`--retries=0`); Katalog `ui-store-read.tests.md`
aktualisiert (Ebene vermerkt).

### Verifikation (Haupt-Checkout)

P242 fasst **nur Doku + einen neuen Test + Fixture** an (kein Runtime/geteilter Code)
→ gezielter Spec-Lauf statt Voll-Suite: `ui-store-read.spec.ts` **2 passed,
`--retries=0`**. `pnpm validate` EXIT 0; alle Tripwires grün
(`check:specs`/`check:fields`/`check:help`/`check:roundtrip`/`check:links`).
Prozess-Hygiene bestätigt: nichts vom Agent gestartetes läuft noch (Port 1882 frei;
Owner-1881 unberührt).
