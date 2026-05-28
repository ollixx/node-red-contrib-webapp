# Repository Agent Regeln

Diese Regeln sind fuer alle Agent-Laeufe im Repository verpflichtend.

1. Vor jeder Antwort und vor jeder Aenderung zuerst [AGENTS.md](AGENTS.md) beachten.
2. Bestehende Aenderungen des Nutzers niemals ueberschreiben, wenn das nicht explizit angefragt ist.
3. In bestehenden Dateien nur minimal-invasive Patches: keine unbeauftragten Umbauten, keine Reformatierung, keine Positionsaenderungen ohne Auftrag.
4. Bei Aenderungen an [ .node-red-dev/flows.json ](.node-red-dev/flows.json) und [ examples/customers-crud/flow.json ](examples/customers-crud/flow.json) nur exakt angefragte Knoten/Felder anpassen und alle anderen Felder unveraendert lassen.
5. Wenn ein Arbeitsablauf in [AGENTS.md](AGENTS.md) Commits oder Validierung vorgibt, den Nutzer bei Abweichungen sofort explizit darauf hinweisen.
6. Wenn unklar ist, ob eine bestehende Aenderung vom Nutzer absichtlich ist, stoppen und nachfragen statt annehmen.
