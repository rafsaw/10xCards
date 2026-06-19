---
title: "10xCards — Destylacja domeny (Domain Distillation)"
created: 2026-06-19
type: domain-distillation
---

# 10xCards — Destylacja domeny

> Produkt tej analizy to **mapa domeny**, nie kod. Wszystkie cytaty (`plik:linia`)
> zostały zweryfikowane przez odczyt pliku przed wpisaniem. Gdzie pojęcie istnieje
> w wymaganiach, ale nie w kodzie (lub odwrotnie), jest to wprost odnotowane.

## KROK 0 — Kontekst projektu (odkrycie)

### Źródła wymagań / wizji (znalezione)

| Dokument | Ścieżka | Rola |
| -------- | ------- | ---- |
| PRD (v2) | `context/foundation/prd.md` | Wizja, success criteria, FR-001…FR-018, Access Control, Business Logic, Non-Goals |
| Tech-stack | `context/foundation/tech-stack.md` | Astro 6 + React 19 + TS + Tailwind 4 + Supabase + Cloudflare Workers |
| Roadmap (v5) | `context/foundation/roadmap.md` | Narracja zmian: slice'y F-01…S-06, north star, streamy, decyzje |
| Historia zmian | `context/archive/**`, `context/changes/**` | Plany i impl-review per slice (atomic-save, srs-review, account-deletion …) |

Dokumenty wymagań **istnieją i są bogate** — analiza opiera się na nich jako głównym
źródle Ubiquitous Language, a kod traktuje jako drugie źródło (co naprawdę egzekwowane).
Ograniczenie: brak wygenerowanych typów Supabase (kod sam to odnotowuje, np.
`src/pages/api/cards.ts:6-7`), więc kontrakt schematu żyje wyłącznie w migracjach SQL.

### Stack i struktura (gdzie żyje logika biznesowa)

- **UI / strony:** `src/pages/*.astro` (np. `generate.astro`, `review.astro`, `library.astro`, `settings.astro`), komponenty React w `src/components/**`.
- **API / warstwa serwisowa (cienka):** `src/pages/api/**` — endpointy HTTP, walidacja wejścia, autoryzacja, wywołania Supabase. Brak osobnej warstwy "domain service".
- **Logika domenowa (czysta):** `src/lib/leitner.ts` (harmonogram SRS), `src/lib/account-retention.ts` (guard read-only + format daty), `src/lib/openrouter.ts` (kontrakt generacji AI).
- **Persystencja + reguły DB:** `supabase/migrations/*.sql` — schemat, CHECK-i, RLS, funkcje `finalize_drafts`, `sweep_expired_account_deletions`.
- **Przekrojowo:** `src/middleware.ts` (sesja + obliczenie stanu retencji), `src/env.d.ts` (`App.Locals`).

**Kluczowa obserwacja architektoniczna:** to nie jest klasyczne DDD z warstwą domenową
i agregatami w kodzie aplikacji. Reguły biznesowe są **rozproszone między SQL (RLS,
CHECK, funkcje) a cienkie handlery API**. Większość niezmienników jest egzekwowana w
bazie danych — co jest świadomą decyzją (RLS jako fundament izolacji, patrz F-01).

---

## KROK 1 — Ubiquitous Language

Pojęcia wyciągnięte z dokumentów ORAZ z kodu. Definicja + cytat źródłowy (dokument) +
miejsce w kodzie (lub "BRAK w kodzie").

### Card (Karta)

- **Definicja:** Para front/back (pytanie/odpowiedź), należąca do dokładnie jednego użytkownika; uczestniczy w cyklu spaced-repetition.
- **Źródło (dokument):** "accepted pairs entering a spaced-repetition lifecycle" — `context/foundation/prd.md:151`; "Each candidate displays front and back text" — `prd.md:56`.
- **Kod:** tabela `public.cards` — `supabase/migrations/20260527150510_cards_and_account_deletion.sql:16-28`.

