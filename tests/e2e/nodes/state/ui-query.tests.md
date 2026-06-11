# Testkatalog: ui-query

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P160.

## Geplante Testziele (P160)

- Verdrahteter Datenfluss: `msg.ui.query.data` → `ui.queries.<queryPath>` → eine
  gebundene `ui-table` (`rows = query:<path>`) zeigt die Daten.
- Zweiter Push aktualisiert die View live.
- `loading`/`error`-Zustand an `ui-text` gebunden zeigt sich.
- (Falls Pipeline-Lücke: `queries`-Befüllung im Snapshot — vorher rot, nachher grün.)
