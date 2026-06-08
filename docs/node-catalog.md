# Node Catalog

Die Einzeldokumente pro Knoten sowie übergreifende Konzepte sind unter [docs/nodes/](nodes/) abgelegt.

## Übergeordnete Konzepte

→ [Übersicht, gemeinsame Modellregeln, Ereignis- und Zustandsmodell](nodes/concepts/overview.md)
→ [Layout-Feature (mehrfach genutztes Konzept)](nodes/concepts/layout.md)
→ [Stores und das `store`-Binding](nodes/concepts/stores.md)
→ [Editor-Features (Node-Picker, typedInput-Typen, Varianten)](nodes/concepts/editor.md)
→ [Theming: Design-Tokens, Variants, Shoelace-Adapter](nodes/concepts/theming.md)
→ [Message-Formate](nodes/concepts/messages.md)
→ [Actions / Interaktions-Verben](nodes/concepts/actions.md)
→ [Events (Client → Backend)](nodes/concepts/events.md)
→ [Inputs (Werte zurück in den State)](nodes/concepts/inputs.md)
→ [Fehler-Handling und Logging](nodes/concepts/errors.md)
→ [Multi-User und Client-Persistenz](nodes/concepts/multi-user.md)

## Strukturknoten

- [ui-app](nodes/structure/ui-app.md)
- [ui-route](nodes/structure/ui-route.md)
- [ui-dialog](nodes/structure/ui-dialog.md)

## View-Knoten — Eingabe

- [ui-input](nodes/input/ui-input.md)
- [ui-select](nodes/input/ui-select.md) _(geplant — P16a)_
- [ui-checkbox](nodes/input/ui-checkbox.md) _(geplant — P16a)_
- [ui-radio](nodes/input/ui-radio.md) _(geplant — P16a)_
- [ui-switch](nodes/input/ui-switch.md) _(geplant — P16a)_
- [ui-textarea](nodes/input/ui-textarea.md) _(geplant — P16a)_
- [ui-datepicker](nodes/input/ui-datepicker.md) _(geplant — P16a)_
- [ui-slider](nodes/input/ui-slider.md) _(geplant — P16a)_

## View-Knoten — Darstellung

- [ui-text](nodes/display/ui-text.md)
- [ui-button](nodes/display/ui-button.md)
- [ui-table](nodes/display/ui-table.md)
- [ui-container](nodes/display/ui-container.md)
- [ui-image](nodes/display/ui-image.md) _(geplant — P16d)_
- [ui-icon](nodes/display/ui-icon.md) _(geplant — P16d)_
- [ui-list](nodes/display/ui-list.md) _(geplant — P16d)_
- [ui-avatar](nodes/display/ui-avatar.md) _(geplant — P16d)_
- [ui-divider](nodes/display/ui-divider.md) _(geplant — P16d)_

## View-Knoten — Feedback & Status

- [ui-alert](nodes/feedback/ui-alert.md) _(geplant — P16b)_
- [ui-toast](nodes/feedback/ui-toast.md) _(geplant — P16b)_
- [ui-progress](nodes/feedback/ui-progress.md) _(geplant — P16b)_
- [ui-skeleton](nodes/feedback/ui-skeleton.md) _(geplant — P16b)_
- [ui-badge](nodes/feedback/ui-badge.md) _(geplant — P16b)_
- [ui-empty-state](nodes/feedback/ui-empty-state.md) _(geplant — P16b)_

## View-Knoten — Navigation & Struktur

- [ui-tabs](nodes/navigation/ui-tabs.md) _(geplant — P16c)_
- [ui-accordion](nodes/navigation/ui-accordion.md) _(geplant — P16c)_
- [ui-breadcrumb](nodes/navigation/ui-breadcrumb.md) _(geplant — P16c)_
- [ui-menu](nodes/navigation/ui-menu.md) _(geplant — P16c)_
- [ui-pagination](nodes/navigation/ui-pagination.md) _(geplant — P16c)_
- [ui-stepper](nodes/navigation/ui-stepper.md) _(geplant — P16c)_

## State-Knoten

- [ui-store](nodes/state/ui-store.md)
- [ui-query](nodes/state/ui-query.md)

## Verhaltensknoten

- [ui-action](nodes/behavior/ui-action.md)
- [ui-navigation](nodes/behavior/ui-navigation.md) _(Deprecated)_

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


