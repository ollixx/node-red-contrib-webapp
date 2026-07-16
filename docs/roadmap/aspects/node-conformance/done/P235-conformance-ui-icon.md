---
id: P235
node: ui-icon
title: "Konformitäts-Pass ui-icon — visible-Doku + Testabdeckung (icon-Binding/color/visible/msg)"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/display/ui-icon.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P235 — Konformitäts-Pass ui-icon

> Ablauf/Checkliste: [epic.md](../epic.md). Cross-Cutting-Anteile: Hilfe-Doku-Link →
> **P232** (bereits ergänzt), No-Crash → **P233** (hier keiner echt vorhanden, s.u.).

## findings (Audit 2026-07-14)

Insgesamt **guter Zustand** — leichter Pass.

**1 · Felder** ✅ — Base-Fields wirken (Schema `...baseFieldsSchema`, P231); `icon`
(Pflicht, backend-neutral `{library,name}`, **bindbar**), `size` (xs…xl + Legacy-
Migration), `color`. Input-Port (msg.payload→icon, primäres Feld).

**2 · Spec** — weitgehend sauber (keine Drift-Phrasen). **Lücke:** das Base-Field
**`visible`** ist in der „Allgemein"-Tabelle **nicht dokumentiert** (Knoten hat es).
`color` ist unter „Darstellung" gut beschrieben.

**3 · Inline-Hilfe** ✅ — Doku-Link vorhanden (P232 hat ihn ergänzt).

**4 · Akzeptanzkriterien** — keine konsolidierte Liste.

**5 · Tests** (`ui-icon.spec.ts`) — **solide**: sl-icon+Name, `library`-Attr,
size-Token ×5 (echte CSS-Klassen-Assertions), „kein Icon → kein sl-icon" (echte
Negativ-Assertion), Legacy-CSS-Size-Migration (asserted `webapp-icon--24` — **kein**
reiner No-Crash-Test trotz „does not crash"-Wortlaut → P233 kann ihn behalten).
**Fehlt:** `icon`-**Store/state-Binding** (Live-Icon-Name), **`color`** gerendert
(Icon-Farbe, gemessen), **`visible=false`** (gebunden) blendet aus, **msg.payload**
→ Icon-Update (Live).

## acceptance (VORSCHLAG — bitte reviewen)

- **icon (Literal via Picker)** → `<sl-icon name="…">`; Kurzform `library:name` →
  `<sl-icon library="…" name="…">`.
- **icon (Store/state-Binding)** → Live-Icon-Name gerendert; Store-Änderung
  aktualisiert (SSE).
- **size** `xs…xl` → CSS-Klasse `webapp-icon--<token>` (bereits abgedeckt).
- **Legacy-Freiwert** (`24`) → `webapp-icon--24`, kein Crash (Migration; abgedeckt).
- **color (gebunden/Literal)** → gerenderte Icon-Farbe entspricht dem Wert
  (computed-style **gemessen**; wirkt seit P231).
- **visible=false (gebunden)** → nicht gerendert (Render-Gate, ADR 0037).
- **kein icon** → kein `<sl-icon>` (Negativ; abgedeckt).
- **msg.payload** → aktualisiert `icon` live (SSE).
- **Ports:** 1 Input, 0 Output.

## verify

`browser` — jedes Kriterium im laufenden App (Playwright; Farbe/Sichtbarkeit
gemessen; [[verify-rendering-by-measurement-not-tags]]).

## spec

`docs/nodes/display/ui-icon.md` — `visible` (Base-Field) in „Allgemein" dokumentieren.

## tests

`tests/e2e/nodes/view/ui-icon.spec.ts` + `.tests.md` — icon-Binding, color, visible,
msg.payload ergänzen (bestehende Tests bleiben); Katalog aktualisieren.

## geplante Fixes (nach Review)

1. Spec: `visible` in „Allgemein" ergänzen.
2. Tests: icon-Store-Binding, color (gemessen), visible-Gate, msg.payload-Input.

## Result

**Delivered.** ui-icon Konformitäts-Pass (leicht — Knoten war in gutem Zustand).
- **Spec** `docs/nodes/display/ui-icon.md`: `visible` (Base-Field, P231/ADR 0037, Render-Gate) in „Allgemein" dokumentiert (Muster ui-divider); `disabled`=N/A, `color`/`size` als eigene dedizierte Controls vermerkt.
- **Tests** `tests/e2e/nodes/view/ui-icon.spec.ts`: 9 bestehende unberührt, **7 neue gemessene** ergänzt — jede erwartete Wert aus dem Serializer/Renderer ABGELEITET (nicht geraten): icon state-Binding (live) + Store-`replace` via SSE, `color` Literal → inline `style="color:…"` + computed-style gemessen, `visible=false` → Komponente ausgeblendet (renderer gate) / `true` → gerendert. Katalog `ui-icon.tests.md` aktualisiert.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/view/ui-icon.spec.ts` **16 passed** (inkl. der geflaggten C02-computed-style-Farbe). `check:specs`/`check:fields`/`check:help`/`check:no-crash`/`check:roundtrip`/`check:links`/`pnpm validate` grün.

**Aufgedeckter Spec↔Code-Bug (Konformitäts-Ertrag, Follow-up):** Die Acceptance forderte „`msg.payload` → Icon-Update live". **Der Code macht das NICHT** — `componentStateInputHandler` erkennt nur `msg.ui.component.op` und reicht `msg.payload` durch (kein Feld-Setter; auch kein `msg.ui.patch` trotz Spec-Input-Abschnitt). Der Agent hat KEINEN grünen Fake-Test geschrieben, sondern das REALE Verhalten getestet (Payload ändert das Icon nicht — Mutations-Guard) + geflaggt. Der echte Live-Pfad ist das store-gebundene Icon. **Entscheidung offen (eigene Phase):** entweder `msg.payload`/`msg.ui.patch` als Icon-Setter implementieren, ODER den Spec-Input-Abschnitt korrigieren. Als Task-Chip herausgelöst.

**Cost.** Sub-Agent `phase/P235` (worktree), ~9 min; Orchestrator-E2E-Verifikation. Token-Zeile in `.ai/agent-runs.jsonl`.
