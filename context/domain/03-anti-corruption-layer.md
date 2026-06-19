---
title: "10xCards — Anti-Corruption Layer dla przeciekającej zależności (refactor plan)"
created: 2026-06-19
type: refactor-plan
---

# 10xCards — Anti-Corruption Layer (ACL)

> Produkt tego dokumentu to **PLAN refaktoru**, nie implementacja. Żaden kod
> produkcyjny nie został zmieniony. Wszystkie cytaty `plik:linia` zostały
> zweryfikowane przez bezpośredni odczyt pliku przed wpisaniem — nie polegano na
> cytatach z dokumentów `01`/`02`, zostały one potwierdzone w kodzie.
> Materiał pomocniczy: `context/domain/01-domain-distillation.md`,
> `context/domain/02-invariant-aggregate-refactor.md`.

---

## KROK 0 — Odkryty kontekst

### Stack i zależności zewnętrzne (z `package.json`)

| Zależność | Pakiet | Rola | Warstwa(y) gdzie żyje |
| --------- | ------ | ---- | --------------------- |
| **Supabase** (DB + Auth) | `@supabase/ssr`, `@supabase/supabase-js` | Postgres + RLS + email-auth | **UI (.astro) + middleware + WSZYSTKIE handlery API** |
| **OpenRouter** (LLM gateway) | brak SDK — `fetch` po HTTP | Generacja kart AI | wyłącznie `src/lib/openrouter.ts` |
| Cloudflare / Astro / React / Tailwind | runtime/UI | platforma | przekrojowo |
| Sentry | `@sentry/astro`, `@sentry/cloudflare` | telemetria | konfiguracja |

> **Korekta założenia z dokumentów 01/02:** `package.json` zawiera dziś
> `vitest`, `@playwright/test`, `@stryker-mutator/*` oraz realne pliki
> `*.test.ts` / `*.integration.test.ts` (np. `src/pages/api/cards.test.ts`,
> `src/pages/api/reviews.integration.test.ts`). Twierdzenie „brak test runnera"
> z poprzednich kroków jest **nieaktualne**. Wpływa to na plan walidacji (KROK 6).

### Deklaracje wymienialności (intencja vs. kod)

- **OpenRouter — deklarowany jako wymienialny.** Roadmap: „Klucz **OpenRouter (lub
  równoważny LLM gateway)** jeszcze nie wpięty" — `context/foundation/roadmap.md:99`;
  „Wybór modelu LLM + sufit kosztowy per request" jako otwarta decyzja — `roadmap.md:100`.
  Dokument 01 klasyfikuje „AI provider integration (OpenRouter transport, JSON-schema,
  retry/timeout)" jako **Generic/Supporting** i wprost: „Mechanika wywołania LLM
  (transport, parsing, błędy) jest **wymienialna** i nie-różnicująca" —
  `context/domain/01-domain-distillation.md:184`.
- **Supabase — wybrany ze względu na RLS, BEZ deklaracji wymienialności.** Tech-stack
  uzasadnia wybór funkcjonalnie („Supabase covers email auth and Postgres with
  Row-Level Security to enforce the ship-blocking cross-user isolation guardrail" —
  `context/foundation/tech-stack.md:29-31`), a PRD podkreśla *niezależność od
  third-party identity*, nie od Supabase (`prd.md:93`). Brak intencji „żeby dało się
  wymienić Supabase".

### Warstwy kodu (gdzie żyje logika)

- UI / strony: `src/pages/*.astro`, `src/components/**`
- API (cienkie handlery): `src/pages/api/**`
- Logika domenowa (pure): `src/lib/leitner.ts`, `src/lib/account-retention.ts`, `src/lib/openrouter.ts`
- Persystencja + reguły: `supabase/migrations/*.sql`
- Przekrojowo: `src/middleware.ts`, `src/env.d.ts`

---

## KROK 1 — Identyfikacja przeciekających zależności

Sygnały przecieku: ten sam pakiet importowany w wielu warstwach, typy biblioteki w
sygnaturach domenowych / kontraktach, rekonstrukcja obiektów biblioteki w wielu
miejscach, wołanie tego samego SDK po obu stronach granicy.

