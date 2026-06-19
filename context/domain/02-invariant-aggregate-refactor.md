---
title: "10xCards — Niezmiennik domenowy i agregat-strażnik (refactor plan)"
created: 2026-06-19
type: refactor-plan
---

# 10xCards — Niezmiennik domenowy i agregat-strażnik

> Produkt tego dokumentu to **PLAN refaktoru**, nie implementacja. Żaden kod
> produkcyjny nie został zmieniony. Wszystkie cytaty `plik:linia` zostały
> zweryfikowane przez bezpośredni odczyt pliku przed wpisaniem (nie polegano na
> cytatach z `01-domain-distillation.md` — zostały one potwierdzone w kodzie).
> Materiał źródłowy: `context/domain/01-domain-distillation.md`.

---

## KROK 0 — Odkryty kontekst

### Stack i warstwy, w których żyje logika biznesowa

| Warstwa | Lokalizacja | Rola w egzekucji reguł |
| ------- | ----------- | ---------------------- |
| UI / strony | `src/pages/*.astro`, `src/components/**` | Renderuje stan, wykonuje zapytania odczytu (np. `review.astro`) |
| API (cienkie handlery) | `src/pages/api/**` | Walidacja wejścia, autoryzacja, wywołania Supabase. **Brak osobnej warstwy "domain service".** |
| Logika domenowa (czysta) | `src/lib/leitner.ts`, `src/lib/account-retention.ts`, `src/lib/openrouter.ts` | Pure functions (harmonogram SRS, guard read-only) |
| Persystencja + reguły DB | `supabase/migrations/*.sql` | Schemat, CHECK, RLS, funkcje `finalize_drafts`, `sweep_*` |
| Przekrojowo | `src/middleware.ts`, `src/env.d.ts` | Sesja + obliczenie stanu retencji (`isReadOnly`) |

**Obserwacja architektoniczna (potwierdzona w kodzie):** to nie jest klasyczne DDD
z warstwą domenową w aplikacji. Niezmienniki są egzekwowane głównie w **DB (RLS +
CHECK + funkcje SQL)**, a handlery API są cienkie. To świadoma decyzja (RLS jako
fundament izolacji). W konsekwencji „agregat-strażnik" w tym repozytorium oznacza
przede wszystkim **przeniesienie egzekucji niezmiennika na granicę danych (DB)**,
ewentualnie wsparte cienką funkcją/RPC jako jedynym wejściem zapisu.

### Dokumenty wymagań (zweryfikowane)

- `context/foundation/prd.md` — wizja, Success Criteria, FR, Access Control, Business Logic.
  - Primary: AI workflow jest na tyle użyteczny, że user go *wybiera* — `prd.md:35`.
  - **Secondary: „Review sessions are reliable end-to-end ... progress saved without
    crashes or lost state across sessions"** — `prd.md:38`.
  - Guardrail izolacji (ship-blocking) — `prd.md:41`.
  - Guardrail fallback review „oldest-due card first" — `prd.md:43`.

---

## KROK 1 — Lista niezmienników biznesowych (zidentyfikowane)

Reguły, które w tej domenie MUSZĄ być zawsze prawdziwe. Każda z cytatem źródła i
miejscem egzekucji (zweryfikowane w kodzie).

