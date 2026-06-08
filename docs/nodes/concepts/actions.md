# Actions — Server → Client

## Grundprinzip

Actions fließen **ausschließlich vom Server (Node-RED) zum Client**. Sie beschreiben, was die UI tun soll — nicht was der Nutzer getan hat (das sind [Events](./events.md)) und nicht welche Daten angezeigt werden (das läuft über [Stores und Queries](../state/ui-store.md)).

Diese Richtung ist absolut:
- Server → Client: Action ✓
- Client → Server: **keine Action**, sondern ein [Event](./events.md)

Actions verändern den **Interaktionszustand** der UI: Sichtbarkeit, Aktivierungszustand, Navigation, Fokus. Sie verändern **keine fachlichen Daten** — dafür gibt es `ui-store`.

---

## Der Action-Message-Contract

Eine Action reist als **`msg.ui.action`** durch den Flow. Dieses Format ist ein
öffentlicher, schema-validierter Message-Contract (`actionMessageSchema` in
`packages/schema`, [ADR 0007](../../adr/0007-action-message-and-per-node-interaction-handlers.md)):

```
msg.ui = {
  clientId?: string,         // Ziel-Client; fehlt = Broadcast an alle Clients
  action: {
    type:    <verb>,         // Verbset siehe unten (ADR 0005)
    to?:     string,         // navigate-Ziel (Route-Pfad oder Template, P66)
    params?: { [k]: string },// navigate: benannte URL-Parameter (P66)
    part?:   string,         // Sub-ID für open/close/select (Sektion/Branch/Tab)
    target?: string          // OPTIONALE explizite Component-/Node-ID (Override)
  }
}
```

Das Schema validiert **nur** `msg.ui.action`. Fremde `msg.*`-Felder (`payload`,
`topic`, `_msgid`, …) und fremde `msg.ui.*`-Felder werden **unangetastet
durchgereicht** — der Emitter reichert die eingehende Message an, er ersetzt sie
nicht. Weil es ein gewöhnlicher Message-Contract ist, kann **jeder** Knoten ihn
erzeugen (`inject`, `trigger`, `function`, eine HTTP-Response oder `ui-action`).

## Der `ui-action` Knoten

`ui-action` ist der bequeme, typisierte **Emitter** dieses Contracts — kein
Gatekeeper. Er hat:

- **Input-Port**: empfängt eine `msg` aus dem Node-RED Flow — das löst die Action aus
- **Output-Port**: verdrahtet mit dem **Zielknoten** der Action (z.B. `ui-dialog`, `ui-button`, `ui-input`)

`ui-action` baut aus seiner Konfiguration eine schema-valide `msg.ui.action` und
emittiert sie am Output-Port; der verdrahtete Zielknoten verarbeitet das ihm
bekannte Verb. Der Output-Port dient also der Zieladressierung über das Wiring.

**Wo der SSE-Push passiert (P59 / ADR 0007 §2):** Nicht `ui-action`, sondern der
**Zielknoten** führt den Push an den Client aus. Jeder interaktionsfähige Knoten
besitzt ein Verb-Set (`ui-dialog` → open/close; View-Knoten → show/hide;
`ui-button`/`ui-input` → enable/disable; `ui-input` → focus/reset;
Einzelauswahl-Container wie Tabs/Stepper/Menü → select; `ui-app`/`ui-route` →
navigate/reset) und verwendet einen gemeinsamen
`interactionInputHandler(ownedVerbs)`. Bei Eingang löst er `target` auf seine
**eigene Node-ID** auf (das Wiring *ist* die Adresse), pusht das Kommando über den
SSE-Kanal und reicht `msg` am Output-Port weiter. Ein Verb, das der Knoten nicht
besitzt, wird **unverändert durchgereicht** (kein stilles Verschlucken). So kann
auch ein blanker `inject`/`function`-Knoten, der den Contract sendet, eine
Interaktion auslösen — `ui-action` ist nur der bequeme Emitter.

```
ui-button (click event) ──→ function node ──→ ui-action (openDialog) ──→ ui-dialog
                                                      ↓
                                          [Client öffnet den Dialog]
```

---

## Zieladressierung

Es gibt drei Wege, das Ziel einer Action zu bestimmen — je nach Anwendungsfall:

