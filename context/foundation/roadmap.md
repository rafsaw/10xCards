---
project: 10xCards
version: 2
status: active
created: 2026-05-26
updated: 2026-06-01
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Powstała z `context/foundation/prd.md` (v1) + auto-researched baseline kodu (2026-05-26, potwierdzony 2026-05-27).
> v2 restruktryzuje pętlę przechwytywania kart (split S-01 → S-01 draft + S-02 atomic save) i dodaje stream compliance (S-05). Wersja poprzednia: `context/foundation/archive/2026-05-27-roadmap.md`.
> Edytuj in-place; archiwizuj gdy zdezaktualizowana.
> Slice'y poniżej są ułożone w kolejności zależności. Tabela "At a glance" jest indeksem.

## Vision recap

Samouk-technik czyta gęsty materiał (AI, software engineering) i chce zachować wiedzę w spaced repetition, ale ręczne pisanie kart Q/A w trakcie czytania przerywa flow wystarczająco mocno, żeby to pomijał. AI może zdjąć tę friction — pod warunkiem, że człowiek pozostaje autorytetem decydującym, co trafia do talii.

Wedge produktu — jedna cecha, której odjęcie sprawia, że produkt staje się nieodróżnialny od generycznego "AI wrzuca karty do decka" — to ręczne akceptuj-lub-odrzuć każdego kandydata wygenerowanego przez AI, zanim wyląduje w bibliotece użytkownika. v1 jest wielo-użytkownikową aplikacją web z twardą izolacją danych per user, mimo że dzień pierwszy obsługuje wyłącznie autora w trybie dogfood — tak żeby wielo-użytkownikowość była wbudowana, a nie doszywana.

## North star

