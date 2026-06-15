# Artifact 1 — Mapa terytorium (historia gita)

> Wide Scan oparty o historię gita. Pokazuje, **gdzie projekt realnie żył** w ostatnich
> 12 miesiącach: aktywne obszary, sprzężenia (współzmiany) i sygnały ryzyka.
> To nie jest jeszcze `repo-map.md` — to surowy obraz terytorium z danych historycznych.

## 0. Zakres i metoda

- **Okno:** ostatnie 12 miesięcy. Cała historia repo mieści się w tym oknie —
  **178 commitów, 2026-05-20 → 2026-06-15** (≈26 dni). Projekt jest młody i intensywny.
- **Filtr szumu** (wycięte z rankingów aktywności kodu): `package-lock.json`,
  `.claude/settings.local.json`, `.claude/.10x-cli-manifest.json` (generowany manifest),
  `.env*`, `.gitignore`, configi (`tsconfig`, `astro.config`, `eslint`, `prettier`,
  `wrangler`, `vitest.config`), snapshoty (`*.snap`).
- **Uwaga o renamach:** liczby liczone z `--no-renames`. Część "zmian"
  `context/changes/**/change.md` to w rzeczywistości **przeniesienia do
  `context/archive/`** przy zamykaniu zmiany (rename = delete+add), a nie praca nad kodem.
  Aktywność `context/` należy więc czytać jako churn procesu 10x-workflow, nie kodu.

## 1. Aktywność — gdzie dotykano kodu

### Skala obszarów (top-level, surowo, dla kontekstu)

| Obszar | Wiersze zmian | Charakter |
|---|---:|---|
| `context/` | 347 | dokumentacja procesu (plan/change/foundation) — **nie kod** |
| `.claude/` | 149 | konfiguracja agenta / manifest — **szum** |
| `src/` | 110 | **realny kod produktu** |
| `notes/` | 27 | notatki kursu — szum |
| `test/` + `tests/` | 13 | testy integracyjne / guardraile |

> Wniosek: dwie trzecie churnu to artefakty AI-workflow (`context/`, `.claude/`).
> Przy analizie ryzyka kodu trzeba je odfiltrować — inaczej zagłuszają sygnał z `src/`.

### a) TOP foldery/moduły (hands-on, `src/`)

| # | Folder | Zmiany | Co tu mieszka |
|--:|---|---:|---|
| 1 | `src/pages` | 47 | trasy Astro + endpointy API |
| 2 | `src/components` | 35 | UI (React/Astro) |
| 3 | `src/lib` | 16 | współdzielony rdzeń (supabase, leitner, openrouter, observability) |
| 4 | `src/middleware.ts` | 6 | bramka autoryzacji tras |
| 5 | `src/layouts` | 3 | layout aplikacji |

Schodząc poziom niżej (bo `src/pages` i `src/components` są zbyt ogólne):

| Pod-obszar | Zmiany | Pod-obszar | Zmiany |
|---|---:|---|---:|
| `src/pages/api` | 25 | `src/components/library` | 7 |
| `src/pages` (trasy `.astro`) | ~22 | `src/components/generate` | 6 |
| | | `src/components/auth` | 6 |
| | | `src/components/review` | 5 |
| | | `src/components/settings` | 3 |

> **`src/pages/api` to najgorętszy realny obszar** (25 zmian) — backend warstwy
> produktowej: `generations`, `cards`, `reviews`, `account`, `auth`.

### b) TOP pliki kodu (po odfiltrowaniu szumu)

