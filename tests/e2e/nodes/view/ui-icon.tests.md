# Testkatalog: ui-icon

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P159 (Field-Typing Welle 2).

## Implementierte Tests (P159)

### E2E: Render (tests/e2e/nodes/view/ui-icon.spec.ts)

| ID | Beschreibung | Datei |
|---|---|---|
| P83-R01 | Rendert als `<sl-icon>` mit konfiguriertem Icon-Namen | ui-icon.spec.ts |
| P83-R02 | Rendert mit `library`-Attribut für namespace Icons | ui-icon.spec.ts |
| P83-R03 | Kein Icon konfiguriert → Node-Wrapper gerendert, aber KEIN `<sl-icon>` (leerer Leaf) | ui-icon.spec.ts |
| P159-S01 | `size="xs"` → CSS-Klasse `webapp-icon--xs` | ui-icon.spec.ts |
| P159-S02 | `size="sm"` → CSS-Klasse `webapp-icon--sm` | ui-icon.spec.ts |
| P159-S03 | `size="md"` → CSS-Klasse `webapp-icon--md` | ui-icon.spec.ts |
| P159-S04 | `size="lg"` → CSS-Klasse `webapp-icon--lg` | ui-icon.spec.ts |
| P159-S05 | `size="xl"` → CSS-Klasse `webapp-icon--xl` | ui-icon.spec.ts |
| P159-M01 | Freier CSS-Alt-Wert (z. B. `"24"`) crasht nicht — Migration-Guard | ui-icon.spec.ts |