✅ **OSIĄGNIĘTY 2026-05-30** — S-02 wdrożony i zamknięty (#8 CLOSED), cały łańcuch Stream A (F-01 → S-01 → S-02) wylądował. Ścieżka *zaloguj → wklej → wygeneruj → zaakceptuj → zapisz* jest przechodnia end-to-end na produkcji.

**S-02: użytkownik atomowo zapisuje wybranych kandydatów AI do swojego decka** — to validation milestone (kamień walidacji) dowodzący PRD Primary Success Criterion: AI-curated karty stają się trwałą biblioteką, której użytkownik świadomie używa zamiast manualnego pisania. Pętla powtórek (S-04) domyka secondary criterion, ale schodzi pod north star, bo wymaga rozstrzygnięć z lekcji o `/10x-research`.

> "North star" oznacza tu najmniejszy slice end-to-end, którego dostarczenie udowadnia główną tezę produktu — umieszczony tak wcześnie, jak pozwalają Prerequisites, bo cała reszta ma sens dopiero, gdy on działa. Auth i deploy są już wdrożone (patrz `## Baseline`), więc po wylądowaniu S-02 ścieżka *zaloguj → wklej → wygeneruj → zaakceptuj → zapisz* jest przechodnia end-to-end.

## At a glance

| ID    | Change ID                          | Outcome (użytkownik może …)                                                                                                                                  | Prerequisites    | PRD refs                                       | Status   |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------- | -------- |
| F-01  | cards-schema-and-rls               | (foundation) schema kart (z polem `status` rozróżniającym draft / saved) + soft-delete na koncie + RLS izolujące dane każdego użytkownika                  | —                | Access Control, NFR (izolacja), Guardrails     | done     |
| S-01  | first-gated-generation             | wkleić fragment tekstu i zobaczyć karty-kandydatów z AI zapisane jako draft w bazie (gated UI accept/reject, ale finalizacja w S-02)                       | F-01             | US-01 (część), FR-004, FR-005, FR-008          | done     |
| S-02  | atomic-save-to-deck                | atomowo zaakceptować wybranych draftów (status → saved) i odrzucić resztę (hard-delete draftów), kończąc cykl AI capture (north star)                       | F-01, S-01       | US-01 (część), FR-006, FR-007                  | done     |
| S-03  | deck-edit-delete                   | utworzyć ręcznie kartę (front+back), przeglądać bibliotekę zapisanych kart, edytować front/back, na twardo skasować kartę                                  | F-01             | US-03, FR-009, FR-010, FR-011, FR-012          | done     |
| S-04  | srs-review-session                 | rozpocząć sesję powtórek SRS, oceniać due karty jako dobrze/źle, daty kolejnej powtórki utrwalają się między sesjami                                        | F-01, S-02       | US-02, FR-013, FR-014, FR-015                  | done     |
| S-05  | account-deletion-with-retention    | zażądać usunięcia konta; konto wchodzi w 30-dniową retencję (logowanie blokowane, możliwa kancelacja), po retencji dane twardo usuwane                      | F-01             | **brak — wymaga update PRD**                   | blocked  |

## Streams

Pomoc nawigacyjna — grupuje elementy dzielące łańcuch Prerequisites. Kanoniczna kolejność wciąż żyje w grafie zależności poniżej; ta tabela to proponowana kolejność czytania równoległych torów. Przy `top_blocker: time` praca równoległa ma znaczenie: różne wieczory mogą posuwać różne strumienie.

| Stream | Theme                            | Chain                          | Note                                                                                                                                                |
| ------ | -------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Pętla AI capture (north-star)    | `F-01` → `S-01` → `S-02`       | ✅ **Domknięty 2026-05-30** — F-01/S-01/S-02 wszystkie `done`. North star osiągnięty.                                                              |
| B      | Biblioteka kart (manualna + CRUD) | `S-03`                         | ✅ **Domknięty 2026-06-01** — `S-03` `done`. Manual create + browse + edit + hard-delete na `/library`. Pokrywa FR-009/010/011/012.                  |
| C      | Pętla powtórek (research-pending) | `S-04`                         | ✅ **Domknięty 2026-05-31** — `S-04` `done`. Model SR rozstrzygnięty (Leitner, `/10x-research`); review loop + harmonogram utrwalony.              |
| D      | Lifecycle konta / compliance      | `S-05`                         | Branches z `F-01`. Aktualnie zablokowany na update PRD (brak FR dla account deletion + retention) — patrz Open Roadmap Questions.                  |

## Baseline

Co jest już w kodzie na 2026-05-26 (zinwentaryzowane automatycznie + potwierdzone przez użytkownika).
Foundations poniżej zakładają obecność poniższych warstw i NIE budują ich na nowo.

- **Frontend:** obecny — Astro 6 + React 19 + Tailwind 4; routing plikowy w `src/pages/`; komponenty auth w `src/components/auth/`; prymitywy UI w `src/components/ui/`.
- **Backend / API:** częściowy — istnieją tylko `src/pages/api/auth/{signin,signup,signout}.ts`. Endpointy dla kart / generacji / powtórek / account-deletion nieobecne.
- **Dane:** częściowe — klient Supabase podłączony (`@supabase/ssr`, `@supabase/supabase-js`); zmienne env (`SUPABASE_URL` / `SUPABASE_KEY`) typowane (per `astro.config.mjs`). Brak schematu, brak migracji, brak tabel kart. `supabase/config.toml` ma migracje wyłączone.
- **Auth:** obecny — rejestracja, logowanie, wylogowanie i potwierdzenie e-mail działają na produkcji (`https://10x-cards.rafsaw.workers.dev`); `src/middleware.ts` wymusza ochronę `/dashboard` przez sesję Supabase. **Pokrywa FR-001 (rejestracja), FR-002 (logowanie), FR-003 (wylogowanie)** — żaden slice ich nie odbudowuje.
- **Deploy / infra:** obecny — Cloudflare Workers przez `@astrojs/cloudflare` v13.5; `wrangler.jsonc` z `nodejs_compat` + `compatibility_date: 2026-05-08`; auto-deploy z gałęzi `main` przez Cloudflare Workers Builds; `wrangler rollback` przećwiczony (patrz `context/deployment/deploy-plan.md` §Phase 6).
- **Observability:** częściowa — blok observability w `wrangler.jsonc` włączony (linie 12–14); free-plan Workers Logs trzyma logi ~3 dni. Brak Sentry / OTel / zewnętrznego error trackingu.

## Foundations

### F-01: Schemat kart + RLS + soft-delete konta

- **Outcome:** (foundation) istnieje tabela `cards` z właścicielem per-user (`user_id` jako FK do `auth.users`), polem `status` rozróżniającym draft (kandydat wygenerowany przez AI, niefinalizowany) od saved (karta w bibliotece), polami front/back i polami harmonogramu wymaganymi przez prosty model SR; istnieje mechanizm soft-delete na poziomie konta (flaga + `retention_until` na rekordzie usera lub osobnej tabeli `account_deletion`) potrzebny przez S-05; polityki Row-Level Security sprawiają, że każdy odczyt i zapis wiersza, którego `user_id` różni się od zalogowanego użytkownika, kończy się błędem. Izolacja cross-user jest wymuszana w bazie danych, nie tylko w warstwie aplikacji.
- **Change ID:** `cards-schema-and-rls`
- **PRD refs:** Access Control (izolacja per-user, brak admina, brak sharingu), NFR ("no path through the product surfaces another user's data, ever"), Guardrails ("cross-user data leakage is ship-blocking even if everything else works")
- **Unlocks:** S-01 (zapisuje drafty z `status=draft`), S-02 (atomowy promote draftów na `status=saved` + delete odrzuconych), S-03 (manual insert z `status=saved` + browse/edit/delete), S-04 (czyta saved + aktualizuje harmonogram), S-05 (soft-delete + hard-delete po retencji). Również redukuje ship-blocking Unknown dotyczący izolacji cross-user — gdy RLS trzyma na poziomie DB, każdy kolejny slice dziedziczy gwarancję bez ponownego dowodu.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy soft-delete konta projektować jako flagę na profilu Supabase usera (admin API), kolumnę w osobnej tabeli `account_deletion_requests`, czy całkiem inny model. — Owner: TBD. Block: no (rozstrzygnięte w `/10x-plan`, gdy S-05 odblokowane przez PRD update).
- **Risk:** Źle skonfigurowana polityka RLS przy choćby jednej tabeli/operacji w cichy sposób przecieka dane między userami — a PRD §Guardrails nazywa to wprost ship-blocking. Sekwencjonowane jako pierwsze, bo każdy inny slice zapisuje lub czyta karty; zrobienie RLS dobrze raz na poziomie DB jest tańsze niż weryfikacja izolacji per slice. Wbudowanie `status` i mechanizmu soft-delete od początku jest tańsze niż dwie migracje rozszerzające schemat w środku roadmapy.
- **Status:** done (issue #6 zamknięty 2026-05-28; change `impl_reviewed`, czeka na `/10x-archive`)

## Slices

### S-01: Pierwsza gated generacja — drafty w bazie

- **Outcome:** zalogowany użytkownik wkleja fragment tekstu źródłowego, aplikacja zwraca zestaw kart-kandydatów (front/back) **zapisanych jako `status=draft` w tabeli `cards`**, użytkownik widzi listę kandydatów w UI. Stan jest trwały (po refreshu / awarii drafty wciąż widoczne dla tego usera), ale jeszcze nie są one częścią biblioteki — accept/reject finalizuje się w S-02. Slice dowodzi że pętla *paste → AI → render kandydatów* działa end-to-end i że PRD FR-008 (retry bez re-paste) jest spełniony przez trwałość draftów.
- **Change ID:** `first-gated-generation`
- **PRD refs:** US-01 (Given/When części generation + display), FR-004 (paste + trigger generation), FR-005 (view candidates with front/back), FR-008 (retry bez re-paste — gwarantowane przez DB persistence draftów)
- **Prerequisites:** F-01
- **Parallel with:** S-03, S-05 (po odblokowaniu)
- **Blockers:** —
- **Unknowns:**
  - Klucz OpenRouter (lub równoważny LLM gateway) jeszcze nie wpięty — `context/deployment/deploy-plan.md` §Out of scope wprost odracza `OPENROUTER_API_KEY` do momentu pojawienia się kodu AI. Trzeba `npx wrangler secret put OPENROUTER_API_KEY` + lokalny wpis w `.dev.vars` zanim ten slice ruszy end-to-end. — Owner: user. Block: no (drobny setup, nie blokuje planowania).
  - Wybór modelu LLM + sufit kosztowy per request. — Owner: TBD. Block: no (rozstrzygnięte w `/10x-plan`).
  - Polityka czyszczenia "wiszących" draftów (user wygenerował i porzucił bez wejścia w S-02). Czy są one widoczne przy kolejnym wejściu na dashboard, czy są TTL-owane. — Owner: TBD. Block: no.
- **Risk:** Trwałe drafty w bazie podnoszą koszt RLS-błędu — wyciek listy draftów innego usera jest takim samym ship-blockerem jak wyciek saved. Drugie ryzyko: jeśli S-02 nie wyląduje w krótkim okienku po S-01, user widzi szmugiel "wisz, się nie zapisuje" i pętla wygląda na zepsutą — to wzmacnia argument, że S-02 idzie zaraz po S-01 w tym samym Stream A.
- **Status:** done (issue #7 zamknięty 2026-05-28; change `impl_reviewed`, czeka na `/10x-archive`)

### S-02: Atomowy zapis do decka (north star)

- **Outcome:** użytkownik patrzy na listę draftów (z S-01), niezależnie zaznacza accept lub reject dla każdego, zatwierdza decyzję — operacja atomowa: zaakceptowani kandydaci dostają `status=saved` (wchodzą w SR lifecycle z initial due-date), odrzuceni są hard-deleted z tabeli. Albo wszystko się udaje, albo nic — bez stanu pośredniego ("połowicznie zapisane"). Po zakończeniu user wraca do dashboardu lub paste'uje kolejny fragment. Domyka pętlę AI capture; **to jest validation milestone PRD Primary Success Criterion**.
- **Change ID:** `atomic-save-to-deck`
- **PRD refs:** US-01 (Given/When części accept/reject + save), FR-006 (accept saves to library), FR-007 (reject discards bez save)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03 (S-03 zależy tylko od F-01, więc może iść osobnym torem; S-04 czeka na S-02 zanim ma co czytać)
- **Blockers:** —
- **Unknowns:**
  - Czy "atomic" wymaga DB-side transakcji, czy server-side guard + idempotency key wystarczy. — Owner: TBD. Block: no.
- **Risk:** Brak atomowości w accept/reject (np. accept zapisuje per-card w pętli, awaria w środku) zostawia połowiczny stan — niektóre karty saved, niektóre wciąż draft — i user nie wie, na co patrzy. Drugie ryzyko: granularność operacji na grupie 5–20 draftów może wymagać DB transaction albo batch UPSERT; obie ścieżki są realne, ale dobranie złej daje subtelne race condition gdy user otwiera dwie karty przeglądarki. PRD FR-006/007 obligują "saves to library" i "discards no save" jako wynik *każdej* operacji — atomic finalize jest kontraktem dla obu.
- **Status:** done (issue #8 zamknięty 2026-05-30; change `impl_reviewed`, czeka na `/10x-archive`)

### S-03: Biblioteka kart — ręczne tworzenie, przegląd, edycja, kasowanie

- **Outcome:** zalogowany użytkownik (a) otwiera formularz "Utwórz kartę", wpisuje niepusty front i back, zapisuje kartę bezpośrednio do biblioteki (status=saved, omijając ścieżkę AI); (b) przegląda listę swoich zapisanych kart; (c) edytuje front/back istniejącej karty; (d) na twardo kasuje kartę (bez soft-delete, bez undo per FR-012). Ręcznie utworzona karta wchodzi w SR lifecycle tak samo jak karta zaakceptowana z AI w S-02. Slice jest niezależny od pętli AI — wystarczy F-01, by go uruchomić; nie wymaga żadnych istniejących saved kart, bo manual create jako pierwsze działanie też ma sens.
- **Change ID:** `deck-edit-delete`
- **PRD refs:** US-03, FR-009 (manual create), FR-010 (browse list), FR-011 (edit front/back), FR-012 (hard delete)
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-05 (po odblokowaniu)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kasowanie jest hard-delete per FR-012 — przypadkowe skasowanie niszczy postęp nauki bez odzyskania. UI musi wystawiać jednoznaczny krok potwierdzenia (PRD FR-012 Socratic dopuszcza confirm step bez rozszerzania zakresu). Drugie ryzyko: manual create + edit + delete + browse to czterokrotne wystawienie tej samej powierzchni dostępu do `cards` — każdy z tych endpointów musi iść przez user-scoped klienta Supabase, inaczej RLS z F-01 nie trzyma. Trzecie: scope crepe — łatwo "skoro już jesteśmy w bibliotece, dodajmy filtry/sortowanie". Trzymać się PRD FR-010 (lista, kropka).
- **Status:** done (zaimplementowany 2026-06-01, 3 fazy: API mutacji + `/library` + inline edit/delete — `665925b`; archived 2026-06-01 → `context/archive/2026-06-01-deck-edit-delete/`; trackery #9 / RAF-13)

### S-04: Sesja powtórek SRS

- **Outcome:** zalogowany użytkownik rozpoczyna sesję powtórek, widzi karty due (status=saved + next_due ≤ now) jeden po drugim, odsłania back, ocenia recall binarnie jako "dobrze" lub "źle" (per FR-014), a data kolejnej powtórki karty się aktualizuje wg prostego modelu SR i jest trwała między sesjami. Sesja trwa aż wszystkie due karty zostaną zrecenzowane lub user wyjdzie. Domyka PRD Secondary Success Criterion (review reliable end-to-end).
- **Change ID:** `srs-review-session`
- **PRD refs:** US-02, FR-013, FR-014, FR-015
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-03, S-05 (po odblokowaniu)
- **Blockers:** —
- **Unknowns:**
  - Konkretna formuła harmonogramowania dla prostego modelu — boxy Leitnera, fixed multipliers, simple Anki-like — i mapowanie binarnego right/wrong na zmianę interwału. PRD §Non-Goals zabrania zaawansowanej optymalizacji; *co* dokładnie to "prosty model" wymaga rozstrzygnięcia. **Planowana ścieżka rozstrzygnięcia: `/10x-research` z następnej lekcji.** — Owner: user. Block: no (formalnie planning może iść z arbitralnym prostym wyborem, ale świadomie czekam na research żeby wybór był informed).
- **Risk:** Wyrafinowane algorytmy SR są explicit non-goal — ryzyko leży po stronie over-engineeringu, nie under-engineeringu. PRD Guardrails definiują kontrakt fallbacku: gdy podstawowa logika wyboru due-card zawiedzie z dowolnego powodu, sesja spada na "najstarsza due-card pierwsza". Drugie ryzyko: bez S-04 PRD Secondary Success Criterion jest nieweryfikowalny — ale north star (S-02) już lokuje walidację Primary, więc S-04 może świadomie poczekać na research bez blokowania całej roadmapy.
- **Status:** done (zarchiwizowany 2026-05-31 → `context/archive/2026-05-30-srs-review-session/`)

### S-05: Usunięcie konta z 30-dniową retencją

- **Outcome:** zalogowany użytkownik znajduje akcję "Usuń konto" w settings, potwierdza decyzję, konto wchodzi w stan `pending_deletion` z `retention_until = now + 30 dni`. W tym oknie: logowanie jest blokowane (z komunikatem "konto w trakcie usuwania, klik aby anulować") + user może anulować jednym kliknięciem (np. przez special token w mailu lub re-login flow), co przywraca konto. Po 30 dniach: hard-delete wszystkich kart usera (cascade z RLS) + usunięcie samego konta z `auth.users`. Mechanizm cron / scheduled task wykonuje hard-delete (Cloudflare Workers Cron Triggers lub Supabase pg_cron).
- **Change ID:** `account-deletion-with-retention`
- **PRD refs:** **BRAK** — PRD v1 nie zawiera FR dla account deletion ani retention policy. Slice wymaga update PRD (proponowane FR-016: User can request account deletion; FR-017: Deletion enters 30-day retention before hard delete; FR-018: User can cancel deletion during retention). Patrz Open Roadmap Question #2.
- **Prerequisites:** F-01 (soft-delete mechanizm + cron lub scheduled job to PRD-pending decyzje, ale schemat już je wspiera)
- **Parallel with:** S-01, S-02, S-03, S-04 (po odblokowaniu PRD)
- **Blockers:** PRD update — brak FR dla account deletion + retention. Slice nie może iść do `/10x-plan` z `PRD refs: brak`.
- **Unknowns:**
  - Co dokładnie "30-day retention" obejmuje: czy user może w tym oknie się zalogować i zobaczyć swoje dane (read-only), czy logowanie zablokowane całkowicie + tylko email-link do anulowania. — Owner: user. Block: yes (definiuje UX i powierzchnię auth).
  - Mechanizm scheduled hard-delete: Cloudflare Workers Cron Triggers (jeden cron dla całej aplikacji, codziennie sweepuje due deletions) vs Supabase pg_cron (DB-side, mniej ruchomych części) vs ręczny worker uruchamiany manualnie. — Owner: TBD. Block: no (rozstrzygnięcie w `/10x-plan` po odblokowaniu PRD).
  - Czy w okresie retencji wymagana jest jakaś forma notyfikacji (np. mail "twoje konto zostanie skasowane za X dni"). — Owner: user. Block: no (nice-to-have).
- **Risk:** Bug w cron / scheduled hard-delete = albo dane zostają na zawsze (user nie został skasowany, mimo prośby — naruszenie obietnicy / potencjalnie regulacyjne), albo dane skasowane przedwcześnie (user nie może anulować). Drugie ryzyko: scope creep — "skoro robimy retention, dorzućmy export danych przed kasowaniem" → to osobna decyzja, osobny FR, osobny slice. Trzecie: bez tracingu w PRD nie wiadomo, co dokładnie jest must-have, a co nice-to-have; planowanie ślepe jest gorsze niż żadne.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                                                | Ready for `/10x-plan` | Notes                                                                  |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------- |
| F-01       | cards-schema-and-rls               | Schemat kart (z draft status) + soft-delete konta + polityki RLS                     | — (done)              | ✅ done — #6 zamknięty 2026-05-28                                       |
| S-01       | first-gated-generation             | Pierwsza gated generacja AI — kandydaci zapisywani jako drafty                       | — (done)              | ✅ done — #7 zamknięty 2026-05-28                                       |
| S-02       | atomic-save-to-deck                | Atomowy accept/reject draftów (north star — domyka PRD Primary Success Criterion)    | — (done)              | ✅ done — #8 zamknięty 2026-05-30 (north star)                          |
| S-03       | deck-edit-delete                   | Biblioteka kart: manual create + browse + edit + hard-delete                         | — (done)              | ✅ done — zaimplementowany 2026-06-01 (`665925b`); change `impl_reviewed` |
| S-04       | srs-review-session                 | Sesja powtórek SRS                                                                   | yes (done)            | ✅ done — review loop + Leitner scheduler (c784b2d); change zaimplementowany 2026-05-31 |
| S-05       | account-deletion-with-retention    | Usunięcie konta z 30-dniową retencją                                                 | no                    | **Zablokowane na update PRD** — brak FR dla account deletion           |

## Open Roadmap Questions

1. **Czy podczas MVP będą się rejestrować realni (nie-autor) użytkownicy, czy v1 to ściśle dogfood autora?** Per `context/deployment/deploy-plan.md` lessons, Supabase free-tier shared SMTP ma cap ~3–4 mailów potwierdzających na godzinę — w porządku do dogfood, łamie się przy jakimkolwiek realnym ruchu rejestracyjnym. Jeśli realni użytkownicy mają się rejestrować przed zamknięciem v1, własne SMTP (Resend / SendGrid / SES) staje się twardym prerequisitem launchu. — Owner: user. Block: roadmap-wide (dotyka gotowości do launchu, nie planów per slice).

2. **PRD nie ma FR dla account deletion + retention, a S-05 ich wymaga.** Slice S-05 jest invented względem PRD v1 (Roadmap guardrail: każdy slice traceuje do PRD ID). Proponowane FR do dodania: FR-016 (user can request account deletion), FR-017 (deletion enters 30-day retention before hard delete), FR-018 (user can cancel deletion during retention). Decyzje do podjęcia w PRD: czy retention to read-only-locked czy całkowicie zablokowane logowanie; czy anulowanie wymaga magic-link maila czy re-login wystarczy; czy potrzebna jest notyfikacja przed hard-delete. Po update'cie PRD do v2: status S-05 → `proposed`, `PRD refs` wypełnione, slice gotowy do `/10x-plan`. — Owner: user. Block: S-05.

3. ✅ **ROZSTRZYGNIĘTE (S-02 wdrożony 2026-05-30, #8).** Rozstrzygnięcie i uzasadnienie w `context/changes/atomic-save-to-deck/` (plan + impl review). — Czy "atomic" w S-02 oznacza DB transakcję, czy server-side guard wystarczy? Słowo "atomic" jest celowo użyte w S-02 — PRD FR-006/007 wymagają, by każdy kandydat skończył albo jako saved albo jako discarded, bez stanu pośredniego. Czy ta gwarancja jest zapewniana przez DB transaction (jeden BEGIN/COMMIT obejmujący wszystkie UPDATE/DELETE), czy przez batch + idempotency-key + reconciliation, jest decyzją architektoniczną dla `/10x-plan` — ale warto rozstrzygnąć ją *przed* startem S-02, żeby uniknąć refactoru w środku. — Owner: TBD. Block: S-02 (technically), no (formally — `/10x-plan` może rozstrzygnąć).

## Parked

- **Zaawansowana inżynieria algorytmu spaced repetition** — PRD §Non-Goals: v1 używa celowo prostego modelu harmonogramowania; sofistykacja to dźwignia na v2.
- **Wielo-formatowy import (PDF, DOCX, EPUB, web URL-e)** — PRD §Non-Goals: w v1 wyłącznie wklejanie czystego tekstu.
- **Współdzielenie kart lub talii między użytkownikami** — PRD §Non-Goals: single-tenant per user; wprost zamyka funkcje społecznościowe / zespołowe.
- **Natywne aplikacje mobilne (iOS, Android)** — PRD §Non-Goals: tylko web. Użyteczność na mobilnej przeglądarce w zakresie jako baseline (per NFR), ale bez natywnych shelli.
- **Reset hasła i flow weryfikacji e-mail** — PRD §Non-Goals: w v1 auth ograniczone do signup / login / logout / session handling. Tylko ręczne recovery.
- **Integracje z innymi platformami (Anki export, Quizlet sync, LMS)** — PRD §Non-Goals: produkt samowystarczalny.
- **Edycja kandydatów z AI przed zapisem** — PRD §Non-Goals: kandydaci są tylko accept-or-reject; refinement dzieje się po zapisie przez surface edycji z FR-011.
- **Eksport własnych danych przed kasowaniem konta** — Naturalne rozszerzenie S-05, ale wymaga osobnego FR w PRD i osobnego slice'a. Świadomie parkuje, by S-05 nie urósł.
- **Notyfikacja mailowa o nadchodzącym hard-delete (S-05)** — Nice-to-have w okresie retencji; rozstrzygnięcie po update PRD.
- **Custom SMTP w Supabase** — Wymagane dla jakichkolwiek niezerowych rejestracji nie-autora (per lekcja SMTP rate-limit w deploy-plan). Odroczone pod `main_goal: speed`; pojawia się w Open Roadmap Question #1.
- **Sentry / zewnętrzny error tracking** — Wbudowana observability Cloudflare Workers + `wrangler tail` wystarcza do solo dogfoodu; odroczyć aż pojawią się realni użytkownicy uzasadniający dodatkowy surface.
- **Gate CI w GitHub Actions** — `.github/workflows/ci.yml` triggeruje wyłącznie na `master` (gałąź robocza to `main`), więc CI obecnie nie chodzi. Per AGENTS.md Agent Tripwires jest to znane i akceptowane; lint + build odpalamy lokalnie. Wrócić, jeśli zechcemy pre-deploy gate.

## Done

- **S-04: rozpocząć sesję powtórek SRS, oceniać due karty jako dobrze/źle, daty kolejnej powtórki utrwalają się między sesjami** — Archived 2026-05-31 → `context/archive/2026-05-30-srs-review-session/`. Lesson: —.
- **S-03: utworzyć ręcznie kartę (front+back), przeglądać bibliotekę zapisanych kart, edytować front/back, na twardo skasować kartę** — Archived 2026-06-01 → `context/archive/2026-06-01-deck-edit-delete/`. Lesson: —.
