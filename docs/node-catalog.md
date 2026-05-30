# Node Catalog

Die Einzeldokumente pro Knoten sowie übergreifende Konzepte sind unter [docs/nodes/](nodes/) abgelegt.

## Übergeordnete Konzepte

→ [Übersicht, gemeinsame Modellregeln, Ereignis- und Zustandsmodell, Designlücken](nodes/overview.md)
→ [Layout-Feature (mehrfach genutztes Konzept)](nodes/layout.md)
→ [Theming: Design-Tokens, Variants, Renderer-Backends](nodes/theming.md)
→ [Message-Formate](nodes/messages.md)
→ [Multi-User und Client-Persistenz](nodes/multi-user.md)

## Strukturknoten

- [ui-app](nodes/ui-app.md)
- [ui-route](nodes/ui-route.md)
- [ui-dialog](nodes/ui-dialog.md)

## View-Knoten — Eingabe

- [ui-input](nodes/ui-input.md)
- [ui-select](nodes/ui-select.md) _(geplant — P16a)_
- [ui-checkbox](nodes/ui-checkbox.md) _(geplant — P16a)_
- [ui-radio](nodes/ui-radio.md) _(geplant — P16a)_
- [ui-switch](nodes/ui-switch.md) _(geplant — P16a)_
- [ui-textarea](nodes/ui-textarea.md) _(geplant — P16a)_
- [ui-datepicker](nodes/ui-datepicker.md) _(geplant — P16a)_
- [ui-slider](nodes/ui-slider.md) _(geplant — P16a)_

## View-Knoten — Darstellung

- [ui-text](nodes/ui-text.md)
- [ui-button](nodes/ui-button.md)
- [ui-table](nodes/ui-table.md)
- [ui-container](nodes/ui-container.md)
- [ui-image](nodes/ui-image.md) _(geplant — P16d)_
- [ui-icon](nodes/ui-icon.md) _(geplant — P16d)_
- [ui-list](nodes/ui-list.md) _(geplant — P16d)_
- [ui-avatar](nodes/ui-avatar.md) _(geplant — P16d)_
- [ui-divider](nodes/ui-divider.md) _(geplant — P16d)_

## View-Knoten — Feedback & Status

- [ui-alert](nodes/ui-alert.md) _(geplant — P16b)_
- [ui-toast](nodes/ui-toast.md) _(geplant — P16b)_
- [ui-progress](nodes/ui-progress.md) _(geplant — P16b)_
- [ui-skeleton](nodes/ui-skeleton.md) _(geplant — P16b)_
- [ui-badge](nodes/ui-badge.md) _(geplant — P16b)_
- [ui-empty-state](nodes/ui-empty-state.md) _(geplant — P16b)_

## View-Knoten — Navigation & Struktur

- [ui-tabs](nodes/ui-tabs.md) _(geplant — P16c)_
- [ui-accordion](nodes/ui-accordion.md) _(geplant — P16c)_
- [ui-breadcrumb](nodes/ui-breadcrumb.md) _(geplant — P16c)_
- [ui-menu](nodes/ui-menu.md) _(geplant — P16c)_
- [ui-pagination](nodes/ui-pagination.md) _(geplant — P16c)_
- [ui-stepper](nodes/ui-stepper.md) _(geplant — P16c)_

## State-Knoten

- [ui-store](nodes/ui-store.md)
- [ui-query](nodes/ui-query.md)

## Verhaltensknoten

- [ui-action](nodes/ui-action.md)
- [ui-navigation](nodes/ui-navigation.md) _(Deprecated)_

## Extension-Pakete (nicht im Core)

Diese Knoten sind zu spezialisiert für den Core und werden als separate npm-Pakete angeboten:

| Paket | Knoten |
|---|---|
| `node-red-contrib-webapp-charts` | `ui-chart`, `ui-sparkline` |
| `node-red-contrib-webapp-map` | `ui-map` |
| `node-red-contrib-webapp-calendar` | `ui-calendar`, `ui-timeline` |
| `node-red-contrib-webapp-richtext` | `ui-rich-text`, `ui-markdown` |
| `node-red-contrib-webapp-code` | `ui-code-editor` |
| `node-red-contrib-webapp-material` | Material Design Backend + Material-spezifische Knoten |
| `node-red-contrib-webapp-bootstrap` | Bootstrap 5 Backend + Bootstrap-spezifische Knoten |