### Front / Back

- **Definicja:** Niepuste teksty karty; front = pytanie answerable z passage, back = pojedyncza odpowiedź.
- **Źródło:** "the question is answerable from the passage and the answer is a single retrievable concept" — `prd.md:153`; FR-009 "typing front and back" — `prd.md:110`.
- **Kod:** kolumny `front text not null check (length(front) > 0)` / `back ... check (length(back) > 0)` — `migrations/...cards_and_account_deletion.sql:19-20`; walidacja niepustości w API `src/pages/api/cards.ts:21-25,52-54`.

### Status: `draft` / `saved`

- **Definicja:** Cykl życia karty. `draft` = kandydat z AI niesfinalizowany; `saved` = karta w bibliotece, część SR lifecycle.
- **Źródło (dokument):** "schema kart (z polem `status` rozróżniającym draft / saved)" — `roadmap.md:40`; "zapisanych jako `status=draft`" — `roadmap.md:92`.
- **Kod:** `status text not null default 'draft' check (status in ('draft','saved'))` — `migrations/...cards_and_account_deletion.sql:21`.

### Candidate Card (Kandydat) / Draft

- **Definicja:** Karta wygenerowana przez AI, czekająca na decyzję accept/reject. W kodzie reprezentowana jako `cards` ze `status='draft'`.
- **Źródło:** FR-005 "view AI-generated candidate cards (front/back) before saving" — `prd.md:100`; US-01 "accept or reject each one independently" — `prd.md:51`.
- **Kod:** wstawianie draftów `status: "draft"` — `src/pages/api/generations.ts:75-82`; lista draftów — `src/pages/generate.astro:21-26`. (Typ `CandidateCard` przed zapisem: `src/lib/openrouter.ts:15-18`.)

### Accept / Reject (Akceptacja / Odrzucenie kandydata)

- **Definicja:** Wedge produktu — człowiek decyduje per-kandydat: accept → `saved`; reject → hard-delete.
- **Źródło:** "explicit per-candidate accept" FR-006 — `prd.md:103`; FR-007 reject "discards ... no save" — `prd.md:105`; wedge: `roadmap.md:26`.
- **Kod:** funkcja `public.finalize_drafts(p_accept_ids, p_reject_ids)` — `migrations/20260529162956_finalize_drafts_fn.sql:14-32`; wywołanie + completeness guard — `src/pages/api/generations/save.ts:62-97`.

### Generation (Generacja AI)

- **Definicja:** Transformacja passage → zestaw par Q/A; rdzeniowa "non-trivial work" produktu.
- **Źródło:** "The transformation is the non-trivial work" — `prd.md:155`; FR-004 — `prd.md:98`.
- **Kod:** `generateCandidateCards()` — `src/lib/openrouter.ts:53-118`; endpoint `src/pages/api/generations.ts:18-89`.

### Source Text / Passage (Tekst źródłowy)

- **Definicja:** Wejście generacji — pojedynczy fragment wklejonego tekstu.
- **Źródło:** "input is a single passage of source text supplied by the user" — `prd.md:153`; "Generation produces at least 1 candidate for a passage of ≥ 200 words" — `prd.md:55`.
- **Kod:** walidacja `MIN_SOURCE_LENGTH = 200` / `MAX_SOURCE_LENGTH = 8000` — `src/pages/api/generations.ts:7-8,40` (uwaga: **znaki**, nie słowa — patrz KROK 4).

### Retry without re-paste (Retry bez re-paste)

- **Definicja:** Przy awarii generacji tekst źródłowy musi przetrwać, by user mógł ponowić bez wklejania od nowa.
- **Źródło:** Guardrail "the user's pasted source text is preserved and they can retry" — `prd.md:42`; FR-008 — `prd.md:107`.
- **Kod:** trwałość draftów jako mechanizm gwarancji — `roadmap.md:94`; zachowanie source w formularzu — `src/components/generate/PasteAndGenerateForm.tsx` (komponent klienta; stan formularza). Adnotacja: gwarancja realizowana częściowo przez DB-persistence draftów + client state.

