---
date: 2026-06-18T19:23:11-0500
researcher: Rafal S
git_commit: 829ea884f2982a148f38af1d3b22f8476af8d330
branch: learning/m4-architect
repository: 10xCards
topic: "Refactor opportunities — które długi z analizy account-retention/write-lock warto naprawić, w jakim kształcie i w jakiej kolejności"
tags: [research, codebase, refactor, account-retention, write-lock, rls, error-handling, middleware, technical-debt, verified]
status: complete
last_updated: 2026-06-18
last_updated_by: Rafal S
last_updated_note: "Dodano §Weryfikacja twierdzeń (ast-grep 0.43.0 + grep). 7/7 twierdzeń strukturalnych potwierdzonych; T7 doprecyzowane; brak korekt w miejscu."
verification_commit: 829ea884f2982a148f38af1d3b22f8476af8d330
---

# Research: Refactor opportunities z analizy account-retention / write-lock

**Date**: 2026-06-18
**Researcher**: Rafal S
**Git Commit**: 829ea884f2982a148f38af1d3b22f8476af8d330
**Branch**: learning/m4-architect
**Repository**: 10xCards (https://github.com/rafsaw/10xCards)

## Research Question

Wejściem jest analiza długu technicznego i ryzyk strukturalnych:
`context/changes/account-retention-write-lock/research.md` (+ priory:
`context/map/repo-map.md`, `context/foundation/lessons.md`, archiwalne impl-review).
Tamta analiza celowo zostawiła otwarte pytanie: **które** z udokumentowanych problemów
warto naprawić, **w jakim docelowym kształcie** i **w jakiej kolejności**.

Ta zmiana, na etapie eksploracji (bez refaktoru, bez decyzji):
1. wypisuje każdy problem, który raport odnotowuje, niezależnie od etykiety;
2. klasyfikuje każdy jako **KANDYDAT** (problem, którego naprawa zmieniłaby **strukturę kodu**)
   albo **NIE-kandydat** (brakujący test / luka w docs / brak guarda — zachowany jako wejście
   do oceny wykonalności i kosztu);
3. bada każdego kandydata trzema perspektywami: obecny kształt (dowody) → intencjonalność
   (archeologia) → wykonalność migracji;
4. zamyka rankingiem 2–3 najmocniejszych kandydatów z trade-offami.

Ustalenia raportu źródłowego są traktowane jako **zebrane dowody** — nie wyprowadzane
na nowo. Świeża weryfikacja w tej sesji służyła **potwierdzeniu obecnego kształtu**
kandydatów oraz danym do wykonalności (testy, CI, historia gita).

## Legenda dowodu

- **[evidence]** — potwierdzone w kodzie / migracji / gicie (z `file:line` lub hash).
- **[inference]** — interpretacja oparta na dowodach.
- **[unknown]** — niepotwierdzone lub poza zasięgiem tej analizy.

---

## 1. Inwentaryzacja problemów + klasyfikacja (do audytu)

Wszystkie pozycje pochodzą z raportu źródłowego (§2 *Technical debt*, *Architecture Insights*,
*Open Questions*). Numeracja `D#` odpowiada kolejności z §2 raportu; rozszczepienia oznaczone.

| # | Problem (z raportu) | Klasa | Uzasadnienie klasyfikacji |
|---|---|---|---|
| **C1** | Egzekucja write-locka jest zdecentralizowana — 7 ręcznie wpiętych call-site'ów `readOnlyGuard`, **brak centralnego interceptora** (D1 — połowa strukturalna; *Architecture Insights*) | **KANDYDAT** | Naprawa zmienia *gdzie* żyje egzekucja inwariantu (call-site → middleware/wrapper) — zmiana struktury. |
| **C2** | Brak klienckiego fallbacku dla `account_read_only`; ponadto **6 zduplikowanych map `FALLBACK_MESSAGES`** w komponentach (D5) | **KANDYDAT** | Naprawa konsoliduje 6 rozproszonych map w jedno źródło + nadaje kodowi błędu kliencki dom — zmiana struktury obsługi błędów. |
| **C3** | Martwa polityka RLS `account_deletion_requests_update_own` (D7) | **KANDYDAT** | Usunięcie polityki zmienia powierzchnię autoryzacji w DB (struktura schematu/RLS). |
| **C4** | Dwie współistniejące definicje „pending": middleware „wiersz istnieje" vs sweep `retention_until < now()` muszą być synchronizowane ręcznie (D4) | **KANDYDAT → STOP** | Patrz §2.4: prawdziwa naprawa to **decyzja o pojęciu biznesowym**, nie zmiana struktury kodu. Zatrzymuję się zgodnie z twardą granicą. |
| N1 | `middleware.ts` (warstwa obliczeniowa `isReadOnly`) ma zero pokrycia testami (D2) | nie-kandydat | Brakujący test — nie zmienia struktury. Wejście do wykonalności (prerekwizyt C1). |
| N2 | „read-only utrzymuje się po `retention_until`" nie ma żadnej asercji; `formatRetentionDate` bez testu (D3) | nie-kandydat | Brakujący test/asercja. |
| N3 | Kolejność null-user → guard nietestowana dla 6/7 tras; trasy auth nie pokryte ani w tabeli exempt (D8) | nie-kandydat | Brakujący test. |
| N4 | „Dlaczego" skoncentrowane w 2 commitach + bus factor 1 (D6) | nie-kandydat | Luka wiedzy/docs. **Uwaga (korekta dowodowa, §1a)** — częściowo nieaktualne. |
| N5 | Detekcja „zapomnianego strażnika" jest pozorna: ręczna tabela `writeRoutes`, brak skanu FS (D1 — połowa testowa) | nie-kandydat | Twardienie testu, nie produkcyjny refaktor. **Jest tańszą alternatywą dla C1** — patrz §3 #2. |

**Podsumowanie klasyfikacji:** 3 czyste kandydaty strukturalne (**C1, C2, C3**), 1 kandydat
pozorny zatrzymany na granicy biznesowej (**C4**), 5 nie-kandydatów (N1–N5) zachowanych jako
wejście do wykonalności/kosztu.

### 1a. Korekta dowodowa do raportu źródłowego (świeże dowody tej sesji)

Raport źródłowy (D6, za `repo-map.md:156,254`) twierdzi, że „dlaczego" inwariantu żyje
w **wygasłych sesjach AI, nie w docs**. Świeża archeologia to **częściowo koryguje**:
uzasadnienie *jest* spisane w planie zmiany —
`context/archive/2026-06-01-account-deletion-with-retention/plan.md:33` („single
`locals.isReadOnly` flag + one-line guard per route is **the auditable pattern**") oraz
`:60` („A single missed route silently leaks write access"). **[evidence]** Kontrakt 403
i decyzja „bez przepisywania RLS na `cards`" też są w planie (`plan.md:44,128-130`). **[evidence]**
Luka wiedzy dotyczy więc bardziej *świeżości modelu mentalnego* niż *braku zapisu* — ma to
wpływ na ocenę ryzyka C1 (intencja jest udokumentowana, nie tylko domniemana).

---

## 2. Kandydaci — trzy perspektywy

### 2.1. C1 — Zdecentralizowana egzekucja write-locka (brak centralnego interceptora)

#### Obecny kształt

- Stan liczony **raz** w `src/middleware.ts:21-40`: PK-lookup `account_deletion_requests`,
  `isReadOnly = !!row`, fail-closed na błędzie DB. **[evidence]**
- Egzekucja **rozsmarowana** na 7 identycznych call-site'ów, wzorzec
  `const readOnly = readOnlyGuard(context.locals); if (readOnly) return readOnly;`:
  `cards.ts:33-34`, `cards/[id].ts:30-31` i `:86-87`, `generations.ts:24-25`,
  `generations/save.ts:39-40`, `generations/discard.ts:18-19`, `reviews.ts:23-24`. **[evidence]**
- `readOnlyGuard` to czysta funkcja `account-retention.ts:5-19` → 403 `account_read_only` lub `null`. **[evidence]**
- Middleware **nie inspekcjonuje metody HTTP** — zero odwołań do `context.request.method`;
  jedyne rozgałęzienie po ścieżce to auth-redirect na `PROTECTED_ROUTES`
  (`middleware.ts:4,42-46`), który **nie obejmuje `/api/*`**. **[evidence]**
- Escape hatches celowo bez strażnika, z komentarzem: `account/cancel.ts:11-14` (delete `:27`),
  `account/delete.ts:13-16` (insert `:34`). Trasy `auth/*` także bez strażnika. **[evidence]**
- Inwentarz `src/pages/api/**`: **wszystkie endpointy są mutujące (POST/PATCH/DELETE) —
  zero GET/PUT**. Mutujące-i-strzeżone: 7 powyżej; mutujące-i-zwolnione: `account/cancel`,
  `account/delete`, `auth/signin|signout|signup`. **[evidence]**

#### Intencjonalność → **świadome ograniczenie**

`26c850a` (2026-06-02 17:34, „request/cancel endpoints + read-only guard (p2)") wprowadził
helper, fail-closed i wpiął strażnika we wszystkie 7 tras w jednym commicie; treść commita
*wylicza* te 7 endpointów jako zamierzony zbiór. **[evidence]** Plan tej zmiany wprost wybiera
wzorzec per-route jako **„the auditable pattern"** mirrorujący istniejący null-check `locals.user`
(`plan.md:33`), świadomy ryzyka („a single missed route silently leaks write access", `:60`). **[evidence]**
Werdykt: **to nie przypadkowa złożoność — to świadoma decyzja** faworyzująca czytelność/audytowalność
pojedynczego call-site'u kosztem braku centralizacji. Refaktor C1 **odwraca** udokumentowaną decyzję,
co podnosi poprzeczkę uzasadnienia. **[inference]**

#### Wykonalność migracji

- **Docelowy kształt (nazwa, bez projektu):** centralny *write-gate* w `middleware.ts` —
  po obliczeniu `isReadOnly`, przed `next()`, bramka „mutująca metoda + ścieżka spoza allowlisty
  → 403", z jawną allowlistą zwolnień (`/api/account/cancel`, `/api/account/delete`, `/api/auth/*`).
  Hook strukturalnie istnieje: `context.request.method` i `context.url.pathname` są dostępne,
  a wczesny `Response` ma precedens (auth-redirect). **[evidence/inference]**
- **Blast radius (duży):** kluczowy haczyk — guardrail `retention-write-lock.test.ts`
  **importuje handlery bezpośrednio i buduje `ctx()` z ręcznym `locals.isReadOnly`, z pominięciem
  middleware** (`:8-15,89-98`). Przeniesienie egzekucji do middleware **unieważnia ten test**:
  handlery przestałyby blokować same z siebie, więc istniejąca sieć bezpieczeństwa
  przestałaby cokolwiek dowodzić, a `middleware.ts` ma **zero pokrycia** (N1). Migracja C1
  pociąga więc: (a) przepisanie guardrail na driver przez middleware, (b) dodanie testów
  obliczenia w middleware. **[evidence]**
- **Testy/CI:** `npm test` (vitest, hermetyczny) uruchamia guardrail lokalnie; **CI nie jest
  bramką** — `ci.yml` odpala tylko na `master`, gałąź robocza to `main`, i **nie ma kroku
  testów** (tylko `astro sync`+`lint`+`build`). Sieć bezpieczeństwa to dyscyplina lokalna. **[evidence]**
- **Pierwszy krok-prerekwizyt:** napisać brakujące testy obliczenia `isReadOnly` w `middleware.ts`
  (N1) — *zanim* cokolwiek się przeniesie. Bez nich centralizacja przenosi inwariant w nietestowane
  miejsce. **[inference]**
- **Tańsza alternatywa (nie-refaktor, N5):** zamiast centralizować, dodać **test skanujący FS**
  (wzorzec `test/no-service-role-in-src.test.ts:21-54`: rekurencyjny `readdirSync` → filtr allowlisty
  → regex) asertujący, że każdy plik mutującej trasy w `src/pages/api/**` zawiera `readOnlyGuard`
  **albo** jest na jawnej liście zwolnień. To usuwa realne ryzyko D1 („zapomniany strażnik")
  **bez** ruszania produkcji i bez odwracania decyzji 26c850a. **[inference]** Patrz §3 #2 trade-off.

### 2.2. C2 — Kliencka kopia komunikatu błędu (`account_read_only` + zduplikowane mapy)

#### Obecny kształt

- `parse-error.ts:16-26`: `parseErrorBody` zwraca surowe `{ code, message }` z body 403
  (`body.error`→`code`, `body.message`→`message`); **nie ma w nim centralnej mapy fallbacków** —
  docstring `:8-9` mówi wprost, że „each call site applies its own `FALLBACK_MESSAGES[code]`". **[evidence]**
- **6 osobnych, zduplikowanych map `FALLBACK_MESSAGES`** w komponentach, wzorzec
  `message || FALLBACK_MESSAGES[code]`: `CardRow.tsx:17-24`, `CreateCardForm.tsx:10-16`,
  `ReviewSession.tsx:19-26`, `PasteAndGenerateForm.tsx:13-21`, `DraftReviewList.tsx:16-23`,
  `DeleteAccountButton.tsx:11-15`. Klucze nakładają się (`unauthorized`, `supabase_unconfigured`,
  `db_error`, `bad_request` powtarzają się w wielu mapach). **[evidence]**
- **Żadna z 6 map nie zawiera klucza `account_read_only`.** Jedyna produkcyjna kopia komunikatu
  to serwer: `account-retention.ts:11` (kod) + `:12` (tekst „Your account is pending deletion
  and is read-only. Cancel the deletion to make changes."). **[evidence]**
- Body 403 niesie **maszynowo-czytelny `error` code** osobno od `message`, a `parseErrorBody`
  już go przepuszcza do klienta — infrastruktura pod keying po kodzie *istnieje*; brakuje tylko
  klienckiej mapy z tym kluczem. **[evidence]**

#### Intencjonalność → **świadome (single-source serwerowy) + przypadkowa duplikacja klienta**

Serwerowy single-source komunikatu jest zamierzony: plan opisuje helper jako „one place that
turns retention state into a 403", docstring `account-retention.ts:21-23` nazywa się „single
source". **[evidence]** Natomiast **6 zduplikowanych map klienckich** nie ma śladu decyzji —
to organiczny przyrost per-komponent (każdy nowy ekran kopiował wzorzec). **[inference]**
Werdykt mieszany: brak klienckiego klucza `account_read_only` jest **luką**, a duplikacja map
jest **przypadkową złożonością**.

#### Wykonalność migracji

- **Docelowy kształt (nazwa):** jeden współdzielony rejestr `code → copy` w `src/lib` (np. obok
  `parse-error.ts`), konsumowany przez komponenty zamiast 6 lokalnych map; `account_read_only`
  dostaje w nim wpis. Body i `parseErrorBody` bez zmian. **[inference]**
- **Blast radius (średni, dobrze ograniczony):** 6 komponentów + ewentualnie `parse-error.ts`;
  `fan-in 7` parse-error potwierdzony. Czysto kliencki — zero ścieżek serwerowych, RLS, DB. **[evidence]**
- **Testy/CI:** istnieje `parse-error.test.ts` (importer #7). Brak testów per-komponent na fallback.
  Ryzyko regresji niskie (string-mapping). **[evidence]**
- **Pierwszy krok-prerekwizyt:** wyodrębnić wspólny zbiór kluczy z 6 istniejących map do jednego
  rejestru (czysto mechaniczne, odwracalne), *potem* dodać `account_read_only` i przepiąć
  komponenty pojedynczo. **[inference]**

### 2.3. C3 — Martwa polityka RLS `account_deletion_requests_update_own`

#### Obecny kształt

- Polityka żyje: `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75`
  — `FOR UPDATE TO authenticated`, `using/with check ((select auth.uid()) = user_id)`.
  Żadna późniejsza migracja jej nie zdejmuje (sweep `20260602120000` tylko czyta tabelę
  w subquery). **[evidence]**
- **Żaden kod nie robi `.update()` na tej tabeli.** Wszystkie dostępy: `middleware.ts:23` (select),
  `delete.ts:34` (insert) + `:45` (select w gałęzi 23505), `cancel.ts:27` (delete). 1 INSERT,
  2 SELECT, 1 DELETE — zero UPDATE. **[evidence]**
- To **nie tylko martwy kod, ale realny obejście autoryzacji:** impl-review
  `2026-06-01-account-deletion-with-retention/reviews/impl-review.md:25-37` (F1, ⚠️ WARNING,
  confidence HIGH) opisuje, że dowolny zalogowany user może `PATCH .../account_deletion_requests?user_id=eq.<own>`
  przez PostgREST i **dowolnie przesunąć własne `retention_until`** (odroczyć lub skrócić usunięcie),
  omijając aplikację. Rekomendacja: „Add a migration dropping `account_deletion_requests_update_own`…
  makes the immutable-window invariant real at the DB layer." **Decision: PENDING.** **[evidence]**

#### Intencjonalność → **przypadkowa pozostałość (nie świadome ograniczenie)**

Polityka **predatuje** feature write-locka — to domyślny komplet CRUD-RLS z bazowego schematu
(`plan.md:13,44` traktuje istniejące RLS jako dane, świadomie *nie* przepisując polityk).
Decyzja, by ją *zostawić*, nigdy nie zapadła — impl-review zostawił ją jako **PENDING**. **[evidence]**
Werdykt: pozostałość, nie zamierzony inwariant; rekomendacja usunięcia jest już zwektorowana
i niewykonana.

#### Wykonalność migracji

- **Docelowy kształt (nazwa):** nowa migracja `drop policy account_deletion_requests_update_own`.
  Komplet insert/select/delete w pełni pokrywa request/cancel/sweep; UPDATE jest zbędny. **[evidence]**
- **Blast radius (minimalny):** wyłącznie warstwa DB/RLS; zero kodu aplikacji, zero UI,
  zero testów hermetycznych. „Zero functional impact" (impl-review F1). **[evidence]**
- **Testy/CI:** brak testu, który by tego pilnował; migracje są **remote-only** (workflow
  weryfikacji), więc krok wykonawczy to apply na zdalnej Supabase + weryfikacja, że PATCH
  przez PostgREST teraz zwraca 403/permission denied. **[evidence/unknown — applied state zdalnej DB]**
- **Pierwszy krok-prerekwizyt:** potwierdzić, że zdalny schemat ma tę politykę aktywną
  (workflow remote-only), zanim napisze się migrację drop. **[inference]**

### 2.4. C4 — Dwie definicje „pending" (middleware vs sweep) → **STOP na granicy biznesowej**

#### Obecny kształt (dowód)

- Middleware: read-only zależy **wyłącznie od obecności wiersza**, nie od daty — komentarz
  `middleware.ts:18-20` „row exists = pending & cancellable, even past `retention_until`";
  `retention_until` jest pobierane, ale **nigdy nie porównywane z `now()`** w runtime. **[evidence]**
- Sweep: `20260602120000_account_deletion_sweep.sql` używa `retention_until < now()` do **twardego
  usunięcia** usera. **[evidence]**

#### Dlaczego STOP

To **nie są dwie reprezentacje jednego pojęcia**, które dało się scalić strukturalnie — to **dwa
różne pojęcia biznesowe**: „pending & cancellable" (okno, w którym user może cofnąć usunięcie,
trwa nawet po dacie) vs „expired & sweepable" (kwalifikuje się do skasowania). Komentarz w kodzie
czyni to rozróżnienie intencjonalnym. „Naprawa" wymagałaby decyzji produktowej — *czy* read-only
ma kończyć się na `retention_until` — a nie ekstrakcji wspólnego predykatu. Zgodnie z twardą
granicą („jeśli prawdziwa naprawa to przeprojektowanie pojęć biznesowych, powiedz to i zatrzymaj się"):
**to nie jest refactor opportunity — to pytanie do właściciela produktu.** Co najwyżej zostaje
nie-strukturalne twardnienie: **asercja** pilnująca obecnego inwariantu (że read-only NIE patrzy
na datę), czyli N2. **[inference]**

---

## 3. Refactor opportunities (ranking z trade-offami)

Ranking po **stosunku wartości do kosztu i ryzyka** (koszt długu vs koszt zmiany, blast radius,
odwracalność). Trzy najmocniejsze kandydaty:

### #1 — C3: usuń martwą politykę RLS `account_deletion_requests_update_own`

- **Obecny → docelowy:** żywa polityka `FOR UPDATE TO authenticated` (nieużywana przez kod)
  → brak polityki UPDATE; immutable-window staje się prawdą na poziomie DB.
- **Czemu #1:** najwyższy ROI. Zamyka **realne obejście autoryzacji** (PostgREST PATCH na własny
  `retention_until`), nie tylko sprząta — a kosztuje jedną migrację. Rekomendacja już istnieje
  i jest zwektorowana (impl-review F1, confidence HIGH, decision PENDING). Intencjonalność:
  pozostałość, nie inwariant.
- **Koszt długu vs koszt zmiany:** dług = cichy bypass okna retencji przez dowolnego zalogowanego
  usera; zmiana = ~3 linie SQL, w pełni odwracalna (re-migracja przywraca politykę).
- **Blast radius:** minimalny — tylko DB/RLS; zero kodu, UI, testów hermetycznych.
- **Szkic ścieżki:** (1) potwierdź aktywność polityki na zdalnym schemacie; (2) napisz migrację
  `drop policy`; (3) zweryfikuj remote, że PATCH przez PostgREST jest teraz odrzucany; (4) (opcja)
  dodaj test/asercję pilnującą braku UPDATE-RLS na tej tabeli.
- **Pierwszy krok-prerekwizyt:** weryfikacja stanu zdalnej Supabase (workflow remote-only) — czy
  polityka jest tam aktywna. **[unknown do potwierdzenia]**

> Uwaga klasyfikacyjna: C3 jest bardziej *hardeningiem bezpieczeństwa + usunięciem martwej
> struktury* niż klasycznym refaktorem. Trafia na #1, bo pytanie zmiany brzmi „co warto naprawić,
> w jakiej kolejności" — a to jest najtańsza, najpewniejsza, już-zwektorowana wygrana.

### #2 — C1: scentralizuj egzekucję write-locka (z jawnym trade-offem wobec N5)

- **Obecny → docelowy:** 7 ręcznie wpiętych `readOnlyGuard` + brak interceptora → centralny
  write-gate w `middleware.ts` (mutująca metoda + ścieżka spoza allowlisty → 403), z jawną
  allowlistą zwolnień (cancel/delete/auth).
- **Czemu #2:** największa dźwignia na sztandarowe ryzyko cross-cutting z raportu i mapy
  (🔴 strefa, fan-in 6, „każda nowa ścieżka zapisu MUSI pamiętać o write-locku"). Ale: odwraca
  **udokumentowaną świadomą decyzję** (26c850a/plan.md) i ma **duży blast radius**.
- **Koszt długu vs koszt zmiany:** dług = przyszły zapomniany strażnik na nowym endpoincie =
  cichy write-leak na koncie read-only, a detekcja jest pozorna (ręczna tabela). Koszt zmiany =
  wysoki: trzeba **przepisać guardrail** (dziś testuje handlery bezpośrednio, z pominięciem
  middleware — straci sens) i **dodać testy middleware** (dziś zero pokrycia, N1).
- **Blast radius:** middleware + wszystkie 7 handlerów (usunięcie call-site'ów) + allowlista
  musząca lustrzanie odwzorować zwolnienia + `retention-write-lock.test.ts` (przepisanie) +
  nowe testy `middleware.ts`.
- **Szkic ścieżki (inkrementalna, odwracalna):** (1) **najpierw** testy obliczenia `isReadOnly`
  w middleware (N1); (2) dodać write-gate w middleware **obok** istniejących call-site'ów
  (podwójna egzekucja — bezpieczne, idempotentne); (3) przepiąć guardrail na driver przez
  middleware; (4) dopiero potem zdejmować call-site'y z handlerów po jednym. Każdy krok zielony osobno.
- **Pierwszy krok-prerekwizyt:** testy `middleware.ts` (N1) — bez nich centralizacja przenosi
  inwariant w nietestowane miejsce.
- **TRADE-OFF (rekomendowany do rozważenia w planie):** jeśli celem jest *eliminacja realnego
  ryzyka „zapomnianego strażnika"* przy minimalnym koszcie/ryzyku — **N5 (test skanujący FS)
  dominuje C1**: usuwa to samo ryzyko bez ruszania produkcji, bez odwracania decyzji 26c850a
  i bez przepisywania guardrail. C1 wygrywa tylko, jeśli chcemy *strukturalnie* znieść możliwość
  pominięcia (jedno miejsce zamiast N), akceptując jego koszt. Decyzja C1-vs-N5 należy do etapu planu.

### #3 — C2: skonsoliduj kliencką kopię błędów w jeden rejestr `code → copy`

- **Obecny → docelowy:** 6 zduplikowanych map `FALLBACK_MESSAGES` + brak klucza `account_read_only`
  → jeden współdzielony rejestr w `src/lib`, konsumowany przez komponenty; `account_read_only`
  dostaje kliencki dom. `parseErrorBody`/body bez zmian.
- **Czemu #3:** realna duplikacja (6 map, nakładające się klucze) + udokumentowana luka (D5),
  ale niższy koszt długu niż C1/C3 i brak wymiaru bezpieczeństwa.
- **Koszt długu vs koszt zmiany:** dług = zmiana serwerowego stringa po cichu zmienia UX
  (brak kontroli klienta), a 6 map dryfuje niezależnie; zmiana = średnia, czysto kliencka,
  mechaniczna.
- **Blast radius:** 6 komponentów + ewentualnie `parse-error.ts`; zero serwera/DB/RLS.
- **Szkic ścieżki:** (1) wyodrębnić wspólny rejestr z istniejących kluczy; (2) przepiąć komponenty
  pojedynczo na rejestr; (3) dodać wpis `account_read_only`; (4) (opcja) testy fallbacku.
- **Pierwszy krok-prerekwizyt:** inwentaryzacja unii kluczy z 6 map (już zebrana w §2.2) i zgoda
  na lokalizację rejestru w `src/lib`.

---

## 4. Kandydaci rozważeni i odrzuceni

| Pozycja | Decyzja | Powód |
|---|---|---|
| **C4** — dwie definicje „pending" | **Odrzucony jako refaktor** | Prawdziwa naprawa to decyzja o pojęciu biznesowym (czy read-only kończy się na `retention_until`), nie zmiana struktury kodu. STOP na granicy biznesowej (§2.4). Zostaje co najwyżej asercja (N2). |
| **N1** — testy `middleware.ts` | nie-kandydat | Brakujący test, nie refaktor. **Ale prerekwizyt C1** — wpięte w ścieżkę #2. |
| **N2** — asercja „read-only po dacie" + `formatRetentionDate` | nie-kandydat | Brakująca asercja. Pochodna decyzji C4. |
| **N3** — kolejność null-user→guard + pokrycie tras auth | nie-kandydat | Brakujący test; obecne zachowanie jest poprawne, brakuje tylko asercji. |
| **N4** — bus factor 1 / wiedza w 2 commitach | nie-kandydat | Luka docs, nie struktura — i częściowo nieaktualna (plan.md dokumentuje „dlaczego", §1a). Mitygacja: spisać ADR, nie refaktorować kod. |
| **N5** — guardrail = ręczna tabela, nie skan FS | nie-kandydat (refaktorowo) | Twardnienie testu, nie produkcji. **Awansowane do trade-offu C1** (§3 #2) jako tańsza alternatywa na to samo ryzyko. |
| Hub `supabase.ts` (fan-in 16) | poza zakresem | Z `repo-map.md`, nie z raportu źródłowego; raport oznacza go jako peryferyjny dla *samego* inwariantu write-lock (§I/S9). Brak konkretnego długu strukturalnego do naprawy w tej analizie. |
| Ukryte sprzężenie Leitner klient↔serwer | poza zakresem | Ryzyko z `repo-map.md:111-114`, nie z raportu account-retention. Inna oś; nie należy do tego zbioru problemów. |
| CI nie bramkuje `main` | poza zakresem | Realne (potwierdzone: `ci.yml` na `master`, bez kroku testów), ale to konfiguracja procesu/CI, nie struktura kodu. Warto naprawić osobno. **[evidence]** |

---

## Weryfikacja twierdzeń (ast-grep)

Weryfikacja twierdzeń **strukturalnych**, na których stoi ranking. Metoda: **ast-grep 0.43.0**
na TS/TSX; **każde zero ast-grep skonfrontowane z `grep`**, by odróżnić realny brak wystąpień
od ograniczenia wzorca. SQL jest **poza zasięgiem ast-grep** (`--lang sql` niewspierany, exit 2)
→ zweryfikowane `grep`. Commit weryfikacji: **`829ea88`** (`git_commit` raportu).

**Werdykt zbiorczy: 7/7 twierdzeń potwierdzonych. Żadne nie wymagało korekty liczb ani numerów
linii w §1–§4 — wszystkie zgodne. T7 doprecyzowane o dokładną liczność. Żaden wynik nie podważa
pozycji żadnego kandydata.**

| # | Twierdzenie | Werdykt | Dowód (plik:linia) | Metoda |
|---|---|---|---|---|
| T1 | `readOnlyGuard` wołany **7×** w **6 plikach** | ✅ potwierdzone | `cards.ts:33`, `cards/[id].ts:30` i `:86`, `generations.ts:24`, `generations/save.ts:39`, `generations/discard.ts:18`, `reviews.ts:23` | ast-grep `readOnlyGuard($$$)` -l ts |
| T2 | **6** map `FALLBACK_MESSAGES` | ✅ potwierdzone | `CreateCardForm.tsx:10`, `DeleteAccountButton.tsx:11`, `PasteAndGenerateForm.tsx:13`, `DraftReviewList.tsx:16`, `CardRow.tsx:17`, `ReviewSession.tsx:19` | ast-grep `const FALLBACK_MESSAGES: $T = $V` -l tsx |
| T3 | **brak** klucza `account_read_only` w mapach fallbacków | ✅ potwierdzone | zero w `src/components`; jedyna prod. kopia `account-retention.ts:11` (+ testy `generations.test.ts:137,141`, `retention-write-lock.test.ts:125,132`) | ast-grep (mapy wypisane — brak klucza) **+ grep** `account_read_only` w `src/components` = **0** |
| T4 | **brak** `.update()` na `account_deletion_requests` | ✅ potwierdzone | dostępy: `middleware.ts:23` (select), `delete.ts:34` (insert), `delete.ts:45` (select), `cancel.ts:27` (delete) — **zero update** | ast-grep `$C.from("account_deletion_requests").update($$$)` = **0** **+ grep** `\.update(` w `account/`+`middleware.ts` = **0** |
| T5 | polityka `account_deletion_requests_update_own` **obecna** w migracji | ✅ potwierdzone | `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72` (`create policy … for update`); **brak późniejszego DROP** | **grep** (ast-grep `--lang sql` niewspierany, exit 2) |
| T6 | **brak** użycia `context.request.method` w middleware | ✅ potwierdzone | `src/middleware.ts` — **zero** wystąpień `method` | ast-grep `context.request.method` i `$_.request.method` = **0** **+ grep** `method` w `middleware.ts` = **0** |
| T7 | inwentarz mutujących endpointów: wszystkie POST/PATCH/DELETE, **brak GET/PUT** | ✅ potwierdzone / **doprecyzowane** | GET=**0**, PUT=**0**; **10× POST** (`reviews.ts:17`, `generations.ts:18`, `cards.ts:27`, `generations/save.ts:33`, `generations/discard.ts:12`, `account/cancel.ts:15`, `account/delete.ts:17`, `auth/signin.ts:4`, `auth/signout.ts:4`, `auth/signup.ts:4`) + **PATCH** `cards/[id].ts:24` + **DELETE** `cards/[id].ts:80` = **12 handlerów / 11 plików** | ast-grep `export const $V: $T = $H` per-verb -l ts |

**Zera ast-grep skonfrontowane z grep (realny brak vs ograniczenie wzorca):**
- **T3 / T4 / T6 → realne zera** (potwierdzone grep): brak klucza `account_read_only` w komponentach,
  brak `.update()` na tabeli, brak `method` w middleware.
- **T2 fałszywe zero:** wariant `const FALLBACK_MESSAGES = $V` (bez adnotacji) → **0**; ograniczenie
  wzorca — wszystkie 6 map ma adnotację `: Record<string, string>`, więc realny wynik = **6** (wariant
  `: $T =`).
- **T7 fałszywe zero:** wariant `export const $V = $H` (bez adnotacji) → **0**; wszystkie handlery mają
  `: APIRoute`, więc realny wynik = **12** (wariant `: $T =`). Forma funkcyjna (`export function $V`) = **0** realne.

**Korekty w miejscu:** brak. Wszystkie liczby i numery linii w §1–§4 zgadzają się z weryfikacją.
Doprecyzowanie T7 (liczność 12/11 + pełne linie) **nie zmienia żadnego werdyktu intencjonalności
ani rankingu** — sekcje *Refactor opportunities* i werdykty intencjonalności pozostają nietknięte.

## Code References

- `src/middleware.ts:21-40` — obliczenie `isReadOnly`/`retentionUntil`, fail-closed (C1, N1)
- `src/middleware.ts:4,42-46` — `PROTECTED_ROUTES` + auth-redirect (nie obejmuje `/api/*`) (C1)
- `src/lib/account-retention.ts:5-19` — `readOnlyGuard` (403 `account_read_only`) (C1, C2)
- `src/lib/account-retention.ts:11-12` — jedyna produkcyjna kopia kodu+komunikatu (C2)
- 7 call-site'ów strażnika: `cards.ts:33-34`, `cards/[id].ts:30-31,86-87`, `generations.ts:24-25`, `generations/save.ts:39-40`, `generations/discard.ts:18-19`, `reviews.ts:23-24` (C1)
- `src/lib/parse-error.ts:8-26` — `parseErrorBody`, brak centralnej mapy (C2)
- Mapy `FALLBACK_MESSAGES`: `CardRow.tsx:17-24`, `CreateCardForm.tsx:10-16`, `ReviewSession.tsx:19-26`, `PasteAndGenerateForm.tsx:13-21`, `DraftReviewList.tsx:16-23`, `DeleteAccountButton.tsx:11-15` (C2)
- `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75` — martwa polityka `update_own` (C3)
- Dostępy do `account_deletion_requests`: `middleware.ts:23`, `delete.ts:34,45`, `cancel.ts:27` — brak UPDATE (C3)
- `supabase/migrations/20260602120000_account_deletion_sweep.sql` — `retention_until < now()` (C4)
- `src/pages/api/retention-write-lock.test.ts:8-15,89-98,113-121,144-147` — guardrail (importuje handlery, omija middleware) (C1)
- `test/no-service-role-in-src.test.ts:21-54` — wzorzec skanu FS (alternatywa N5)
- `.github/workflows/ci.yml:3-7,12-24` — trigger `master`, brak kroku testów

## Historical Context (from prior changes)

- `context/changes/account-retention-write-lock/research.md` — raport źródłowy (dług D1–D8).
- `context/archive/2026-06-01-account-deletion-with-retention/plan.md:33,44,60,128-130` — **decyzja**
  o wzorcu per-route, kontrakcie 403, braku przepisywania RLS na `cards`. **[evidence]**
- `context/archive/2026-06-01-account-deletion-with-retention/reviews/impl-review.md:25-37` —
  F1: martwa polityka UPDATE jako bypass; rekomendacja drop; decision PENDING. **[evidence]**
- `context/archive/2026-06-03-cross-user-isolation-write-authorization/` — commit `47e3cbc`
  dodał guardrail (R4); impl-review tej zmiany **nie** wspomina martwej polityki. **[evidence]**
- Commity: `26c850a` (guard p2), `cbcccca` (UI p3), `130980a` (sweep), `47e3cbc` (guardrail). **[evidence]**

## Related Research

- `context/changes/account-retention-write-lock/research.md` — raport źródłowy (priors).
- `context/map/repo-map.md` — mapa ryzyk strukturalnych; §4 klasyfikuje account-retention jako 🔴.
- `context/foundation/lessons.md` — reguła o świadomym wyborze umiejscowienia tras (nie kolidująca z C1–C3).

## Open Questions / Unknowns

- **[unknown]** Czy zdalna Supabase ma politykę `account_deletion_requests_update_own` aktywną
  (applied state) — prerekwizyt C3; workflow weryfikacji jest remote-only.
- **[unknown]** Czy poza `src/pages/api/**` istnieje serwerowa ścieżka mutacji (np. form action
  w `.astro`) mogąca ominąć zarówno call-site'y, jak i przyszły central gate — wpływa na kompletność
  allowlisty C1 i na FS-scan N5. (Raport źródłowy zostawił to jako unknown; inwentarz `src/pages/api/**`
  nie wykazał innych mutacji, ale strony `.astro` nie były skanowane.)
- **[inference, do potwierdzenia w planie]** C1 vs N5 — czy chcemy strukturalnie znieść możliwość
  pominięcia strażnika (C1, drogo), czy mechanicznie ją wykryć (N5, tanio). Decyzja należy do etapu planu.
- **[unknown]** Czy product-owner chce, by read-only kończyło się na `retention_until` (C4) —
  pytanie biznesowe, nie strukturalne.