### 1. Output-Port Wiring (primär)

Der Zielknoten wird im Node-RED Flow direkt mit dem Output-Port von `ui-action` verdrahtet. Das ist der bevorzugte Weg für alle **statischen, bekannten Ziele**.

```
ui-action (disable) ──→ ui-button "Speichern"
ui-action (show)    ──→ ui-container "Fehlermeldung"
ui-action (open)    ──→ ui-dialog "Bestätigung"
```

Vorteile: visuell explizit, keine String-Referenzen, Node-RED-idiomatisch, statisch validierbar.

Einschränkung: Das Ziel muss zur Flow-Editierzeit bekannt sein. Für dynamisch berechnete Ziele → Option 3.

### 2. Knoten-Picker (sekundär, "wireless")

Wer keine Wires ziehen will, kann im `ui-action`-Editor die Zielknoten über den
Button **"Auf Canvas wählen"** direkt auf dem Canvas auswählen (P60 / ADR 0007
§3). Technisch nutzt der Picker `RED.view.selectNodes()` — dieselbe Canvas-Pick-API,
die die Kern-Knoten `catch` / `status` / `complete` für ihren Scope verwenden —
gefiltert auf **interaktionsfähige webapp-Knoten** (alle `ui-*` außer dem Emitter
`ui-action`/`ui-navigation` selbst). Es lassen sich **mehrere** Ziele wählen; die
IDs werden als Liste (`targets`) in der Config gespeichert.

Bei Eingang stellt `ui-action` die Aktion an **jeden** gewählten Zielknoten via
`targetNode.receive(msg)` zu — **derselbe Input-Pfad wie ein Wire** (`receive()`,
nicht `send()`; das behebt den ADR 0007 §Context-3-Bug). Verhalten und Push sind
damit identisch zur Verdrahtung.

> **Sekundär, bewusst:** Node-RED lebt von sichtbaren Flows; versteckte
> ID-Referenzen sind schwerer nachzuvollziehen. Das Wiring des Output-Ports
> (Option 1) bleibt der primäre, empfohlene Weg. Der Picker ist die implizite
> Alternative für Wireless-Setups.

### 3. `target` aus `msg` (dynamisch zur Laufzeit)

Wenn das Ziel erst zur Laufzeit bekannt ist — z.B. weil es aus den Daten des auslösenden Events stammt — kann die Node-/Component-ID des Zielknotens als `target` in der `msg` mitgeliefert werden:

```json
{ "ui": { "action": { "type": "disable", "target": "<node-id>" } } }
```

`target` überschreibt die Default-Auflösung des Zielknotens (der sonst seine
eigene Node-ID als Ziel setzt). Typischer Anwendungsfall: Das Event enthält eine
`sourceId`, die als Ziel der Reaktion genutzt wird.

> **`target` ist das kanonische (Schema-)Feld.** Die Runtime-Handler akzeptieren
> zusätzlich `targetId` als Back-Compat-Alias, aber `actionMessageCommandSchema`
> ist `.strict()` und kennt nur `type/to/params/part/target` — ein
> `msg.ui.action.targetId` fällt also durch die Schema-Validierung. Im Zweifel
> `target` verwenden. (Die Schema/Runtime-Diskrepanz ist bekannt.)

> **Zustellung via `receive()` (P60 / ADR 0007 §3):** Ein `target`/`targetId`-Override
> in der `msg` adressiert genau diesen Knoten; `ui-action` stellt die Aktion an
> dessen **Input** via `targetNode.receive()` zu (nicht `send()`, das am Output
> injizierte — der ADR 0007 §Context-3-Bug). Damit ist der Override-Pfad mit dem
> Picker-Pfad (Option 2) vereinheitlicht. Altflows, die das Config-Feld `target`
> mit unverdrahtetem Output nutzten, funktionieren unverändert weiter (`target`
> wird wie ein einzelnes gewähltes Ziel behandelt).

### 4. Pfad-Selektor (zukünftig — dynamische Elemente)

Für dynamisch erzeugte Elemente (z.B. Zeilen in einer Tabelle, Items in einer Liste) gibt es keine feste Node-ID. Hier wird ein Adressierungsschema auf dem App-State oder DOM benötigt — z.B. JSONPath auf den Store-Zustand.

