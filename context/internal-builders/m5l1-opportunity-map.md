# Opportunity Map — M5L1

## Kontekst

- **Projekt / kontekst**: 10xCards (internal-builder lens, Moduł 5 Lekcja 1)
- **Ograniczenie danych**: lokalne / read-only / non-sensitive — pierwsza wersja działa na własnym repo (git log, wynik testów, notatki z planów/ryzyk). Bez kontroli dostępu i audytu na start.
- **Data**: 2026-06-23

## Mapa

Jeden wiersz na sygnał, zwięzłe komórki — dłuższe uzasadnienie jest w sekcjach poniżej.

| Sygnał | SaaS / domyślna odpowiedź | Cienki helper | Pierwsza użyteczna wersja | Ryzyko danych | Kierunek, jeśli wartościowe |
|---|---|---|---|---|---|
| 1. Trudno odczytać bezpieczeństwo release'u | GitHub/CI/Sentry nie łączą kontekstu kursowego (ryzyko → plan → decyzja → dowód testowy) | Helper łączy git + testy + checklistę ryzyk + notatki z planów → digest | Ręcznie odpalany digest Markdown, lokalnie + mock | Lokalne / read-only | Internal tool → Review / CI gate |
| 2. Rozproszone artefakty AI | Obsidian / `.claude/skills` / git — każde trzyma wycinek, brak indeksu | Read-only katalog artefaktów z lokalizacją (nie nowy magazyn) | Skrypt skanuje `.claude/skills` + folder notatek i drukuje tabelę katalogu | Lokalne / read-only | Internal tool → Shared artifact registry |
| 3. Powtarzalne tematy review | PR review / `/code-review` / `lessons.md` — ad hoc, z pamięci | Zakodowanie tematów jako pisemny Definition of Done / checklista | Plik checklisty stosowany ręcznie lub przez `/code-review` | Lokalne / non-sensitive | Internal tool → Review / CI gate |

## Klasyfikacja sygnałów

### Sygnał 1 — Trudno odczytać bezpieczeństwo release'u
Po zmianach w 10xCards mam dużo informacji w różnych miejscach (git, testy, plany, raporty architektury, notatki Sentry). Trudno szybko zobaczyć, czy zmiana naprawdę zamyka ryzyko i czy mam dowody przed kolejnym krokiem/release.

- **Domyślna odpowiedź**: GitHub pokazuje commity i PR-y, CI pokazuje wynik testów, Sentry pokazuje błędy — ale żadne z nich nie łączy kontekstu kursowego (ryzyka, planu refaktoru, decyzji architektonicznych i dowodów testowych).
- **Cienki helper**: lokalny helper czytający git log, wynik testów, checklistę ryzyk i notatki z planów M3/M4, generujący krótki digest w Markdown.
- **Pierwsza wersja**: ręcznie odpalany digest z lokalnego repo i mockowanych danych. Bez API, dashboardu, automatycznych komentarzy w PR.
- **Ryzyko danych**: lokalne / read-only / non-sensitive.

### Sygnał 2 — Rozproszone artefakty AI
Skille, prompty i notatki kursowe są rozproszone między repo, Obsidianem i rozmowami z agentem.

- **Domyślna odpowiedź**: wyszukiwanie w Obsidianie, `.claude/skills` w repo, historia gita — każde trzyma wycinek, żadne nie jest indeksem.
- **Cienki helper**: generowany indeks/rejestr listujący artefakty i miejsce ich życia (read-only katalog), a nie nowy magazyn.
- **Pierwsza wersja**: skrypt skanujący `.claude/skills` + folder notatek i drukujący tabelę katalogu. Mockowalne.
- **Ryzyko danych**: lokalne / read-only / non-sensitive.
- **Uwaga**: tarcie częściowo *przypadkowe* (dyscyplina + jeden folder dużo załatwia) i pokrywa się z dystrybucją przez 10x-cli. Słabszy kandydat na pierwszy build.

### Sygnał 3 — Powtarzalne tematy review
Review często wraca do tych samych tematów: RLS, izolacja użytkowników, Sentry, testy regresji i granice domeny.

- **Domyślna odpowiedź**: PR review, `/code-review`, `lessons.md`, ESLint — łapią to, ale ad hoc i z pamięci za każdym razem.
- **Cienki helper**: zakodowanie powtarzalnych tematów jako pisemny Definition of Done / checklista uruchamiana przy każdym PR.
- **Pierwsza wersja**: plik checklisty (tematy jako pozycje bramki), stosowany ręcznie lub przez `/code-review`. Bez budowania narzędzia.
- **Ryzyko danych**: lokalne / non-sensitive.
- **Uwaga**: tarcie *esencjalne* — istnieje z powodu realnych obaw jakościowych. Fix to głównie zakodowanie, nie budowa; w dużej części obsłużone przez `lessons.md` + `/code-review`.

## Wybrany pierwszy kandydat

```text
Kandydat:
  10xCards Release Safety Digest

Czyta:
  git log (od ostatniego tagu/release), najnowszy wynik testów, checklistę
  ryzyk/DoD oraz notatki z planów/architektury (M3/M4). Mock tam, gdzie źródło
  nie jest jeszcze podpięte.

Zwraca:
  Krótki digest Markdown: co się zmieniło, które ryzyka zmiana deklaruje zamknąć,
  dowód dla każdego (testy zielone / nieuruchomione / brak) oraz otwarte punkty
  przed kolejnym krokiem.

Nie robi:
  Bez API, bez dashboardu, bez automatycznych komentarzy w PR, bez roli systemu
  źródła prawdy. Linkuje do PR-ów/ticketów/jobów; nie staje się nimi.

Ryzyko danych:
  Lokalne / read-only / non-sensitive. Brak potrzeby kontroli dostępu w v1.

Kierunek, jeśli się sprawdzi:
  Internal tool → Review / CI gate uruchamiający ten sam check w CI przed release.
```

## Dlaczego ten kandydat

Wygrywa względem kryteriów: powtarza się przy każdej zmianie, łączy ≥3 źródła, ma jasny ręczny koszt dzisiaj, jest testowalny read-only i nie zastępuje odpowiedzialności żadnej istniejącej platformy.

- **Sygnał 2** — ból częściowo przypadkowy (folder + dyscyplina) i pokrywa się ze ścieżką dystrybucji 10x-cli.
- **Sygnał 3** — tarcie esencjalne, już w większości obsłużone przez `lessons.md` + `/code-review`; to zakodowanie, nie budowa.
- **Sygnał 1** — jedyny, gdzie wartość bierze się z *łączenia* źródeł, których nic innego nie łączy, a koszt ręczny wraca przy każdej zmianie.

## Następny kierunek, jeśli wartościowe

Internal tool → **Review / CI gate**. Pierwsza wersja zostaje lokalna, read-only i łatwa do wyrzucenia (ręcznie odpalany digest). Jeśli zacznie być używana regularnie, naturalny krok to ten sam check uruchamiany w CI przed release — bez przejmowania roli GitHuba/CI/Sentry jako źródła prawdy.

Najtańszy pierwszy krok przed kodem: krótka rozmowa z osobami żyjącymi z tym tarciem (dla internal tool — manager i zespół, dla którego jest), żeby sprawdzić, czy obraz problemu jest pełny i dlaczego tarcie istnieje.
