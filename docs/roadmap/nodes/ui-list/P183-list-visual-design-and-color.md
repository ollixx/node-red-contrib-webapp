---
id: P183
node: ui-list
epic: nodes/ui-list
title: "ui-list Visual-Design: Zeilen-Anatomie (Icon|Label|Wert) + displayType-Intents als CSS (plain default, divided, grouped Kasten, actionable hover/active) + color richtig auflösen (Token oder CSS)"
findings:
  - "Owner (2026-06-14): 'es geht … darum, dass es da mitten drin zwar korrekt, aber nicht vernünftig gelayoutet rumhängt. Da shoelace keine gestylten listen hat, ist das alles wirklich sehr plain. Das braucht ein wenig Design.' (Screenshot: Icon klebt am Label, value klebt am Label = 'Eins1', nackte Bullets.)"
  - "Owner (2026-06-14): Default = plain (sauber gelayoutet). actionable braucht KEIN Caret rechts — stattdessen responsive mit Hover + optischem Klick (active/pressed), 'so macht das auch bootstrap'."
  - "Owner (2026-06-14): 'color mit String primary' wird nicht gerendert. Befund: der Serializer setzt color roh als style=\"color:primary\" — kein gültiger CSS-Wert → ignoriert. 'primary' ist ein semantisches Token (variant-Vokabular), ui-list hat aber kein variant."
acceptance:
  - "Zeilen-Anatomie: jede Zeile ist ein Flex-Layout — führendes Icon (ausgerichtet, ~18px, gedämpft) | Label (primär, flex, Ellipsis bei Überlänge) | Wert (rechts, mit Abstand); Zeilen-Padding (~10px 14px) + Gap. Icon klebt NICHT mehr am Text."
  - "value-Abstand: secondary = gedämpfter trailing Text MIT Abstand zum Label (kein 'Eins1'-Kleben); badge = Pille (sl-badge) mit Gap. Beide vom Label getrennt."
  - "displayType-Intents als CSS, sichtbar unterscheidbar: plain (DEFAULT; saubere Zeilen, keine Trennlinie), divided (0.5px-Trennlinien), grouped (umrandeter Kasten/list-group: Container-Border + Radius, Zeilen innen geteilt), actionable (Hover-Highlight + active/pressed-Feedback, KEIN Chevron)."
  - "Default-Wechsel: Schema-Default displayType = plain — betrifft nur NEUE Knoten; bestehende behalten ihren gespeicherten Wert."
  - "color richtig auflösen: ein semantisches Token (primary/success/warning/danger/neutral/info) wird auf die Theme-Farbe gemappt (gemeinsame Quelle wie variant, z. B. --wa-color-*); ein gültiger CSS-Wert (#hex/rgb/Name/var()) wird durchgereicht; Unbekanntes wird IGNORIERT (kein kaputtes Inline-style). color='primary' rendert sichtbar in Theme-Primary."
  - "color-Auflösung als GETEILTER Helfer (resolveColorValue o. ä.), nutzbar von jedem Base-Field-color (alle Knoten); Beweis an ui-list."
  - "Hell/Dunkel: das CSS lebt in der ausgelieferten App-Stylesheet, scoped auf .webapp-list/.webapp-list-item; funktioniert in beiden Modi."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: in_progress
---
# P183 — ui-list Visual-Design + color-Auflösung

> Folge zu **P180** (das nur das `displayType`-Modell/Enum + `ordered` brachte).
> Hier kommt die **CSS-Gestaltung** dazu — Shoelace hat keine Listen-Komponente,
> also liefern **wir** das Design. Plus der `color`-Token-Fix.
>
> **Soll-Bild:** der bestätigte Mockup (Owner 2026-06-14) — Zeile
> `[Icon] [Label …] [Wert/Badge]`, vier Intents plain/divided/grouped/actionable.

## Umfang

1. **Zeilen-Anatomie (CSS):** `.webapp-list-item` = Flex-Row, führendes Icon
   (gedämpft, ~18px, eigener Abstand), Label primär mit Ellipsis, Wert rechts mit
   Gap; Zeilen-Padding. Behebt Icon-/value-Kleben („Eins1").
2. **value-Darstellung:** `secondary` → trailing gedämpfter Text **mit** Abstand;
   `badge` → Pille mit Gap (bestehender `sl-badge`, P171).
3. **displayType-Intents (CSS):**
   - `plain` (**Default**) — saubere Zeilen, keine Trennlinie.
   - `divided` — 0.5px-Trennlinien zwischen Zeilen.
   - `grouped` — umrandeter Kasten (Container-Border + Radius, Zeilen innen
     geteilt) — der Bootstrap-`list-group`-Look.
   - `actionable` — Hover-Highlight + **active/pressed**-Feedback (optischer
     Klick), **kein** Chevron. Greift bei `itemClick`/`selectable`.
4. **Schema-Default** `displayType = plain` (nur neue Knoten; Migration der
   Alt-Werte aus P180 bleibt).
5. **color-Auflösung (geteilter Helfer):** `resolveColorValue(value)` —
   - semantisches Token (`primary/success/warning/danger/neutral/info`) → Theme-
     Farbe (gleiche Token-Quelle wie `variant`/`mapVariant`, z. B. `--wa-color-*`);
   - gültiger CSS-Wert (`#hex`, `rgb()`, CSS-Name, `var(...)`) → unverändert;
   - sonst → **ignorieren** (kein `style`), kein kaputtes Inline-CSS.
   In der ui-list-color-Anwendung (heute `style="color:<roh>"`) einsetzen; der
   Helfer ist von jedem Base-Field-`color` (ADR 0015) nutzbar.

## acceptance / verify

- `verify: browser` — die vier Looks + `color="primary"` sichtbar im laufenden
  Frontend beweisen (hell/dunkel); E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- `ui-list.tests.md` + E2E: je Intent ein Render-Nachweis (grouped = Kasten,
  actionable = Hover/active, divided = Linien); Zeilen-Anatomie (Icon/Label/Wert
  getrennt); `color`-Token vs CSS-Wert vs ungültig.

## Risiken / Hinweise

- **color-Semantik:** `color` nimmt jetzt Token **oder** CSS-Wert. Das erweitert
  die `color = allgemeine Farbe`-Definition (ADR 0015) bewusst um die Token —
  Spec (Basis-Felder) entsprechend nachziehen. `variant` bleibt davon unberührt
  (ui-list hat keins).
- CSS in der **einen** ausgelieferten Stylesheet — keine Inline-Style-Dubletten;
  `.webapp-list--disabled`/`--selected` (P172/P173) weiter respektieren.
- Reines Editor-/Render-CSS + ein Auflösungs-Helfer — **kein** Schema-Vertrags-
  wechsel außer dem `displayType`-Default.
