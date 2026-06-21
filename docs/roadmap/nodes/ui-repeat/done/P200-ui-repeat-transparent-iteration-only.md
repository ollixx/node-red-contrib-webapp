---
id: P200
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat ist transparent: nur Iteration, kein Wrapper (ADR 0025) — Rücknahme der Repeat-als-Container-Richtung (P191/P197/P199-Repeat)"
findings:
  - "Owner (2026-06-20): 'ein repeat horizontal so bauen, dass die elemente dahinter auch wirklich dicht hintereinander liegende texte sind. Ohne wrapper der items.' Gerendert wurden stattdessen gestapelte Divs."
  - "Owner (2026-06-20): 'Deine Beschreibungen und die Tests sind alle für den Arsch … meine Anforderungen werden nicht erfüllt.' — berechtigt: die P191/P197/P199-Tests prüften TAGS (span-Wrapper vorhanden), nie das tatsächliche LAYOUT. Grün auf Tags, falsch auf der Anforderung."
  - "Owner-Entscheidung (2026-06-20): ui-repeat = nur Iteration, N× Kinder ohne Zusatz-Tags; Layout/Chrome über einen expliziten ui-container. Trade-off (akzeptiert): mehrere Kinder je Item gruppieren nur über einen expliziten inneren ui-container."
  - "Messung (Renderer, am echten DOM): vorher (P191/P197) je Item ein webapp-item-Block-Div + transparenter Container → y=111/147/183 (gestapelt). Nach Umbau: ui-container[span] > repeat > ui-text(item) → y=111/111/111, x=240/249/258 (nebeneinander, dicht, kein Repeat-Wrapper)."
acceptance:
  - "expandRepeat flacht die geklonten Template-Kinder in die ELTERN-Region ab (re-id't `<itemKey>#<childId>`), KEIN per-Item-Container, KEIN eigenes Layout, KEIN variant. Der P191-Container-Zweig ist entfernt."
  - "Schema/Editor/Runtime: `ui-repeat.layout` und `ui-repeat.variant` entfernt (Feld, Layout-Selektor, Variant-SelectBox, mapConfig-Mapping + Layout-Registrierung)."
  - "ui-container[variant=span] um einen repeat-of-ui-text rendert die Werte NEBENEINANDER — verifiziert per MESSUNG (gleiches y, steigendes x), kein per-Item-Wrapper-Element. (Nicht per Tag.)"
  - "P164/P184/P185/P192/P193/P196 (Iteration, Scope, Bindings, named scopes) bleiben grün; ui-container-Varianten (P198 + P199-Container, inkl. span) bleiben gültig."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P200 — ui-repeat ist transparent (ADR 0025)

> **Rücknahme** der „Repeat-als-Container"-Richtung. Siehe
> [ADR 0025](../../../../adr/0025-ui-repeat-is-transparent-iteration-only.md).
> ui-repeat iteriert nur — Layout & Chrome sind Sache eines expliziten `ui-container`.

## Result

- **delivered:** `ui-repeat` ist jetzt **transparent**: es klont die Template-Kinder N× direkt in die
  Eltern-Region (re-id't `<itemKey>#<childId>`), **ohne** eigenen Wrapper, **ohne** Layout, **ohne**
  variant. `expandRepeat` (`packages/renderer/src/renderer.ts`) verliert den per-Item-Container-Zweig
  (P191) und flacht immer ab; die P192-Subtree-Logik für einen `ui-container` *im* Repeat bleibt.
  Entfernt: `ui-repeat.layout`/`ui-repeat.variant` aus Schema (`node-definitions.ts`,
  `contracts.ts` Vocabulary/Default), Editor (`ui-repeat.html`: kein Layout-Selektor, kein
  Variant-SelectBox), Runtime (`nodes/webapp.js`: kein `layoutId`/`variant`-Mapping, keine
  `vertical`-Default-Migration, keine Layout-Registrierung). **Layout/Chrome** macht ein expliziter
  `ui-container` (Eltern → arrangiert alle Klone, z. B. `variant=span` = Inline-Zeile; oder das eine
  Kind → gruppiert die Felder je Item).
- **gemessen (am echten DOM, nicht per Tag):** `ui-container[variant=span]` → `ui-repeat` →
  `ui-text(item)` über `[a,b,c]` → die Werte stehen **nebeneinander** (`y=111/111/111`,
  `x=240/249/258`, dicht), **kein** `…#<repeatId>`-Wrapper, **kein** `webapp-container--transparent`
  je Item. Vorher (P191/P197): `y=111/147/183` (gestapelt).
- **stats:** 18 Dateien (Renderer/Schema/Editor/Runtime + Doku/ADR; 6 falsche Tests/Fixtures gelöscht,
  1 neuer Mess-E2E + Fixture `ui-repeat-inline-compose.flow.json`). Verifikation auf develop: build 0;
  Unit **375 schema / 148 renderer / 176 editor / 1054 runtime**; **E2E**: ui-repeat 10/10 (inkl. der
  neue gemessene ADR-0025-Beweis), ui-container 10/10 (span unverändert gültig), customers-crud
  unverändert; volle Suite **634 passed** (einzige Reds: der vorbestehende, gechippte
  Accordion-Defekt; eine veraltete P199-Container-Variant-Assertion `+span` mitkorrigiert);
  check:specs/links/roadmap + lint grün.
- **notes:** Kehrt **P191** (repeat eigenes Layout), **P197** (repeat variant) und den
  **ui-repeat-Teil von P199** (repeat `variant=span`) um — diese bleiben aus Historie in `done/`,
  sind aber durch dieses Paket abgelöst. Die zugehörigen Tag-prüfenden Tests sind gelöscht und durch
  einen **Lage-prüfenden** (Bounding-Box-)Test ersetzt — die neue Verifikationsregel: Layout wird
  **gemessen**, nicht über Tags/Klassen behauptet. ui-container-Varianten (P198 + P199-Container)
  sind unberührt.
- **process:** Owner-Frust über grüne Tests bei nicht erfüllter Anforderung. Vorgehen: erst das echte
  gerenderte DOM **gemessen** (Repro: gestapelt), dann den transparenten Umbau direkt umgesetzt und
  den Owner-Fall live als „SIDE BY SIDE" belegt — danach ADR/Paket geschrieben. Direkt-Implementierung
  durch den Orchestrator (außerhalb des reinen Phasen-Rituals), weil der Owner ausdrücklich „erst
  funktionierendes Rendering, dann Bürokratie" wollte.
