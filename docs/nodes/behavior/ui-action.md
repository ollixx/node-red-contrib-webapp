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
ausgeschlossen (Verstöße sind Compile-Validierungsfehler). Die UI-Umschaltung
(Modus-Toggle, Wire-Scan, Mapping-Tabelle) liefert **P119**; hier das Datenmodell.

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `targetMode` | „Zielquelle" | `wire` \| `route` \| `url` | optional (Default per Migration) | Gespeicherte Absicht. `wire` = Ziel kommt über die Verdrahtung; `route` = per Referenz gewählte `ui-route`; `url` = ganze URL als `to`. |
| `routeId` | „Ziel-Route" | Referenz auf eine `ui-route` (Picker, P119) | nur Modus `route` | App-global zur Routen-`path` aufgelöst. Im Modus `route` **kein** `to`. |
| `params` | „Parameter" | typisierte Liste `[{ name, value, valueType }]` | optional (Modus `route`/`wire`) | Benannte Parameter, die die `:platzhalter` der Ziel-Route füllen. `valueType` ∈ `str` \| `msg` \| `jsonata` \| `flow` \| `global` \| `env`; jeder Wert wird **zur Action-Zeit gegen die auslösende msg** ausgewertet. Im Modus `url` ignoriert (die URL trägt ihre Werte selbst). |
| `to` / `toType` | „Navigation zu" | typedInput (`str` \| `msg` \| `flow` \| `global` \| `jsonata`) | nur Modus `url` | Ganze URL/Pfad. `str` = literaler Pfad (ggf. mit `:platzhaltern`); `msg`/`flow`/`global` lesen ihn aus Kontext; `jsonata` berechnet ihn. Im Modus `url` **kein** `routeId`. Default-Typ: `str`. |

> **Migration (Lade-Shim).** Bestands-Configs ohne `targetMode`: `to` gesetzt →
> `url`; `routeId` gesetzt → `route`; sonst → `wire`. Ein Legacy-`params`-Objekt
> `{k:"v"}` wird verlustfrei in eine Liste mit `valueType: "str"` migriert.

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

- **Sichtbarkeit (Präsenz):** `show` / `hide` — blendet ein beliebiges Element ein/aus.
- **Offenlegung (Disclosure):** `open` / `close` — öffnet/schließt ein bereits sichtbares, aufklappbares Element (Dialog, Drawer, Accordion-Sektion, Details/Collapse, Tree-Branch). Nutzt optional `part`. Ersetzt `openDialog`/`closeDialog`, die als Aliase erhalten bleiben.
- **Einzelauswahl:** `select` — genau eines aus einer Geschwister-Gruppe aktiv (Tab, Stepper-Schritt, Menü). Nutzt `part`.

plus `navigate`, `enable` / `disable`, `focus`, `reset`. (`trigger` bleibt als
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
verdrahtete Zielknoten verarbeitet das ihm bekannte Verb und führt den SSE-Push
aus; ein Verb, das der Knoten nicht besitzt, wird unverändert durchgereicht.

**Antizipierte Wiring-Szenarien:**
- `ui-button` (Klick) → `function` → `ui-action (open)` → `ui-dialog`.
- `ui-action (navigate, Modus wire)` → `ui-route` — die empfangende Route baut die Location.
- `ui-action (disable)` → `ui-button` während eines laufenden Requests.

## Besonderheiten

- Den SSE-Push führt der **Zielknoten** aus, nicht `ui-action` (P59 / ADR 0007 §2).
- `openDialog` / `closeDialog` werden als Aliase von `open` / `close` (ohne `part`)
  weiterhin akzeptiert.
- Sichtbarkeit / enabled / open-Zustand werden client-seitig in einer
  Interaktions-Overlay gehalten, die nach jedem Snapshot-Re-Render erneut
  angewandt wird — ein `show`/`hide` überlebt also einen store-getriebenen
  Snapshot-Push.

## Referenzen

- [actions.md](../concepts/actions.md) — Action-Contract, Verben, Zieladressierung
- [messages.md](../concepts/messages.md) — `msg.ui.action`-Format, Navigation
- [events.md](../concepts/events.md) — auslösende Events (Client → Server)
- [`ui-route`](../structure/ui-route.md) / [`ui-app`](../structure/ui-app.md) — Navigationsziele
- [editor.md](../concepts/editor.md) — Canvas-Picker (`targets`) vs. Wiring
- [`ui-store`](../state/ui-store.md) — Daten (Abgrenzung)

## Offene Punkte

- Ein Pfad-Selektor für dynamisch erzeugte Elemente (z. B. Tabellenzeilen,
  Listen-Items ohne feste Node-ID) ist noch nicht spezifiziert — geplant für die
  Phase, in der Repeat/List-Elemente eingeführt werden.