### Zależność A — Supabase (`@supabase/*`)

**Skala przecieku (zweryfikowana grepem `from "@/lib/supabase" | from "@supabase`):
19 plików, w tym 14 produkcyjnych (reszta to testy).** Pakiet/fabryka przecieka przez
**trzy** warstwy: UI (.astro), middleware (przekrojowo), oraz każdy handler API.

Pliki produkcyjne, które DZIŚ „znają" Supabase (import + użycie):

| Plik:linia | Co przecieka |
| ---------- | ------------ |
| `src/lib/supabase.ts:1,5,9` | fabryka `createServerClient` (jedyne sensowne miejsce) |
| `src/env.d.ts:3` | **typ biblioteki w kontrakcie aplikacji:** `user: import("@supabase/supabase-js").User \| null` |
| `src/middleware.ts:2,7,9-13,21-26` | `createClient`, `supabase.auth.getUser()`, `.from("account_deletion_requests").select().eq().maybeSingle()` |
| `src/pages/review.astro:3,7,14-21` | `createClient` + query budowane fluent-API Supabase w **UI** |
| `src/pages/library.astro:3,7,40,59` | `createClient` + dwa query (count + list) fluent-API w **UI** |
| `src/pages/generate.astro:3,7,21-26` | `createClient` + query draftów fluent-API w **UI** |
| `src/pages/api/cards.ts:2,36,59-64` | `createClient` + `.from("cards").insert().select().single().overrideTypes()` |
| `src/pages/api/cards/[id].ts:2,33,62-64,89,102-103` | PATCH/DELETE fluent-API |
| `src/pages/api/reviews.ts:2,26,60-72` | `.from("cards").update().eq().eq().eq().select().overrideTypes()` |
| `src/pages/api/generations.ts:3,70,82` | `.from("cards").insert().select()` |
| `src/pages/api/generations/save.ts:2,42,66-70,87-90` | `.from().select()` + **`supabase.rpc("finalize_drafts", …)`** z ręcznym castem wyniku |
| `src/pages/api/generations/discard.ts:2,21,26` | `.from("cards").delete().eq().eq()` |
| `src/pages/api/account/delete.ts:2,23,33-34,44-45` | insert-or-select na `account_deletion_requests` (obsługa kodu błędu `23505`) |
| `src/pages/api/account/cancel.ts:2,21,27` | `.from("account_deletion_requests").delete().eq()` |
| `src/pages/api/auth/signin.ts:2,9,13` | `supabase.auth.signInWithPassword()` |
| `src/pages/api/auth/signup.ts:2,9,13` | `supabase.auth.signUp()` |
| `src/pages/api/auth/signout.ts:2,5,7` | `supabase.auth.signOut()` |

Dodatkowo przecieka **kontrakt typu** poza fabrykę: `App.Locals.user` to surowy
`@supabase/supabase-js.User` (`src/env.d.ts:3`), więc każdy `context.locals.user`
(np. `cards.ts:28`, `reviews.ts:18`, `generations.ts:19`, `middleware.ts:13,25`,
`index.astro:5`) zależy od kształtu typu biblioteki.

**Duplikacja rekonstrukcji wzorców** (te same idiomy Supabase powtórzone w wielu
plikach, nie wyabstrahowane):
- `if (!supabase) return json({ error: "supabase_unconfigured", … }, 503)` — powtórzone
  w `cards.ts:37-39`, `reviews.ts:27-29`, `generations.ts:71-73`, `save.ts:43-45`,
  `discard.ts:22-23`, `account/delete.ts:24-25`, `account/cancel.ts:22-23` (7×).
- `.overrideTypes<…, { merge: false }>()` jako obejście braku typów — `cards.ts:64`,
  `reviews.ts:72`, `save.ts:70`, `review.astro:21`, `generate.astro` (komentarze
  potwierdzają „No generated Supabase types in this codebase" — `cards.ts:5-7`,
  `cards/[id].ts:5`, `save.ts:5-7`).
