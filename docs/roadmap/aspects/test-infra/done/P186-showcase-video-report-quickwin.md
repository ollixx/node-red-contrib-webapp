---
id: P186
title: "Review-Video Quick-Win: Playwright video+trace+HTML-Report + on-demand test:showcase-Target — sofort Videos der bestehenden 74 E2E-Specs"
epic: aspects/test-infra
findings:
  - "Owner (2026-06-15): per-Knoten Playwright-Tests, die die Benutzung in Node-RED simulieren, jedes Feature einmal durchspielen, im Browser laufen und ein VIDEO als Review liefern. (ADR 0022)"
acceptance:
  - "Ein on-demand-Target (z. B. `pnpm test:showcase`) startet die E2E mit Video + Trace AN und dem HTML-Reporter; der normale `pnpm exec playwright test` / CI bleibt ohne Video (Zeit/Disk)."
  - "Nach einem Showcase-Lauf öffnet der Playwright-HTML-Report pro Test ein eingebettetes Video + einen klickbaren Trace (Schritt-für-Schritt-DOM)."
  - "Die bestehenden 74 Specs liefern so ohne Änderung reviewbare Videos; ein dokumentierter Befehl, wie der Owner den Report öffnet (z. B. `pnpm exec playwright show-report`)."
  - "Artefakt-Ablage (test-results/, playwright-report/) ist gitignored; keine Videos im Repo."
verify: browser
spec: docs/adr/0022-per-node-review-videos-fixture-driven-showcase.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: done
---
# P186 — Review-Video Quick-Win

> Stufe 1 aus [ADR 0022](../../../../adr/0022-per-node-review-videos-fixture-driven-showcase.md).
> **Fast geschenkt:** Video/Trace sind ein Config-Flag; die ganze NR-Instanz +
> 74 Specs laufen schon. Damit hat der Owner **sofort** Videos zum Durchsehen.

## Umfang

1. **Playwright-Config:** ein **Profil/Projekt** oder ein env-geschalteter Zweig
   mit `use: { video: "on", trace: "on" }` + `reporter: [["html"]]` — **nur** für
   den Showcase-Lauf; der Default-/CI-Lauf bleibt video-frei.
2. **`test:showcase`-Script** in `package.json` (setzt das Profil/ENV, ruft
   Playwright). Optional `show-report` als Komfort-Script.
3. **`.gitignore`:** `test-results/`, `playwright-report/` (falls nicht schon).
4. **Doku:** kurzer Abschnitt (CLAUDE.md/Testing-Doc), wie man den Showcase-Lauf
   startet und den Report öffnet.

## acceptance / verify

- `verify: browser` — der HTML-Report mit eingebetteten Videos + Traces ist der
  Beweis; im Haupt-Checkout durch den Orchestrator erzeugt
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- Video/Trace nur im Showcase-Profil — **nicht** den CI-Standardlauf verlangsamen.
- Keine inhaltlichen Spec-Änderungen hier; das paced Showcase-Format ist **P187**.
- `spec`-Feld zeigt auf die ADR (Infra-Paket ohne eigenen Knoten-Vertrag).

## Result

- **delivered:** ADR 0022 Stage-1 review-video quick-win. `playwright.config.ts` now has a
  **`SHOWCASE=1` env gate**: when set, it turns on `video:"on"`, `trace:"on"`, and the HTML reporter;
  the default `pnpm exec playwright test` / CI path is unchanged (no video/trace → no time/disk cost).
  `package.json`: new `test:showcase` (`SHOWCASE=1 playwright test`) + `show-report`
  (`playwright show-report`) scripts. `CLAUDE.md`: documented both under Commands. `test-results/` and
  `playwright-report/` were already gitignored (no change). The existing 74 specs produce reviewable
  videos immediately under the flag — no spec changes.
- **stats:** 3 files (+25/−3). Build + lint + unit **1046** green on develop; check:roadmap +
  check:links OK.
- **verification:** gating proven — a normal run of `ui-badge.spec.ts` produced **no** `.webm` and no
  `playwright-report/`; the same spec under `SHOWCASE=1` produced **13 videos** (one per test) +
  `playwright-report/index.html` with embedded video + clickable trace.
- **notes:** No app-behavior change (test-infra only), so the gate is build/lint/unit + the explicit
  video-gating proof rather than a full E2E run. The paced fixture-driven showcase spec format is the
  Stage-2 follow-on **P187** (depends on this). This phase's branch also carried the owner's
  out-of-band roadmap commit `0466cad` (ADR 0023 + the new **P193** package — named repeat scopes);
  it merged in cleanly alongside the P186 config (docs-only, tripwires green) — P193 is now listed as
  pending.
- **cost:** session agent-a10ed85ade76f87c0, ~5m.
