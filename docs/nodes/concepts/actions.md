# Actions — Server → Client

## Grundprinzip

Actions fließen **ausschließlich vom Server (Node-RED) zum Client**. Sie beschreiben, was die UI tun soll — nicht was der Nutzer getan hat (das sind [Events](./events.md)) und nicht welche Daten angezeigt werden (das läuft über [Stores und Queries](../state/ui-store.md)).

Diese Richtung ist absolut:
- Server → Client: Action ✓
- Client → Server: **keine Action**, sondern ein [Event](./events.md)

Actions verändern den **Interaktionszustand** der UI: Sichtbarkeit, Aktivierungszustand, Navigation, Fokus. Sie verändern **keine fachlichen Daten** — dafür gibt es `ui-store`.

---

## Der `ui-action` Knoten

`ui-action` ist der einzige Knoten, der Actions an den Client sendet. Er hat:

- **Input-Port**: empfängt eine `msg` aus dem Node-RED Flow — das löst die Action aus
- **Output-Port**: verdrahtet mit dem **Zielknoten** der Action (z.B. `ui-dialog`, `ui-button`, `ui-input`)

Der Output-Port dient der Zieladressierung, nicht der Weiterverarbeitung im Flow. Die Runtime liest das Wiring und leitet die Action an den entsprechenden Client-Component weiter.

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

Einschränkung: Das Ziel muss zur Flow-Editierzeit bekannt sein. Für dynamisch berechnete Ziele → Option 2.

### 2. `targetId` aus `msg` (dynamisch zur Laufzeit)

Wenn das Ziel erst zur Laufzeit bekannt ist — z.B. weil es aus den Daten des auslösenden Events stammt — kann die Node-ID des Zielknotens in der `msg` mitgeliefert werden:

```json
{ "ui": { "action": { "type": "disable", "targetId": "<node-id>" } } }
```

`targetId` überschreibt das statische Wiring. Typischer Anwendungsfall: Das Event enthält eine `sourceId`, die als Ziel der Reaktion genutzt wird.

### 3. Pfad-Selektor (zukünftig — dynamische Elemente)

Für dynamisch erzeugte Elemente (z.B. Zeilen in einer Tabelle, Items in einer Liste) gibt es keine feste Node-ID. Hier wird ein Adressierungsschema auf dem App-State oder DOM benötigt — z.B. JSONPath auf den Store-Zustand.

**Noch nicht implementiert.** Wird in einer späteren Phase spezifiziert, wenn Repeat/List-Elemente eingeführt werden.

---

## Action-Typen

Eine Action ist ein typisiertes Kommando. Der Typ bestimmt, was der Client tut.

### `navigate`

Navigiert den Client zu einer Route.

```json
{
  "ui": {
    "action": {
      "type":   "navigate",
      "target": "/customers/42"
    }
  }
}
```

`target` ist ein absoluter Pfad innerhalb der App. Route-Parameter werden inline aufgelöst.

---

### `openDialog` / `closeDialog`

Öffnet oder schließt einen Dialog.

```json
{
  "ui": {
    "action": {
      "type":     "openDialog",
      "dialogId": "<node-id des ui-dialog>"
    }
  }
}
```

Alternative zu Store-basiertem Dialog-State — sinnvoll wenn kein persistenter Zustand benötigt wird.

---

### `show` / `hide`

Blendet ein UI-Element ein oder aus.

```json
{
  "ui": {
    "action": {
      "type":     "show",
      "targetId": "<node-id des Ziel-Knotens>"
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
      "type":     "disable",
      "targetId": "<node-id>"
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
      "type":     "focus",
      "targetId": "<node-id eines ui-input>"
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
      "type":     "reset",
      "targetId": "<node-id eines ui-input>"
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
      "type":   "navigate",
      "target": "/dashboard"
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

Mehrere `ui-action`-Knoten können parallel verdrahtet werden — jeder sendet seine eigene Action an den Client.

---

## Konfiguration im Editor

`ui-action` wird im Editor mit einem **Action-Typ** vorkonfiguriert. Das legt fest, welche Action der Knoten bei Eingang einer `msg` ausführt. Alternativ kann der Typ dynamisch aus `msg.ui.action.type` gelesen werden (msg überschreibt Konfiguration).

Pflichtfelder:
- `parent`: die `ui-app`, zu der diese Action gehört (bestimmt den Routing-Kontext)
- `name`: wird in Auswahlfeldern anderer Knoten angezeigt

Optionale Felder:
- `actionType`: voreingestellter Action-Typ
- `target` / `to`: voreingestelltes Ziel (kann durch `msg` überschrieben werden)

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
