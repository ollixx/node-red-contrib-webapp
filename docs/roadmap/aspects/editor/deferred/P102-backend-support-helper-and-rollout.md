---
id: P102
title: "Backend-Support: schemagetriebene Capability-Map + gemeinsamer Editor-Helfer (Trennlinie+Warnung) + Konzept überall referenzieren"
epic: aspects/editor
status: deferred
deferred_reason: "Ohne ein zweites, real renderndes Backend ist die Capability-Map einspaltig und die Warnung hat keinen Gegenwert. Zurückgestellt, bis ein zweites Backend (eigenes Epic) existiert. Ball flach halten."
dependencies: [P50]
verify: browser
spec: docs/nodes/concepts/backend-support.md
---
# P102 — Backend-Support: Capability-Map + Editor-Helfer + Doc-Rollout

> Setzt das Konzept [backend-support.md](../../../../nodes/concepts/backend-support.md)
> um. Querschnitt für **alle** Knoten mit backend-bedingten Feldern
> (`size`, `variant`, `pulsating`, `displayType=square`, …).

## Findings
> Owner-Vorgabe (sinngemäß, aus der Diskussion zu ui-avatar/ui-badge):

- Felder, die das aktive Backend (heute Shoelace) nicht nativ unterstützt, müssen im Editor **unter einer Trennlinie** mit einer **Warnung** erscheinen — und zwar bei **allen** Knoten gleich, nicht pro Knoten neu erfunden.
- Das verirrte einzelne „i"-Icon hinter solchen Feldern (z. B. ui-avatar „Variant") ist falsch und entfällt, sobald die Warnung erscheint.
- Das Verhalten gehört in ein Konzept und muss **überall referenziert** werden.

## Acceptance
> `verify: browser` — im laufenden Editor zu beweisen.

- Schema/Contract: eine **deklarative Capability-Map** (`SUPPORT_BY_BACKEND` o. ä. in `packages/schema`) ist die Single Source of Truth dafür, welches Feld welches Backend nativ unterstützt. Weder Editor noch Knoten hartcodieren diese Liste. (Heute: alle Einträge gegen den einzigen Adapter „shoelace".)
- Editor: ein **gemeinsamer Helfer** in `resources/lib/editor-common.js` (z. B. `installBackendSupportNotice({ fields })`) rendert die Trennlinie + standardisierte Warnung. Kein Knoten implementiert das selbst.
- Editor (Beweis an ui-avatar): `size` und `variant` stehen unter einer Trennlinie mit Warnung „vom aktiven Backend (Shoelace) nicht nativ unterstützt"; das einzelne „i"-Icon ist weg.
- Editor (Beweis an ui-badge): `size`, `pulsating`, `displayType=square` analog.
- Das Feld bleibt **bedienbar** (nicht deaktiviert) und wird zur Laufzeit weiterhin als `data-*` emittiert (Laufzeitregel des Konzepts).
- Doc-Rollout: **jede** Node-Doc mit mindestens einem backend-bedingten Feld referenziert [backend-support.md](../../../../nodes/concepts/backend-support.md) an der Feldzeile + in „Referenzen". (ui-badge, ui-avatar sind bereits verdrahtet; übrige Knoten mit `size`/`variant`/`pulsating` ergänzen — Liste per `grep` der Feldnamen in `docs/nodes/**` ermitteln.)

## Notes
- Reihenfolge: Capability-Map zuerst (Contract), dann Helfer (liest die Map), dann ui-avatar/ui-badge umstellen, dann Doc-Rollout.
- ui-avatar nutzt eine größere size-Skala (`xs`–`xl`) als das geteilte `COMPONENT_SIZES` (`sm`/`md`/`lg`) — beim Capability-Modell beachten, nicht stillschweigend vereinheitlichen (eigener Klärungspunkt).
