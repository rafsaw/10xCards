# Mom Test Validation Plan — M5L1

> Wejście: `context/internal-builders/m5l1-opportunity-map.md` (kandydat: 10xCards Release Safety Digest)
> Tryb: solo / kursowo — walidacja oparta na własnym przeszłym zachowaniu, nie na opinii.
> Data: 2026-06-23

## Input Idea

Lokalny helper generujący krótki Markdown digest, który łączy git log, wynik testów, checklistę ryzyk i notatki z planów (M3/M4), żeby przed kolejnym krokiem/release szybko odczytać, czy zmiana zamyka ryzyko i jakie są dowody.

## Hypotheses

- **Użytkownik / rola**: deweloper 10xCards — na ten moment najpewniej autor sam (projekt kursowo-solo).
- **Tarcie**: info o bezpieczeństwie release'u rozsiane po git / testach / planach / Sentry; trudno szybko odczytać stan ryzyk i dowody.
- **Obecny workaround**: ręczne przeklikiwanie źródeł przy każdym kroku/release.
- **Ryzykowne założenia**:
  1. Że przegląd realnie się powtarza i kosztuje czas (a nie jest rzadki i „wystarczająco" szybki).
  2. Że digest zostanie *użyty* przed kolejnym krokiem, a nie wygenerowany raz i porzucony.
  3. Że problem to brak *złączenia* źródeł, a nie brak nawyku zapisania ryzyk w jednym miejscu (tarcie przypadkowe).
- **Dowody już obecne**: własna obserwacja z M5L1; brak twardych danych o liczbie i koszcie przeglądów.

## Critique

1. **Projekt jest solo** — klasyczne wywiady się nie skalują. Najmocniejszy dowód to przeszłe zachowanie autora (ile razy realnie robił przegląd i co wtedy zrobił), nie opinia o pomyśle.
2. **Rozwiązanie udające problem** — „digest łączący źródła" to już rozwiązanie. Realne tarcie może być węższe (np. „nie pamiętam, które ryzyka z planu miały być zamknięte") i wymagać jednego pola w `change.md`, a nie generatora.
3. **Test obalenia** — jeśli przegląd jest rzadki (≤1 na slice), zajmuje <5 min, a `/code-review` + `lessons.md` już go pokrywają, to sygnał słaby i lepszy jest istniejący nawyk niż nowe narzędzie.

## Interview Guide (self-interview, 20–30 min)

Zasada: przed odpowiedzią otwórz git log i przejrzyj ostatnie 3 release'y/slice'y. Odpowiadaj z danych, nie z pamięci.

**A. Kontekst**
1. Ile było „kroków/release'ów" w ostatnich 4 tygodniach? (policz z git/tagów)
2. Co formalnie uznajesz za „gotowe do kolejnego kroku"? Czy to gdzieś zapisane?

**B. Ostatnia realna historia (sedno)**
3. Weź ostatni release — krok po kroku: co sprawdziłeś przed ruszeniem dalej i w jakiej kolejności (git / testy / plan / Sentry)?
4. Ile to zajęło (z zegarkiem)? Gdzie utknąłeś najdłużej?
5. Czy coś wtedy umknęło i wyszło później?

**C. Workaround dzisiaj**
6. Bez nowego narzędzia — jak to robisz teraz? Checklista, notatka, rytuał?
7. Czy używałeś `/code-review` albo `lessons.md`? Co załatwiły, a czego nie?

**D. Koszt**
8. Co realnie kosztuje brak złączenia źródeł — czas, powtórki, ryzyko regresji, czy lekka irytacja? Konkretny ostatni przykład.

**E. Sygnał decyzyjny**
9. Gdyby digest istniał przy ostatnim release — które pole przeczytałbyś najpierw? Co musi w nim być, żebyś realnie go otwierał?
10. Co musiałoby być prawdą, żeby uznać, że nie warto tego budować?

*Follow-up:* jeśli na pyt. 5 padło „coś umknęło" → czy digest by to złapał, czy to rzecz spoza tych źródeł?

## Survey (opcjonalny szerszy sygnał — kohorta 10xDevs, 6–8 pytań)

Uruchom tylko, by sprawdzić, czy tarcie generalizuje się poza autora.

1. **(Screener)** Wypuszczałeś w ostatnim miesiącu zmianę, gdzie ryzyka/decyzje/testy żyją w osobnych miejscach? `Tak / Nie` *(Nie → koniec)*
2. Jak często przed kolejnym krokiem ręcznie zbierasz info z wielu źródeł? `Codziennie / Co tydzień / Co kilka tygodni / Rzadziej`
3. Ile zajmuje jeden taki przegląd? `<5 min / 5–15 / 15–30 / >30`
4. Czy zdarzyło się ruszyć dalej i przeoczyć niezamknięte ryzyko? `Często / Czasem / Raz / Nigdy`
5. Czego dziś używasz do tego przeglądu? `Nic / Własna checklista / Narzędzie review / CI / Inne`
6. **(Otwarte)** Opisz ostatni raz, gdy taki przegląd był uciążliwy.
7. **(Otwarte)** Co sprawiłoby, że codzienne narzędzie do tego otwierałbyś zamiast pominąć?

Bez pytań o „czy podoba Ci się pomysł" i bez wyceny.

## Decision Criteria

- **Buduj**: w ostatnich 4 tygodniach ≥4 realne przeglądy, każdy >10 min lub ≥1 przeoczone ryzyko wyszło później, a `/code-review`+`lessons.md` tego nie pokrywały.
- **Zawęź zakres**: przegląd się powtarza, ale ból siedzi w jednym polu — dodaj to pole do `change.md`/`plan.md` zamiast budować generator.
- **Nie buduj jeszcze**: przegląd rzadki (≤1 na slice) i <5 min — sygnał za słaby.
- **Najpierw istniejące narzędzie**: `/code-review` + dyscyplina `lessons.md`/`change.md` już zamykają potrzebę — zostań przy nawyku.