**Noch nicht implementiert.** Wird in einer späteren Phase spezifiziert, wenn Repeat/List-Elemente eingeführt werden.

---

## Action-Typen

Eine Action ist ein typisiertes Kommando. Der Typ bestimmt, was der Client tut.

> **Implementierter Typsatz (Schema, P53 / [ADR 0005](../../adr/0005-ui-action-interaction-vocabulary.md)):**
> drei semantische Klassen —
> *Sichtbarkeit* `show` / `hide` (beliebiges Element),
> *Offenlegung* `open` / `close` (Dialog, Drawer, Accordion-Sektion, Details,
> Tree-Branch; mit optionalem `part` für die Sub-Granularität),
> *Einzelauswahl* `select` (Tab, Stepper, Menü; mit `part`) —
> plus `navigate`, `enable` / `disable`, `focus`, `reset`. `open` / `close`
> ersetzen das frühere `openDialog` / `closeDialog`, das als Alias erhalten bleibt.
> `show` / `hide` (Präsenz) sind bewusst getrennt von `open` / `close`
> (Offenlegungszustand eines bereits sichtbaren Elements). Alle Typen ändern
> ausschließlich den Interaktionszustand — niemals fachliche Daten. Sichtbarkeit /
> enabled / open-Zustand werden client-seitig in einer Interaktions-Overlay
> gehalten, die nach jedem Snapshot-Re-Render erneut angewandt wird. Die früheren
> Datenaktionen `submit` / `remove` wurden in P29 entfernt (siehe
> [ADR 0003](../../adr/0003-live-node-red-app-no-preview.md)); CRUD gehört in den
> verdrahteten Flow. (`trigger` bleibt als Legacy-Pass-Through-Verb im Schema.)

### `navigate`