### Review Session (Sesja powtórek)

- **Definicja:** Przegląd kart due, jedna po drugiej, z oceną recall.
- **Źródło:** US-02 — `prd.md:62-73`; FR-013 — `prd.md:122`.
- **Kod:** `src/pages/review.astro` + `src/components/review/ReviewSession.tsx`. **Brak osobnej encji "session" w bazie** — sesja to stan klienta (`useState index`), `ReviewSession.tsx:66-67`.

### Due Card (Karta due)

- **Definicja:** Karta `status='saved'` z `next_due_at <= now`, kwalifikująca się do powtórki.
- **Źródło:** US-02 "next-due date is now or in the past" — `prd.md:64`.
- **Kod:** zapytanie due — `src/pages/review.astro:14-21`; indeks częściowy `cards_due_idx ... where status='saved'` — `migrations/20260531120000_cards_due_index_and_interval_check.sql:12`.

### Rating: `right` / `wrong` (binarna ocena)

- **Definicja:** Binarna ocena recall sterująca harmonogramem.
- **Źródło:** FR-014 "binary right/wrong scale" — `prd.md:124`.
- **Kod:** `type ReviewRating = "right" | "wrong"` — `src/lib/leitner.ts:11`; walidacja — `src/pages/api/reviews.ts:13-15`.

### Spaced-Repetition Schedule / Leitner box (Harmonogram)

- **Definicja:** Prosty model SR: 6 boxów Leitnera o stałych interwałach; right → +1 box, wrong → box 0.
- **Źródło:** "deliberately-simple scheduling model" — `prd.md:173`; "Leitner" — `roadmap.md:56`; FR-015 — `prd.md:126`.
- **Kod:** `BOX_INTERVALS_DAYS = [1,2,4,7,15,30]`, `schedule()` — `src/lib/leitner.ts:6,23-33`. Pola persystencji: `next_due_at`, `interval_days`, `repetition_count` (= box index), `last_reviewed_at` — `migrations/...cards_and_account_deletion.sql:23-26`.

### Library (Biblioteka)

- **Definicja:** Zbiór `saved` kart użytkownika; powierzchnia browse/create/edit/delete.
- **Źródło:** FR-010 — `prd.md:114`; "the user's library" — `prd.md:52`.
- **Kod:** `src/pages/library.astro`, `src/components/library/*`; mutacje `src/pages/api/cards.ts` (create), `src/pages/api/cards/[id].ts` (edit/delete).

### User / Account (Użytkownik / Konto)

- **Definicja:** Tożsamość email+hasło; właściciel kart; jednostka izolacji danych.
- **Źródło:** Access Control — `prd.md:159-169`; FR-001/002/003 — `prd.md:90-95`.
- **Kod:** `auth.users` (Supabase); `user_id uuid not null references auth.users(id) on delete cascade` — `migrations/...cards_and_account_deletion.sql:18`; sesja w `src/middleware.ts:10-16`.

### Per-user Isolation (Izolacja danych — RLS)

- **Definicja:** Każdy odczyt/zapis wiersza obcego `user_id` kończy się błędem; izolacja egzekwowana w DB.
- **Źródło:** Guardrail "cross-user data leakage is ship-blocking" — `prd.md:41`; NFR — `prd.md:145`.
- **Kod:** polityki RLS `cards_select_own`/`insert`/`update`/`delete` (`(select auth.uid()) = user_id`) — `migrations/...cards_and_account_deletion.sql:36-53`.

### Account Deletion Request / Retention (Żądanie usunięcia + retencja)

