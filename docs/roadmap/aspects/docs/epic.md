# Epic: docs

Cross-cutting work packages: user-facing documentation of the webapp node set
(not the repo-internal specs under `docs/nodes/**` — those are the durable
contracts and are maintained per phase).

> Goal: Anwender — nicht Repo-Entwickler — verstehen die Konzepte (z. B. die
> zwei Wege Wire vs. Referenz) dort, wo sie arbeiten: im Editor und in einer
> noch festzulegenden Doku-Form mit Beispielen.


## User-Docs-Programm (ADR 0042, 2026-07-22)

`docs/guide/` (EN kanonisch + `de/`-Spiegel) + locales-Hilfen (en-US+de) für alle
44 Knoten. Zug: **P265** Framework+i18n-Pilot → **P266** Intro/Getting-Started/
8 Guides → **P267–P271** Node-Referenz-Batches (backbone/input/display/feedback/
navigation; parallelisierbar). Guardrails: `check:guide` (neu) + erweitertes
`check:help`, Allowlists → leer. Beispiel-Flows smoke-verifiziert.
