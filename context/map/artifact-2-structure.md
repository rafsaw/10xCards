# Artifact 2 — Mapa strukturalna (dependency-cruiser)

> Jak projekt jest **zbudowany** (graf importów), w opozycji do tego, gdzie **żył**
> (Artifact 1 — historia gita). Pokazuje huby zależności, cykle, granice warstw,
> blast radius i ryzyka testowalności — oraz miejsca, gdzie struktura kodu **nie
> pokrywa się** z apparent strukturą produktu.

## 0. Zakres i metoda

- **Narzędzie:** `dependency-cruiser` 17.4.3, konfiguracja `.dependency-cruiser.cjs`
  (już w repo). Polecenie: `npx depcruise src --output-type json|err`.
- **Zakres grafu:** `src/` (TS/TSX). Wykluczone w configu: `context/`, `.claude/`,
  `public/`, `supabase/`, skompilowane `.astro/`, `dist/`.
- **Skala grafu:** **60 modułów, 134 zależności**. **0 naruszeń reguł, 0 cykli,
  0 sierot** wg narzędzia. (Reporter `--output-type err` w podsumowaniu drukuje
  **61 modules** — dolicza węzeł wejściowy `src`; liczbą odniesienia w tym dokumencie
  jest **60** realnych modułów z raportu JSON.)
- **Metryki:** fan-in = ile modułów importuje dany plik (jak bardzo jesteś *zależnym*);
  fan-out = ile modułów `src/` dany plik importuje (jak bardzo *zależysz*).
  **Fan-in liczy też kolokowane testy** (`*.test.ts`), chyba że w danym wierszu
  zaznaczono inaczej — dlatego niektóre endpointy mają fan-in ≥1 wyłącznie z własnych
  testów, nie z produkcji.
- **Ważny limit metody:** depcruise widzi tylko graf TS/TSX. **Importy z plików
  `.astro` nie są liczone do fan-in.** Dlatego np. `src/lib/config-status.ts` ma w
  tej metryce fan-in 0, mimo że jest używany — importuje go `src/layouts/Layout.astro`.
  Fan-in stron `.astro` i `middleware.ts` (oba 0) to artefakt metody, **nie** martwy kod.

## Najważniejsze obserwacje (TL;DR)