| # | Niezmiennik | Źródło | Gdzie żyje dziś |
| - | ----------- | ------ | --------------- |
| I1 | **Karta `status='saved'` ZAWSZE ma `next_due_at`** (wchodzi w SR lifecycle z konkretną datą due) | `prd.md:38` (reliable end-to-end), `roadmap.md:132` | Proceduralnie w 3 ścieżkach zapisu; **brak CHECK** (`migrations:22` nullable) |
| I2 | Karta należy do dokładnie jednego usera; nikt obcy jej nie czyta/pisze | `prd.md:41` (ship-blocking) | FK + RLS — `migrations:18,36-53` (egzekwowane w DB) |
| I3 | Front i back zawsze niepuste | FR-009 `prd.md:110` | CHECK `migrations:19-20` **i** API `cards.ts:52-54` (podwójnie) |
| I4 | Status ∈ {draft, saved} | `roadmap.md:40` | CHECK `migrations:21` |
| I5 | `interval_days >= 0` | impl-review F3 | CHECK `cards_interval_days_nonneg` `...interval_check.sql:14` |
| I6 | Accept/reject całego zestawu draftów jest **atomowy** (all-or-nothing) | `roadmap.md:107`, FR-006/007 | `finalize_drafts` jedna transakcja — `...finalize_drafts_fn.sql:14-32` (egzekwowane w DB) |
| I7 | Submitted selection pokrywa **dokładnie** bieżący zbiór draftów (disjoint, kompletny) | S-02 contract | completeness guard `save.ts:77-83` (egzekwowane w aplikacji) |
| I8 | Edycja front/back **nie** resetuje harmonogramu | `prd.md:117` | PATCH aktualizuje tylko front/back — `cards/[id].ts:62-68` |
| I9 | Konto pending-deletion: odczyt OK, **wszystkie mutacje zablokowane** | FR-017 `prd.md:136` | `readOnlyGuard` powtórzony ręcznie w 6+ handlerach; **NIE w DB/RLS** |
| I10 | Obecność wiersza request ⇔ konto pending & read-only & cancellable; re-request nie przesuwa okna | FR-017/018 | `middleware.ts:34-35`, `delete.ts` insert-or-select (egzekwowane) |
| I11 | `repetition_count` = poprawny box index (0..MAX_BOX) | `leitner.ts:7,24` | `schedule()` capuje (`leitner.ts:24`); DB dopuszcza dowolny nieujemny int (brak górnego CHECK) |

---

## KROK 2 — Klasyfikacja na trzech osiach i wybór #1

Oceniam każdy kandydat na osiach: **(a) rdzeniowość** (sens produktu wg
Success Criteria), **(b) rozsmarowanie** (ile warstw/plików), **(c) siła egzekucji**
(egzekwowany / tylko zadeklarowany / naruszalny).

| # | (a) Rdzeniowość | (b) Rozsmarowanie | (c) Egzekucja | Werdykt |
| - | --------------- | ----------------- | ------------- | ------- |
| **I1** | **Wysoka** — SR lifecycle to Core; Secondary Success Criterion `prd.md:38` | **Wysoka** — 3 ścieżki zapisu (`cards.ts`, `finalize_drafts`, `reviews.ts`) + read (`review.astro`) | **Najsłabsza** — nullable kolumna, brak CHECK; trzymany tylko dyscypliną kodu | **#1** |
| I9 | Średnio-wysoka (Supporting/compliance, ale dotyka wszystkich write-surfaces) | Wysoka (6+ handlerów) | Słaba (powtarzany guard, brak single point) | #2 (kandydat alternatywny) |
| I2 | Wysoka (ship-blocking) | — | **Mocna (DB/RLS)** | Już dobrze egzekwowany |
| I6 | Wysoka (Core) | — | **Mocna (transakcja DB)** | Już dobrze egzekwowany |
| I3,I4,I5 | Średnia/niska | — | Mocna (CHECK) | Już dobrze egzekwowane |
| I11 | Niska | Średnie | Częściowa (brak górnego CHECK) | Drobny dług |

### Wybór #1 (z uzasadnieniem, potwierdzony niezależnie wobec dokumentu 01)

**#1 = I1 — niezmiennik „karta `saved` ⇒ `next_due_at IS NOT NULL`" (agregat Card).**

Wybieram go, bo jest **jednocześnie najbardziej rdzeniowy I najsłabiej egzekwowany**:

- **Rdzeniowość:** SR lifecycle jest rdzeniem produktu — Secondary Success Criterion
  brzmi „Review sessions are reliable end-to-end ... without ... lost state"
  (`prd.md:38`). Karta `saved` bez `next_due_at` **cicho wypada z review** i jest
  dokładnie „lost state".