- **Definicja:** Żądanie usunięcia konta wprowadza 30-dniową retencję read-only; po niej hard-delete.
- **Źródło:** FR-016/017/018 — `prd.md:133-140`.
- **Kod:** tabela `account_deletion_requests` (`user_id` PK, `requested_at`, `retention_until`) — `migrations/...cards_and_account_deletion.sql:56-60`; endpointy `src/pages/api/account/delete.ts`, `.../cancel.ts`.

### Read-only Lock (Blokada read-only)

- **Definicja:** Konto pending-deletion: logowanie i odczyt dozwolone, wszystkie mutacje zablokowane.
- **Źródło:** FR-017 "locked to read-only ... cannot create, edit, delete, generate, or review" — `prd.md:136`.
- **Kod:** `readOnlyGuard()` — `src/lib/account-retention.ts:5-19`; obliczenie `isReadOnly` w middleware — `src/middleware.ts:21-40`; wywołania we wszystkich write-handlerach (np. `cards.ts:33-34`, `reviews.ts:23-24`, `generations.ts:24-25`, `generations/save.ts:39-40`).

### Cancel via re-login (Anulowanie przez ponowne logowanie)

- **Definicja:** User anuluje pending-deletion logując się ponownie / klikając "anuluj"; przywraca read-write.
- **Źródło:** FR-018 — `prd.md:139`.
- **Kod:** `src/pages/api/account/cancel.ts:15-34` (usuwa wiersz request → `isReadOnly=false` przy kolejnej nawigacji).

### Hard-delete Sweep (Cykliczne twarde usuwanie)

- **Definicja:** Codzienny cron usuwa `auth.users` z wygasłą retencją; cascade czyści `cards` i `account_deletion_requests`.
- **Źródło:** FR-017 "after the window elapses all of the user's cards and the account itself are hard-deleted" — `prd.md:136`.
- **Kod:** `sweep_expired_account_deletions()` + `cron.schedule('account-deletion-sweep','0 3 * * *', ...)` — `migrations/20260602120000_account_deletion_sweep.sql:16-55`.

### Atomic finalize (Atomowy zapis kandydatów)

- **Definicja:** Accept+reject całego zestawu draftów w jednej transakcji: albo wszystko, albo nic.
- **Źródło:** north star S-02 "operacja atomowa ... Albo wszystko się udaje, albo nic" — `roadmap.md:107`.
- **Kod:** funkcja `finalize_drafts` (jedna transakcja, dwa statementy) — `migrations/20260529162956_finalize_drafts_fn.sql:1-32`.

---

## KROK 2 — Klasyfikacja subdomen

Rdzeń = przewaga i sens produktu. Wedge produktu (jasno nazwany): **ręczna kuratela
kandydatów AI** — `roadmap.md:26`, `prd.md:101`.

