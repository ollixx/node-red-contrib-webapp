---
id: P116
title: "reactive-typedInput: Expression-Editor-Dialog mit Completion, zweistufiger Validierung und Doku-Panel; Aufnahme in den kanonischen Typsatz"
epic: aspects/editor
status: pending
dependencies: [P113, P115]
---
# P116 — `Reactive` im Editor: typedInput + Expression-Editor

> Rationale & Entscheidung: [ADR 0010](../../../adr/0010-reactive-binding-client-expressions.md).
> Durable Spec (Zielzustand, bereits geschrieben): `docs/nodes/concepts/reactive-expressions.md`,
> Abschnitt „Editor-Erlebnis". Renderer/Schema-Seite: **P115** (muss `done` sein).
> Kanonischer Typsatz: **P113** (muss `done` sein — `Reactive` ist dort Typ #4).

## findings (Nutzer-Wortlaut, 2026-06-10)

- "Ein neuer Type ‚Reactive' vielleicht? Und den Code, den man da eingibt, …
  den würde ich am liebsten gleich mit Codecompletion und Validierung etc.
  inline eingeben als User. Da würden dann alle globalen Variablen, wie
  ‚routeParam' auftauchen. Natürlich auch mit einer coolen Doku dazu."

Drei Anforderungen stecken darin, alle drei sind Pflicht:
1. **Codecompletion** — und zwar mit den *echten* Namen aus dem Flow (Stores,
   Routenparameter), nicht nur generischen Schlüsselwörtern.
2. **Validierung** — beim Tippen (Syntax) und vor dem Deploy (Referenzen).
3. **Doku** — direkt im Editor sichtbar, nicht nur irgendwo im Repo.

## Kontext für den umsetzenden Agenten (bitte zuerst lesen)

1. `docs/nodes/concepts/reactive-expressions.md` — der Vertrag: Expression-Form,
   die drei Globals (`routeParam`, `store(name)`, `query(pfad)`),
   Store-per-Name-Semantik, Fehlerbild. Der Dialog muss genau DAS lehren und
   validieren, was der Renderer (P115) ausführt.
2. `docs/nodes/concepts/editor.md` — die Editor-Helfer-Landschaft
   (`resources/lib/editor-common.js`, einzige kanonische Datei). Der neue Typ
   reiht sich dort ein; **keine** Kopien der Datei anlegen.
3. Das Ergebnis von P113 — der kanonische Typsatz-Helfer (Arbeitstitel
   `valueBindingTypes()` / `readValueBinding()` / `applyValueBinding()`).
   `Reactive` ist **Typ #4** dieses Satzes (nach Route-Param, vor msg) und wird
   über diesen Helfer auf alle Display-Wert-Inputs ausgerollt — NICHT pro
   Knoten einzeln verdrahtet.
4. **Vorbild im Repo:** der Icon-Picker-Dialog (P69) und der Store-typedInput
   (P67) zeigen das Muster „typedInput-Typ mit Expand-Button öffnet Dialog".
   **Vorbild in Node-RED:** der eingebaute JSONata-Expression-Editor
   (typedInput-Typ `jsonata`, `RED.editor` Typ `_expression`) — gleiche
   UX-Klasse: Code-Feld, Expand, großer Editor mit Hilfe.

## Zielmodell — was genau zu bauen ist

### 1. Der typedInput-Typ `reactive`

Neuer Typ im kanonischen Satz (Helfer aus P113), Gestalt analog
`storeTypedInputType`:

- `value: "reactive"`, Label `"Reactive"`, Icon-Vorschlag `fa fa-bolt`,
  `hasValue: true` — der einzeilige typedInput zeigt den Quelltext.
- Serialisierung über den P113-Helfer: `{ kind: "reactive", value: "<quelltext>" }`
  (Quelltext in `value`, kein `path`).
- `expand`: öffnet den Expression-Editor-Dialog (unten); Ergebnis wird in den
  typedInput zurückgeschrieben.
- typedInput-`validate`: Quelltext nicht leer UND Syntax-Check besteht
  (s. Validierung Stufe 1). Damit markiert Node-RED den Knoten bei kaputtem
  Ausdruck als ungültig (rotes Dreieck, Deploy blockiert) — das ist die
  Deploy-Sperre.

### 2. Der Expression-Editor-Dialog

Aufbau als Editor-Dialog im Admin-UI (jQuery/Node-RED-Tray oder Dialog —
**kein** Shoelace, siehe editor.md-Grundsatz). Layout: Editor-Bereich oben,
darunter eine Status-/Fehlerzeile, daneben oder als Tab das Doku-Panel.

- **Code-Editor:** `RED.editor.createEditor({ mode: "ace/mode/javascript", … })`
  — Node-REDs gebündelter Editor (ab NR 2.x Monaco mit ace-kompatibler API).
  Mehrzeilig (Template-Literals über mehrere Zeilen sind das erwartete Idiom).
- **Completion (nur wenn Monaco verfügbar — Feature-Detection, sonst sauberer
  Verzicht ohne Fehler):** ein Completion-Provider, der anbietet:
  - die drei Globals `routeParam`, `store()`, `query()` mit kurzer
    Beschreibung als Detail-Text;
  - nach `routeParam.` die **echten Parameternamen**: aus dem `mount` des
    gerade editierten Knotens die umschließende Route ermitteln (Mount-String
    parsen, ggf. Container-Kette über `collectReferenceNodes()` nach oben
    laufen, bis eine `route:`-Ebene erreicht ist) und deren `path` nach
    `:name`-Segmenten scannen. Knoten außerhalb einer Route (z. B. in einem
    App-Slot gemountet) → keine Param-Vorschläge, stattdessen Hinweis im
    Doku-Panel, dass `routeParam` dort zur Laufzeit leer sein kann.
  - nach `store("` die **echten Store-Namen** der Parent-App
    (aus `collectReferenceNodes().stores`; Name = `name`-Feld, getrimmt).
- **Validierung Stufe 1 — Syntax, beim Tippen:** den Quelltext als Expression
  parsen (`new Function('"use strict"; return ( ' + src + ' );')` im
  try/catch). Fehler → Meldung in der Statuszeile (Node-REDs Fehlerstil),
  OK-Button deaktiviert. Leerer Quelltext → ebenfalls ungültig.
- **Validierung Stufe 2 — Referenzen, beim Übernehmen/Speichern:** alle
  `store("…")`-Literale im Quelltext gegen die existierenden Store-Namen der
  App prüfen (einfaches Regex-Scanning über String-Literale als erste Stufe
  reicht; dynamische Namen `store(x)` sind nicht statisch prüfbar und werden
  übersprungen). Unbekannter Name → Fehlermeldung mit dem Namen
  (`Store „kunde" existiert nicht in dieser App`); mehrdeutiger Name (zwei
  Stores gleichen Namens in der App) → ebenfalls Fehler. Diese Prüfung läuft
  zusätzlich in typedInput-`validate`, damit sie auch ohne Dialog-Öffnen beim
  Deploy greift.
- **Doku-Panel („coole Doku"):** kompakte Darstellung der Globals-Tabelle mit
  je einem Beispiel (`` `Kunde ${routeParam.id}` ``,
  `store("customer").name`, `query("customers.total")`) und den zwei
  Grundregeln („eine Expression, kein Statement", „nur lesen"). Inhaltliche
  Quelle ist `docs/nodes/concepts/reactive-expressions.md`; das Panel
  verlinkt darauf mit dem etablierten GitHub-URL-Muster der Inline-Hilfen.
  Die Beispiele müssen mit der Doku-Seite übereinstimmen — bei Abweichung die
  Doku-Seite ändern, nicht zwei Wahrheiten pflegen.

### 3. Inline-Hilfe der Knoten

Die `data-help-name`-Hilfen der Display-Knoten erwähnen den Wert-Typsatz
bereits über P113; dort den Satz um eine Zeile zu `Reactive` ergänzen (ein
Satz + Verweis), NICHT die ganze Doku duplizieren.

### 4. Beispiel-App (optional, empfohlen)

`examples/customers-crud` hat eine Detail-Route mit `:id` — ein dort sinnvoll
platzierter `reactive`-Titel („Kunde 42") wäre der lebende Beweis. NUR über
`pnpm gen:example` (Generator anpassen), niemals Hand-Edit der `flow.json`;
wenn der Generator-Eingriff unverhältnismäßig ist, weglassen und im Result
begründen — die E2E-Fixture aus P115 deckt die Funktion ab.

## Explizit OUT of scope

- Renderer/Schema-Verhalten (P115 — fertig vorausgesetzt).
- Input-Controls (ui-input/-select/…): deren `value` ist eine zweiseitige
  Bindung; `reactive` ist dort kein Angebot (gleiche Abgrenzung wie P113).
- Ein eigener zweiter Editor-Dialog-Stack: den bestehenden Editor-/Tray-Stack
  von Node-RED nutzen, wie es JSONata-Editor und P69-Icon-Picker tun.

## acceptance (observierbar, browser)

- **Typsatz:** Jeder Display-Wert-Input (P113-Scope, z. B. ui-text `value`)
  bietet `Reactive` als Typ #4 (nach Route-Param, vor msg). Auswahl zeigt ein
  Code-Eingabefeld mit Expand-Button.
- **Dialog:** Expand öffnet den Expression-Editor; der eingegebene mehrzeilige
  Ausdruck wird beim Übernehmen in den typedInput zurückgeschrieben und
  überlebt Panel schließen → wieder öffnen (Round-Trip:
  `{ kind:"reactive", value:"…" }` im Knoten-Config).
- **Completion (Monaco vorhanden):** In einem Flow mit Route
  `/customers/:id` und einem Store namens `customer`: `routeParam.` bietet
  `id` an; `store("` bietet `customer` an. Editor-Screenshot als Beleg.
- **Syntax-Validierung:** Eingabe `\`Kunde ${\`` (kaputtes Template-Literal)
  zeigt eine Fehlermeldung im Dialog und deaktiviert Übernehmen; der Knoten
  ist mit kaputtem Ausdruck ungültig (rot markiert), Deploy blockiert.
- **Referenz-Validierung:** `store("gibtsnicht")` ergibt beim Übernehmen/Deploy
  eine Fehlermeldung, die den Namen nennt; Knoten ungültig bis korrigiert.
- **Doku-Panel:** Im Dialog sind die drei Globals mit Beispielen sichtbar plus
  Link auf die Doku-Seite.
- **Ende-zu-Ende (der Gedankenspiel-Beweis):** Über den Editor (nicht per
  Fixture!) einem ui-text auf einer `/customers/:id`-Route der Ausdruck
  `` `Kunde ${routeParam.id}` `` gegeben, deployed: `/customers/42` zeigt
  „Kunde 42", Navigation auf `/customers/7` zeigt „Kunde 7" ohne Reload.
- **Ace-Fallback:** Mit deaktiviertem Monaco (oder simuliertem Fallback)
  öffnet der Dialog weiterhin, Eingabe + Validierung funktionieren — nur die
  Completion fehlt. Kein Konsolen-Fehler.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/reactive-expressions.md` (Abschnitt
  „Editor-Erlebnis") + `docs/nodes/concepts/editor.md` (Typsatz-Tabelle —
  beide bereits auf Zielzustand; Implementierung zieht den Code nach und
  korrigiert die Docs bei bewussten Detail-Abweichungen).
- tests: E2E neu `tests/e2e/nodes/editor/reactive-expression.spec.ts`
  (Dialog öffnen, Eingabe, Syntax-/Referenz-Fehlerfälle, Round-Trip,
  Ende-zu-Ende-Szenario). Den per-Node-Testkatalog von ui-text
  (`tests/e2e/nodes/view/ui-text.tests.md`) um die `Reactive`-Fälle ergänzen,
  da ui-text der Leit-Knoten des Typsatzes ist. Unit-Anteil: das
  `store("…")`-Literal-Scanning der Referenz-Validierung ist als reine
  Funktion testbar.

## Risiken / Hinweise

- **Monaco-API hinter Node-REDs Wrapper:** `RED.editor.createEditor` liefert
  eine ace-kompatible API; für den Completion-Provider muss ggf. auf das
  rohe Monaco-Objekt (`window.monaco`) zugegriffen werden. Feature-Detection
  zwingend; der Ace-Fallback ist Akzeptanzkriterium, kein Sonderfall.
- **Completion-Kontext „welche Route?":** Der Mount kann über Container-Ketten
  laufen — die Auflösung zur umschließenden Route muss die Kette nach oben
  laufen (Logik existiert ähnlich in `getMountLayoutId`/`buildMountOptionsTree`
  — wiederverwenden statt duplizieren).
- **Zwei Wahrheiten vermeiden:** Beispiel-Snippets existieren dann an drei
  Orten (Doku-Seite, Doku-Panel, Tests). Die Doku-Seite ist die Quelle; Panel
  und Tests zitieren sie. Im Result bestätigen, dass alle drei übereinstimmen.
