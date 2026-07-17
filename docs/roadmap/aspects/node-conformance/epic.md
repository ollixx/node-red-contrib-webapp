# Epic: node-conformance

Systematischer **Konformitäts-Pass pro `ui-*`-Knoten**: Knoten für Knoten werden
alle Felder geprüft/korrigiert, die Doku angepasst, die Inline-User-Hilfe
optimiert, **beobachtbare Akzeptanzkriterien für jedes Feature** erfasst und die
**Testabdeckung frisch** dagegen aufgebaut. Owner-getrieben (2026-07-14),
step-by-step reviewt.

## Die 5 Dimensionen pro Knoten

Jedes Paket (`PNNN-conformance-ui-<node>.md`) prüft denselben Satz und hält die
Findings + die Akzeptanzkriterien fest:

1. **Felder** — je Feld Typ/Default/Pflicht/Binding-Arten korrekt; keine toten/
   Legacy-Reste; node-lokale Fehler fixen. Cross-cutting Renames/Legacy-Sweep
   bleiben bei **P228/P229** (nicht duplizieren). Wächter: `check:fields`,
   `check:specs`.
2. **Spec** (`docs/nodes/<cat>/<node>.md`) — Detail-Bar (AGENTS.md R11): je Feld
   Typ/Werte/Default/Binding-Kinds/per-Backend/Validierung+Fehlertext/
   Abhängigkeiten/**beobachtbare Render-Wirkung**; Input/Output/Events/Theming.
   Stale Aussagen korrigieren. Wächter: `check:specs`.
3. **User-Doku** (Inline-HTML `data-help-name`) — knapp, korrekt, Zweck +
   wichtigste Felder + Link zur Voll-Doku.
4. **Akzeptanzkriterien** — für **jedes** Feature/Feld ein **beobachtbares**
   Kriterium (Roadmap-`acceptance`-Format). Der Test-Vertrag.
5. **Tests neu** — frisch nach `.ai/agents/node-testing.md` (Unit + Playwright,
   outcome-based, per Feature, `.tests.md`-Katalog aktuell, ggf. Showcase). Alte
   Presence-/„renders without crashing"-Tests **verworfen**.

## Ablauf (pro Knoten)

Audit (alle 5 Dimensionen, mit Belegen) → **Findings + vorgeschlagene
Akzeptanzkriterien im Paket** → Owner reviewt/bestätigt → Umsetzung (Felder/Spec/
Hilfe fixen + Tests neu) → E2E grün → `## Result` + `done`.

## Reihenfolge

Pilot **ui-divider** (Base-Field-Referenzknoten, minimal) zum Kalibrieren von
Template + Aufwand; danach Reihenfolge festlegen (voraussichtlich nach Familie:
display → input → feedback → navigation → structure → state → behavior).

## Verfeinerter Prozess (nach dem Pilot P230, Owner 2026-07-14)

- **Rollenteilung:** *ich (mit dem Owner)* mache pro Knoten den **Audit** →
  Konformitäts-Paket (Findings + beobachtbare Akzeptanz), Owner reviewt; der
  **Orchestrator setzt um** (Fixes + frische Tests, **E2E im Haupt-Checkout**
  verifiziert). Löst den Port-1882-E2E-Konflikt (Worktree-Agenten können E2E nicht
  fahren; der Orchestrator verifiziert am Close-out).
- **Cross-Cutting zuerst:** systemische Muster werden gebündelt gefixt, **bevor**
  per-Knoten-Pässe darauf bauen — bereits erledigt/geplant: **P231** (Base-Fields
  in Schema+Laufzeit, done), **P232** (Voll-Doku-Link in alle Inline-Hilfen),
  **P233** (verbotene „renders without crashing\"-Tests ersetzen).
- **Muster 6 (Editor-Exposure-Gap) — geprüft 2026-07-17, NICHT systemisch.** Gegenstück
  zu Muster 4: Schema+Renderer können Binding, aber das Editor-Control ist kein
  typedInput → für den Autor unerreichbar. Sweep über alle 41 Knoten mit Schema
  (Binding-Fähigkeit transitiv aufgelöst, inkl. Aliase wie `iconFieldSchema`):
  **12 Kandidaten → 1 echter Fall** (`ui-icon.icon` → **P239**), 1 bekannt-übersprungener
  (`ui-empty-state.visible`: eigenes Plain-Text-`visiblePath` statt typedInput —
  gehört in den **P152**-Redesign), **10 False Positives**. **Kein Batch-Paket nötig.**
  - **Warum ein Muster-6-Guardrail heute NICHT sauber baubar ist:** Editor-Feldnamen
    und Schema-Feldnamen weichen *by design* ab, `mapConfig` (`nodes/webapp.js`)
    übersetzt — `currentPage`→`page`, `total`→`totalPages`, `activeRoute`→`activeItem`,
    `fallback`→`fallbackSrc`, `optionsField`→`options`. Ein Namens-Match-Check
    produziert damit ~10/12 False Positives; er müsste `mapConfig` pro Knoten
    verfolgen. Das ist die Feld-Modell-Normalisierung aus **ADR 0038** — der Guardrail
    wartet auf **P228/P229** (deferred).
  - **Nebenbefund:** derselbe Namens-Versatz ist der Grund, warum P237s
    `check:binding-docs` `ui-icon.icon` nicht sehen konnte — es matcht nur Felder,
    deren Ausdruck **wörtlich** `bindingSchema` enthält; `iconFieldSchema` ist ein
    indirekter Alias.
- **Discovery-Sweep:** ein schneller heuristischer Audit über alle 45 Knoten
  (Spec-Drift, fehlender Hilfe-Link, No-Crash-Tests, Katalog-Stubs, Testabdeckung)
  liefert die **priorisierte Reihenfolge** (worst-first) statt blinder Familien-
  Reihenfolge. Die Flags sind Startpunkte, nicht bestätigte Findings — jeder Knoten
  bekommt den echten Audit.

## Sonderfall Component-Knoten

`ui-component-definition` / `ui-component-instance` sind **off-canvas Config-Knoten**
(rendern nichts eigenständig; die Definition/Instanz-Mechanik ist über die
ui-component-Tests abgedeckt). Sie werden **leichter** behandelt: kurze Spec + gute
Inline-Hilfe (+ Doku-Link), **aber keine Render-Feature-Tests** — als bewusste
dokumentierte Ausnahme.

> Goal: jeder `ui-*`-Knoten hat ein bestätigtes Feld-Set, eine detail-vollständige
> Spec, eine gute Inline-Hilfe, beobachtbare Akzeptanzkriterien und eine frische,
> outcome-basierte Testabdeckung.