| Obszar / pojęcie | Kategoria | Uzasadnienie (z odwołaniem do celów) |
| ---------------- | --------- | ------------------------------------ |
| **AI generation + per-candidate Accept/Reject (kuratela)** | **Core** | To jest wedge: "Per-candidate review IS the product wedge; remove it and the product becomes a generic AI-dumps-cards-into-deck tool" — `prd.md:101`. Primary Success Criterion zależy od tego, że user *wybiera* ten workflow — `prd.md:35`. |
| **Spaced-repetition lifecycle (status saved → schedule → due → rating)** | **Core** | "Spaced repetition is the integration point this product exists for" FR-013 — `prd.md:123`. Secondary Success Criterion: review reliable end-to-end — `prd.md:38`. Sam *algorytm* jest celowo prosty (non-goal optymalizacji, `prd.md:173`), ale obecność cyklu SR jest rdzeniowa. |
| **Per-user isolation (RLS)** | **Core (guardrail)** | "Cross-user data leakage is ship-blocking even if everything else works" — `prd.md:41`. To nie supporting — naruszenie zatapia produkt. Egzekwowane na poziomie DB jako fundament (F-01, `roadmap.md:76`). |
| **Manual card creation + Library CRUD** | **Supporting** | Potrzebne, ale nie różnicujące: manual create to "fallback for cases AI handles poorly" — `prd.md:111`; browse/edit/delete utrzymują bibliotekę użyteczną. Wspierają rdzeń, nie stanowią przewagi. |
| **Account deletion + 30-day retention + read-only lock** | **Supporting** | "minimum self-service obligation" wynikająca z multi-user-from-day-one — `prd.md:134`; dodane w PRD v2, nie część wizji v1. Lifecycle/compliance, nie wedge. |
| **Authentication (signup/login/logout, sesja)** | **Generic** | Standardowy email+hasło delegowany do Supabase Auth; "Email+password was chosen for independence" — `prd.md:93`. Żaden slice go nie odbudowuje (baseline, `roadmap.md:68`). Klasyczna generic subdomain. |
| **AI provider integration (OpenRouter transport, JSON-schema, retry/timeout)** | **Generic / Supporting** | Mechanika wywołania LLM (transport, parsing, błędy) jest wymienialna i nie-różnicująca — `src/lib/openrouter.ts`. Różnicujący jest *prompt + kuratela*, nie sam HTTP do dostawcy. |
| **Loading states / nawigacja / paginacja-search (S-06 UX)** | **Generic (polish)** | "czysty UX-polish bez własnego FR" — `roadmap.md:165`. |

---

## KROK 3 — Kandydaci na agregaty i ich niezmienniki

Agregat = klaster, który musi być zmieniany jako spójna całość, z niezmiennikiem
trzymanym na jego granicy.

### Agregat A — Card (root)

Granica: pojedynczy wiersz `cards` (+ jego pola harmonogramu i status).

| Niezmiennik | Źródło | Status egzekucji |
| ----------- | ------ | ---------------- |
| Front i back zawsze niepuste | FR-009/AC `prd.md:82`, "non-empty" | **Egzekwowany** — CHECK w DB `migrations:19-20` **i** walidacja API `cards.ts:52-54`, `cards/[id].ts:54-56`. (Podwójnie.) |
| Status ∈ {draft, saved} | `roadmap.md:40` | **Egzekwowany** — CHECK `migrations:21`. |
| Karta należy do dokładnie jednego usera; nikt obcy jej nie czyta/pisze | Guardrail `prd.md:41` | **Egzekwowany** — FK + RLS `migrations:18,36-53`. |
| `interval_days >= 0` | impl-review F3, `migrations:14` | **Egzekwowany** — CHECK `cards_interval_days_nonneg` `migrations/...interval_check.sql:14`. |
| Edycja front/back **nie** resetuje harmonogramu | `prd.md:117` (edit jako refinement), kod-komentarz | **Egzekwowany** — PATCH aktualizuje tylko front/back `cards/[id].ts:62-68`. |
| `saved` ⇒ ma `next_due_at` (wchodzi w review query) | S-04 outcome `roadmap.md:132` | **Częściowo zadeklarowany, NIE wymuszony schematem** — `next_due_at` jest nullable (`migrations:23`); spójność trzymają *aplikacja/funkcje* (`cards.ts:61`, `finalize_drafts:23`, `reviews.ts`), nie CHECK. Patrz KROK 4. |
| `repetition_count` = poprawny box index (0..MAX_BOX) | `leitner.ts:7,24` | **Częściowo** — `schedule()` capuje do MAX_BOX (`leitner.ts:24`), ale DB dopuszcza dowolny nieujemny int; brak CHECK na górną granicę. |

### Agregat B — DraftBatch / Generation finalize (root koncepcyjny)

Granica: **cały zestaw draftów jednego usera** w momencie finalizacji (nie pojedynczy draft).

