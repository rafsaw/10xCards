# 🎯 Rekomendacje opcjonalne — 10xCards (pod wyróżnienie / Demo Day)

Data: 2026-06-29
Kontekst: projekt ma już **5/5** w mvp-check (zob. `mvp-check-report.md`). Poniższe punkty
NIE są wymagane do zaliczenia minimalnego progu — to dźwignie pod **wyróżnienie i Demo Day**
(termin: **5 lipca 2026**, jedyne okno z wyróżnieniami).

> Przypomnienie: UI, screeny i deployment są oceniane osobno od mvp-check. Poniżej skupiam się
> na tym, co podnosi jakość techniczną widoczną w kodzie i dokumentacji.

---

## 1. Domknięcie faz testów 3–5 (najwyższy priorytet)

Ryzyka są już zdefiniowane w `context/foundation/test-plan.md` — brakuje tylko testów.
To najmocniejszy, najtańszy sygnał dojrzałości, bo plan→test mapuje się 1:1.

- **R3 — atomowość accept/reject** (`finalize_drafts` RPC): test, że połowiczny commit nie
  zostawia decku w niespójnym stanie (część draftów zapisana, część nie). Najtańsza warstwa:
  test integracyjny na RPC z wymuszonym błędem w połowie.
- **R4 — account lifecycle / sweep**: test, że konto w 30-dniowej retencji nie może mutować
  zasobów (route write-lock) oraz że hard-delete sweep usuwa właściwe konta i nie pomija
  należnych. Część już pokryta (`retention-write-lock.test.ts`) — domknij stronę sweepa.
- **R6 — trwałość postępu review**: test, że `next_due_at` / rating przeżywają sesję, oraz że
  fallback „oldest-due-first" odpala, gdy selekcja zawiedzie. Najlepiej E2E
  (`review-persistence.spec.ts` już istnieje jako punkt startowy) + test jednostkowy fallbacku.

**Efekt:** pełne pokrycie 6/6 ryzyk z planu — narracja „każde ryzyko ma test" jest bardzo mocna na Demo Day.

---

## 2. Wzmocnienie narracji wartości (AI + SRS)

Sędziowie patrzą na „unikalną wartość". Warto, żeby logika biznesowa była łatwa do wskazania:

- Krótka sekcja w README lub `context/` opisująca **dlaczego** Leitner (a nie SM-2/FSRS) — świadoma
  decyzja architektoniczna czyta się lepiej niż domyślny wybór.
- Jeden test jednostkowy na pełną ścieżkę promocji przez wszystkie 6 pudełek (1→2→4→7→15→30 dni)
  + reset na błędzie — czytelny dowód, że algorytm działa zgodnie z intencją.

---

## 3. Odporność ścieżki AI (R1 rozszerzone)

Masz już typowane błędy OpenRouter. Pod Demo Day warto pokazać **graceful degradation** od strony użytkownika:

- Test/scenariusz: gdy LLM zwróci błąd, użytkownik **nie traci wklejonego tekstu** (zachowany w stanie),
  widzi czytelny komunikat zamiast 500/hangu. To dokładnie scenariusz R1 z perspektywy UX-kontraktu.

---

## 4. Higiena „gotowości na ocenę"

- **CI na `main`**: obecnie workflow triggeruje się na `master`, ale pracujesz na `main` (zob. AGENTS.md),
  więc CI realnie nie gejtuje. Jeśli pokazujesz repo — wyrównaj branch w `.github/workflows/ci.yml`,
  żeby zielony badge odzwierciedlał rzeczywistość.
- **Mutation testing**: masz dostępny Stryker. Jeden przebieg na `src/lib/leitner.ts` lub
  `src/lib/openrouter.ts` i wzmianka o score = dowód, że testy faktycznie łapią regresje (nie tylko pokrywają linie).

---

## Kolejność, gdybyś miał ograniczony czas

1. **R3 + R6** (atomowość zapisu i trwałość review) — to ryzyka „utraty danych użytkownika", najbardziej widoczne.
2. **R4 sweep** — domknięcie account lifecycle.
3. Narracja wartości (#2) + odporność AI (#3) — szybkie, podnoszą odbiór.
4. CI/Stryker (#4) — kosmetyka gotowości, jeśli zostanie czas.

> Wszystkie powyższe są **opcjonalne**. Minimalny próg masz spełniony (5/5).
