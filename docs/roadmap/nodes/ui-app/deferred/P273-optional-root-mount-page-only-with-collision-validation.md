---
id: P273
title: "ui-app: optionaler Root-Mount /<root> (Page-only) mit Deploy-Zeit-Kollisionsvalidierung in beide Richtungen"
epic: nodes/ui-app
status: deferred
deferred_reason: "Owner-Entscheidung 2026-07-23: bewusst geparkt — nicht 1.0-kritisch, Reverse-Proxy deckt den Bedarf heute; aufnehmen mit der Produktionsreife-Strecke oder bei realem Deployment-Bedarf."
dependencies: []
node: ui-app
verify: browser
spec: docs/nodes/structure/ui-app.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P273 — ui-app: optionaler Root-Mount `/<root>` mit Kollisionsvalidierung

> Rationale + verworfene Alternativen: [ADR 0043](../../../../adr/0043-optional-root-mount-with-deploy-time-collision-validation.md).
> Verwandte Vorarbeit: P108 (root-Eindeutigkeit als Deploy-Diagnostic — dieselbe Gattung).

## Findings

> Owner-Report (2026-07-23), wörtlich:

- „Fehler in der Doku zu ui-app. Da steht die App wird als /\<name\> ausgeliefert.
  Das stimmt ja so nicht. /webapp/\<name\> ist richtig." *(Doku am 2026-07-23
  korrigiert — der Doku-Teil dieses Findings ist bereits erledigt.)*
- „Hier sollten wir auch mal nachdenken, ob nicht auch /\<name\> möglich wäre.
  Da müsste natürlich geschaut werden, dass der name keine existierenden
  endpunkte der node-red instanz überschreibt -> Validierung notwendig,
  andernfalls wird die webapp nicht gemounted."

## Acceptance

> `verify: browser` — jede Zeile im laufenden Editor/Deploy zu beweisen.
> Zuschnitt per ADR 0043: Opt-in, Page-only am Root, technische Endpoints
> bleiben unter `/webapp/<root>/…`.

1. **Opt-in-Feld:** `ui-app` erhält ein Boolean-Feld `mountAtRoot`
   (Default `false`, Gruppe „Allgemein"). Die Editor-URL-Vorschau zeigt bei
   aktiviertem Feld `/<root>`, sonst `/webapp/<root>`.
2. **Serving:** Mit `mountAtRoot: true` liefert `GET /<root>` (und
   `GET /<root>/*` für SPA-Locations) dieselbe Seite wie `/webapp/<root>`;
   `/webapp/<root>` bleibt parallel erreichbar. Die technischen Endpoints
   (`/stream`, `/event`, `/snapshot`, `/dynamic-state`, `/asset/:id`) werden
   NICHT am Root registriert — der ausgelieferte Client nutzt sie über die
   `/webapp/<root>`-Base (Bootstrap trägt die API-Base getrennt von der
   Page-URL).
3. **Kollisionsvalidierung Richtung 1 (App vs. Bestand):** Kollidiert `<root>`
   beim Deploy mit (a) einem Eintrag der statischen Deny-List (mindestens:
   `webapp`, `ui`, `resources`, `red`, `icons`, `vendor`, `flows`, `nodes`,
   `settings`, `auth`, `library`, `context`, `debug`, `locales`) oder (b) einer
   bereits im `RED.httpNode`-Router registrierten Route mit gleichem erstem
   Pfadsegment, dann: strukturierter Diagnostic (Gattung analog P108, z. B.
   `root-mount-collision`, mit dem kollidierenden Pfad im Text), die App wird
   **nicht** am Root gemountet, bleibt aber unter `/webapp/<root>` voll
   funktionsfähig. Editor zeigt den Konflikt (Knoten-Warnung), nichts wird
   still verschluckt.
4. **Kollisionsvalidierung Richtung 2 (Bestand vs. App):** Ein NACH dem
   App-Deploy deployter `http in`-Endpoint, dessen erstes Pfadsegment einem
   aktiven Root-Mount entspricht, erzeugt beim (Re-)Deploy einen Diagnostic —
   der Konflikt wird gemeldet, nicht durch Registrierungs-Reihenfolge
   nichtdeterministisch entschieden.
5. **Gegenproben:** (a) `mountAtRoot: false` (Default) registriert nichts am
   Root — Verhalten heutiger Apps byte-gleich unverändert; (b) kollisionsfreier
   Root-Mount erzeugt keinen Diagnostic; (c) zwei Apps mit `mountAtRoot: true`
   und verschiedenen `root`s koexistieren.
6. **Doku:** `docs/nodes/structure/ui-app.md` dokumentiert das Feld vollständig
   (Typ, Default, Validierung + Fehlertext, Verhalten bei Kollision,
   Deny-List-Wartungshinweis bei Node-RED-Upgrades) und nennt den
   Reverse-Proxy als Produktions-Alternative.

## Notes

- Express-Registrierungsreihenfolge über Deploys ist nicht stabil („first match
  wins", vgl. P108) — deshalb ist die *beidseitige* Prüfung je Deploy Kern des
  Pakets, nicht Kür.
- Die Deny-List ist Node-RED-versionsabhängig (Admin-Routen wachsen). Sie lebt
  als benannte Konstante mit Kommentar + Doku-Hinweis; die dynamische
  Router-Inspektion fängt Unbekanntes.
- Auth (ADR 0041): die eine Guard-Middleware muss auch die Root-Mount-Routen
  abdecken — Page und SPA-Fallback am Root laufen durch dieselbe Enforcement-
  Fläche wie die `/webapp`-Endpoints.
