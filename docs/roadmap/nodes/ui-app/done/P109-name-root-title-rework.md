---
id: P109
title: "ui-app: name + root ins Schema, title raus; Render-Semantik (HTML-title = name; Header-Slot leer → name als Titel, sonst nur Slot)"
epic: nodes/ui-app
status: done
dependencies: [P1, P3]
node: ui-app
verify: browser
spec: docs/nodes/structure/ui-app.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P109 — ui-app: name/root/title-Rework

## Findings
> Owner-Entscheidung 2026-06-09 (Review-Gap 2).

- `uiAppNodeDefinitionSchema` hat heute `title`, aber **kein `root` und kein `name`**, obwohl beide tragend sind (Editor-Pflichtfeld `root`, mapConfig `root: config.root`, appId-Match `entry.root`). → `name` **und** `root` ins Schema, `title` **raus**.
- Render-Semantik:
  - **HTML-`<title>`** (Browser-Tab) → immer der `name`.
  - **Header-Slot:** ist **kein** Kind im Header-Slot → der `name` wird als Titel im Header angezeigt. Ist **mindestens ein** Kind im Header-Slot → es wird **nur** der Slot gerendert (kein `name` mehr).
- Doc-Hinweis: will der User einen vom `name` **abweichenden** HTML-Title, bräuchte es später ein eigenes `title`-Feld — **das machen wir jetzt nicht** (nur dokumentieren).

## Acceptance
> `verify: browser` — im laufenden App-Frontend + Editor zu beweisen.

- Schema: `uiAppNodeDefinitionSchema` enthält `name` und `root`, **nicht** mehr `title`. Unit-Test.
- **Back-Compat:** ein alter ui-app-Config mit `title` (ohne `name`) lädt ohne Fehler; mapConfig migriert `title` → `name` (Shim), bestehende Flows brechen nicht. Test.
- Browser: das `<title>`-Element der App-Seite zeigt den `name`.
- Browser (Header-Slot leer): der `name` erscheint als Titel im Header.
- Browser (≥1 Kind im Header-Slot): **kein** `name` im Header — nur die Slot-Kinder werden gerendert.
- Doc: ui-app.md Felder-Tabelle auf `name`/`root` umgestellt, Render-Semantik beschrieben, Hinweis auf das optionale spätere `title`-Feld.

## Notes
- Der Header-Slot-Belegungs-Check muss dem Renderer/Serializer bekannt sein (Slot hat ≥1 Kind?) — das ist der nicht-triviale Teil.
- `root` im Schema ist zugleich Voraussetzung für P108 (root-Eindeutigkeit).

## Result

delivered: Added `name` and `root` to `uiAppNodeDefinitionSchema`, removed `title`; updated `appModelSchema` to use `name`; implemented header-slot render semantics (empty slot → app's name shown in app-bar; occupied slot → name suppressed); back-compat shim in `mapConfig` migrates old `title`-only configs transparently; `/webapp/apps` endpoint emits both `name` and `title` (back-compat).
stats: 22 files changed, 322 insertions, 55 deletions; 9 new unit tests (P109 schema), 3 new E2E tests; all 1056 unit tests pass; build+validate clean
notes: `name`/`root` optional in schema (editor enforces required before deploy; old configs back-compat-safe via Zod strip-unknown). E2E (verify:browser) to be run by orchestrator on develop after merge.
cost: session ac6c921dd49f4e753, 19m
