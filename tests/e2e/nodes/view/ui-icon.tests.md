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

## Ergänzt (P235 — node-conformance)

### E2E: Binding / color / visible / msg (tests/e2e/nodes/view/ui-icon.spec.ts)

| ID | Beschreibung | Testziel |
|---|---|---|
| P235-B01 | `icon` state-gebunden (Store) → Live-Icon-Name im gerenderten `<sl-icon name>` | Beweist: `icon` ist bindbar (iconFieldSchema); der Renderer löst `bind.icon` (state→Store) in den gerenderten Namen auf. |
| P235-B02 | Store-Änderung (Inject `replace`) → Icon-Name wechselt via SSE (`house`→`star`) | Beweist: Live-Update-Pfad — Store-Snapshot-Push morpht das gerenderte `<sl-icon>`. |
| P235-C01 | Literal `color` → Inline-`style="color:…"` im ausgelieferten HTML | Beweist: der dedizierte Plain-String-`color` erreicht das `<sl-icon>` als rohe Inline-Farbe (renderIconHtml). |
| P235-C02 | Literal `color` → gemessene `getComputedStyle(el).color` == Wert (`rgb(0, 128, 0)`) | Gemessen (nicht Tag/String): die Farbe wirkt am gerenderten Element. Kein `--color` (das ist ui-divider). |
| P235-V01 | `visible` an Store=false gebunden → Icon **nicht** gerendert (Wrapper + `<sl-icon>` weg) | Render-Gate (`visibleIf`, ADR 0037) blendet die ganze Komponente aus. |
| P235-V02 | `visible` an Store=true gebunden → Icon gerendert | Gegenprobe zum Render-Gate. |
| P235-P01 | Inject `msg.payload` → gerendertes Icon **unverändert** (`house` bleibt `house`) | Wahrheitsgetreues Negativ: ui-icon nutzt `componentStateInputHandler` (Pass-Through); `msg.payload` ist **kein** Icon-Setter (Spec: „kein primäres msg.payload-Feld"). Mutation-Guard. |
