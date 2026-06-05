---
applyTo: "examples/customers-crud/flow.json"
description: "Schutzregeln fuer Flow-Dateien: nur angefragte Knoten/Felder aendern und bestehende Layout-/Positionsdaten unveraendert lassen"
---

## ABSOLUTES VERBOT

**`.node-red-dev/flows.json` darf von Agenten niemals gelesen, geschrieben oder neu generiert werden** — auch nicht über `pnpm gen:example`. Diese Datei ist die persönliche Dev-Umgebung des Owners und ausschließlich von ihm zu verwalten. Kein Auftrag des Nutzers rechtfertigt eine Ausnahme.

## Regeln für generierte Flow-Dateien

`examples/customers-crud/flow.json` → wird von `pnpm gen:example` erzeugt.
`examples/structure/*.json`, `examples/view/*.json`, `examples/composite/*.json`, `examples/state/*.json`, `examples/behavior/*.json` → werden von `pnpm gen:node-examples` erzeugt.

Alle diese Dateien werden **ausschließlich über den zugehörigen Generator-Script** erzeugt — nie manuell bearbeitet. Beim Bearbeiten gelten harte Regeln:

1. Nur die vom Nutzer explizit angefragten Aenderungen umsetzen.
2. Keine globalen Normalisierungen (z, x, y, order, wires, Reihenfolge von Feldern) ohne ausdruecklichen Auftrag.
3. Vorhandene Knotenpositionen und Eigenschaften unveraendert lassen, ausser die Anfrage verlangt genau diese Aenderung.
4. Niemals andere Apps/Flows in derselben Datei anfassen, wenn nicht explizit angefragt.
5. Bei Unsicherheit zuerst stoppen und Rueckfrage stellen.
6. Darauf achten, dass für alle Knoten immer eine id existiert. Diese darf gerne auch aus der sematik oder dem Namen des Knotens abgeleitet sein, muss aber natürlich in der flows.json eindeutig sein.
7. Darauf achten, dass alle Knoten immer über "z" mit dem richtigen Flow (Tab) verknüpft sind. Den flow mit dieser id muss es in der datei geben.
