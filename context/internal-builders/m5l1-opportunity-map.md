## Rozważane sygnały tarcia

1. Po zmianach w 10xCards trudno szybko sprawdzić, czy zmiana naprawdę zamyka ryzyko i jakie mamy dowody.
2. Artefakty AI, prompty i notatki kursowe są rozproszone między repo, Obsidianem i rozmowami z agentem.
3. Review często wraca do tych samych tematów: RLS, izolacja użytkowników, Sentry, testy regresji i granice domeny.

## Wybrana okazja
Opportunity: 10xCards Release Safety Digest

# M5L1 — Opportunity Card

## Opportunity

10xCards Release Safety Digest

## Sygnał tarcia

Po zmianach w 10xCards mam dużo informacji w różnych miejscach: git, testy, plany, raporty architektury, Sentry notes. Trudno szybko zobaczyć, czy zmiana naprawdę zamyka ryzyko i czy mam dowody przed kolejnym krokiem/release.

## SaaS / domyślna odpowiedź

GitHub pokazuje commity i PR-y, CI pokazuje czy testy przechodzą, Sentry pokazuje błędy, ale żadne z tych narzędzi nie łączy kontekstu kursowego: ryzyka, planu refaktoru, decyzji architektonicznych i dowodów testowych.

## Cienki helper

Mały lokalny helper, który czyta git log, wynik testów, checklistę ryzyk i notatki z planów M3/M4, a potem generuje krótki Markdown digest.

## Pierwsza użyteczna wersja

Ręcznie odpalany digest z lokalnego repo i mockowanych danych. Bez API, bez dashboardu, bez automatycznych komentarzy w PR.
