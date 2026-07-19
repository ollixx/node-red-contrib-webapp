# `ui-action`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-action` ist der bequeme, **typisierte Emitter** des `msg.ui.action`-Contracts
([actions.md](../concepts/actions.md)). Bei Eingang einer `msg` baut er aus seiner
Konfiguration (überschreibbar durch `msg.ui.action.*`) eine schema-valide
`msg.ui.action` und gibt sie am Output-Port aus. Eine Action ändert ausschließlich
den **Interaktionszustand** der UI (Navigation, Sichtbarkeit, Aktivierungszustand,
Fokus) — **niemals fachliche Daten**; dafür gibt es [`ui-store`](../state/ui-store.md).
`ui-action` ist **kein** privilegierter Knoten: Jeder Knoten, der den Contract
sendet (`inject`, `function`, …), löst die Interaktion aus. Den SSE-Push an den
Client führt der **verdrahtete Zielknoten** aus, nicht `ui-action`.

## Einordnung

- **Parent:** genau eine `ui-app`. Die App bestimmt den Routing-Kontext und an welchen Client Actions weitergeleitet werden.
- **Kinder:** keine. `ui-action` wird nicht gemountet.
- **Ziel:** primär der über den Output-Port **verdrahtete** Zielknoten; sekundär per Canvas-Picker gewählte `targets`; alternativ ein `target`-Override aus der `msg`.
- **Rolle zur Laufzeit:** baut den Action-Contract und stellt ihn dem Zielknoten zu; der Zielknoten löst `target` auf seine eigene Node-ID auf und pusht das Kommando.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (SelectBox,
Node-Picker-Dialog, typedInput, Canvas-Knoten-Picker).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Action N`. |
| `parent` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. Bestimmt den Routing-Kontext. |
| `actionType` | „Action-Typ" | SelectBox (Verb-Set) | optional | Das voreingestellte Interaktions-Verb. Auswahl aus dem kanonischen Verb-Set (siehe unten). Überschreibbar via `msg.ui.action.type`. Leer = unspezifiziert (Typ kommt dann aus der `msg`). |
| `description` | „Beschreibung" | Textfeld | optional | Freitext-Beschreibung der Aktion (Dokumentation im Editor). |

### Gruppe „Navigation" (nur bei `actionType: navigate`) — ADR 0011 (P118)

Die Zielquelle ist ein **expliziter Modus** (`targetMode`); pro Modus sind nur
die zugehörigen Felder gesetzt — eine Doppel-Konfiguration ist technisch
ausgeschlossen (Verstöße sind Compile-Validierungsfehler). Das Datenmodell kommt
aus **P118**; die UI-Umschaltung (Modus-Toggle, Wire-Scan, Mapping-Tabelle) ist
seit **P119** umgesetzt (siehe „Editor-UX" unten).

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `targetMode` | „Zielquelle" | `wire` \| `route` \| `url` | optional (Default per Migration) | Gespeicherte Absicht. `wire` = Ziel kommt über die Verdrahtung; `route` = per Referenz gewählte `ui-route`; `url` = ganze URL als `to`. |
| `routeId` | „Ziel-Route" | Referenz auf eine `ui-route` (Picker, P119) | nur Modus `route` | App-global zur Routen-`path` aufgelöst. Im Modus `route` **kein** `to`. |
| `params` | „Parameter" | typisierte Liste `[{ name, value, valueType }]` | optional (Modus `route`/`wire`) | Benannte Parameter, die die `:platzhalter` der Ziel-Route füllen. `valueType` ∈ `str` \| `msg` \| `jsonata` \| `flow` \| `global` \| `env`; jeder Wert wird **zur Action-Zeit gegen die auslösende msg** ausgewertet. Im Modus `url` ignoriert (die URL trägt ihre Werte selbst). |
| `to` / `toType` | „Navigation zu" | typedInput (`str` \| `msg` \| `flow` \| `global` \| `jsonata`) | nur Modus `url` | Ganze URL/Pfad. `str` = literaler Pfad (ggf. mit `:platzhaltern`); `msg`/`flow`/`global` lesen ihn aus Kontext; `jsonata` berechnet ihn. Im Modus `url` **kein** `routeId`. Default-Typ: `str`. |

> **Migration (Lade-Shim).** Bestands-Configs ohne `targetMode`: `to` gesetzt →
> `url`; `routeId` gesetzt → `route`; sonst → `wire`. Ein Legacy-`params`-Objekt
> `{k:"v"}` wird verlustfrei in eine Liste mit `valueType: "str"` migriert.

#### Editor-UX (P119, ADR 0011)

Die Gruppe „Ziel" zeigt einen **Segment-Schalter** mit drei Modi (je Icon +
Label): **via Wire** (Stecker) · **Route** (Kette) · **URL** (Globus). Genau ein
Modus ist aktiv; die Felder der anderen Modi sind ausgeblendet und werden beim
Speichern **nicht serialisiert** (Modus-Exklusivität). Der **Hintergrund des
Panels** trägt die Modus-Farbe (blau für Wire, lila für Route, neutral für URL;
Tokens aus P120); Formfelder sitzen als helle Insets darauf. Ein separates Badge
im Panel entfällt — nur eine schlichte Überschrift (ADR 0011 §4).

- **Initiale Vorbelegung** (nur wenn `targetMode` noch nie gespeichert wurde):
  Ein transitiver **Wire-Scan** (BFS über ausgehende Wires, durch
  Zwischenknoten, Zyklus-/Tiefenschutz; Link-Nodes/Subflows werden nicht
  verfolgt) findet erreichte `ui-route`/`ui-app`. ≥1 Treffer → Modus `wire`
  vorgewählt; sonst `route`. Ab dem ersten Speichern gilt ausschließlich die
  gespeicherte Absicht — spätere Wire-Änderungen schalten den Modus **nicht** um.
- **Wire-Scan-Assistenz (nie Validierung):** genau 1 Treffer → „via Wire →
  `<path>`" + Mapping-Tabelle aus dessen `:platzhaltern`; mehrere Treffer →
  „via Wire → n mögliche Ziele" + Platzhalter pro Ziel gruppiert + Hinweis, dass
  die Versorgung aller Zweige Laufzeitverantwortung ist (`msg.ui.action.params`);
  keine Treffer → freie Parameter-Liste. **In keinem Fall** ein
  Validierungsfehler aus dem Scan.
- **Route-Modus (hart validiert):** Picker-Feld (Preset `routes`, app-gescoped)
  + Mapping-Tabelle, deren linke Spalte fix die `:platzhalter` der gewählten
  Route trägt (aus dem `path` geparst), rechte Spalte je ein typedInput
  (`str`/`msg`/`jsonata`/`flow`/`global`/`env`). Routen-Wechsel baut die Tabelle
  neu auf; gleichnamige Werte bleiben erhalten. **Validierung:** Platzhalter ohne
  Wert oder eine gelöschte/unbekannte `routeId` → Knoten ungültig vor Deploy.
- **URL-Modus:** nur das `to`-typedInput, **keine** Parameter-Sektion. Ein
  `str`-Pfad mit `:platzhaltern` ohne Werte erzeugt eine **sanfte Warnung**
  (keine Blockade).

### Gruppe „Ziel"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `targets` | „Ziel-Knoten (optional)" | Canvas-Knoten-Picker („Auf Canvas wählen") | optional | Liste der per Canvas-Picker gewählten Zielknoten-IDs — der sekundäre „wireless"-Pfad. Bei Eingang Zustellung an jeden Knoten via `receive()`. **Primär** bleibt das Wiring des Output-Ports. |
| `part` | „Teil (Sub-ID)" | Textfeld | optional | Sub-ID innerhalb des Ziels für `open` / `close` / `select` (z. B. Accordion-Sektion, Tree-Branch, Tab-Name). Überschreibbar via `msg.ui.action.part`. |

> Das Altfeld `target` (Einzel-String) wird aus pre-P60-Flows weiter akzeptiert
> und wie ein einzelnes gewähltes Ziel behandelt; im Editor ersetzt der Picker es.
> Zur Laufzeit ist `msg.ui.action.target` der einzige kanonische Override (P79); ein `targetId` wird ignoriert.

### Kanonisches Verb-Set (ADR 0005)

Die Verben (`actionTypeSchema`) sind in drei semantische Klassen getrennt:

- **Sichtbarkeit (Präsenz):** `show` / `hide` — schreiben den EINEN `visible`-Wert
  des Zielknotens ([ADR 0037](../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md)):
  ist `visible` an einen Store gebunden, wird **durch den Store durchgeschrieben**
  (dieselbe Wahrheit wie ein direkter Store-Write); ungebunden landet der Wert im
  **internen per-Client-Slot** des Knotens. Die Sichtbarkeit folgt dem Wert (ein
  Snapshot-Re-Render entfernt/zeigt das Element), **nicht** einer separaten
  Client-Overlay-Schicht. `ui-alert` ist ein gültiges Ziel.
- **Offenlegung (Disclosure):** `open` / `close` — öffnet/schließt ein bereits sichtbares, aufklappbares Element (Dialog, Drawer, Accordion-Sektion, Details/Collapse, Tree-Branch). Nutzt optional `part`. Ersetzt `openDialog`/`closeDialog`, die als Aliase erhalten bleiben.
- **Einzelauswahl:** `select` — genau eines aus einer Geschwister-Gruppe aktiv (Tab, Stepper-Schritt, Menü). Nutzt `part`.

plus `navigate`, `enable` / `disable` (schreiben analog den `disabled`-Wert, ADR
0037), `focus`, `reset`. (`trigger` bleibt als
Legacy-Pass-Through-Verb erhalten.) Es gibt **keine** CRUD-Verben — die früheren
`submit`/`remove` wurden in P29 entfernt; Daten gehören in den verdrahteten Flow.

### Inline-Hilfe (HTML)

Der `data-help-name="ui-action"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein: Zweck (typisierter Emitter des Action-Contracts, nur
Interaktionszustand), das Verb-Set, die drei Navigations-Modi (wire/route/url), der Hinweis
dass der **Zielknoten** den Push ausführt und die Zieladressierung primär über das
Wiring läuft — plus ein Link auf die ausführliche Doku. Empfohlener Link (später
ggf. Wiki): `https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/behavior/ui-action.md`.

