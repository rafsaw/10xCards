# Raport architektoniczny M4 — 10xCards

> Synteza końcowa Modułu 4 (10xArchitect): L2 mapa → L3 analiza przepływu → L4 plan refaktoru → L5 domena.
> Każde twierdzenie strukturalne ma źródło w artefakcie lub bezpośrednim odczycie repo. Stan na 2026-06-19.

## 1. Projekty opisane w module

- **Nazwa:** `10xCards` — AI-assisted spaced-repetition MVP
- **Stack:** Astro/React/TS/Supabase/Cloudflare
- **Skala (orientacyjnie):** młode repo, ~26 dni, 178–181 commitów
- **Najważniejszy fakt:** zdrowy graf, ale bus factor 1
   **Artefakty M4:** repo użyte we wszystkich lekcjach modułu: L2 mapa projektu, L3 research przepływu account-retention/write-lock, L4 plan refaktoru C3, L5 artefakty DDD (`01`, `02`, `03`).

## 2. Mapa projektu z L2

1. **Centrum grawitacji to infrastruktura, nie „AI".** Hub kodu to `src/lib/supabase.ts` (fan-in 16 wg depcruise; przy ponownym pomiarze 15 TS/TSX + 3 `.astro` — różnica metody, `.astro` poza grafem). Headline-feature `openrouter.ts` to wąska szprycha fan-in 2 (produkcyjnie 1) (źródło: `repo-map.md` §1, §6; korekta `account-retention-write-lock/research.md` §I S7/S9).
2. **Granica klient/serwer jest realna, nie deklarowana:** żaden komponent nie importuje `supabase`/`openrouter`/`retention` bezpośrednio (źródło: `repo-map.md` §1, z `artifact-2` §3). Frontend tnie pionowo (folder per funkcja), backend płaski pod `pages/api/`, sprzężony przez warstwę `lib` (źródło: `self-vs-evidence.md` §3 #5).
3. **Ukryty cross-cutting inwariant zapisu:** `account-retention.ts` (fan-in 6) wpina się w *każdy* mutujący endpoint — nazwa folderu „usuwanie konta" ukrywa, że to globalny aspekt (źródło: `repo-map.md` §3). To zostało wybrane do pogłębienia w L3.
4. **Strefy ryzyka (🔴):** Supabase/DB+RLS (hub, migracje remote-only) oraz account-retention/write-lock (max zasięg, ślad 2 commitów w jeden dzień). 🟡: ciche sprzężenie interwałów Leitnera przez granicę klient↔serwer; ścieżki błędu OpenRouter („wyglądają słabo pokryte — do weryfikacji"); CI nie bramkuje `main` (workflow na `master`) (źródło: `repo-map.md` §4).
5. **Self-perception vs evidence:** właściciel uważał AI za sedno i ryzyko za OpenRouter+Supabase; dowód pokazał, że AI jest peryferyjny i najłatwiej wymienialny, a niedoceniane ryzyko to retention write-lock i sprzężenie Leitnera (źródło: `self-vs-evidence.md` §1–§3). Dominujące ryzyko jest **wiedzowe** (bus factor 1, „dlaczego" w wygasłych sesjach AI), nie strukturalne (źródło: `repo-map.md` §1, §5).

## 3. Analiza feature z L3 — account-retention / write-lock

- **Przepływ:** write-lock / read-only dla wszystkich mutujących operacji (cards, generations, reviews, account). Wybrany z mapy jako 🔴 „max zasięg, min śladu" — strefa, którą `self-vs-evidence.md` §4 wskazał jako niedoceniane ryzyko (źródło: `account-retention-write-lock/research.md` Research Question + `repo-map.md` §4).
- **Feature overview:** input to każdy mutujący HTTP request; stan `locals.isReadOnly` liczony **raz** w `middleware.ts:18-40` (PK-lookup `account_deletion_requests`, `isReadOnly = !!row`, **fail-closed** na błędzie DB); blokada to `readOnlyGuard` → **403 `account_read_only`** wpięty ręcznie w 7 call-site'ów (6 plików) tuż po sprawdzeniu usera; `cancel`/`delete` celowo omijają strażnika (escape hatch zarządzający stanem) (źródło: `research.md` §A–§D, §1; weryfikacja ast-grep §I S1–S3).
- **Technical debt (prawdziwy):**
  1. **Warstwa obliczeniowa `middleware.ts` ma zero pokrycia testami** — guardrail chroni tylko *umieszczenie* strażnika na sfałszowanym `locals`, nie *poprawność* obliczenia `isReadOnly` (źródło: `research.md` §2.2, §F).
  2. **Detekcja „zapomnianego strażnika" jest pozorna** — tabela `writeRoutes` jest ręczna, brak skanu FS (kontrast z `no-service-role-in-src.test.ts`). Potwierdzone: brak `context.request.method` w middleware, egzekucja „hand-wired" w 7 miejscach bez interceptora (źródło: `research.md` §2.1; ast-grep T6/S2, `refactor-opportunities/research.md` T6).
  3. **Martwa polityka RLS `account_deletion_requests_update_own`** — `FOR UPDATE TO authenticated` żyje, a kod nigdy nie robi `.update()` (1 INSERT, 2 SELECT, 1 DELETE — zero UPDATE). To **realny bypass autoryzacji**, nie tylko martwy kod (źródło: `research.md` §2 D7; ast-grep T4; potwierdzone niezależnie `refactor-opportunities/research.md` T4/T5).
- **Pozornie groźne, faktycznie nie-dług:** stan po stronie handlerów jest **spójny i poprawny** — wszystkie 7 endpointów wołają strażnika *przed* zapisem w identycznej kolejności; dwa niestrzeżone (`cancel`/`delete`) pomijają go celowo i z komentarzem. OpenRouter strukturalnie *najbezpieczniejszy* (fan-in produkcyjny 1). To nie luka — to świadoma izolacja (źródło: `research.md` Summary, §D, §I S7).

## 4. Plan refaktoru z L4

* **Co:** L4 przekształciła dług z L3 w ranking możliwych zmian. Wybrano **C3 — usunięcie martwej polityki RLS `account_deletion_requests_update_own`**, bo miała najlepszy stosunek ryzyka do kosztu: zamykała możliwość single-step UPDATE własnego `retention_until`, miała mały blast radius i była odwracalna.

* **Docelowy kształt:** `account_deletion_requests` pozostaje tabelą lifecycle dla usuwania konta, ale bez polityki `FOR UPDATE`. Aplikacja nadal używa `INSERT`, `SELECT` i `DELETE`; brak ścieżki aplikacyjnej dla `UPDATE` zostaje odzwierciedlony w RLS.

* **Czego świadomie NIE robimy:** nie centralizujemy jeszcze write-locka (**C1**), nie ruszamy kopii błędów/UI fallbacków (**C2**), nie rozstrzygamy definicji „pending” po `retention_until` (**C4**, decyzja produktowa), i nie domykamy w tym planie rezydualnego wektora `DELETE+INSERT`. Plan świadomie zamyka tylko single-step UPDATE, a nie cały immutable-window na poziomie DB.

* **Fazy i weryfikacja:**

  1. **Baseline:** potwierdzić istniejącą politykę i odtworzyć udany PATCH przed zmianą — ręcznie/empirycznie + lint/build.
  2. **Migracja:** dodać i zaaplikować `drop policy if exists` na remote Supabase — ręcznie na remote + lint/build.
  3. **Weryfikacja:** ten sam PATCH ma zwrócić 403/permission denied, a delete/cancel mają dalej działać — ręcznie/empirycznie + lint/build.

* **Wniosek z plan-review:** zwycięstwo zostało celowo ograniczone. C3 usuwa realny, tani do zamknięcia bypass UPDATE, ale nie udaje pełnego rozwiązania wszystkich problemów write-locka; `DELETE+INSERT` i automatyczny guard dla przyszłych endpointów zostają jako follow-up.

## 5. Domena wg DDD z L5

- **Ubiquitous language (kluczowe):** Card (`status` draft→saved), Candidate/Accept-Reject (wedge produktu — ręczna kuratela kandydatów AI), Spaced-Repetition Schedule (Leitner, boxy `[1,2,4,7,15,30]`), Read-only Lock / Account Deletion Request, Atomic finalize (`finalize_drafts`) (źródło: `01-domain-distillation.md` KROK 1–2).
- **Najważniejsze rozjazdy model-vs-kod:** **R3** — „karta `saved` zawsze ma `next_due_at`" deklarowane, ale kolumna jest **nullable**, niezmiennik trzymany proceduralnie w 3 ścieżkach zapisu; karta `saved` bez daty cicho wypada z review (fail-silent). **R4** — read-only lock to reguła *konta*, a egzekwowana jako powtórzony guard w 6+ handlerach, nie w RLS (źródło: `01-domain-distillation.md` KROK 4 R3/R4).
- **Niezmiennik #1 i agregat:** **I1 — `status='saved' ⇒ next_due_at IS NOT NULL`**, należy do **agregatu Card**. Wybrany bo jednocześnie najbardziej rdzeniowy (SR lifecycle = Secondary Success Criterion, `prd.md:38`) i najsłabiej egzekwowany (nullable, brak CHECK). Rekomendacja: CHECK `cards_saved_has_due` na granicy danych; manual probe 2026-06-19 zwrócił **0** wierszy łamiących regułę (źródło: `02-invariant-aggregate-refactor.md` KROK 2, KROK 4, Warstwa 1).
- **Anti-Corruption Layer:** przeciekająca zależność #1 to **Supabase** — przecieka przez **3 warstwy** (UI `.astro` + middleware + każdy handler API), 19 plików / 14 produkcyjnych; typ biblioteki `User` w kontrakcie `App.Locals` (`env.d.ts:3`), fluent-query i `.rpc` budowane w warstwie widoku, idiom `23505`/`overrideTypes` zduplikowany. Sens ACL tu **nie** jest porzucenie Supabase (RLS to fundament izolacji), lecz **zatrzymanie wycieku persystencji do UI i kontraktu** — jeden punkt wiedzy o kształcie zapytań, typ domenowy zamiast `@supabase` User. OpenRouter świadomie pominięty — już odizolowany (1 plik, własny port + typ błędu) (źródło: `03-anti-corruption-layer.md` KROK 1–2, KROK 4).

## 6. Decyzje, które należą do mnie

AI/agent pomógł odkryć strukturę: fan-in, blast radius, rozjazdy model-vs-kod oraz miejsca potwierdzone grepem/ast-grepem. Po mojej stronie jako maintainera zostało rozstrzygnięcie zakresu: w L4 akceptuję ograniczony refaktor C3, który zamyka single-step UPDATE, ale nie udaje pełnego rozwiązania `DELETE+INSERT` ani centralizacji write-locka. Po mojej stronie zostaje też decyzja produktowa C4, czyli czy read-only ma kończyć się po `retention_until`, oraz decyzja, że część weryfikacji przy remote-only Supabase musi być ręczna/empiryczna. W L5 akceptuję I1 jako najważniejszy niezmiennik domenowy oraz Supabase jako największy ACL smell, mimo że OpenRouter był bardziej oczywistym podejrzeniem. Tych decyzji nie deleguję w całości do AI, bo zależą od intencji produktu, progu ryzyka i odpowiedzialności za niezmienniki.

---
*Źródła: `context/map/{repo-map,self-vs-evidence,artifact-1/2/3}.md`; `context/changes/account-retention-write-lock/research.md`; `context/changes/refactor-opportunities/{change,research,plan,plan-brief}.md`; `context/domain/{01,02,03}*.md`; bezpośredni odczyt `package.json`, `src/`, `supabase/migrations/`, `wrangler.jsonc`.*