| Niezmiennik | Źródło | Status egzekucji |
| ----------- | ------ | ---------------- |
| Accept/reject całego zestawu jest **atomowy** — brak stanu pośredniego | S-02 `roadmap.md:107`, FR-006/007 | **Egzekwowany** — `finalize_drafts` jako pojedyncza transakcja, oba statementy w jednym wywołaniu `migrations/...finalize_drafts_fn.sql:1-32`. |
| Submitted selection pokrywa **dokładnie** bieżący zbiór draftów (disjoint accept/reject, kompletny) | S-02 contract; kod-komentarz | **Egzekwowany** — completeness guard `generations/save.ts:62-83`. |
| Operacja idempotentna na double-submit / stale tab | impl-review S-02 | **Egzekwowany** — guard `status='draft'` w obu statementach `finalize_drafts:23,27`; affected counts z `GET DIAGNOSTICS` `:24,28`. |
| Draft nie jest częścią biblioteki dopóki nie zaakceptowany | `roadmap.md:92` | **Egzekwowany** — `status='draft'` wykluczony z review/library query (`review.astro:16`, library filtruje `saved`). |

> Uwaga DDD: "DraftBatch" nie jest osobną encją w schemacie — granica agregatu jest
> *dorozumiana* i trzymana proceduralnie (`finalize_drafts` + completeness guard). To
> dobry przykład agregatu zaimplementowanego jako funkcja DB, nie jako tabela.

### Agregat C — Account (root: User + Deletion Request)

Granica: konto użytkownika wraz z opcjonalnym `account_deletion_requests` (1:1, PK=user_id).

| Niezmiennik | Źródło | Status egzekucji |
| ----------- | ------ | ---------------- |
| Obecność wiersza request ⇔ konto pending & read-only & cancellable | FR-017 `prd.md:136`, middleware-komentarz | **Egzekwowany** — `isReadOnly = !!row` `middleware.ts:34-35`; guard na write-routes `account-retention.ts:5-19`. |
| Re-request **nie** przesuwa okna retencji (`retention_until` stałe) | kod-komentarz | **Egzekwowany** — insert-or-select, nie upsert; 23505 → zwraca istniejące `delete.ts:31-54`. |
| Pending account może czytać, ale nie mutować (create/edit/delete/generate/review) | FR-017 `prd.md:136` | **Egzekwowany w aplikacji** — guard w każdym write-handlerze; **NIE w DB/RLS** (RLS nadal pozwala ownerowi pisać). Patrz KROK 4. |
| Po wygaśnięciu retencji konto+karty hard-deleted | FR-017 `prd.md:136` | **Egzekwowany** — sweep + cron `migrations/...sweep.sql:16-55`; cascade z `auth.users` `migrations:18,57`. |
| Cancel = usunięcie request → read-write; działa też w stanie read-only | FR-018 `prd.md:139` | **Egzekwowany** — `cancel.ts` celowo NIE wywołuje guarda `cancel.ts:11-27`. |
| Fail-closed: błąd DB przy odczycie stanu → read-only | (kod, decyzja bezpieczeństwa) | **Egzekwowany** — `middleware.ts:28-32`. |

---

## KROK 4 — Rozjazdy MODEL vs KOD

Najcenniejsza część: gdzie wiedza domenowa istnieje, a kod jej nie odwzorowuje (lub odwrotnie).

