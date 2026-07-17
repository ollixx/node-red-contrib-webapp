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

## Ergänzt (P239 — Icon-Name bindbar im Editor, ADR 0012)

P235 hatte den **Laufzeit**-Pfad eines gebundenen Icon-Namens bereits bewiesen
(P235-B01/B02) — die Bindung war dort aber nur durch **Hand-Edit am Flow-JSON**
erreichbar. P239 schließt den **Editor-Exposure-Gap**: `installIconField` rendert
statt eines reinen Textfelds einen typedInput über den kanonischen Binding-Satz.
Die Tests unten fahren deshalb den **echten Editor** (nicht die Admin-API).

### Unit (packages/editor/test/p239-icon-binding.test.ts — 18 Tests)

Laden `resources/lib/editor-common.js` in einer vm (wie P113) und prüfen die reine
Serialisierung ohne DOM.

| ID | Beschreibung | Testziel |
|---|---|---|
| P239-U01 | `valueBindingTypes({category:"icon"})` == der `value`-Satz mit **genau einem** Delta: `str` → `icon` (positionsgleich, keine Additions/Removals) | Das `icon`-Category ist ein **Delta** auf dem kanonischen Satz (wie `color`, P238), keine Parallel-Liste — die Binding-Arten können nicht pro Feld auseinanderdriften. |
| P239-U02 | Der `icon`-Literal-Typ trägt den P69-Picker auf seinem `expand`-Button | Das `ui-image.src`-Muster (Picker-Typ schreibt ein Literal zurück). |
| P239-U03–U07 | `readIconBinding` öffnet alle drei `iconFieldSchema`-Formen korrekt (Bare-String, `library:name`, `{library,name}`, Binding-Objekt, leer) | Back-Compat: kein deployter Wert öffnet falsch. |
| P239-U08–U14 | `applyIconBinding` ist **verlustfrei**: ein unverändertes Literal wird **identisch** (`toBe`) zurückgeschrieben — auch `{library:'default',name:'house'}`, dessen String-Form (`house`) die Library verschluckt | Der Kern der Round-trip-Akzeptanz; ein naives Save würde `{library,name}` → `"house"` driften. |
| P239-U15–U18 | Literal→Binding persistiert das Binding-Objekt; Binding→Literal persistiert den nackten Namen (**nie** ein `{kind:"literal"}`-Wrapper); Whitespace wird getrimmt | Die Form-Grenze zwischen den beiden Autoren-Wegen. |

### E2E: Editor-Weg (tests/e2e/nodes/view/ui-icon.spec.ts)

Alle Erwartungswerte sind **gemessen** (laufendes Node-RED auf 1882), nicht hergeleitet.

| ID | Beschreibung | Testziel |
|---|---|---|
| P239-E01 | Das Typ-Menü des Felds bietet **gemessen** genau `store, query, routeParam, reactive, msg, jsonata, icon, num, bool, json, date, flow, global, env` — **kein** `str`. Zusätzlich: `#node-input-icon` existiert **nicht**, `#node-input-iconBinding` trägt den typedInput-Container | Beweist die Editor-Exposure am **echten** Typ-Menü (nicht am Quelltext) und die Carrier-Form (ADR 0031). Gemessen aus dem geöffneten Menü (`.red-ui-typedInput-options:visible`) — jeder typedInput hängt sein eigenes Menü an `<body>`. |
| P239-E02 | Autor wählt im Editor Typ **Store** + Store-Knoten → Save → gespeichert ist `{kind:"store", path:"iconEdStore"}` → Deploy → gerendertes `<sl-icon name>` == **`house`** (der aufgelöste Store-Wert), **nicht** das deployte Literal `gear`; danach Inject `replace` → `name` wechselt live auf **`star`** | **Die Kern-Akzeptanz.** Vor P239 unmöglich ohne Flow-JSON-Handarbeit. Misst das echte `name`-Attribut und den SSE-Live-Tausch — der in P235 belegte Laufzeitpfad, jetzt aus dem Editor erreichbar. |
| P239-E03 | Literaler Modus: Button „Icon wählen…" + Vorschau sichtbar, Vorschau-`src` == `resources/node-red-contrib-webapp/shoelace/assets/icons/house.svg`; nach Wechsel auf Typ `store` **beide verschwunden**; zurück auf `icon` → beide wieder da (`gear.svg`) | Akzeptanz „Vorschau bleibt erhalten" + Picker/Vorschau sind literal-only (ein Store-Pfad hat nichts zu picken/zeigen). Gemessen an der echten Preview-URL, nicht an einem Tag. |
| P239-E04 | Picker im literalen Modus **real geöffnet**: Suche → Tile `house` klicken → Feld-Typ bleibt `icon`, Wert `house` → Save → gespeichert `"house"` (**nackter String**, kein `{kind:"literal"}`-Wrapper) → Deploy → gerendertes `<sl-icon name="house">` | Akzeptanz „Der Auswahl-Dialog bleibt" — end-to-end bis aufs gerenderte Element, inkl. Back-Compat der persistierten Form. |

### E2E: Round-trip (verlustfrei, ADR 0031)

Öffnen→Done **ohne Änderung**; danach wird `RED.nodes.node(id).icon` gelesen.

| ID | Beschreibung | Testziel |
|---|---|---|
| P239-R01 | Bare-String `"house"` überlebt unverändert | Back-Compat-Form (Muster jedes bestehenden Flows). |
| P239-R02 | Shorthand `"lucide:star"` überlebt unverändert | Die Library-Kurzform wird nicht zerlegt. |
| P239-R03 | Literal `{library:"lucide", name:"star"}` überlebt unverändert | Die Objekt-Form wird nicht zum String geplättet. |
| P239-R04 | Literal `{library:"default", name:"house"}` überlebt unverändert | Schärfster Fall: die String-Form (`house`) verliert die Library — ein naives Save würde driften. |
| P239-R05 | Binding `{kind:"state", path:"iconName"}` überlebt unverändert | Die neue Form clobbert nicht (die Bug-Klasse, gegen die der Carrier schützt). |

> **Muster-Hinweis (P239):** `ui-button` und `ui-avatar` rufen `installIconField`
> ebenfalls auf, steigen aber **nicht** in den Binding-Modus ein (`binding` ist
> opt-in) und behalten das literale Textfeld — ihre Binding-Exposure gehört in
> ihre eigenen Konformitäts-Pässe (ui-button: P236). Abgedeckt durch
> `tests/e2e/nodes/editor/p69-icon-picker.spec.ts` (Library-Filter-Test auf
> ui-button) — der Test läuft unverändert weiter und beweist damit, dass die
> Erweiterung **additiv** ist.
