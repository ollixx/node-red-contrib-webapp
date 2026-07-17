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

## Ergänzt (P238 — `color`-Standard-Control, ADR 0039)

### E2E: Theme-Token / Freifarbe / Binding / Back-Compat (tests/e2e/nodes/view/ui-icon.spec.ts)

Alle Erwartungswerte sind **gemessen** (echtes Node-RED, `getComputedStyle` am
gerenderten `<sl-icon>`), nicht hergeleitet. Die Token lösen gegen die
`--wa-color-*`-Design-Tokens der App auf (`:root` in `nodes/webapp.js`, per
`designTokens` am `ui-app` überschreibbar) — **nicht** gegen Shoelace-`--sl-color-*`.
Gemessene Defaults: `--wa-color-primary:#3b82f6`, `--wa-color-success:#22c55e`,
`--wa-color-danger:#ef4444`, `--wa-color-text:#111827`.

| ID | Beschreibung | Testziel |
|---|---|---|
| P238-T01 | `color = {literal, "token:primary"}` → gemessene `color` == `rgb(59, 130, 246)` **und** != `rgb(17, 24, 39)` | Gemessen: der Theme-Token wirkt am Element und ist **nicht** die Default-Textfarbe (d. h. er greift wirklich, statt nur zu erben). |
| P238-T02 | `token:primary` → `style="color:var(--wa-color-primary)"`; HTML enthält **nie** `color:primary` / `color:token:primary` | Der Token wird als Design-Token-CSS-Custom-Property ausgegeben, nie roh (`primary` ist kein gültiger CSS-Wert) — der Sinn des `token:`-Präfixes (ADR 0039 §1). |
| P238-T03 | Kein `color` → **kein** Style-Attribut; gemessene `color` == `rgb(17, 24, 39)` | Baseline für P238-T01: das Icon erbt die Theme-Textfarbe; leeres `color` erfindet kein CSS. |
| P238-F01 | `color = {literal, "#ff0000"}` (die vom Color-Selector persistierte Form) → gemessene `color` == `rgb(255, 0, 0)` | Gemessen: freie Farbe wird unverändert durchgereicht. **Nicht** deckungsgleich mit P235-C02: das ist die Plain-String-Form (Back-Compat-Pfad), nicht was der Selector schreibt. |
| P238-B01 | Deployter **Plain-String** `color: "#ff0000"` (Form vor P238) → Knoten fällt nicht aus der App, gemessene `color` == `rgb(255, 0, 0)` | Migration-Guard (ADR 0039 §4): das `z.string()`-Override ist weg, ein nackter String würde die Validierung reißen — `normalizeColorField` (mapConfig) migriert ihn vorher zu einem `literal`-Binding. Kein deployter Flow verliert seine Farbe. |
| P238-S01 | `color` an Store gebunden (`{store, colStore1}`, Wert `"token:success"`) → gemessene `color` == `rgb(34, 197, 94)` | **Vor P238 unmöglich** (`color` war Plain-String ⇒ `bind.color` blieb leer). Beweist zusätzlich: ein als *Daten* gespeicherter Token löst genauso auf wie einer aus dem Editor. |
| P238-S02 | Store-Änderung (Inject `replace` → `"token:danger"`) → gemessene `color` wechselt live `rgb(34, 197, 94)` → `rgb(239, 68, 68)` **ohne Reload** | Die Kern-Capability aus ADR 0039 §4: eine gebundene Farbe färbt das Icon **live** (SSE-Snapshot-Push morpht das DOM). |

> **Harness-Hinweis (P201):** die Store-Tests halten **eine** `ui-app` pro Flow.
> Ein Store-Update wird der App zugeordnet, die den Store-Knoten besitzt (Match
> über den Flow-Tab, `findAppIdForNode`). Mehrere Apps auf **einem** Tab filen das
> Update unter der ersten App ab — das Icon aktualisiert dann nie. FlowBuilder +
> `resetFlow` liefern ohnehin eine App pro Test.
