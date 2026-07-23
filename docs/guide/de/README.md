# node-red-contrib-webapp — Benutzerhandbuch

> Dies ist die **Benutzer-Dokumentation** (ADR 0042): aufgabenorientiert,
> beispielgetrieben, geschrieben für alle, die mit diesen Knoten Web-Apps
> bauen. **Englisch ist kanonisch** ([`../README.md`](../README.md)); dieser
> Baum unter `de/` ist die deutsche Übersetzung. Die internen
> *Vertrags*-Dokumente liegen in `docs/nodes/**` (Anforderungs-Ebene, für
> Implementierer) — ein anderes Genre; die Benutzer-Doku darf ihnen nie
> widersprechen.

## Inhalt

- **[Einführung](introduction.md)** — was node-red-contrib-webapp ist und
  wie es denkt (das Kern-Modell auf einer Seite)
- **[Erste Schritte](getting-started.md)** — Installation, erste App,
  erstes Deploy, Troubleshooting
- **Guides** — die großen Themen, jeweils mit importierbarem Beispiel-Flow:
  - [Layout & Slots](guides/layout-slots.md) — Mount-Pfade, Layout-Presets,
    Platzierungsfelder
  - [Bindings & State](guides/bindings-state.md) — die Binding-Arten (inkl.
    der `user`-Quelle), Stores, Store-Operationen
  - [Actions & Events](guides/actions-events.md) — die Richtungs-Regel und
    die zwei Wege: Wire vs. Referenz
  - [Navigation & Dialoge](guides/navigation-dialogs.md) — Routen, die drei
    Navigate-Modi, Dialog open/close, Route-Scoping
  - [Daten anzeigen](guides/displaying-data.md) — der Query-Loop, Tabellen,
    Listen, Repeat, Pagination
  - [Formulare](guides/forms.md) — die Input-Familie, bidirektionales
    value/writeTo, Write-Trigger
  - [Auth](guides/auth.md) — Trusted-Header-Betrieb, `user`-Binding,
    `requiresGroup`-Guards
  - [Theming & Komponenten](guides/theming-components.md) — Design-Tokens,
    Varianten vs. Farben, wiederverwendbare Komponenten
- **Knoten-Referenz** — eine Seite je Knoten unter
  [`nodes/`](nodes/ui-divider.md): Zweck, jedes Feld mit seinen Varianten auf
  Benutzer-Ebene, Eingangs-Verhalten, Events und 1–3 importierbare Beispiele
  - [`ui-divider`](nodes/ui-divider.md) — der Pilot; die Batches P267–P271
    ergänzen den Rest
- **Templates** — [`../_templates/`](../_templates/node-reference.md) für
  Autoren (jeweils EN + DE in einer Datei):
  [Knoten-Referenz](../_templates/node-reference.md) ·
  [Guide](../_templates/guide.md) · [Editor-Hilfe](../_templates/help.md)

## Übersetzungsregel

**Deutsch ist nicht optional**: jede Seite wird EN + DE in derselben Änderung
verfasst (Drift-Regel — nie EN ohne DE mergen).

## i18n der Knoten-Hilfe

Die **verbindliche Anleitung** zur Node-RED-Locale-Mechanik (Dateiorte, Format,
Fallback-Kette, Migrationsregeln, Guardrails) steht — bewiesen am Piloten
`ui-divider` — im englischen [README](../README.md#how-node-help-i18n-works-proven-mechanic--binding-for-p267p271).
Kurzfassung: Hilfe-Dateien liegen unter
`nodes/<cat>/locales/en-US/<node>.html` + `locales/de/<node>.html` (voller
`data-help-name`-Script-Block), der Inline-Hilfeblock wird entfernt, die
Editor-Sprache (User Settings → View → Language) wählt die Locale; Fallback
exakt → Sprachpräfix → `en-US`.