- **Słabość egzekucji (zweryfikowana w kodzie):** kolumna `next_due_at timestamptz`
  jest **nullable** — `supabase/migrations/20260527150510_cards_and_account_deletion.sql:22`.
  Nie ma żadnego CHECK wiążącego `status` z `next_due_at`. Spójność trzymają wyłącznie
  TRZY oddzielne ścieżki zapisu, z których każda *pamięta* ustawić datę:
  - manual create — `src/pages/api/cards.ts:61` (`next_due_at: new Date().toISOString()`),
  - finalize draftów — `supabase/migrations/20260529162956_finalize_drafts_fn.sql:22` (`set ... next_due_at = now()`),
  - rating w review — `src/pages/api/reviews.ts:65` (`next_due_at: next.next_due_at`).
- **Mechanizm cichej awarii (potwierdzony):** read-path review filtruje
  `.eq("status","saved").lte("next_due_at", now)` —
  `src/pages/review.astro:17-18`. W SQL `NULL <= now()` daje `NULL` (nie `true`),
  więc karta `saved` z `next_due_at = NULL` **nigdy nie pojawi się** w sesji
  powtórek i nie da żadnego błędu. Klasyczna „fail-silent".

**Dlaczego NIE #2 (I9 read-only lock) jako pierwszy:** I9 jest realnym długiem
(reguła agregatu Account rozsmarowana po 6+ handlerach), ale jego rdzeniowość jest
niższa (Supporting/compliance, dodany w PRD v2, nie część wizji v1), a *dzisiejszy*
stan jest spójnie egzekwowany — każdy istniejący write-handler woła `readOnlyGuard`.
Ryzyko I9 to „przyszły endpoint zapomni guarda" (dług prewencyjny), podczas gdy I1 to
„dowolna istniejąca lub przyszła ścieżka zapisu, która zapomni daty, tworzy
niewidoczny błąd danych" — wyższe iloczyn wartość×ryzyko. To potwierdza ranking z
`01-domain-distillation.md`, ale na podstawie własnego odczytu kodu, nie na słowo.

---

## KROK 3 — Diagnoza wybranego niezmiennika (I1)

### Gdzie reguła żyje dziś (wszystkie warstwy)

| Warstwa | Plik:linia | Co robi z niezmiennikiem |
| ------- | ---------- | ------------------------ |
| Schemat DB | `migrations/20260527150510_...:22` | `next_due_at timestamptz` — **nullable, brak związku ze `status`. NIE egzekwuje.** |
| Indeks (read support) | `migrations/20260531120000_...:12` | `cards_due_idx ... where status='saved'` — wspiera zapytanie, nie wymusza obecności daty |
| Zapis 1 (manual create) | `src/pages/api/cards.ts:59-61` | Ustawia `status:'saved', next_due_at: now()`. Egzekucja **rozproszona, w aplikacji** |
| Zapis 2 (finalize) | `migrations/...finalize_drafts_fn.sql:21-23` | `update ... set status='saved', next_due_at=now()`. Egzekucja **w funkcji SQL** |
| Zapis 3 (review rating) | `src/pages/api/reviews.ts:53,60-66` | `schedule()` → `next_due_at`. Egzekucja **rozproszona, w aplikacji** |
| Zapis 4 (draft insert) | `src/pages/api/generations.ts:75-80` | Wstawia `status:'draft'` **bez** `next_due_at` (poprawnie — draft NIE jest w lifecycle) |
| Edycja (PATCH) | `src/pages/api/cards/[id].ts:62-68` | Aktualizuje tylko front/back; nie dotyka daty (poprawnie — I8) |
| Odczyt (review) | `src/pages/review.astro:14-21` | `.eq('status','saved').lte('next_due_at', now)` — **NULL cicho wykluczany** |

### Diagnoza słabości

1. **Brak strażnika na granicy danych.** Żadna warstwa poniżej aplikacji nie pilnuje
   `saved ⇒ next_due_at`. DB akceptuje `INSERT/UPDATE` tworzący `saved` bez daty.
2. **Niezmiennik wyciekł z granicy agregatu do warstwy aplikacji.** Reguła Card jest
   utrzymywana przez to, że **3 niezależne ścieżki zapisu** pamiętają o jej spełnieniu.
   To dokładnie zapach „rozsmarowanego niezmiennika".
