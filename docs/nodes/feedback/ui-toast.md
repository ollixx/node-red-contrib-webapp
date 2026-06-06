# `ui-toast`

## Zusammenfassung

Zeigt eine temporäre Benachrichtigung die sich nach einer konfigurierbaren Zeit automatisch schließt.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Toasts erscheinen immer auf App-Ebene, nicht in einem Slot.

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`.

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Default: `"Toast N"`
- `severity`: `primary | success | warning | danger | neutral | info` (SEVERITY_VARIANTS; `info` ist Alias von `primary`). Default: `info`. (P49b: Legacy-Wert `error` → verwende `danger`.)
- `duration`: Anzeigedauer in ms. Default: `4000`. `0` = kein Auto-Dismiss.
- `position`: `top-right | top-center | bottom-right | bottom-center`. Default: `bottom-right`

## Input

Wird durch eine eingehende Message ausgelöst:

```
msg.ui.toast.message  = "Gespeichert"
msg.ui.toast.severity = "success"    ← optional, überschreibt Editor-Default (SEVERITY_VARIANTS)
msg.ui.clientId                      ← optional, nur für diesen Client
```

## Output

| Event | `msg.ui`-Felder |
|---|---|
| `dismiss` | `event: "dismiss"`, `clientId` |