| # | Dokument mówi (X) | Kod robi (Y) | Dowód | Waga |
| - | ----------------- | ------------ | ----- | ---- |
| R1 | "at least 1 candidate for a passage of **≥ 200 words**" (`prd.md:55`) | Walidacja liczy **znaki** (≥200), nie słowa; górny limit 8000 znaków bez odpowiednika w PRD | `src/pages/api/generations.ts:7-8,40` | Średnia — passage 200-słowny zawsze przejdzie, ale 200-znakowy (≈30 słów) też; kontrakt PRD luźniejszy niż intencja. |
| R2 | "Generation produces **at least 1** candidate" (`prd.md:55`) | Prompt + schema wymagają **3–10** kart (`minItems:1` w schema, ale prompt mówi "between 3 and 10"); kod tnie do 10 i wymaga ≥1 | prompt `openrouter.ts:46-51`, schema `:30-31`, slice `:117`; PRD `prd.md:55` | Niska — kod jest *surowszy* niż PRD (3–10 vs ≥1); rozjazd intencji, nie błąd. |
| R3 | `saved` karta ZAWSZE ma `next_due_at` (wchodzi w SR lifecycle z initial due-date) — `prd.md:157`, `roadmap.md:132` | Kolumna `next_due_at` jest **nullable**; niezmiennik trzymany tylko proceduralnie (manual create, finalize, review wszystkie ustawiają datę), brak CHECK/partial constraint | `migrations:23` (nullable); `cards.ts:61`, `finalize_drafts:23` | **Wysoka** — niezmiennik rdzeniowego agregatu (Card) nie jest wymuszony w DB; jedna ścieżka zapisu, która zapomni ustawić datę, tworzy "saved bez due", niewidoczne w review. |
| R4 | Read-only lock to reguła **konta** (domenowa) — "cannot create, edit, delete, generate, or review" (`prd.md:136`) | Egzekwowane jako **powtórzony guard w każdym handlerze** (`readOnlyGuard` wołany ręcznie 6+ razy); RLS w DB tego NIE wymusza — pending user nadal ma write-RLS | guard wołania `cards.ts:33`, `reviews.ts:23`, `generations.ts:24`, `save.ts:39`, `[id].ts:30,86`; brak w RLS `migrations:46-53` | **Wysoka** — reguła agregatu Account rozsmarowana po warstwie API; pominięcie wywołania w nowym write-route cicho łamie "read-only" (dług, nie bug dziś). |
| R5 | Fallback Guardrail: "If the primary due-card selection fails ... falls back to **oldest due first**" (`prd.md:43`, FR/US-02 `prd.md:73`) | Brak osobnej gałęzi fallback — zapytanie due **już** sortuje `next_due_at asc` (efektywnie oldest-first); przy błędzie zapytania UI pokazuje błąd, nie fallback | `review.astro:14-24` (order), `ReviewSession.tsx:77-85` (loadError → komunikat) | Średnia — "oldest due first" jest *domyślnym* porządkiem, więc nie ma drugiej ścieżki do której można spaść; Guardrail spełniony trywialnie, ale nie jako jawny fallback. |
| R6 | Sesja powtórek jako byt z trwałym postępem (`prd.md:38` reliable end-to-end, "across sessions") | "Session" nie istnieje jako encja — to stan klienta (`index`); trwałość = per-rating zapis do `cards` | `ReviewSession.tsx:66-67,144-148`; brak tabeli sesji | Niska — świadoma decyzja (trwałość na karcie, nie na sesji); rozjazd nazewniczy, nie funkcjonalny. |
| R7 | "Each candidate displays front and back plus two actions: accept / reject" — model per-kandydat (`prd.md:56`) | Finalizacja wymaga **kompletnego** pokrycia całego zestawu draftów (all-or-nothing batch), nie per-kandydat niezależnie | `generations/save.ts:77-83` (exactlyCoversDrafts) | Niska/Średnia — UI nadal per-kandydat, ale *zapis* jest batchowy/atomowy (S-02 to celowa ewolucja modelu); warto by PRD to odzwierciedlał. |
| R8 | `front maxLength 500`, `back maxLength 2000` (kontrakt AI) | DB **nie** ma górnego limitu długości front/back; manual create też nie | schema `openrouter.ts:37-39`; DB `migrations:19-20` (tylko `length>0`) | Niska — limit istnieje tylko na ścieżce AI; manual/edit może wstawić dowolnie długi tekst. Niespójność kontraktu. |

---

## KROK 5 — Ranking refaktoru

Uszeregowanie kandydatów wg **wartości** (jak rdzeniowy niezmiennik) × **ryzyka**
(jak słabo dziś egzekwowany).

