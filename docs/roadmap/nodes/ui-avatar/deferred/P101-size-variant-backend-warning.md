---
id: P101
title: "ui-avatar: size/variant nur bei Backend-Support, sonst Warnung unter Trennlinie; verirrtes Info-Icon entfernen; Render-Garantie per Test"
epic: nodes/ui-avatar
status: deferred
deferred_reason: "Hängt an P102 (zurückgestellt) und an einem zweiten Backend für die size/variant-Render-Garantie. Zurückgestellt, bis das vorliegt. Ball flach halten."
dependencies: [P93, P94, P102]
node: ui-avatar
verify: browser
spec: docs/nodes/display/ui-avatar.md
tests: tests/e2e/nodes/view/ui-avatar.tests.md
---
# P101 — ui-avatar: size/variant Backend-Support + Warnung + Render-Garantie

## Findings
> Bericht des Owners, wörtlich.

- Shoelace unterstützt `size` und `variant` nicht. Der Editor sollte diese Felder in diesem Fall (vom Backend nicht unterstützt) unterhalb einer Trennlinie anzeigen und eine Warnung dazu anzeigen.
- Hinter „Variant" erscheint ein einzelnes „i". Das macht keinen Sinn — weg damit, wenn die Warnung erscheint.
- Wie garantieren wir per Test, dass z. B. mit Bootstrap `size` und `variant` korrekt angezeigt werden?

## Acceptance
> Beobachtbar, muss im laufenden Frontend bewiesen werden (`verify: browser`).

- Editor (Backend = Shoelace): `size` und `variant` stehen **unterhalb einer Trennlinie**, mit einer sichtbaren Warnung „vom aktiven Backend (Shoelace) nicht unterstützt".
- Editor: das verirrte einzelne „i" hinter „Variant" ist entfernt, sobald die Warnung erscheint (keine doppelte/sinnlose Info-Markierung).
- Test-Garantie: ein Test mit einem Backend, das `size`/`variant` unterstützt (z. B. Bootstrap-Adapter), beweist, dass beide **beobachtbar gerendert** werden — d. h. unterschiedliche `size`-Werte erzeugen unterschiedliche gerenderte Größen und unterschiedliche `variant`-Werte unterschiedliche Farben/Stile (nicht bloß DOM-Präsenz). Der Test wird **rot**, wenn das Rendering von size/variant entfernt wird.

## Notes
- Die „nicht nativ unterstützt"-Warnung + `data-*`-Emission ist zentral spezifiziert in [backend-support.md](../../../../nodes/concepts/backend-support.md); der gemeinsame Editor-Helfer + die Capability-Map kommen aus **P102**. Dieses Paket stellt ui-avatar darauf um und ergänzt die Render-Garantie — es erfindet das Muster nicht neu.
- Offene Designfrage für die Render-Garantie: Ist ein Backend vorhanden/testbar, das `size`/`variant` nativ rendert, oder muss das über einen Adapter-Stub geführt werden? Vor Umsetzung klären (vgl. aspects/adapter-Historie P23/P25), nicht raten.