| # | Plik | Zmiany | Rola |
|--:|---|---:|---|
| 1 | `src/pages/dashboard.astro` | 6 | główny ekran po zalogowaniu |
| 1 | `src/middleware.ts` | 6 | bramka auth dla `PROTECTED_ROUTES` |
| 3 | `src/pages/library.astro` | 5 | przeglądanie/edycja fiszek |
| 3 | `src/components/review/ReviewSession.tsx` | 5 | sesja powtórek (SRS/Leitner) |
| 5 | `src/components/generate/DraftReviewList.tsx` | 4 | recenzja wygenerowanych draftów |
| 6 | `src/pages/generate.astro` | 3 | ekran generowania AI |
| 6 | `src/lib/observability.ts` | 3 | Sentry / telemetria |
| 6 | `src/layouts/Layout.astro` | 3 | wspólny layout |
| 6 | `src/components/library/CardRow.tsx` | 3 | wiersz fiszki |

> Poza `src/` realnie aktywne (poza-szumowe) pliki to `CLAUDE.md`/`AGENTS.md`
> (instrukcje agenta, 20+3 zmiany) i `sentry.client.config.ts` (5) —
> ślad wdrożenia obserwowalności.

## 2. Nacisk pracy w czasie

Podział na kwartały **nie ma sensu** — cała historia to ~4 tygodnie. Zamiast tego tydzień po tygodniu:

| Tydzień | Commity | Dominujący nacisk |
|---|---:|---|
| 2026-05-20 → 26 (W20) | 33 | bootstrap + pierwszy kod (`src` ≈ `.claude`), schemat kart, auth |
| 2026-05-27 → 06-02 (W21) | 35 | szczyt feature'ów: generowanie, atomic-save, SRS, deck edit, usuwanie konta |
| 2026-06-03 → 06-09 (W22) | 107 | **pik** — isolation/RLS, testy odporności generowania, observability (Sentry) |
| 2026-06-10 → 06-15 (W23–24) | 3 | wygaszenie — tylko `.claude` / manifesty lekcji |

> Trajektoria: **fundament (auth/schema) → feature'y produktu → hardening
> (izolacja użytkowników, testy, observability) → cisza**. Nacisk przesuwał się
> od budowania w stronę bezpieczeństwa i niezawodności.

## 3. Współzmiany — co zmienia się razem

Pary katalogów najczęściej w jednym commicie (po wycięciu czysto-procesowych par
`.claude ↔ context`, które są artefaktem workflow):

| Para obszarów | Wspólne commity |
|---|---:|
| `context/changes` ↔ `src/lib` | 11 |
| `context/changes` ↔ `src/pages/api` | 10 |
| `context/changes` ↔ `src/pages` (trasy) | 10 |
| `src/middleware.ts` ↔ `src/pages` (trasy) | 5 |
| `context/changes` ↔ `src/components/{generate, library, review}` | 5 każda |
| `context/changes` ↔ `supabase` | 5 |
| `context/changes` ↔ `src/middleware.ts` | 6 |

Trójki w obrębie `src/` są słabe (max 2 wystąpienia), ale powtarza się oś
**`src/lib` + `src/middleware.ts` + `src/pages`** — czyli rdzeń + bramka + trasy
zmieniają się razem.

### Wnioski dla TOP 3 obszarów z rankingu aktywności