- Ręczne mapowanie kodu błędu sterownika (`23505` unique-violation) w `account/delete.ts:44`
  — wiedza o Postgres/PostgREST wyciekła do handlera.

### Zależność B — OpenRouter

**Skala przecieku: praktycznie zero.** `fetch("https://openrouter.ai/...")` żyje
wyłącznie w `src/lib/openrouter.ts:59`. Handler `generations.ts` woła już tylko
**własny port** `generateCandidateCards(...)` (`generations.ts:5,50`) i mapuje
**własny** typ błędu `OpenRouterError` na HTTP (`generations.ts:56-64`). Domenowy typ
`CandidateCard` jest zdefiniowany lokalnie (`openrouter.ts:15-18`), NIE jest typem
biblioteki. To jest *już* poprawnie odizolowana zależność (mały, świadomy ACL „de
facto"). Jedyna pozostałość to nazwa „OpenRouter" wyciekająca do kodów błędów
domenowych (`OpenRouterErrorCode`, `openrouter.ts:1`) i do `config-status.ts:21` —
drobny, kosmetyczny dług naming, nie przeciek warstwowy.

---

## KROK 2 — Klasyfikacja i wybór #1

| Oś | Supabase (A) | OpenRouter (B) |
| -- | ------------ | -------------- |
| (a) liczba warstw / plików | **3 warstwy (UI + middleware + API), 14 plików prod.** | 1 plik (`openrouter.ts`) |
| (b) ryzyko/koszt wymiany dziś | **Wysokie** — query fluent-API i `.rpc` rozsiane w UI i 9+ handlerach; typ `User` w kontrakcie; idiomy `23505`, `overrideTypes` zduplikowane | Niskie — jeden `fetch`, jeden port już istnieje |
| (c) deklaracja wymienialności w dokumentach | Brak (wybrany dla RLS) | **Jest** (`roadmap.md:99`, `01:184`) — ale kod **już** ją dotrzymuje |
| Rozjazd intencja↔kod | n/d (brak intencji) | **Brak rozjazdu** — intencja i kod zgodne |

### Wybór #1 = **Supabase (`@supabase/*`)**

Uzasadnienie:

1. **Najszerszy przeciek przez granice** — to jedyna zależność rozsmarowana po trzech
   warstwach (UI, middleware, API) w 14 plikach produkcyjnych. OpenRouter siedzi w
   jednym pliku i ma już port — nie ma czego naprawiać.
2. **Najgroźniejszy rodzaj przecieku:** logika persystencji (fluent query-builder,
   `.rpc`, mapowanie kodów błędów sterownika) żyje **w warstwie UI** (`review.astro`,
   `library.astro`, `generate.astro` budują zapytania Supabase bezpośrednio w
   front-matterze strony). To biblioteka serwerowa wciągana do plików renderujących
   widok — dokładnie ten antywzorzec, którego ACL ma bronić.
3. **Typ biblioteki w kontrakcie aplikacji** (`User` w `App.Locals`, `env.d.ts:3`) —
   przeciek typu, który propaguje się wszędzie, gdzie czyta się `locals.user`.
4. **Paradoks intencji:** OpenRouter jest *deklarowany* wymienialny i kod to spełnia;
   Supabase *nie* jest deklarowany wymienialny, a jednocześnie jest najtrudniejszy do
   wymiany — najgorszy stosunek „rozsmarowanie × koszt wymiany". To czyni go realnym
   długiem architektonicznym, nawet jeśli pełna wymiana Supabase nie jest celem MVP.

> Świadome zawężenie celu: pełna wymiana Supabase nie jest wymaganiem produktu (RLS
> to fundament izolacji — `tech-stack.md:30`). Wartość ACL tutaj to nie „żeby porzucić
> Supabase", lecz **zatrzymanie wycieku persystencji do UI i kontraktu**: jeden punkt
> wiedzy o kształcie zapytań, testowalność handlerów bez stubowania fluent-API, oraz
> typ domenowy zamiast `@supabase`-`User`.

---

## KROK 3 — Diagnoza (duplikacja + przecieki przez granice)

### Przeciek 1 — query persystencji w warstwie UI (najgroźniejszy)

`review.astro:14-21` buduje zapytanie due-cards bezpośrednio fluent-API Supabase:

```
const { data, error } = await supabase
  .from("cards").select("id, front, back, repetition_count")
  .eq("status", "saved").lte("next_due_at", new Date().toISOString())
  .order("next_due_at", { ascending: true })
  .order("last_reviewed_at", { ascending: true, nullsFirst: true })
  .overrideTypes<DueCard[], { merge: false }>();
```

Analogicznie `library.astro:40,59` (count + list `saved`) i `generate.astro:21-26`
(lista draftów). **Warstwa widoku zna nazwy kolumn, semantykę `lte`/`order` i obejście
typów Supabase.** Wymiana sterownika DB dotyka plików `.astro`.

### Przeciek 2 — `.rpc` i kody błędów sterownika w handlerach

- `save.ts:87-90`: `supabase.rpc("finalize_drafts", {p_accept_ids, p_reject_ids})` z
  ręcznym castem `as { data: FinalizeResult[] | null; error: … }` (`save.ts:90`) — bo
  brak typów. Wiedza o sygnaturze RPC i kształcie wyniku rozsmarowana między funkcję
  SQL a handler.
- `account/delete.ts:44`: ręczna obsługa `error.code === "23505"` (Postgres
  unique-violation) — kod błędu sterownika wyciekł do logiki domenowej „re-request nie
  przesuwa okna" (I10 z dokumentu 02).

### Przeciek 3 — typ biblioteki w kontrakcie

`env.d.ts:3`: `user: import("@supabase/supabase-js").User | null`. Każdy odczyt
`context.locals.user` (`cards.ts:28`, `reviews.ts:18`, `generations.ts:19`,
`save.ts:34`, `cards/[id].ts:25`, `account/*`, `index.astro:5`, `middleware.ts:13,25`)
zależy od kształtu typu biblioteki, choć używa z niego wyłącznie `id`.

### Duplikacja (te same idiomy, brak abstrakcji)

| Idiom | Powtórzenia (plik:linia) |
| ----- | ------------------------ |
| `if (!supabase) → 503 supabase_unconfigured` | `cards.ts:37`, `reviews.ts:27`, `generations.ts:71`, `save.ts:43`, `discard.ts:22`, `account/delete.ts:24`, `account/cancel.ts:22` |
| `.overrideTypes<…,{merge:false}>()` (obejście braku typów) | `cards.ts:64`, `reviews.ts:72`, `save.ts:70`, `review.astro:21` |
| `auth.*` (signin/up/out/getUser) | `signin.ts:13`, `signup.ts:13`, `signout.ts:7`, `middleware.ts:12` |

---

## KROK 4 — Projekt ACL

Cel: **jeden katalog wie o kształcie Supabase; reszta kodu zna tylko wąskie porty i
typy domenowe.** Strategia jest „repozytoryjna" (port per agregat), nie „opakuj cały
SupabaseClient" — wąskie porty są testowalne i nie przeciekają fluent-API.

### Topologia katalogów (proponowana)

```
src/lib/persistence/
  ports.ts            // wąskie interfejsy domenowe (CardRepository, AccountRepository, AuthGateway, GenerationStore)
  identity.ts         // domenowy typ AuthUser (zastępuje @supabase User w kontrakcie)
  errors.ts           // PersistenceError, NotConfiguredError, ConflictError (mapują kody sterownika)
  supabase/
    client.ts         // = dzisiejszy src/lib/supabase.ts (createServerClient) — JEDYNY import @supabase
    card-repository.ts        // adapter: implementuje CardRepository przez .from("cards")…
    account-repository.ts     // adapter: account_deletion_requests + mapowanie 23505 → ConflictError
    auth-gateway.ts           // adapter: auth.signIn/up/out/getUser → AuthUser | AuthError
    mappers.ts                // wiersz Supabase ↔ obiekt domenowy; jedyne miejsce z .overrideTypes
```

### Value object / typ domenowy — jedyne miejsce wiedzy o kształcie

```ts
// identity.ts — domenowa tożsamość; NIE @supabase User.
export interface AuthUser { readonly id: string; readonly email: string | null; }
// mapper (jedyne miejsce, które dotyka @supabase User):
function toAuthUser(u: import("@supabase/supabase-js").User): AuthUser
```

`App.Locals.user` (`env.d.ts:3`) zmienia typ na `AuthUser | null`. Reszta kodu nie
importuje `@supabase/supabase-js`.

### Wąskie porty (interfejsy domenowe)

```ts
// ports.ts — kontrakty, które zna reszta aplikacji. Brak typów Supabase w sygnaturach.

export interface CardRepository {
  listDue(now: Date): Promise<DueCard[]>;                 // review.astro
  listSaved(page: Page): Promise<{ items: CardView[]; total: number }>; // library.astro
  listDrafts(): Promise<DraftView[]>;                     // generate.astro
  createSaved(input: NewCard, now: Date): Promise<CardView>;     // POST /api/cards
  insertDrafts(cards: CandidateCard[]): Promise<DraftView[]>;    // generations.ts
  editContent(id: string, front: string, back: string): Promise<CardView | null>; // PATCH
  delete(id: string): Promise<boolean>;                   // DELETE
  applyRating(id: string, box: number, s: Schedule): Promise<boolean>; // reviews.ts (box-guarded)
  finalizeDrafts(accept: string[], reject: string[]): Promise<{ saved: number; discarded: number }>; // rpc
  listDraftIds(): Promise<string[]>;                      // completeness guard (save.ts)
  discardDrafts(): Promise<void>;
}

export interface AccountRepository {
  getDeletionState(userId: string): Promise<{ pending: boolean; retentionUntil: string | null }>; // middleware
  requestDeletion(userId: string): Promise<{ retentionUntil: string }>;  // insert-or-select; 23505→istniejące
  cancelDeletion(userId: string): Promise<void>;
}

export interface AuthGateway {
  currentUser(): Promise<AuthUser | null>;                // middleware
  signInWithPassword(email: string, password: string): Promise<AuthError | null>;
  signUp(email: string, password: string): Promise<AuthError | null>;
  signOut(): Promise<void>;
}
```

> Owner-scoping pozostaje w DB (RLS, `(select auth.uid()) = user_id` —
> `migrations:36-53`). Porty są celowo per-user-implicit: adapter używa klienta z
> sesją, RLS dowozi izolację. To zgodne z istniejącą architekturą (dokument 01: RLS
> jako fundament), więc port NIE przyjmuje `userId` tam, gdzie dziś polega na RLS.

### Adapter (jedyny, który zna `@supabase`)

```ts
// supabase/card-repository.ts (pseudokod) — implementuje port przez fluent-API.
class SupabaseCardRepository implements CardRepository {
  constructor(private db: SupabaseClient) {}

  async listDue(now: Date): Promise<DueCard[]> {
    const { data, error } = await this.db.from("cards")
      .select("id, front, back, repetition_count")
      .eq("status", "saved").lte("next_due_at", now.toISOString())
      .order("next_due_at", { ascending: true })
      .order("last_reviewed_at", { ascending: true, nullsFirst: true });
    if (error) throw new PersistenceError(error);          // jedyne miejsce mapujące błąd sterownika
    return (data ?? []).map(toDueCard);                    // mapper, nie .overrideTypes w UI
  }

  async finalizeDrafts(accept, reject) {
    const { data, error } = await this.db.rpc("finalize_drafts",
      { p_accept_ids: accept, p_reject_ids: reject });
    if (error) throw new PersistenceError(error);
    const row = (data as FinalizeRow[] | null)?.[0];        // cast/RPC-shape zamknięty TU
    return { saved: row?.saved_count ?? 0, discarded: row?.discarded_count ?? 0 };
  }
}

// supabase/account-repository.ts — mapowanie kodu sterownika zamknięte w adapterze:
async requestDeletion(userId) {
  const ins = await this.db.from("account_deletion_requests").insert({ user_id: userId }).select("retention_until").single();
  if (ins.error?.code === "23505") {                        // 23505 NIE wycieka do handlera
    const sel = await this.db.from("account_deletion_requests").select("retention_until").eq("user_id", userId).single();
    return { retentionUntil: sel.data.retention_until };
  }
  if (ins.error) throw new PersistenceError(ins.error);
  return { retentionUntil: ins.data.retention_until };
}
```

### Złożenie portu (fabryka — jedyny punkt konfiguracji)

```ts
// persistence/index.ts — zwraca porty lub sygnalizuje brak konfiguracji JEDEN raz.
export function getRepositories(headers, cookies):
  { cards: CardRepository; accounts: AccountRepository; auth: AuthGateway } | null {
  const db = createSupabaseClient(headers, cookies);        // = dzisiejszy supabase.ts
  if (!db) return null;                                     // jedno miejsce „not configured"
  return { cards: new SupabaseCardRepository(db), accounts: …, auth: … };
}
```

Powtarzany guard `if (!supabase) → 503` (7×) zwija się do jednego sprawdzenia
`if (!repos) return notConfigured(503)`.

### Rozstrzygnięcie pytań zależnych od kontraktu biblioteki

- **Brak generowanych typów Supabase** (`cards.ts:5-7`) → decyzja: typy wierszy
  (`CardRow`, `FinalizeRow`) i `toDueCard`/`toCardView` żyją w `supabase/mappers.ts`;
  `.overrideTypes` znika z UI/handlerów. (Alternatywa: `supabase gen types` — poza
  zakresem tego planu, ale gdyby wejść, generowany typ importuje wyłącznie adapter.)
- **Kod błędu `23505`** → mapowany na domenowy `ConflictError` w adapterze
  (`account-repository.ts`); reguła „re-request nie przesuwa okna" (I10) zostaje
  intencyjnie w adapterze + niezmiennik w DB (PK na `user_id`), nie w handlerze.

---

## KROK 5 — Dowód izolacji + before/after

### Co dotyka wymiana sterownika DB PO refaktorze

Wymiana / wersjonowanie Supabase dotyka **wyłącznie** `src/lib/persistence/supabase/**`
(+ ewentualnie `identity.ts` mapper). NIE dotyka:

- tabel/migracji (`supabase/migrations/**` — schemat, RLS, `finalize_drafts` bez zmian),
- kontraktów API (kody błędów HTTP `supabase_unconfigured`, `db_error` itd. — bez zmian),
- UI (`*.astro`, `src/components/**` — dostają gotowe `DueCard[] / CardView[]`),
- portów (`ports.ts` — kontrakt domenowy stabilny).

### Before / after — kluczowe miejsca

| Miejsce | Before (dziś) | After (ACL) |
| ------- | ------------- | ----------- |
| `review.astro:14-21` | fluent-API Supabase + `.overrideTypes` w UI | `const dueCards = repos.cards.listDue(now)` — UI dostaje `DueCard[]` |
| `library.astro:40,59` | dwa query Supabase w UI | `repos.cards.listSaved(page)` |
| `generate.astro:21-26` | query draftów w UI | `repos.cards.listDrafts()` |
| `save.ts:87-90` | `supabase.rpc(...) as {…}` w handlerze | `repos.cards.finalizeDrafts(accept, reject)` |
| `account/delete.ts:44` | ręczny `error.code === "23505"` | `repos.accounts.requestDeletion(userId)` (ConflictError wewn.) |
| `env.d.ts:3` | `User` z `@supabase/supabase-js` | `AuthUser` (typ domenowy) |
| guard `if (!supabase) → 503` ×7 | powtórzony w każdym handlerze | jeden `if (!repos)` |
| `signin/up/out`, `middleware` `auth.*` | bezpośrednie `supabase.auth.*` | `repos.auth.*` / `AuthGateway` |

UI po refaktorze otrzymuje **gotowe dane domenowe** (`DueCard`, `CardView`,
`DraftView`), nigdy surowy obiekt/builder Supabase.

---

## KROK 6 — Weryfikacja i plan

### Kryterium sukcesu (grep)

Po refaktorze:
```
grep -r '@supabase'  src/   # → tylko src/lib/persistence/supabase/** (+ identity.ts mapper)
grep -r 'from "@/lib/supabase"' src/   # → tylko persistence/** i jego testy
```

**Dziś** (zweryfikowane): `from "@/lib/supabase" | @supabase` trafia w **19 plików**
(14 produkcyjnych). **Po** — produkcyjnie wyłącznie katalog adaptera.

| Plik dziś zna Supabase | Po refaktorze zna? |
| ---------------------- | ------------------ |
| `src/lib/supabase.ts` | TAK → przeniesiony do `persistence/supabase/client.ts` |
| `src/env.d.ts:3` | NIE (`AuthUser`) |
| `src/middleware.ts` | NIE (`repos.auth` + `repos.accounts`) |
| `src/pages/review.astro` / `library.astro` / `generate.astro` | **NIE** (porty) |
| `src/pages/api/cards.ts`, `cards/[id].ts`, `reviews.ts`, `generations.ts`, `generations/save.ts`, `generations/discard.ts` | NIE (`repos.cards`) |
| `src/pages/api/account/delete.ts`, `cancel.ts` | NIE (`repos.accounts`) |
| `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts` | NIE (`repos.auth`) |
| `src/pages/persistence/supabase/**` (nowe) | **TAK (jedyne)** |

### Plan faz (zgodny z konwencją projektu)

**Faza 0 — Porty + typ tożsamości (fundament, bez zmian zachowania).**
1. `persistence/ports.ts`, `identity.ts` (`AuthUser` + mapper), `errors.ts`.
2. Zmiana `env.d.ts:3` na `AuthUser`; mapowanie w middleware.
3. Walidacja: `npm run lint`, `npm run build`, `npm run test` (vitest istnieje), ręczny
   przejazd `/auth/*`, `/dashboard`.

**Faza 1 — Adapter CardRepository + przepięcie UI i handlerów kart.**
4. `supabase/card-repository.ts` + `mappers.ts`; przepiąć `review.astro`, `library.astro`,
   `generate.astro`, `cards.ts`, `cards/[id].ts`, `reviews.ts`, `generations.ts`,
   `save.ts`, `discard.ts`. `finalize_drafts` rpc zamknięty w adapterze (transakcja DB bez zmian).
5. Walidacja jw. + ręczny `/library`, `/generate`→save, `/review`.

**Faza 2 — AccountRepository + AuthGateway.**
6. Przepiąć `account/delete.ts` (23505→ConflictError), `cancel.ts`, middleware retencja,
   `signin/up/out`. Usunąć powtórzony guard `if (!supabase)` na rzecz `getRepositories(...)`.
7. Walidacja jw. + ręczny przejazd usunięcia/anulowania konta i auth.

**Faza 3 — Dokręcenie kryterium.**
8. Grep-check: `@supabase` tylko w `persistence/supabase/**`. Zaktualizować testy
   (dziś mockują `@/lib/supabase` — np. `cards.test.ts:19`, `reviews.test.ts:20`,
   integration fixtures `test/integration/scoped-supabase-mock`); po refaktorze testy
   handlerów mockują **porty**, integracyjne nadal stubują adapter/klient.

> Uwaga: testy istnieją (vitest/playwright + integration fixtures), więc walidacja
> obejmuje `npm run test` / `npm run test:integration`, nie tylko lint+build+manual.

---

## Ograniczenia analizy

- Pełna wymiana Supabase NIE jest celem produktu (RLS = fundament izolacji,
  `tech-stack.md:30`); wartość ACL to zatrzymanie wycieku persystencji do UI/kontraktu
  i jeden punkt wiedzy, nie migracja off-Supabase.
- Owner-scoping pozostaje w RLS (DB), więc porty są per-user-implicit — to świadomy
  wybór zgodny z istniejącą architekturą, nie pominięcie.
- OpenRouter celowo pominięty jako #1: jest już odizolowany (jeden plik, własny port +
  typ błędu) — naprawiać nie ma czego.
- Nie zmodyfikowano żadnego kodu produkcyjnego — to plan. Stan na 2026-06-19.