Navigiert den Client zu einer Route. Zwei Szenarien (ADR 0007, P66-Amendment) —
ausführlich in [messages.md](messages.md#navigation):

- **Szenario 1 — verdrahtet:** Out-Port von `ui-action` an eine `ui-route`/`ui-app`. Die Ziel-Route baut ihren Pfad aus dem **eigenen** `path` und den `params` (`:placeholder` → Wert). Kein `to`.
- **Szenario 2 — `to`:** `to` ist im Editor ein **typedInput** (`toType`: `str`/`msg`/`flow`/`global`/`jsonata`), das app-global aufgelöst wird; `params` können zusätzlich gesetzt werden.

```json
{
  "ui": {
    "action": {
      "type": "navigate",
      "to":   "/customers/:id",
      "params": { "id": "42" }
    }
  }
}
```

`to` ist ein absoluter Pfad bzw. ein Template innerhalb der App; `:placeholder`
werden aus `params` gefüllt. `onEnter`/`onLeave` der betroffenen Route(n) werden in
beiden Szenarien emittiert (siehe [events.md](events.md)). `ui-navigation` ist deprecated.

---

### `open` / `close` (vormals `openDialog` / `closeDialog`)

Öffnet oder schließt ein aufklappbares, sichtbares Element: Dialog, Drawer,
Accordion-Sektion, Details/Collapse oder Tree-Branch. `open` / `close` sind die
kanonischen Verben (P53 / ADR 0005); `openDialog` / `closeDialog` bleiben als
Alias erhalten.

```json
{
  "ui": {
    "action": {
      "type":   "open",
      "target": "<node-id des Ziel-Elements>",
      "part":   "<optionale Sub-ID: Accordion-Sektion / Tree-Branch / Tab>"
    }
  }
}
```

Ohne `part` adressiert ein bares `target` das Element als Ganzes (z.B. einen
Dialog — das frühere `openDialog`-Verhalten). Mit `part` wird genau eine
Sektion/Branch innerhalb des Ziels geöffnet. Alternative zu Store-basiertem
Dialog-State — sinnvoll wenn kein persistenter Zustand benötigt wird.

---

### `show` / `hide`

Blendet ein UI-Element ein oder aus.

```json
{
  "ui": {
    "action": {
      "type":   "show",
      "target": "<node-id des Ziel-Knotens>"
    }
  }
}
```

Gilt für alle View-Knoten: `ui-button`, `ui-input`, `ui-text`, `ui-table`, `ui-container`, etc.

---

### `enable` / `disable`

Aktiviert oder deaktiviert ein interaktives Element.

```json
{
  "ui": {
    "action": {
      "type":   "disable",
      "target": "<node-id>"
    }
  }
}
```

Gilt für `ui-button` und `ui-input`.

---

### `focus`

Setzt den Fokus auf ein Eingabefeld.

```json
{
  "ui": {
    "action": {
      "type":   "focus",
      "target": "<node-id eines ui-input>"
    }
  }
}
```

---

### `reset`

Setzt ein Eingabefeld auf seinen Initialwert zurück.

```json
{
  "ui": {
    "action": {
      "type":   "reset",
      "target": "<node-id eines ui-input>"
    }
  }
}
```

---

## Ziel-Client

Standardmäßig wird eine Action an **alle verbundenen Clients** der App gesendet. Um eine Action nur an einen bestimmten Client zu senden, wird `msg.ui.clientId` gesetzt:

```json
{
  "ui": {
    "clientId": "client-abc123",
    "action": {
      "type": "navigate",
      "to":   "/dashboard"
    }
  }
}
```

`clientId` stammt in der Regel aus dem auslösenden Event (der Klick kam von diesem Client). Der App-Autor leitet `msg.ui.clientId` aus dem Event einfach weiter.

---

## Typisches Flow-Muster

```
[Event vom Client]
ui-button output ──→ HTTP Request (z.B. Kunde speichern)
                 └──→ ui-store   (Formulardaten löschen)
                 └──→ ui-action  (Dialog schließen)
                 └──→ ui-action  (zu Kundenliste navigieren)
```

Mehrere `ui-action`-Knoten können parallel verdrahtet werden — jeder emittiert
seine eigene Action; den Push an den Client führt der jeweils verdrahtete
Zielknoten aus (P59 / ADR 0007).

---

## Konfiguration im Editor

`ui-action` wird im Editor mit einem **Action-Typ** vorkonfiguriert. Das legt fest, welche Action der Knoten bei Eingang einer `msg` ausführt. Alternativ kann der Typ dynamisch aus `msg.ui.action.type` gelesen werden (msg überschreibt Konfiguration).

Pflichtfelder:
- `parent`: die `ui-app`, zu der diese Action gehört (bestimmt den Routing-Kontext)
- `name`: wird in Auswahlfeldern anderer Knoten angezeigt

Optionale Felder:
- `actionType`: voreingestellter Action-Typ
- `to`: voreingestelltes Navigationsziel (kann durch `msg` überschrieben werden)
- `targets`: die über den **Knoten-Picker** ("Auf Canvas wählen", Option 2)
  gewählten Zielknoten-IDs (Liste). Sekundärer "wireless"-Pfad — primär bleibt das
  **Wiring des Output-Ports**. Bei Eingang Zustellung an jeden Knoten via
  `receive()`.
- `target` (legacy): Einzel-Override aus Altflows (pre-P60 Freitext). Wird wie ein
  einzelnes gewähltes Ziel behandelt; im Editor durch den Picker ersetzt.

---

## Abgrenzung zu Stores und Bindings

| Konzept | Zweck | Beispiel |
|---|---|---|
| **Action** | Interaktionszustand der UI ändern | Dialog öffnen, navigieren, Feld deaktivieren |
| **Store** | Fachliche Daten halten und ändern | Formularwerte, Listendaten, Flags |
| **Binding** | Datenwert an UI-Element binden | Textfeld zeigt `store.customer.name` |

Eine Action verändert nie Daten in einem Store. Ein Store-Update führt nie direkt zu einer Navigation oder Dialog-Öffnung — das wäre Aufgabe einer Action.

---

## Abgrenzung zu Events

| | Event | Action |
|---|---|---|
| Richtung | Client → Server | Server → Client |
| Auslöser | Nutzerinteraktion | Node-RED Flow |
| Inhalt | Was passiert ist | Was die UI tun soll |
| Knoten | `ui-button`, `ui-table`, etc. (Output-Port) | `ui-action` (Input-Port) |

Siehe auch: [events.md](./events.md), [messages.md](./messages.md)
