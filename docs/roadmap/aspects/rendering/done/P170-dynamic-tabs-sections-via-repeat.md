---
id: P170
epic: aspects/rendering
title: "Dynamische Tabs/Sektionen via ui-repeat: ein ui-repeat erzeugt ui-tab/ui-accordion-section-Kinder aus Daten (Capstone, kein eigener Dynamik-Mechanismus)"
findings:
  - "Owner (2026-06-11): 'die slots werden nicht angezeigt … Das ist dann ja auch dynamisch, wenn man die options dynamisch füllt.'"
  - "Owner-Entscheidung (2026-06-12): in Modell 1a fällt der dynamische Fall aus ui-repeat — keine eigene 'dynamischer-Slot'-Bindung."
acceptance:
  - "Ein ui-repeat mit items=Store-Array, dessen Template ein ui-tab (label = item.<feld>) ist, rendert N Tabs — einen pro Datensatz."
  - "Array-Änderung (Item hinzu/weg/umsortiert) ändert die Tab-Menge sichtbar; keyed (kein Flackern der unveränderten Tabs); activeTab bleibt stabil, solange das Kind existiert."
  - "Gleicher Nachweis für ui-accordion + ui-accordion-section."
  - "Kein neuer Binding-/Slot-Mechanismus eingeführt — der Effekt entsteht allein aus ui-repeat (ADR 0017) + Kinder-definieren-Sektionen (ADR 0018)."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P165, P168, P169]
status: done
---
# P170 — Dynamische Tabs/Sektionen via ui-repeat (Capstone)

> Schließt P142 endgültig: der **dynamische** Teil ist kein eigenes Feature,
> sondern die **Komposition** aus `ui-repeat` (ADR 0017) und Kinder-definieren-
> Sektionen (ADR 0018). Dieses Paket **beweist** die Komposition end-to-end und
> dokumentiert das Muster — es baut idealerweise **keinen** neuen Mechanismus.

## Umfang

1. **Verifizieren:** ui-repeat (Template = `ui-tab`, `label = item.<feld>`)
   innerhalb eines `ui-tabs` → N Tabs aus Daten; dito `ui-accordion` mit
   `ui-accordion-section`.
2. **Keying/Stabilität:** Repeat-Keys × Sektions-id; `activeTab`/Open-Zustand
   übersteht Datenänderungen, solange das Kind existiert.
3. **Lücken schließen, falls vorhanden:** sollte die Komposition an einer Stelle
   nicht greifen (z. B. Repeat-Kinder werden vom Container nicht als Sektionen
   erkannt), dort den **minimalen** Fix machen — aber **kein** paralleles
   Dynamik-Modell einführen.
4. **Doku:** das Muster „dynamische Tabs = ui-repeat von ui-tab" in
   `ui-tabs.md`/`ui-accordion.md` + ein Beispiel dokumentieren.

## acceptance / verify

- `verify: browser` — E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- Hängt an der **ui-repeat-Welle (P165)** und an P168/P169 — erst ziehbar, wenn
  beide stehen.
- Leitprinzip: **Komposition statt neuem Mechanismus**. Wenn dieses Paket viel
  neuen Code braucht, stimmt etwas an ADR 0017/0018 nicht — dann zurückmelden.

## Result

- **delivered:** Capstone — proved (and documented) that **dynamic tabs/sections = a `ui-repeat`
  of `ui-tab`/`ui-accordion-section`**, pure composition of ADR 0017 (ui-repeat) + ADR 0018
  (children-define-tabs/sections), **no new mechanism**. The only gap was the predicted one:
  `renderTabs`/`renderAccordion` enumerated only section-kind children mounted DIRECTLY into the
  container, so an interposing `ui-repeat` (kind `repeat`) and its template `ui-tab` (mounted at
  `container:<repeatId>/content`) were skipped. Minimal fix in `packages/renderer/src/renderer.ts`:
  new `resolveSectionChildren()` + `renderSectionContent()` helpers expand a child `ui-repeat` per
  item (reusing `expandRepeat`'s frame-resolution + per-instance keying `<itemKey>#<templateId>`)
  and resolve each tab/section's label AND content against the row's `{item,index}` scope — no
  parallel dynamic-slot binding, no schema change. Bonus: unified `ACCORDION_SECTION_SLOT` with
  `TAB_SLOT` (both `"content"`). Pattern + example documented in `docs/nodes/navigation/ui-tabs.md`
  + `ui-accordion.md`.
- **stats:** 8 files (+987/−59); +11 renderer unit (`p170-dynamic-tabs-sections.test.ts`) + 2
  runtime full-pipeline render tests + new E2E `tests/e2e/nodes/view/dynamic-tabs-sections.spec.ts`.
  Unit green (renderer 103 / runtime 971 / schema / editor 102). Develop verification: `pnpm build`
  exit 0; **capstone browser proof green** — dynamic-tabs-sections T01–T03 (a ui-repeat of ui-tab
  renders one keyed tab per store row, label from `item.name`; add/reorder keyed, ids stable) +
  S01–S02 (ui-repeat of ui-accordion-section, keyed remove); ui-tabs + ui-accordion + ui-repeat
  specs green (the one E01 red in the first batch was a confirmed flake — synthetic `sl-tab-show` +
  raw-POST intercept race; re-ran 14/14 green, and a fix-agent confirmed P170 doesn't touch the
  change-event path). check:roadmap + check:links + lint OK.
- **notes:** **ADR 0017/0018 confirmed sound** — the dynamic case needed a small targeted renderer
  fix, not a new feature. This closes the deferred dynamic-slots concept (P142). **This was the
  last open roadmap phase — the roadmap is drained.**
- **cost:** session a6c5282a95cb8353d, ~24m (+ orchestrator browser proof + flake recheck).