## Zieladressierung

1. **Output-Port Wiring (primär).** Der Zielknoten wird direkt mit dem Output-Port verdrahtet — der bevorzugte Weg für alle statischen, bekannten Ziele.
   ```
   ui-action (disable) ──→ ui-button "Speichern"
   ui-action (show)    ──→ ui-container "Fehlermeldung"
   ui-action (open)    ──→ ui-dialog "Bestätigung"
   ```
2. **Canvas-Knoten-Picker (sekundär, „wireless").** Über „Auf Canvas wählen" (`targets`) werden ein oder mehrere Zielknoten gewählt; bei Eingang via `targetNode.receive(msg)` zugestellt — derselbe Input-Pfad wie ein Wire.
3. **`target` aus `msg` (dynamisch).** Ist das Ziel erst zur Laufzeit bekannt, trägt `msg.ui.action.target` die Node-ID; sie überschreibt die Default-Auflösung des Zielknotens. Zustellung ebenfalls via `receive()`.

## Input

Der In-Port empfängt eine `msg`. Relevante Felder:

```
msg.ui.action.type   = "navigate" | "show" | "hide" | "open" | "close" | "select" | "enable" | "disable" | "focus" | "reset"
msg.ui.action.target = <node-id>  ← optionaler Ziel-Override (sonst löst der Zielknoten auf sich selbst auf); einziges kanonisches Feld (P79)
msg.ui.action.part   = <sub-id>   ← Granularität für open / close / select
msg.ui.action.to     = <pfad>     ← explizites Navigationsziel (Modus route/url; leer im Modus wire). Override hat Vorrang.
msg.ui.action.params = { k: v }   ← benannte URL-Parameter für navigate (Laufzeit-Override, ergänzt die konfigurierten)
msg.ui.clientId      = <client>   ← schränkt die Action auf einen bestimmten Client ein (sonst Broadcast)
```

- **Was passiert:** `ui-action` baut aus Konfiguration + msg-Overrides eine
  schema-valide `msg.ui.action` und reicht die **angereicherte** `msg` am Out-Port
  weiter (anreichern, nicht ersetzen — ADR 0007 §1). Fremde `msg.*`- und
  `msg.ui.*`-Felder reisen unverändert mit.
- **Navigation, drei Modi (ADR 0011 / P118):**
  - `wire` — kein explizites Ziel in der msg; die empfangende `ui-route` baut die
    Location aus ihrem eigenen `path` (heutiges Verhalten). Macht Verzweigung
    wohldefiniert: die Route, die die msg empfängt, gewinnt.
  - `route` — `routeId` wird app-global zur Routen-`path` aufgelöst, die
    typisierten `params` werden gegen die auslösende msg ausgewertet, daraus die
    Location gebaut und als **explizites Ziel** in `msg.ui.action.to` getragen.
  - `url` — `to`/`toType` liefern die ganze URL; `params` entfällt.
  `onEnter`/`onLeave` werden in allen Modi emittiert (über den Connect-basierten
  Lifecycle nach dem Full-Reload, P112).
- **Adressierungs-Vorrang (ADR 0011 §3):** Trägt eine eingehende navigate-msg
  bereits ein explizites Ziel (Modus `route`/`url` oder `msg.ui.action.to`), so
  reicht eine empfangende `ui-route` sie **unverändert durch** — sie setzt NICHT
  ihren eigenen Pfad darauf. Eine verdrahtete Route kapert also keine adressierte
  Navigation.
- **Keine Mehrdeutigkeits-Validierung mehr:** Die frühere P66-Regel „verdrahtet
  **und** `to` = Deploy-Fehler" (samt fehlendes-Ziel- und toter-Link-Scan)
  entfällt ersatzlos — der Modus speichert die Absicht. Eine unsinnige
  Verdrahtung ist per Owner-Entscheid Nutzer-Verantwortung; es gibt **keine**
  scan-basierte Laufzeit-/Deploy-Prüfung.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.
- **Framework-Fehler** werden gemäß [logs-errors.md](../concepts/logs-errors.md)
  als strukturierter Fehler gemeldet.

## Output

Der Output-Port emittiert die **mit `msg.ui.action` angereicherte `msg`**: der
typisierte Befehl wird aus Konfiguration + msg-Overrides gebaut und in
`msg.ui.action` geschrieben; alle fremden Felder reisen unverändert mit. Der
verdrahtete Zielknoten verarbeitet das ihm bekannte Verb: `show`/`hide` und
`enable`/`disable` **schreiben den dynamic-state-Wert** (`visible`/`disabled`) und
lösen darüber den Re-Render aus; die Offenlegungs-/Auswahl-Verben (`open`/`close`/
`select`, `focus`) führen einen SSE-Command-Push aus. Ein Verb, das der Knoten
nicht besitzt, wird unverändert durchgereicht.

**Antizipierte Wiring-Szenarien:**
- `ui-button` (Klick) → `function` → `ui-action (open)` → `ui-dialog`.
- `ui-action (navigate, Modus wire)` → `ui-route` — die empfangende Route baut die Location.
- `ui-action (disable)` → `ui-button` während eines laufenden Requests.

## Besonderheiten

- Den SSE-Push (für `open`/`close`/`select`/`focus`) bzw. den dynamic-state-Write
  (für `show`/`hide`/`enable`/`disable`) führt der **Zielknoten** aus, nicht
  `ui-action` (P59 / ADR 0007 §2; ADR 0037).
- `openDialog` / `closeDialog` werden als Aliase von `open` / `close` (ohne `part`)
  weiterhin akzeptiert.
- **Sichtbarkeit / enabled sind der EINE dynamic-state-Wert** des Zielknotens
  ([ADR 0037](../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md)):
  gebunden lebt er im Store (Durchschreiben), ungebunden im internen per-Client-Slot
  des Knotens. `show`/`hide`/`enable`/`disable` sind nur weitere „von außen"-Schreiber
  auf denselben Wert — wie eine Bindung, eine `msg` (P223) oder die Duration (P225).
  Ein `hide` überlebt daher einen store-getriebenen Snapshot-Push automatisch (der
  Wert bleibt), **ohne** eine separate Client-Overlay-Schicht. Nur der
  Offenlegungs-/Auswahl-Zustand (`open`/`selected`) wird weiterhin client-seitig in
  einer Interaktions-Overlay gehalten und nach jedem Re-Render erneut angewandt.

## Migration: `ui-navigation` → `ui-action` navigate ([ADR 0040](../../adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md))

Der frühere `ui-navigation`-Knoten wurde **stillgelegt** (P243). Navigation ist ab
jetzt **allein** ein `ui-action` mit `actionType: "navigate"`; es gibt **keinen**
Laufzeit-Shim. Ein deployter `type: "ui-navigation"`-Knoten wird nach dem Entfernen
zum **unbekannten Typ** — ersetze ihn mechanisch:

| vorher (`ui-navigation`) | nachher (`ui-action`) |
|---|---|
| `type: "ui-navigation"` | `type: "ui-action"` |
| — | `actionType: "navigate"` |
| — | `targetMode: "url"` |
| `to` | `to` (unverändert übernehmen) |
| `parent` | `parent` (unverändert) |
| `name` | `name` (unverändert) |

Nur der `url`-Modus (`to`) eines `ui-navigation` hat je funktioniert (die Laufzeit
verwarf `route`/`wire`/`params`), daher ist die Abbildung verlustfrei. Für
`route`- oder `wire`-Navigation nutze die entsprechenden `targetMode`-Werte des
`ui-action` navigate (siehe „Gruppe Navigation" oben).

## Referenzen

- [actions.md](../concepts/actions.md) — Action-Contract, Verben, Zieladressierung
- [messages.md](../concepts/messages.md) — `msg.ui.action`-Format, Navigation
- [events.md](../concepts/events.md) — auslösende Events (Client → Server)
- [ADR 0040](../../adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md) — `ui-navigation` stillgelegt (Navigation ist ein `ui-action` navigate)
- [`ui-route`](../structure/ui-route.md) / [`ui-app`](../structure/ui-app.md) — Navigationsziele
- [editor.md](../concepts/editor.md) — Canvas-Picker (`targets`) vs. Wiring
- [`ui-store`](../state/ui-store.md) — Daten (Abgrenzung)

## Offene Punkte

- Ein Pfad-Selektor für dynamisch erzeugte Elemente (z. B. Tabellenzeilen,
  Listen-Items ohne feste Node-ID) ist noch nicht spezifiziert — geplant für die
  Phase, in der Repeat/List-Elemente eingeführt werden.
