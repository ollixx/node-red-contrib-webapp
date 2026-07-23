# Template: topic guide (`docs/guide/guides/<topic>.md`)

> For authors (P265, ADR 0042). A guide is **task-oriented**: it walks the
> reader from a goal to a working flow. EN under `docs/guide/guides/`, DE
> mirror under `docs/guide/de/guides/` — **always both in the same change**.

## Skeleton (EN)

```markdown
# <Topic title>

## Goal

What the reader will have built/understood at the end — 1–3 sentences.

## Prerequisites

What must exist/be known first (installed package, a running app, a prior
guide), with links.

## Steps

Numbered, each step one concrete action in the editor plus what the reader
should now SEE (the observable result). Screenshot-free but visually
verifiable wording.

1. …
2. …

## Example flow

An importable flow that is the finished result of the steps:
`examples/guide/<topic>.json` + the standard import instructions
(Node-RED menu → Import → file/JSON → Import → Deploy → open the app).

## Where next

Links to the related node references and follow-up guides.
```

---

## Skelett (DE — für `docs/guide/de/guides/<topic>.md`)

```markdown
# <Themen-Titel>

## Ziel

Was am Ende gebaut/verstanden ist — 1–3 Sätze.

## Voraussetzungen

Was vorher existieren/bekannt sein muss (installiertes Paket, laufende App,
vorheriger Guide), mit Links.

## Schritte

Nummeriert; jeder Schritt eine konkrete Aktion im Editor plus das, was der
Leser jetzt SIEHT (beobachtbares Ergebnis).

1. …
2. …

## Beispiel-Flow

Ein importierbarer Flow als fertiges Ergebnis der Schritte:
`examples/guide/<topic>.json` + Standard-Import-Anleitung (Node-RED-Menü →
Import → Datei/JSON → Import → Deploy → App öffnen).

## Wie weiter

Links auf die zugehörigen Knoten-Referenzen und Folge-Guides.
```
