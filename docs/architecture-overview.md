# Architecture Overview

## Zielbild

Das Projekt trennt deklarative UI-Struktur, Runtime-Orchestrierung und Editor-Ergonomie sauber voneinander. Die UI-Hierarchie wird nicht aus Wires rekonstruiert, sondern aus einer zentral kompilierten Registry gelesen.

## Paketgrenzen

### `packages/schema`

- definiert App-, Layout-, Route-, Dialog-, Komponenten- und Event-Vertraege
- validiert Mounts und komplette App-Modelle
- liefert Fixtures fuer das Customers-CRUD-Beispiel

### `packages/runtime`

- nimmt Node-Definitionen entgegen und assembliert sie zu Registry-Contributions
- kompiliert Contributions deterministisch zu einem normalisierten App-Modell
- stellt das Modell ueber eine schlanke Runtime-API bereit

### `packages/renderer`

- rendert das kompilierte Modell als Snapshot fuer Route, Layout, Regionen und Dialoge
- loest Bindings gegen State, Queries und Route-Parameter auf
- standardisiert UI-Ereignisse im `msg.ui`-Format

### `packages/editor`

- validiert Node-RED-Editor-Konfigurationen vor dem Deploy
- bildet die Strukturansicht aus dem kompilierten Registry-Modell statt aus Canvas-Verdrahtung

## Datenfluss des MVP

1. Ein Flow liefert UI-Knoten wie `ui-route`, `ui-table` oder `ui-form`.
2. Die Runtime assembliert diese Knoten zu Contributons fuer App, Layouts, Routen, Dialoge und Komponenten.
3. Die Registry kompiliert daraus ein validiertes `AppModel`.
4. Der Renderer bildet daraus Route- und Dialog-Snapshots und erzeugt standardisierte `msg.ui`-Events.
5. Der Editor kann dieselbe Struktur lesen, ohne Hierarchie aus Wires abzuleiten.

## Warum die Registry zentral ist

- Doppelungen und fehlerhafte Mounts werden an einer Stelle diagnostiziert.
- Renderer und Editor arbeiten gegen dasselbe normalisierte Modell.
- Struktur und Verhalten bleiben getrennt: Wires koennen Event- und Datenfluss zeigen, ohne DOM-Elternschaft implizit zu transportieren.

## P7-Referenzpfad

Der Referenzfall liegt unter [examples/customers-crud/README.md](../examples/customers-crud/README.md). Er deckt Listenansicht, Detailroute, Dialogformular, Navigation, State-Bindings und Basis-Hardening ueber automatisierte Tests ab.