3. **Klient/aplikacja jako jedyny strażnik dla 2 z 3 ścieżek.** `cards.ts` i
   `reviews.ts` to TS w handlerze — jedyne miejsce, gdzie reguła jest sprawdzana dla
   tych ścieżek. Nowa ścieżka zapisu (przyszły import, batch-edit, „mark as saved")
   może ją pominąć bez żadnego sygnału.
4. **Błąd jest „połykany", nie zatrzymuje operacji.** Karta `saved` bez daty nie rzuca
   wyjątku — po prostu znika z `review.astro` (NULL ≤ now → NULL). Łamie to fail-fast:
   nielegalny stan jest persystowany i milczy, zamiast zatrzymać zapis.
5. **Brak typowanego kontraktu.** Brak wygenerowanych typów Supabase (`cards.ts:5-7`),
   więc kompilator też nie wymusi obecności daty przy `status:'saved'`.

---

## KROK 4 — Projekt agregatu-strażnika (Card)

Cel: uczynić **agregat Card jedynym miejscem egzekwowania I1**, tak by żadna ścieżka
zapisu — istniejąca ani przyszła — nie mogła utworzyć „saved bez due".

### Warstwa 1 (fundament) — niezmiennik na granicy danych (DB CHECK)

Najtańsza i najmocniejsza zmiana: przenieść regułę do schematu, gdzie żyje już I2–I6.

```sql
-- Nowa migracja: NNNNNNNNNNNNNN_cards_saved_requires_due.sql
-- Niezmiennik I1: karta saved ZAWSZE ma next_due_at.
-- Draft (status='draft') ma prawo do next_due_at IS NULL.
alter table public.cards
  add constraint cards_saved_has_due
  check (status <> 'saved' or next_due_at is not null);
```

Semantyka CHECK (logika implikacji `saved ⇒ next_due_at not null`):
- `status='draft'` → warunek spełniony niezależnie od daty (draft może mieć NULL).
- `status='saved'`, `next_due_at` ustawione → spełniony.
- `status='saved'`, `next_due_at` NULL → **CHECK violation, zapis odrzucony** (fail-fast w DB).

**Precondition migracji (backfill):** przed dodaniem CHECK należy zweryfikować, że
nie istnieją wiersze łamiące regułę (jeśli istnieją — to już objaw buga):

```sql
-- Sanity / backfill: napraw ewentualne istniejące "saved bez due" zanim CHECK
-- zostanie nałożony (inaczej ADD CONSTRAINT się nie powiedzie — co też jest
-- pożądanym fail-fast).
update public.cards
  set next_due_at = now()
  where status = 'saved' and next_due_at is null;
```

> Uwaga: jeśli backfill znajdzie wiersze, to dowód, że niezmiennik był już naruszany.
> W obecnym kodzie wszystkie 3 ścieżki ustawiają datę, więc oczekiwany wynik: 0 wierszy.
>
> **Manual data probe wykonany 2026-06-19:**
> ```sql
> select count(*) from public.cards where status = 'saved' and next_due_at is null;
> ```
> Wynik: **0**. Obecne dane NIE łamią niezmiennika I1 — backfill pozostaje wyłącznie
> safety netem, a `ADD CONSTRAINT cards_saved_has_due` można nałożyć bez oczekiwanego
> konfliktu z istniejącymi rekordami.

### Warstwa 2 (opcjonalna konsolidacja) — jedno wejście zapisu jako root agregatu

CHECK z Warstwy 1 **wystarcza** do twardej egzekucji I1 (każda ścieżka, która zapomni
daty, dostanie błąd zamiast cicho zapisać). Dla pełnego wzorca „agregat = jedyne
miejsce mutacji" można dodatkowo skonsolidować przejście `draft/new → saved` w jedną
funkcję domenową, tak by aplikacja nie składała ręcznie `status + next_due_at`.

Proponowany root agregatu i jego metody (pseudokod — kontrakt, nie kod produkcyjny):

```
// Agregat: Card (root) — jedyny strażnik niezmiennika "saved ⇒ next_due_at".
// Granica: pojedynczy wiersz cards + jego pola harmonogramu i status.

// Nazwany błąd domenowy (nie cichy zapis):
class SavedCardMissingDueError extends DomainError {}   // nielegalny stan agregatu

interface ReviewScheduler { schedule(box, rating, now): Schedule }  // = src/lib/leitner.ts

// Metoda fabryczna: utworzenie karty od razu w SR lifecycle (manual create).
// precondition: front i back niepuste (I3); zawsze ustawia next_due_at.
Card.createSaved(front, back, now): Card
  require nonEmpty(front) && nonEmpty(back)          // inaczej InvalidCardError
  return Card{ status:'saved', front, back,
              next_due_at: now, interval_days:0, repetition_count:0 }
  // postcondition (niezmiennik): status='saved' ⇒ next_due_at != null  ✔

// Metoda przejścia: promocja draftu do biblioteki (finalize accept).
// precondition: karta jest draftem; zawsze ustawia next_due_at.
card.promoteToSaved(now): void
  require this.status == 'draft'                     // inaczej IllegalTransitionError
  this.status = 'saved'
  this.next_due_at = now
  // postcondition: invariant trzymany

// Metoda przejścia: zarejestrowanie oceny w review.
// precondition: karta jest saved; harmonogram liczony przez scheduler.
card.applyRating(rating, currentBox, scheduler, now): void
  require this.status == 'saved'                     // inaczej IllegalTransitionError
  s = scheduler.schedule(currentBox, rating, now)
  this.repetition_count = s.repetition_count
  this.interval_days    = s.interval_days
  this.next_due_at      = s.next_due_at              // nigdy null dla saved
  this.last_reviewed_at = s.last_reviewed_at

// Metoda edycji: poprawka treści NIE rusza harmonogramu (I8).
card.editContent(front, back): void
  require nonEmpty(front) && nonEmpty(back)
  this.front = front; this.back = back
  // next_due_at / repetition_count / interval_days nietknięte

// Strażnik wewnętrzny wołany przed każdym zapisem przez repozytorium:
private card.assertInvariants(): void
  if this.status == 'saved' && this.next_due_at == null
     throw SavedCardMissingDueError()               // fail-fast, nie loguj-i-jedź
```

### Warstwa 2b — repozytorium agregatu

Zamiast rozsianych zapytań `.from('cards').insert/update(...)` w handlerach:

```
interface CardRepository {
  // ładuje pojedynczy agregat (owner-scoped przez RLS / auth.uid()):
  getById(id): Card | null
  // zapisuje agregat; woła card.assertInvariants() PRZED persystencją:
  save(card): void          // narusza I1 → SavedCardMissingDueError (nie INSERT)
  // zapytania odczytu pozostają cienkie (review query), ale opierają się na tym,
  // że repo nigdy nie zapisze saved bez daty.
}
```

Dla atomowego finalize (I6) **nie** rozbijamy istniejącej funkcji DB: `finalize_drafts`
pozostaje pojedynczą transakcją (root „DraftBatch" zaimplementowany jako funkcja SQL).
Jeśli przejście `promoteToSaved` ma iść przez agregat, to RPC `finalize_drafts` jest
dla niego idiomatycznym „repozytorium transakcyjnym" — i tak ustawia `next_due_at=now()`
w tej samej transakcji co `status='saved'` (`finalize_drafts_fn.sql:21-23`), więc
**atomowość niezmiennika jest tam już zapewniona**. CHECK z Warstwy 1 dokłada twardą
gwarancję także dla tej ścieżki.

### Warstwa 3 — cienkie API/route (egzekucja na serwerze)

Wzorzec dla mutujących route'ów (parse → metoda agregatu → mapowanie błędu domenowego):

```
POST /api/cards (manual create):
  parse front, back                       // 400 invalid_card jeśli puste
  card = Card.createSaved(front, back, now())
  repo.save(card)                         // SavedCardMissingDueError → 500 db_error (nigdy nie wystąpi przy poprawnym agregacie)
  return 201 { card }

POST /api/reviews (rating):
  parse cardId, rating, currentBox
  card = repo.getById(cardId); require card.status=='saved' (idempotentny guard jak dziś)
  card.applyRating(rating, currentBox, leitner, now())
  repo.save(card)
  return 200 { applied }

POST /api/generations/save (finalize):
  parse accept[], reject[]
  completeness guard (I7) — bez zmian (save.ts:62-83)
  rpc finalize_drafts(accept, reject)     // promoteToSaved + delete w jednej transakcji; CHECK pilnuje I1
  return 200 { saved, discarded }
```

Egzekucja I1 **już jest** po stronie serwera (nie klienta), więc tu nie ma migracji
klient→serwer (w odróżnieniu od wielu klasycznych przypadków). Refaktor polega na
**zejściu z warstwy aplikacji na warstwę danych** (CHECK) + opcjonalnym scaleniu
mutacji w root agregatu.

### Mapowanie błędu domenowego na odpowiedź HTTP

| Błąd domenowy | HTTP | body.error |
| ------------- | ---- | ---------- |
| `InvalidCardError` (front/back puste) | 400 | `invalid_card` |
| `IllegalTransitionError` (np. rating na draft) | 409 / 400 | `illegal_transition` |
| `SavedCardMissingDueError` (assertInvariants) | 500 | `db_error` (bug serwera — nie powinien wyciec do usera; logowany) + **DB CHECK** jako siatka bezpieczeństwa |

---

## KROK 5 — Before/after, plan faz, testy

### Before / after dla każdego dzisiejszego miejsca reguły

| Miejsce | Before (dziś) | After (po refaktorze) |
| ------- | ------------- | --------------------- |
| Schemat `cards.next_due_at` | nullable, brak związku ze `status` (`migrations:22`) | + CHECK `cards_saved_has_due` — DB odrzuca `saved` bez daty |
| `cards.ts` manual create | ręcznie składa `status:'saved', next_due_at:now()` (`:61`) | `Card.createSaved(...)`; data gwarantowana przez agregat **i** CHECK |
| `finalize_drafts` | `set status='saved', next_due_at=now()` (`:22`) | bez zmian (już poprawne, atomowe); CHECK dokłada gwarancję |
| `reviews.ts` rating | ręcznie składa pola z `schedule()` (`:60-66`) | `card.applyRating(...)`; CHECK dokłada gwarancję |
| `generations.ts` draft insert | `status:'draft'` bez daty (`:79`) | bez zmian (draft = NULL dozwolony; CHECK to akceptuje) |
| `cards/[id].ts` PATCH | tylko front/back (`:64`) | bez zmian (I8 zachowany) |
| `review.astro` read | NULL cicho wykluczany (`:17-18`) | bez zmian funkcjonalnie, ale „saved bez due" **nie może już powstać**, więc wykluczenie staje się bezprzedmiotowe |

### Plan faz refaktoru

**Faza 0 — Siatka bezpieczeństwa w DB (najwyższy zwrot, najmniejsze ryzyko).**
1. Nowa migracja: backfill (`update ... where status='saved' and next_due_at is null`)
   + `add constraint cards_saved_has_due`. **Manual data probe z 2026-06-19 zwrócił 0
   wierszy łamiących regułę** (patrz Warstwa 1), więc constraint nakłada się czysto;
   backfill zostaje jako idempotentne zabezpieczenie.
2. Walidacja: `npm run lint`, `npm run build`; ręczny przejazd tras `/library` (manual
   create), `/generate` → save, `/review` (rating). Jeśli backfill zmienił >0 wierszy —
   zgłosić jako bug (dowód, że niezmiennik był naruszany).

**Faza 1 (opcjonalna) — Konsolidacja w agregat Card.**
3. Dodać `src/lib/card.ts` (pure, edge-safe — wzór `leitner.ts`) z metodami
   `createSaved / promoteToSaved / applyRating / editContent / assertInvariants` i
   nazwanymi błędami domenowymi.
4. Przepiąć `cards.ts` i `reviews.ts` na agregat (handler tylko parse → metoda → map).
   `finalize_drafts` pozostaje jako transakcyjne repo dla `promoteToSaved`.
5. Walidacja jak w Fazie 0.

> Faza 0 sama w sobie domyka niezmiennik I1 (twarda egzekucja na granicy danych).
> Faza 1 to czystość DDD (jedno miejsce mutacji), nie warunek poprawności.

### Uwaga o testach

> **Korekta (2026-06-19):** wcześniejsza wersja tego dokumentu (za nieaktualnym
> wpisem w `AGENTS.md`) twierdziła, że projekt nie ma test runnera. To nieprawda —
> projekt MA Vitest (unit + integration, harness w `test/integration/`) oraz
> Playwright E2E w `tests/e2e/`. `AGENTS.md` i `CLAUDE.md` zostały poprawione.

Walidacja: `npm run lint`, `npm run build`, odpowiednie suity (`npm test`,
`npm run test:integration`, `npm run test:e2e`) oraz ręczne sprawdzenie tras
`/library`, `/generate`, `/review`. Poniższe przypadki to **przypadki testowe
niezmiennika I1 do dodania** — kolokować jako `*.test.ts` / `*.integration.test.ts`
obok kodu, E2E wg skilla `/10x-e2e`.

#### Przypadki testowe niezmiennika I1 (legalne / nielegalne)

DB CHECK (poziom integracji / SQL):
- LEGAL: `insert cards(status='draft', next_due_at=null)` → sukces.
- LEGAL: `insert cards(status='saved', next_due_at=now())` → sukces.
- LEGAL: `update cards set status='saved', next_due_at=now() where ...` → sukces.
- **ILLEGAL:** `insert cards(status='saved', next_due_at=null)` → **CHECK violation**.
- **ILLEGAL:** `update cards set status='saved', next_due_at=null where status='draft'` → **CHECK violation**.
- **ILLEGAL:** `update cards set next_due_at=null where status='saved'` → **CHECK violation**.

Agregat Card (poziom jednostkowy — pure, jeśli powstanie Faza 1):
- LEGAL: `Card.createSaved("q","a", now)` → `status='saved' && next_due_at==now`.
- LEGAL: `draft.promoteToSaved(now)` → `status='saved' && next_due_at==now`.
- LEGAL: `saved.applyRating('right', box, leitner, now)` → `next_due_at` przesunięte, nie-null.
- LEGAL: `saved.editContent("q2","a2")` → front/back zmienione, `next_due_at` NIETKNIĘTE (I8).
- **ILLEGAL:** `Card.createSaved("", "a", now)` → `InvalidCardError`.
- **ILLEGAL:** `saved.promoteToSaved(now)` (już saved) → `IllegalTransitionError`.
- **ILLEGAL:** `draft.applyRating(...)` (rating na draft) → `IllegalTransitionError`.
- **ILLEGAL:** ręczne wymuszenie `status='saved', next_due_at=null` + `save()` → `SavedCardMissingDueError` (assertInvariants).

End-to-end (Playwright, `tests/e2e/` — patrz skill `/10x-e2e`):
- Utwórz kartę ręcznie w `/library` → natychmiast widoczna w `/review` (ma due=now).
- Wygeneruj + accept w `/generate` → zaakceptowane karty pojawiają się w `/review`.
- Oceń kartę „right" w `/review` → znika z bieżącej sesji, wraca po interwale boxa.

### Nowe „load-bearing" nazwy do rejestracji (jeśli projekt prowadzi rejestr kontraktów)

- `cards_saved_has_due` — nazwa CHECK constraint (kontrakt schematu).
- `Card.createSaved` / `Card.promoteToSaved` / `Card.applyRating` / `Card.editContent`
  / `Card.assertInvariants` — metody agregatu (Faza 1).
- `SavedCardMissingDueError`, `InvalidCardError`, `IllegalTransitionError` — nazwane
  błędy domenowe.
- `CardRepository.save` / `.getById` — kontrakt repozytorium (Faza 1).

---

## Ograniczenia analizy

- Brak wygenerowanych typów Supabase — kontrakt schematu czytany wyłącznie z migracji
  SQL (kod sam to odnotowuje, `cards.ts:5-7`). TypeScript nie wymusi dziś `next_due_at`
  przy `status:'saved'` — stąd CHECK w DB jest właściwą warstwą egzekucji.
- Nie zmodyfikowano żadnego kodu produkcyjnego — to plan.
- Stan na 2026-06-19 (slice'y F-01…S-06 `done` wg roadmapy).