1. **Hub to warstwa Supabase, nie API i nie AI.** `src/lib/supabase.ts` ma fan-in **16** —
   importują go middleware + **dosłownie każdy** endpoint API. To jedyny prawdziwy
   hub serwerowy. OpenRouter (rdzeń „AI") to wąska szprycha o fan-in **2**.
2. **Dwa rozłączne huby = czysta granica klient/serwer.** Serwer ciąży ku
   `supabase.ts`; klient (React) ciąży ku `parse-error.ts` (fan-in 7, same komponenty).
   Żaden komponent nie importuje `supabase`/`openrouter`/`retention` bezpośrednio —
   reguły to wymuszają i **rzeczywistość się zgadza** (0 naruszeń).
3. **Zero cykli, zero sierot.** Jak na projekt z 178 commitów w ~4 tygodnie to
   nietypowo zdrowy graf — efekt jawnych reguł architektonicznych egzekwowanych od początku.
4. **Największy blast radius: `supabase.ts` (16) → `account-retention.ts` (6, wszystkie
   zapisy) → `parse-error.ts` (7, całe UI).** Te trzy pliki to dźwignie zmian o szerokim zasięgu.
5. **Struktura ≠ domena.** Sygnaturowa logika produktu (SRS/Leitner, generowanie AI)
   jest strukturalnie **peryferyjna** (małe szprychy), a w centrum stoi infrastruktura
   (klient Supabase). „Flashcard/AI" to cienkie moduły; ciężar grafu to plumbing. (§6)

## 1. Huby zależności — kto jest wspólnym zależnym

### Fan-in (najczęściej importowane moduły `src/`)

| # | Moduł | Fan-in | Podsystem | Kto importuje |
|--:|---|--:|---|---|
| 1 | `src/lib/supabase.ts` | **16** | **Warstwa Supabase** | `middleware.ts` + **wszystkie** endpointy API (auth, cards, generations, reviews, account) |
| 2 | `src/lib/parse-error.ts` | 7 | Cross-cutting (klient) | 6 komponentów React (generate, library, review, settings) |
| 3 | `src/lib/account-retention.ts` | 6 | Write-lock / retencja | **wszystkie 6 endpointów zapisujących** (cards, generations×3, reviews) |
| 4 | `src/lib/leitner.ts` | 3 | Domena SRS | `reviews.ts` (serwer) + `ReviewSession.tsx` (klient) + test |
| 5 | `src/lib/utils.ts` | 3 | UI util (`cn`) | komponenty auth/ui/review |
| 6 | `src/pages/api/reviews.ts` | 3 | Endpoint | **tylko własne testy kolokowane** (nie produkcja) |
| — | `src/lib/openrouter.ts` | 2 | **Integracja AI** | `generations.ts` + jego test — i nic więcej |
| — | `src/lib/observability.ts` | 2 | Sentry/telemetria | `parse-error.ts` + test |

### Odpowiedź na pytanie „który podsystem jest hubem"

| Kandydat z briefu | Werdykt | Dowód |
|---|---|---|
| **Warstwa Supabase** | ✅ **TAK — to jest hub** | `supabase.ts` fan-in 16, jedyny wspólny zależny serwera |
| Trasy API | ❌ nie — to *sinki*, nie huby | endpointy mają fan-in ~0 od produkcji; importują je tylko własne testy. Reguła `api-not-imported-by-client` to gwarantuje |
| Integracja OpenRouter | ❌ nie — wąska szprycha | fan-in 2, odizolowana do jednego endpointu `generations.ts` |
| Workflow review | ❌ nie | `ReviewSession.tsx` to konsument (fan-out 3), nikt go nie importuje |
| Auth | ❌ nie — to klaster fan-out | `SignInForm`/`SignUpForm` mają fan-out 4 (ciągną FormField/PasswordToggle/SubmitButton), ale fan-in ~0 |
| Testy | częściowo (po stronie fan-out) | `retention-write-lock.test.ts` ma najwyższy fan-out (9) — kontraktowy test inwariantu zapisu |

> **Wniosek:** centrum grawitacji kodu to **infrastruktura dostępu do danych**
> (`supabase.ts`), a nie żadna z funkcji produktowych. To typowe i zdrowe dla aplikacji
> CRUD+auth. Wysoki fan-in nie jest tu *design smell* — to **stabilna granica
> infrastruktury** (jeden, zamierzony punkt dostępu do bazy/sesji). Oznacza jednak,
> że jest to **moduł o największym blast radius** w repo: zmiany jego sygnatury/zachowania
> wymagają największej ostrożności, nawet jeśli sam moduł jest celowo stabilny i rzadko ruszany.

## 2. Cykle zależności

**Brak.** `depcruise --output-type err` → `no dependency violations found (61 modules,
134 dependencies)`; reguła `no-circular` (severity error) nie zgłasza nic. Graf jest
acykliczny (DAG).

> Dlaczego to ważne: cykle są głównym powodem, dla którego legacy „nie da się ruszyć
> bez ruszenia wszystkiego". Tutaj ich nie ma — każdy moduł da się prześledzić w jedną
> stronę. To realny atut przy refaktorze i przy testowaniu w izolacji.

## 3. Granice architektoniczne

Config definiuje 8 reguł `forbidden`. **Wszystkie przechodzą.** Najważniejsze, z dowodem:

| Sprawdzana granica | Wynik | Dowód z dependency-cruiser |
|---|---|---|
| API nie może być importowane przez resztę kodu (`api-not-imported-by-client`) | ✅ trzyma | Jedyne fan-in endpointów pochodzą z ich kolokowanych testów (np. `reviews.ts ← reviews.test.ts`), nie z produkcji |
| API nie wciąga komponentów React (`api-no-react-components`) | ✅ trzyma | brak krawędzi `pages/api/** → components/**.tsx` |
| Serwerowe liby (supabase/openrouter/retention/observability) nie trafiają do klienta (`no-server-lib-in-client`) | ✅ trzyma | żaden `components/**.tsx` nie importuje `supabase`/`openrouter`/`account-retention`/`observability` |
| Produkcja nie zależy od testów (`not-to-test`) | ✅ trzyma | 0 krawędzi prod→`*.test/*.spec` |
| Brak devDeps / niezadeklarowanych pakietów w `src/` | ✅ trzyma | 0 naruszeń `no-dev-dep-in-src`, `no-non-package-json` |

**Obserwowana granica klient/serwer (empirycznie, nie tylko z reguł):**

- **Serwer** (`middleware.ts`, `pages/api/**`) zbiega się do `supabase.ts` + `account-retention.ts`.
- **Klient** (`components/**`) zbiega się do `parse-error.ts` + `utils.ts` + `components/ui`.
- Te dwa zbiory **nie przecinają się przez warstwę lib serwera** — granica jest realna,
  nie tylko deklarowana. To najmocniejszy strukturalny sygnał dojrzałości tego repo.

## 4. Blast radius (zasięg zmiany)

Co pęka, gdy zmienisz sygnaturę/zachowanie danego modułu:

| Moduł | Bezpośredni zasięg | Charakter ryzyka |
|---|--:|---|
| `src/lib/supabase.ts` | **16 modułów** | Zmiana klienta/sesji/typów → ripuje przez middleware i **każdy** endpoint. Największa dźwignia w repo. |
| `src/lib/parse-error.ts` | 7 | Zmiana kształtu błędu → wszystkie ścieżki obsługi błędów w UI. |
| `src/lib/account-retention.ts` | 6 | Zmiana logiki write-locka → **wszystkie operacje zapisu** naraz (cards, generations, reviews). |
| `src/lib/leitner.ts` | 3 (klient + serwer) | Niski fan-in, ale **wysoki blast radius semantyczny**: pojedynczy moduł SRS zasila zarówno podgląd w `ReviewSession.tsx`, jak i zapis w `reviews.ts`. Zmiana interwałów propaguje się przez granicę klient↔serwer naraz — to jeden kontrakt na dwóch końcach, nie zduplikowana logika. |
| `src/lib/openrouter.ts` | 2 | Wąsko — dotyka tylko `generations.ts`. Bezpieczny do zmiany. |
| `src/middleware.ts` | brama wszystkich chronionych tras | Fan-in 0 w grafie, ale runtime-owy blast radius = każda trasa `PROTECTED_ROUTES` (zgodne z Artifact 1 §5). |

> Spójność z Artifact 1: terytorium wskazało `middleware.ts` jako „wspólny mianownik"
> po stronie *aktywności/historii*. Graf koryguje to: **strukturalnym** wspólnym
> mianownikiem jest `supabase.ts` (16), a `middleware.ts` jest hubem *runtime'owym*
> (brama), nie importowym. Oba są prawdziwe — to różne osie tego samego ryzyka.

## 5. Ryzyka testowalności

### Podsumowanie

Graf dzieli kod na dwa światy testowe: **czysty rdzeń** (łatwy do unit-testów) i
**warstwę spiętą z Supabase** (wymaga integracji/mocków). Repo już zbudowało narzędzia
pod ten drugi świat (`test/integration/scoped-supabase-mock.ts`, `two-user-fixture.ts`),
co potwierdza, że ryzyko zostało rozpoznane.

### Lista ryzyk testowych

- **Wszystko, co importuje `supabase.ts` (16 modułów), jest trudne do unit-testu w izolacji** —
  ciągnie klienta bazy + sesję. → naturalnie kończy się **testem integracyjnym**.
  Dowód w repo: `reviews.integration.test.ts`, `cards/[id].integration.test.ts`,
  `retention-write-lock.test.ts` (a nie czyste unity).
- **`retention-write-lock.test.ts` ma fan-out 9** — to najcięższy test w repo. Pilnuje
  inwariantu „brak zapisu w trakcie retencji" naraz na wielu endpointach. Wysoka wartość,
  ale **kruchy**: zmiana w którymkolwiek z 9 modułów może go ruszyć.
- **Bramę `middleware.ts` najlepiej dziś weryfikować integracyjnie/e2e** — istnieje
  `tests/e2e/auth.setup.ts` + `review-persistence.spec.ts`. Przy obecnym kształcie
  `PROTECTED_ROUTES` to wystarcza; gdyby logika ochrony tras urosła (role, wyjątki,
  warunki), warto wydzielić czystą funkcję dopasowania trasy do unit-testów.
- **Komponenty React zależą głównie od `parse-error.ts`** (czysty) — łatwe do unit/render-testu;
  ale ścieżki robiące `fetch` do API domykają się dopiero **e2e**.

### Najbardziej podejrzane moduły (uwaga przy testach)

| Moduł | Dlaczego podejrzany | Strategia testu |
|---|---|---|
| `pages/api/generations.ts` | fan-out 3: Supabase + retention + **OpenRouter** (sieć/LLM) | integracja z mockiem OpenRouter (`openrouter.test.ts` już izoluje klienta) |
| `pages/api/reviews.ts` | Supabase + retention + **leitner** (logika SRS) | integracja; logikę SRS testuj osobno na `leitner.ts` |
| `lib/account-retention.ts` | wpięty we wszystkie zapisy | kontraktowy test inwariantu (już jest) |
| `middleware.ts` | brama auth, runtime blast radius | e2e/auth.setup |

### Czysty, łatwo testowalny rdzeń (atut)

`leitner.ts` (algorytm SRS, pure), `parse-error.ts` (pure), `openrouter.ts`
(izolowany klient) — **najbardziej ryzykowna logika biznesowa jest wydzielona i
unit-testowalna**. Każdy z nich ma już `*.test.ts`. To dobry sygnał projektowy.

### Co sprawdzić dalej

- Czy `reviews.integration.test.ts` testuje **te same** interwały Leitnera, których
  używa `ReviewSession.tsx` (ryzyko rozjazdu klient/serwer — patrz §4 i §6)?
- Pokrycie ścieżki błędu OpenRouter w `generations.ts` (timeouty/odmowy modelu) —
  to jedyny punkt styku z zewnętrznym LLM-em.

## 6. Implementacja vs. domena — gdzie struktura zaskakuje

Apparent struktura produktu (z Artifact 1 i AGENTS.md): „AI-assisted spaced-repetition
flashcard MVP", funkcje = generate / library / review / auth / settings. Graf pokazuje
cztery rozjazdy między tym obrazem a realną strukturą kodu:

| # | Domena mówi | Struktura pokazuje | Dlaczego to ważne |
|--:|---|---|---|
| 1 | **„AI" to sedno produktu** | `openrouter.ts` ma fan-in **2** — jedna wąska szprycha do jednego endpointu | Headline-feature jest strukturalnie peryferyjny. Plus: świetna izolacja (łatwo wymienić providera). Minus: „AI-first" to w kodzie cienki moduł, nie centrum. |
| 2 | **SRS/Leitner to sygnatura aplikacji** | `leitner.ts` to mały util (fan-in 3), **współdzielony przez granicę** klient↔serwer | Najważniejsza logika domenowa nie jest strukturalnie centralna, ale ma **wysoki blast radius semantyczny**: ten sam kontrakt interwałów obowiązuje po obu stronach granicy. To jeden moduł czytany w dwóch miejscach (`ReviewSession.tsx` ↔ `reviews.ts`), nie zduplikowana logika — zmiana propaguje się na oba końce równocześnie. |
| 3 | **Backend „per feature"** (jak komponenty) | Komponenty SĄ per-feature (`generate/`, `library/`, `review/`…), ale API jest **płaskie** pod `pages/api/`, a sprzężenie idzie przez **warstwę lib**, nie przez funkcję | Frontend tnie pionowo (po domenie), backend poziomo (po warstwie). Szukając „całej funkcji review" znajdziesz ją w komponencie, ale na serwerze jest rozsmarowana: `reviews.ts` + `supabase` + `retention` + `leitner`. |
| 4 | **„Usuwanie konta" to jedna mała funkcja** | `account-retention.ts` to **aspekt przecinający wszystkie zapisy** (fan-in 6) | W mapie domeny to drobny feature; w kodzie to globalny inwariant wpięty w każdy endpoint mutujący. Każda nowa ścieżka zapisu MUSI uwzględnić retention — to nieoczywiste z nazw folderów. |

> **Sedno rozjazdu:** w centrum grafu stoi **infrastruktura** (`supabase.ts`), a domenowa
> sygnatura produktu (SRS, AI) leży na peryferiach jako małe, dobrze odizolowane moduły.
> To nie jest wada — to konsekwencja świadomej architektury (jawne reguły boundaries).
> Ale przy nawigacji „po funkcji" trzeba pamiętać: funkcja w UI jest jednym folderem,
> a na serwerze rozpada się na warstwę lib + płaski endpoint + cross-cutting retention.

## Opcjonalny następny krok: graf

Najbardziej wartościowy pojedynczy podgraf do renderu (SVG/Graphviz) odpowiadałby na
jedno pytanie: **„co pęknie, gdy ruszę `supabase.ts`?"**

```
npx depcruise src --config .dependency-cruiser.cjs \
  --focus "src/lib/supabase.ts" \
  --output-type dot | dot -T svg > context/map/supabase-blast-radius.svg
```

Drugi kandydat: `--focus "src/lib/account-retention.ts"` (mapa write-locka po wszystkich
zapisach). Render dopiero po selekcji — pełny graf `src/` (60 modułów) jest zbyt gęsty,
by coś z niego wyczytać.


## 7. Self-perception vs evidence

Expected owner perception:
- The core architectural risk is AI/OpenRouter.
- The app is organized around product features: generate, library, review, auth.
- SRS/Leitner is one of the central domain mechanisms.

Evidence from the dependency graph:
- The strongest structural hub is not AI but `src/lib/supabase.ts`.
- OpenRouter is well isolated: one production consumer plus tests.
- Feature organization is strong on the frontend, but the backend is organized around flat API endpoints plus shared infrastructure.
- `account-retention.ts` is more architectural than it appears from the product UI: it is a cross-cutting write invariant.
- `leitner.ts` has low fan-in, but high semantic importance because it affects both review UI and persisted review behavior.

Decision implication:
- When changing product behavior, navigate by feature.
- When changing auth/data/session/write behavior, navigate by infrastructure hub and blast radius.

---

*Wygenerowano z `dependency-cruiser` 17.4.3 (`npx depcruise src`, 60 modułów / 134
zależności, 0 cykli / 0 sierot / 0 naruszeń). Komplementarne do Artifact 1 (historia).
Następny krok serii: synteza do `repo-map.md` (jeszcze nie tworzony).*
