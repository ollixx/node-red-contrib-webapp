# Node-RED Webapp – Übersicht und gemeinsame Konzepte

## Zweck

Dieser Ordner beschreibt die Node-RED-Knoten des Projekts in ihrem heutigen
Zustand. Er trennt dabei zwischen:

- dem deklarativen Vertrag, den ein Knoten ins gemeinsame Modell einbringt
- dem tatsächlichen Laufzeitverhalten
- den noch offenen Punkten

Die Dokumente sind Arbeitsgrundlage *und* Referenz. Maßgeblich („source of
truth") sind im Zweifel das Schema (`packages/schema/src/contracts.ts`,
`node-definitions.ts`) und die ADRs unter `docs/adr/`; diese Doku spiegelt sie
wider.

Querschnittliche Konzepte sind in eigenen Dateien zentral dokumentiert:
[layout.md](layout.md), [stores.md](stores.md), [actions.md](actions.md),
[events.md](events.md), [messages.md](messages.md), [inputs.md](inputs.md),
[logs-errors.md](logs-errors.md), [theming.md](theming.md), [editor.md](editor.md),
[multi-user.md](multi-user.md).

## Kategorien

- Struktur: [`ui-app`](../structure/ui-app.md), [`ui-route`](../structure/ui-route.md), [`ui-dialog`](../structure/ui-dialog.md)
- View (Display / Input / Feedback / Navigation): u. a. [`ui-text`](../display/ui-text.md), [`ui-button`](../display/ui-button.md), [`ui-table`](../display/ui-table.md), [`ui-container`](../display/ui-container.md), [`ui-input`](../input/ui-input.md), [`ui-alert`](../feedback/ui-alert.md), [`ui-tabs`](../navigation/ui-tabs.md) — vollständige Liste in den jeweiligen Unterordnern.
- State: [`ui-store`](../state/ui-store.md), [`ui-query`](../state/ui-query.md)
- Verhalten: [`ui-action`](../behavior/ui-action.md), [`ui-navigation`](../behavior/ui-navigation.md) *(deprecated — `ui-action` mit `navigate` ist der Weg, siehe ADR 0007)*

## Gemeinsame Modellregeln

- Eine App wird über ihre `id` identifiziert; dieser Wert muss eindeutig sein.
- Knoten werden über ihre Node-RED-Knoten-IDs referenziert (eine separate fachliche ID ist nicht nötig).
- View-Knoten werden über `mount` an Route-, Dialog- oder Preset-Layout-Slots gebunden. Die UI-Hierarchie ergibt sich aus `parent`/`mount`, **nie** aus Wires — Wires tragen Daten-/Event-Fluss.
- Mount-Pfade folgen dem Muster `<type>:<id>/<slot>` (z. B. `route:/customers/content`).
- Für Referenzen wie `parent`, `mount`, `routeId`, `action`, `storeId` bietet der Editor durchsuchbare Auswahllisten aus den vorhandenen Webapp-Knoten an (einheitlicher Node-Picker-Dialog, P68).
- Das gemeinsame Schema validiert Feldpräsenz, Grundform und zunehmend fachliche Constraints (z. B. Routen-Pfad `/` verboten, Grid-Platzierung positive Integer, Mehrdeutigkeit bei Navigation).

## Ereignis- und Zustandsmodell

UI-Zustand und UI-Verhalten sind getrennte Konzepte:

- **Zustand** (fachliche/eingabebezogene Daten) läuft ausschließlich über `ui-store` — siehe [stores.md](stores.md).
- **Verhalten** (Navigation, Sichtbarkeit, Offenlegung, Fokus, …) läuft über `ui-action` als schema-validierte Action-Message — siehe [actions.md](actions.md).
- **Events** sind Meldungen vom Client zum Backend (Click, Change, Submit, Select, Route-onEnter/onLeave …). Sie reisen als `msg.ui`-Event-Message und werden vom Ursprungsknoten auf dessen Out-Port emittiert; der Flow entscheidet, was passiert — siehe [events.md](events.md). Es gibt **keinen** eigenen `ui-event`-Knoten; jeder interaktive Knoten emittiert seine Events selbst.
- **Live-Transport:** Die gerenderte Oberfläche wird als framework-neutraler `RenderSnapshot` über einen SSE-Kanal an den Browser geliefert; Store-Updates und Interaktionsbefehle werden live nachgeschoben (P30/P31) — siehe [messages.md](messages.md).

Abgrenzung:
- `ui-action`: beschreibt, was die UI tun soll (Interaktionszustand)
- `ui-store`: beschreibt, welcher Datenzustand gehalten und geändert wird
- Event (`msg.ui` mit `event`): beschreibt, was der Client dem Backend meldet

## Architektur-Eckpfeiler

- **Rendering-Backend:** ein Web-Component-Adapter auf Basis von **Shoelace** (ADR 0002), dessen Assets lokal vendored sind (ADR 0008). Das Modell ist backend-agnostisch (semantische Props + Varianten); der Adapter mappt auf das Framework — siehe [theming.md](theming.md).
- **Keine Framework-Logik in der Runtime:** `nodes/webapp.js` enthält keine beispiel-/domänenspezifische Logik (ADR 0003). Fachliche Logik lebt im verdrahteten Flow.
- **Logging & Fehlermodell:** strukturierte Logs/Fehler mit Severity, Message-Tracing, opt-in Backend→Frontend-Weiterleitung und ein `ui-log`-Knoten (ADR 0006) — siehe [logs-errors.md](logs-errors.md).

## Offene Punkte (Auswahl)

- Reichere Untermodelle für `ui-input`/`ui-table` (Feldtypen, Validierung, strukturierte Spalten im Editor).
- Vereinheitlichung des typedInput inkl. `store`-Typ über weitere Binding-Felder (Folge von P67).
- Icon-System mit registrierbaren Libraries und Picker (geplant).
- Clientseitige Store-Persistenz/Resynchronisierung (`persist`) — heute nur als Flag getragen, Verhalten noch nicht aktiv.