| Ranga | Cel | Wartość (rdzeniowość) | Ryzyko (słabość egzekucji) | Werdykt |
| ----- | --- | --------------------- | -------------------------- | ------- |
| **#1** | **R3 — niezmiennik `saved ⇒ next_due_at` (Agregat Card)** | Wysoka: SR lifecycle to Core (Secondary Success Criterion); "saved bez due" wypada z review niezauważenie | Wysoka: `next_due_at` nullable, brak CHECK/partial; trzymany w 3 rozproszonych ścieżkach zapisu | **Refaktoruj pierwszy.** Dodaj wymuszenie w DB (np. `check (status <> 'saved' or next_due_at is not null)`), żeby niezmiennik rdzeniowego agregatu żył na granicy danych, nie w aplikacji. |
| **#2** | **R4 — read-only lock jako reguła Account, nie powtarzany guard** | Średnio-wysoka: Supporting (compliance), ale dotyka *wszystkich* write-surfaces — pominięcie cicho łamie obietnicę usunięcia | Wysoka: reguła powtórzona ręcznie 6+ razy; brak pojedynczego punktu egzekucji; nowy endpoint łatwo "zapomni" | **Drugi.** Skonsoliduj (middleware-level guard dla mutujących metod/route'ów albo RLS uwzględniające pending state), zamiast polegać na dyscyplinie per-handler. |
| **#3** | **R1 — kontrakt długości source (≥200 słów vs ≥200 znaków)** | Średnia: dotyka jakości rdzeniowej generacji (za krótki passage → słabe karty) | Średnia: kod świadomie inny niż PRD; łatwa korekta, ale wymaga decyzji "słowa czy znaki" | **Trzeci.** Uzgodnij PRD↔kod (zaktualizować jeden z nich); dziś milcząca rozbieżność kontraktu wejścia. |
| #4 | R8 — brak górnego limitu długości front/back w DB | Niska (Supporting/Generic) | Średnia: AI-path limitowany, manual nie | Wyrównać limit po stronie DB/API dla spójności. |
| #5 | R2/R6/R7 — rozjazdy nazewniczo-intencyjne | Niska | Niska (kod surowszy / decyzja świadoma) | Doprecyzować PRD, bez zmian w kodzie. |

### Rekomendacja #1 (z uzasadnieniem)

**Wymusić w bazie niezmiennik „karta `saved` ma zawsze `next_due_at`” (R3).** To
najlepszy stosunek wartości do ryzyka: dotyczy **rdzeniowego agregatu Card** i
**rdzeniowej subdomeny** (SR lifecycle, od której zależy Secondary Success Criterion —
`prd.md:38`), a jednocześnie jest *najsłabiej* egzekwowany — kolumna jest nullable
(`migrations:23`), a spójność trzyma się wyłącznie na tym, że trzy oddzielne ścieżki
zapisu (`cards.ts:61`, `finalize_drafts:23`, `reviews.ts`) pamiętają o ustawieniu daty.
Klasyczny zapach DDD: niezmiennik agregatu wyciekł z granicy do warstwy aplikacji.
Przeniesienie go do CHECK/partial-constraint sprawia, że żadna przyszła ścieżka zapisu
nie utworzy „saved bez due” — karty znikającej z review bez śladu.

---

## Ograniczenia analizy

- Brak wygenerowanych typów Supabase — kontrakt schematu czytany wyłącznie z migracji SQL (kod sam to odnotowuje, `cards.ts:6-7`).
- Komponenty klienta (`PasteAndGenerateForm.tsx`, `DraftReviewList.tsx`, `CardList.tsx`) przejrzane pod kątem ról domenowych, nie linia-po-linii — cytaty kodu pochodzą z warstwy reguł (API/SQL/lib), gdzie żyją niezmienniki.
- Mapa odzwierciedla stan na 2026-06-19 (slice'y F-01…S-06 wszystkie `done` wg `roadmap.md`).
