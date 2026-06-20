---
id: P198
node: ui-container
epic: nodes/ui-container
title: "Container-Varianten rendern wirklich unterschiedlich: card/panel/section/transparent statt 4× nackte <sl-card>; transparent/section ohne Card-Chrome (Platzverschwendung beheben)"
findings:
  - "Owner (2026-06-20): 'alle Variants sehen gleich aus und führen zu einem maximal platzverschwenderischen Card-Rendering. Wo sind die 4 Varianten definiert?'"
  - "Befund: CONTAINER_VARIANTS = ['card','panel','section','transparent'] (packages/schema/src/contracts.ts:793). Der Serializer (resources/lib/webapp-serializer.js:653) rendert JEDEN Variant als <sl-card class=\"webapp-container webapp-container--<variant>\" variant=\"…\"> — sl-card ist IMMER das Element, der Variant wird nur als CSS-Klasse drangehängt (+ ein variant-Attribut, das sl-card ignoriert). Für webapp-container--* gibt es KEIN CSS → alle 4 = Shoelace-Default-Card (Rand+Polster+Hintergrund). 'transparent' ist damit nicht transparent."
acceptance:
  - "Die 4 Varianten rendern sichtbar unterschiedlich: card = echte Karte (Rand+Polster+Hintergrund, sl-card); panel = leichter umrandeter Block (Rand, reduziertes Polster, KEINE Card-Elevation); section = minimal (kein Rand/Hintergrund, nur Abstand); transparent = NACKT (plain div, kein Rand/Polster/Hintergrund — reines Layout-Grouping)."
  - "transparent + section erzeugen KEINE <sl-card> und KEIN Default-Polster — die Platzverschwendung ist weg (Stichprobe: ein transparent-Container fügt im DOM keinen Rand/kein Padding hinzu)."
  - "Das nötige CSS (webapp-container--panel/section/transparent) existiert und wird ausgeliefert (im selben Weg wie das Shoelace-Theme/die App-Styles); hell/dunkel-tauglich."
  - "Eine Stelle: die Variant→Rendering-Entscheidung sitzt zentral im Container-Serializer (Element-Wahl: sl-card nur für card, sonst plain div + Variant-Klasse) — kein per-Knoten-Sonderweg. Gilt für ui-container UND den ui-repeat-Wrapper (P197)."
  - "Default ui-container bleibt card (rückwärtskompatibel); nur panel/section/transparent ändern ihr Aussehen (vorher faktisch = card)."
verify: browser
spec: docs/nodes/display/ui-container.md
tests: tests/e2e/nodes/composite/ui-container.spec.ts
dependencies: []
status: pending
---
# P198 — Container-Varianten wirklich unterscheiden

> **Bug.** Die 4 Container-Varianten sind im Schema definiert, aber der Serializer
> rendert alle als `<sl-card>` + eine **ungestylte** Klasse → identisch und
> platzverschwenderisch (`transparent` ist eine Card). Das CSS fehlt schlicht.
> Verzahnt mit ADR 0021 (Variant = semantischer Intent, je Backend gemappt).

## Umfang

1. **Serializer (Element-Wahl je Variant)** in `webapp-serializer.js` (Container-
   Block ~Z.636–655): `card` → `<sl-card>` (wie bisher); `panel`/`section`/
   `transparent` → **plain `<div class="webapp-container webapp-container--<v>">`**
   (kein `<sl-card>`). Die `variant="…"`-Attribut-Krücke entfällt.
2. **CSS** (ausgeliefert) für die drei: `--panel` = 1px Rand + moderates Padding,
   keine Elevation; `--section` = kein Rand/Hintergrund, nur vertikaler Abstand;
   `--transparent` = nichts (display:contents bzw. plain block ohne Box-Chrome).
   Ablageort = derselbe ausgelieferte Stylesheet-Weg wie das Shoelace-Theme.
3. **Doku:** ui-container-Spec (Theming) — was die 4 Varianten optisch bedeuten;
   `card` = Default, `transparent` = reines Layout-Grouping.

## acceptance / verify

- `verify: browser` — vier Container, je ein Variant, sichtbar verschieden;
  transparent fügt im DOM kein Box-Chrome/Padding hinzu. E2E im Haupt-Checkout
  durch den Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Eine** Rendering-Quelle; ui-repeat-Wrapper (P197) nutzt dieselbe → beide
  profitieren.
- Default `card` für ui-container unverändert (keine stille Optik-Änderung für
  bestehende card-Container); nur die bisher faktisch identischen 3 ändern sich.
- Backend-neutral denken (ADR 0021): die Variant-Namen bleiben semantisch; nur
  der Shoelace-Adapter (=dieser Serializer/CSS) bildet sie ab.
