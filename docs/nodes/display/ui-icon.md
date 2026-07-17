# `ui-icon`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-icon` rendert ein **Icon per symbolischen Namen** — icon-set-agnostisch. Das
Renderer-Backend bestimmt, welches Icon-Set (z. B. Shoelace-System-Icons,
Heroicons, Lucide) verwendet wird; der Knoten selbst kennt nur den semantischen
Icon-Namen. Der Knoten ist rein darstellend; er emittiert keine Events.

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder `ui-container` — genau
  einer; gemountet über `mount` in einen Slot des Parents.
- **Kinder:** keine — `ui-icon` ist ein Blatt-Knoten.
- **Rolle zur Laufzeit:** der Renderer löst den Icon-Namen gegen das aktive
  Icon-Set auf und stellt das Icon in der konfigurierten Größe und Farbe dar.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Mount-Baum,
Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Icon N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents (`<type>:<id>/<slot>`). Bestimmt die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

#### Basis-Felder (P231, ADR 0015 — Schema + Runtime)

`ui-icon` mischt die gemeinsame Basis-Feld-Gruppe über
`installBaseFields(config)` ein (siehe [editor.md](../concepts/editor.md),
Abschnitt „Basis-Felder + Editor-Struktur"). Der Knoten führt für `size` ein
**eigenes** Control (Gruppe „Darstellung") und blendet es daher aus dem
Basis-Satz aus (`omit`); `disabled` ist N/A:

| Feld | Label | Editor-Typ | Anwendbar | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible" | Boolean-Zustand-typedInput (ADR-0012-Boolean-Satz) | ja | Sichtbarkeit; leer = sichtbar (Default). Persistiert als Binding-Objekt und wird zur Laufzeit als `visibleIf` ausgewertet (Render-Gate): `false` ⇒ das Icon wird nicht gerendert. Dynamisches Zustandsmodell (Binding vs. interner Wert, msg/Duration/Aktionen): [ADR 0037](../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md). |
| `disabled` | „Disabled" | — (N/A) | **nein** | Ein Icon hat keinen interaktiven Zustand — Feld wird disabled mit diesem Hinweis angezeigt. |
| `color` | „Color" | `color`-Standard-Control (Theme-Token / Farbe / Bindings) | **ja** | Farbe des Icons — seit **P238** ([ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md) §4) das **gemeinsame Basis-Feld**, nicht mehr ein eigenes Plain-String-Feld. Siehe „Darstellung" unten. |
| `size` | „Size" | — (eigenes Control, „Darstellung") | **eigen** | Größe des Icons — als **eigenes** Token-SelectBox unter „Darstellung" geführt, nicht über den Basis-Satz. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `icon` | „Icon" | Textfeld + Icon-Picker (P69) | **ja** | Backend-neutraler Icon-Wert `{ library, name }`. Im Editor als Textfeld mit „Icon wählen…"-Button gespeichert: ein nackter Name (`home`) nutzt die Default-Library (das vendorte Bootstrap-Set), die Kurzform `library:name` (`lucide:user`) wählt eine registrierte Zusatz-Library. Darf nicht leer sein. Bindbar (literal via Picker ODER dynamisch via state/msg/store/…). Das Renderer-Backend löst `{ library, name }` gegen sein Icon-Set auf (`<sl-icon library name>`). |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `size` | „Größe" | SelectBox (`xs` / `sm` / `md` / `lg` / `xl`) | optional | Größe des Icons. Default: `md`. Das Backend übersetzt die Größenstufe in eine konkrete Pixel- oder em-Größe. **Migration:** Knoten mit alten freien CSS-Werten (z. B. `24`, `1.5rem`) werden im Editor als `<wert> (bestehend)` angezeigt und brechen nicht — der Wert bleibt erhalten bis der Nutzer aktiv einen Token wählt. |
| `color` | „Color" | `color`-Standard-Control: **Theme-Token** (SelectBox) \| **Farbe** (Textfeld + Color-Selector) \| **Bindings** (voller kanonischer Satz) | optional | Farbe des Icons. **Bindbar** (P238, [ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md) §1/§4) — ein `state`/`store`/`query`-gebundener Wert färbt das Icon **live** (SSE-Re-Render). Drei Wege in einem Control: **Theme-Token** (`primary`, `success`, `warning`, `danger`, `neutral`, `info`, `muted`) — persistiert als `token:<name>`, gerendert als `var(--wa-color-<token>)`, folgt also dem App-Theme (`designTokens` auf `ui-app`); **Farbe** — beliebiger CSS-Wert (`#ff0000`, `rgb(255,0,0)`, `hsl(0 100% 50%)`, `red`), über den Color-Selector (HSB/RGB/Web) wählbar oder direkt getippt; **Binding** — jede kanonische Binding-Art ([ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)). Default: leer ⇒ das Icon erbt die Text-/Icon-Farbe des umgebenden Themes (`colorText`). Beobachtbare Wirkung: inline `style="color:…"` am `<sl-icon>`. Ein unbekannter Wert wird **ignoriert** (kein Style-Attribut) — es wird nie ungültiges CSS ausgegeben. **Migration:** ein deployter Plain-String (`"#ff0000"`, das Feld vor P238) wird verlustfrei als `literal`-Binding übernommen und rendert unverändert. |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-icon"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Icon per symbolischen Namen, backend-agnostisch), Hinweis auf Icon-Name-Vokabular,
`size` und `color` und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-icon.md`.

## Input

`ui-icon` hat einen **Eingangs-Port**, der folgende Messages akzeptiert:

- **`msg.ui.component.op`** (`show` / `hide`): blendet das Icon ein oder aus,
  ohne die Konfiguration zu verändern.
- **`msg.ui.patch`**: überschreibt beliebige Felder der Knoten-Definition
  (z. B. `icon`, `size`, `color`).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

`ui-icon` definiert **kein** primäres `msg.payload`-Feld — er hat keinen
einzelnen darstellbaren Hauptwert, der per Payload gesetzt würde.

## Output

`ui-icon` hat **keinen Output-Port**. Der Knoten ist rein darstellend und
emittiert keine Events.

## Theming

`ui-icon` trägt kein eigenes `variant`-Feld — die Farbe wird vom Basis-Feld
`color` bedient, das die Theme-Tokens **und** darüber hinaus jede Farbe anbietet
(`variant` ist die Reduktion auf die Tokens, `color` die Obermenge;
[ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)
§1/§2). Größe und Farbe werden über `size` und `color` gesteuert; nicht gesetzte
Farbe erbt das Icon aus dem App-weiten Theme (`colorText`,
[theming.md](../concepts/theming.md)). Ein **Theme-Token** (`token:<name>`) wird
als `var(--wa-color-<token>)` gerendert und folgt damit den `designTokens` der
App — im Gegensatz zu einer freien Farbe, die fix ist. Das Rendering-Backend
(heute Shoelace) bildet die Konfiguration auf seinen Icon-Mechanismus ab; weitere
Backends folgen demselben semantischen Contract.

## Besonderheiten

- **Backend-neutraler Icon-Wert (P69).** Der Icon-Wert ist `{ library, name }`
  (bzw. die String-Kurzform `library:name`, mit Default-Library wenn die Library
  weggelassen wird). Der Renderer bildet ihn aufs Backend ab (Shoelace:
  `<sl-icon library name>`); ein anderes Backend kann dasselbe Paar auf seinen
  eigenen Icon-Mechanismus mappen (ADR 0002). Portabilität von `{ library, name }`
  setzt voraus, dass die Library im Ziel-Backend registriert ist.
- **Global registrierbare Icon-Libraries (P69).** Zusätzlich zur Default-Library
  (vendortes Bootstrap-Set) lassen sich weitere Libraries auf Modul-/globaler
  Ebene registrieren (`RED.settings.webappIconLibraries`, lokal ausgeliefert,
  client-seitig via Shoelace `registerIconLibrary()`). Der Editor-Picker liest die
  verfügbaren Icons aus einem Server-Manifest (`GET /webapp/icons/manifest`).

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [inputs.md](../concepts/inputs.md) — Component-Ops (`show`/`hide`)
- [editor.md](../concepts/editor.md) — Editor-Typen (Mount-Baum)

## Offene Punkte

- Das kanonische Icon-Namens-Vokabular und die Alias-Mapping-Strategie zwischen
  Backends (z. B. Shoelace → Heroicons) sind noch nicht spezifiziert.
- Klickbarkeit (`clickable`, Emittieren eines `click`-Events) ist noch nicht modelliert;
  aktuell ist `ui-icon` immer rein dekorativ.
- Animation (z. B. Spinner-Modus) ist noch nicht im Schema.
