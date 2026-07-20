---
id: P250
node: ui-tabs
title: "Konformitäts-Pass ui-tabs(+tab) (leicht) — `variant` (line/contained/pills) ungetestet, tab-Kind ohne Katalog; activeTab/Render exzellent"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
---
# P250 — Konformitäts-Pass ui-tabs (+ ui-tab)

> Audit 2026-07-17. **Exzellent abgedeckt** — 9 outcome-E2E (Render sl-tab/-panel,
> `activeTab` literal/state/Zwei-Wege-Write-Back/SSE, Default-erste-aktiv,
> tabChange-Event, Legacy-tabs-JSON-Migration), Base-Fields, Katalog, Kind-
> Eindeutigkeit (ADR 0018).

## findings

### A. `variant` (line/contained/pills) ungetestet
`variant: z.enum(["line","contained","pills"])` ist eine **Nicht-Farb-Appearance**
(nicht color/severity). Es gibt eine `mapVariant`-Infrastruktur
(`webapp-serializer.js:287`), aber **kein Test** prüft, dass die drei Werte einen
beobachtbaren Unterschied am `sl-tab-group` erzeugen. **Zu verifizieren:** rendert
`variant` observabel (Attribut/Klasse)? Falls nein → inert (implementieren oder
entfernen); falls ja → Test ergänzen. (Berührt P240 variant-vs-color: `variant`
ist hier korrekt eine Appearance, keine Farbe.)

### B. ui-tab: Kind-Knoten ohne Katalog
`ui-tab` (label-Binding + icon) hat **kein** `.tests.md` und keine eigenen E2E —
Kind-Knoten, via ui-tabs R01/R02 abgedeckt. Wie ui-accordion-section: schlanker
Katalog **oder** dokumentierte Kind-Knoten-Ausnahme; Base-Field-N/A vermerken.

### C. Solide (nicht neu aufbauen)
Render, activeTab (alle Binding-Arten + Zwei-Wege + SSE), Default-Aktiv,
tabChange-Event, Legacy-Migration, Base-Fields.

## acceptance
- **`variant` aufgelöst:** jeder Wert erzeugt einen **gemessenen** DOM-Unterschied
  (Attribut/Klasse am sl-tab-group) + Test — oder Feld als inert dokumentiert/entfernt.
- **ui-tab:** Katalog angelegt **oder** dokumentierte Kind-Knoten-Ausnahme.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — variant-Unterschied gemessen; die 9 bestehenden bleiben grün.

## spec
`docs/nodes/navigation/ui-tabs.md` (+ ui-tab.md) — variant-Render-Wirkung, Kind-Knoten.

## tests
`tests/e2e/nodes/view/ui-tabs.spec.ts` + Katalog; ggf. ui-tab.tests.md.

## notes for the implementer
- Gemeinsames Muster mit ui-accordion (P247: multiple) und den Kind-Knoten
  ui-tab/ui-accordion-section — konsistent entscheiden.

## Result

**Done 2026-07-20.** Leichter Pass; `variant` gemessen und ehrlich gemacht, ui-tab
als Kind-Knoten-Ausnahme dokumentiert.

### `variant` (line/contained/pills) — gemessen INERT → kleiner ehrlicher Implement

Alle vier Fälle (`undefined|line|contained|pills`) erzeugten **byte-identisches**
Markup — der Prop erreichte `component.props.variant`, aber der Serializer las ihn nie.
`sl-tab-group` hat **kein** natives `variant` und `variant` ist hier eine
**Appearance, keine Farbe** — daher NICHT durch `mapVariant` (colour-only) geroutet,
sondern nach dem **ui-avatar-Präzedenz (P94)** ein `data-variant="<line|contained|
pills>"` direkt am `sl-tab-group` emittiert (absent → dokumentierter Default `"line"`).
Neu gemessen: jeder Wert emittiert sein eigenes `data-variant`. E2E **V01** (4 Fälle)
+ Spec (`ui-tabs.md` Darstellung/Theming). **P240 respektiert:** keine variant↔color-
Umklassifizierung.

### ui-tab (Kind-Knoten) — dokumentierte Ausnahme (ui-accordion-section-Präzedenz)

Kein eigener Katalog/E2E (via ui-tabs R01/R02 + `p168-tabs-children-model.test.ts` +
Schema abgedeckt); `ui-tab.md` um „Kind-Knoten-Ausnahme"-Abschnitt ergänzt;
**Base-Fields N/A** (verifiziert: `ui-tab.html` BASE_FIELDS visible/disabled/color/
size/variant = false).

### Verifikation (Haupt-Checkout, autoritativ) — 804/1, die 1 ist KEIN P250-Regress

Voll-Lauf **804 passed / 1 failed** (`--retries=0`). Die eine Rote ist
`ui-tabs.spec.ts:226` **E01** (30 s Timeout) — **diagnostiziert, nicht als „Flake"
abgetan**: E01 hängt an Shoelaces **nicht garantiertem `sl-tab-show`-Upgrade-Emit**
(der `defaultTabEvent`-Drain, Z. 244); unter Voll-Suite-Last kommt der Auto-Emit
gelegentlich nicht rechtzeitig → 30 s-Hang. P239 fixte die *falsches-Event-gegriffen*-
Variante; dies ist die *Emit-kommt-nie*-Variante. **Kein P250-Bezug:** E01 isoliert
**13/13 in 73 ms**; das additive `data-variant`-Attribut kann keinen positions-#709-
abhängigen Timeout verursachen, und die Voll-Läufe P247/P248/P249 (800/800/801) haben
E01 grün gesehen. Der P250-Code ist verifiziert sauber (isoliert 13/13 inkl. V01).
Eine **Task-Chip** (`task_c1239d9c`) für einen robusten E01-Fix (echter Tab-Klick statt
passivem Upgrade-Emit) ist angelegt — statt „Flake" wegzuwinken (siehe P170-Lehre in
[[e2e-verify-build-and-no-tail]]).

`pnpm build` + `pnpm validate` + alle Tripwires grün. Agent committete VOR der
Verifikation, stoppte alle Prozesse (Port 1882 frei), Haupt-Checkout unberührt.