1. **`src/pages/api`** — silnie sprzężone z `context/changes` (każdy feature = nowy
   endpoint) oraz z `src/lib`. Backend jest sterowany feature'ami: dodanie zmiany
   produktowej niemal zawsze dotyka API + współdzielonego rdzenia. To zdrowe pionowe
   cięcia (slice'y), ale oznacza, że **`src/lib` jest wspólnym zależnym** wielu endpointów.
2. **`src/components`** — sprzężenia rozłożone po pod-folderach (`generate`, `library`,
   `review`, każdy ~5). Komponenty są dobrze odseparowane per-feature; **nie ma jednego
   komponentu-molocha**, churn idzie wzdłuż granic funkcji.
3. **`src/middleware.ts`** — mimo że to jeden plik, współzmienia się z trasami (5),
   `context/changes` (6) i `src/lib` (5). Bramka auth jest **punktem styku całego
   produktu**: zmiany w tablicy `PROTECTED_ROUTES` towarzyszą wielu feature'om.

## 4. Wspólny mianownik i weryfikacja istnienia

### Czy jest jeden plik dotykający wielu obszarów naraz?

Mierząc, z iloma **różnymi** obszarami dany plik współzmienia się w historii:

| Plik | Liczba odrębnych obszarów | Typ |
|---|---:|---|
| `package.json` | 12 | manifest zależności (oczekiwane — szum) |
| `.gitignore` / `.env.example` / `astro.config.mjs` | 9–11 | config (szum) |
| `.claude/.10x-cli-manifest.json` | 9 | **generowany** (szum) |
| `CLAUDE.md` / `AGENTS.md` | 9 | instrukcje agenta (proces) |
| **`src/middleware.ts`** | **9** | **realny "wspólny mianownik" w kodzie** |

> **Brak pliku z tłumaczeniami / i18n** — projekt nie ma warstwy lokalizacji, więc
> klasyczny "wspólny mianownik" (plik z tłumaczeniami) nie istnieje. Najbliższym
> prawdziwym kodowym wspólnym mianownikiem jest **`src/middleware.ts`** (bramka auth
> spinająca wszystkie chronione trasy). Po stronie procesu rolę tę pełni
> `CLAUDE.md`/`AGENTS.md`. Resztę "szerokich" plików stanowią configi i generowany
> manifest — należy je ignorować przy wnioskowaniu o architekturze.

### Weryfikacja: czy sprzężone pliki nadal istnieją w repo?

Sprawdzono wszystkie pliki `src/` z historii oraz top sprzężone/kodowe — **wszystkie
istnieją, zero usunięć**:

- ✅ `src/middleware.ts`, `src/pages/dashboard.astro`, `src/pages/library.astro`,
  `src/components/review/ReviewSession.tsx`, `src/components/generate/DraftReviewList.tsx`,
  `src/lib/observability.ts`, `sentry.client.config.ts`, `package.json`, `CLAUDE.md` — obecne.
- Jedyne **renamy** w historii to przeniesienia `context/changes/<id>/change.md`
  → `context/archive/<data-id>/change.md` (12 zamkniętych zmian). To zamykanie
  feature'ów w workflow, **nie** ruch w kodzie. Analiza nie opiera się na żadnym
  pliku, który zniknął lub został przeniesiony.

## 5. Sygnały ryzyka (wynikające z terytorium)

- **`src/middleware.ts` — hotspot + szeroki blast radius.** Często zmieniany (6),
  sprzężony z 9 obszarami, jest jedyną bramką autoryzacji. Błąd tutaj dotyka
  wszystkich chronionych tras → kandydat do szczególnej uwagi w przeglądach i testach.
- **`src/lib` jako wspólny zależny.** Współdzielony rdzeń (`supabase`, `leitner`,
  `openrouter`, `observability`, `account-retention`) zmienia się razem z większością
  feature'ów — regresja w lib ma szeroki zasięg.
- **`src/pages/api` jako epicentrum logiki.** Najgęściej dotykany realny obszar; tu
  skupia się ryzyko biznesowe (generowanie AI, zapis kart, powtórki, usuwanie konta).
- **Hardening pojawił się późno** (observability + testy odporności w ostatnim tygodniu
  pracy) — młoda warstwa, mało historii, potencjalnie niedojrzała.
- **Guardraile już istnieją:** `test/no-service-role-in-src.test.ts` oraz testy
  integracyjne `cards` / `reviews` / `retention-write-lock` — dobry sygnał, że
  najbardziej ryzykowne ścieżki (RLS, izolacja użytkowników) są pilnowane.
- **Szum dokumentacyjny dominuje churn** (`context/`, `.claude/`). Każda przyszła
  analiza częstotliwości MUSI go filtrować, inaczej `src/` zniknie w statystykach.

---

*Wygenerowano z historii gita (`git log`, okno 12 mies. = cała historia repo,
178 commitów). Następny krok serii: synteza do `repo-map.md` (jeszcze nie tworzony).*
